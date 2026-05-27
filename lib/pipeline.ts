// lib/pipeline.ts
// Photo processing pipeline: download from Drive, generate thumbnails, approve,
// and index faces via the ArcFace Python microservice.
import { db, photos, photoFaceEmbeddings, processingJobs } from "@/lib/db";
import { and, eq, isNull, sql, count } from "drizzle-orm";
import { downloadFileBuffer } from "./drive";
import { uploadToR2 } from "./r2";
import { extractFaces } from "./faceApi";

/**
 * Trigger processing job for an event (queues it if not already running).
 */
export async function triggerProcessing(eventId: string): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.eventId, eventId),
          sql`${processingJobs.status} IN ('queued', 'running')`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[PIPELINE] Job already exists for event ${eventId}, skipping queue`);
      return;
    }

    await db.insert(processingJobs).values({
      id: crypto.randomUUID(),
      eventId,
      status: "queued",
      createdAt: new Date(),
    });
    console.log(`[PIPELINE] Queued processing job for event ${eventId}`);

    // In local dev environments, run the processing job immediately in the background
    if (process.env.VERCEL !== "1") {
      (async () => {
        console.log(`[PIPELINE] Local environment detected. Starting background processing loop for event ${eventId}...`);
        try {
          // Set job to running in DB
          await db
            .update(processingJobs)
            .set({ status: "running", startedAt: new Date() })
            .where(
              and(
                eq(processingJobs.eventId, eventId),
                eq(processingJobs.status, "queued")
              )
            );

          let hasMore = true;
          while (hasMore) {
            const { processed, remaining } = await processPhotoBatch(eventId, 10);
            console.log(`[PIPELINE] Processed ${processed} photos. Remaining: ${remaining}`);
            hasMore = remaining > 0 && processed > 0;
          }

          // Set job to done in DB
          await db
            .update(processingJobs)
            .set({ status: "done", doneAt: new Date() })
            .where(
              and(
                eq(processingJobs.eventId, eventId),
                eq(processingJobs.status, "running")
              )
            );
          console.log(`[PIPELINE] Background processing loop finished for event ${eventId}.`);
        } catch (err) {
          console.error(`[PIPELINE] Error in local background processing loop:`, err);
          // Set job to error
          await db
            .update(processingJobs)
            .set({ status: "error", doneAt: new Date() })
            .where(
              and(
                eq(processingJobs.eventId, eventId),
                eq(processingJobs.status, "running")
              )
            );
        }
      })();
    }
  } catch (err) {
    console.error("[PIPELINE] Failed to trigger processing:", err);
  }
}

/**
 * @deprecated Use triggerProcessing instead.
 */
export const triggerQualityFilter = triggerProcessing;

/**
 * Process a batch of pending photos:
 * 1. Download from Drive
 * 2. Generate thumbnails (800px + 400px) → upload R2
 * 3. Set status = 'approved' immediately (no quality filter)
 * 4. Detect faces → insert face embeddings for Face Search
 */
export async function processPhotoBatch(
  eventId: string,
  batchSize: number
): Promise<{ processed: number; remaining: number }> {
  // Fetch pending photos (no blurScore filter needed anymore)
  const pending = await db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.eventId, eventId),
        eq(photos.status, "pending")
      )
    )
    .limit(batchSize);

  let processed = 0;

  // Process in chunks of 15 concurrently to maximize network and CPU utilization
  const chunkSize = 15;
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (photo) => {
        try {
          console.log(`[PIPELINE] Processing photo ${photo.id} (${photo.filename})`);

          // 1. Download buffer from Google Drive
          let buffer: Buffer;
          try {
            buffer = await downloadFileBuffer(photo.driveFileId);
          } catch (err) {
            console.error(`[PIPELINE] Failed to download ${photo.driveFileId}:`, err);
            await db
              .update(photos)
              .set({ status: "rejected", rejectReason: "processing_error" })
              .where(eq(photos.id, photo.id));
            return;
          }

          if (buffer.length === 0) {
            console.warn(`[PIPELINE] Empty buffer for photo ${photo.id}, skipping`);
            await db
              .update(photos)
              .set({ status: "rejected", rejectReason: "processing_error" })
              .where(eq(photos.id, photo.id));
            return;
          }

          // 2. Generate thumbnails and upload to R2
          const sharp = (await import("sharp")).default;

          // Get image dimensions
          const meta = await sharp(buffer).metadata();
          const imgWidth = meta.width || null;
          const imgHeight = meta.height || null;

          const thumb800 = await sharp(buffer)
            .resize(800, null, { withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
          const thumb400 = await sharp(buffer)
            .resize(400, null, { withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();

          const key800 = `thumbnails/${photo.id}_800.jpg`;
          const key400 = `thumbnails/${photo.id}_400.jpg`;
          const thumbnailUrl = await uploadToR2(key800, thumb800, "image/jpeg");
          const thumbnailSm = await uploadToR2(key400, thumb400, "image/jpeg");

          // 3. Extract faces via ArcFace Python microservice (512-dim)
          let faces: Array<{ embedding: number[]; bbox: { x: number; y: number; w: number; h: number }; confidence: number }> = [];
          try {
            const result = await extractFaces(buffer, photo.filename);
            faces = result.faces;
          } catch (faceErr) {
            console.warn(`[PIPELINE] ArcFace extraction failed for ${photo.id}, continuing without embeddings:`, faceErr);
          }

          // 4. Mark as APPROVED (no quality rejection)
          await db
            .update(photos)
            .set({
              thumbnailUrl,
              thumbnailSm,
              width: imgWidth,
              height: imgHeight,
              faceCount: faces.length,
              status: "approved",
              rejectReason: null,
              processedAt: new Date(),
            })
            .where(eq(photos.id, photo.id));

          // 5. Insert ArcFace 512-dim embeddings for Face Search
          if (faces.length > 0) {
            await db.insert(photoFaceEmbeddings).values(
              faces.map((face, index: number) => ({
                id: crypto.randomUUID(),
                photoId: photo.id,
                embedding: face.embedding,     // number[512]
                faceIndex: index,
                bboxX: face.bbox?.x ?? null,
                bboxY: face.bbox?.y ?? null,
                bboxW: face.bbox?.w ?? null,
                bboxH: face.bbox?.h ?? null,
                confidence: face.confidence ?? null,
                model: "ArcFace",
              }))
            );
          }

          processed++;
          console.log(`[PIPELINE] ✅ Photo ${photo.id} approved (${faces.length} faces indexed)`);
        } catch (err) {
          console.error(`[PIPELINE] Failed to process photo ${photo.id}:`, err);
          try {
            await db
              .update(photos)
              .set({ status: "rejected", rejectReason: "processing_error" })
              .where(eq(photos.id, photo.id));
          } catch (dbErr) {
            console.error(`[PIPELINE] Failed to update error status for ${photo.id}:`, dbErr);
          }
        }
      })
    );
  }

  // Count remaining pending photos
  const remainingResult = await db
    .select({ count: count() })
    .from(photos)
    .where(
      and(
        eq(photos.eventId, eventId),
        eq(photos.status, "pending")
      )
    );

  const remaining = Number(remainingResult[0]?.count || 0);
  return { processed, remaining };
}
