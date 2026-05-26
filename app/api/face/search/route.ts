// app/api/face/search/route.ts
import { auth } from "@/lib/auth";
import { db, userFaceEmbeddings, filterConfig } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const searchSchema = z.object({
  // Single embedding (backward compat)
  embedding: z.array(z.number()).length(128).optional(),
  // Multiple embeddings (multi-capture average)
  embeddings: z.array(z.array(z.number()).length(128)).optional(),
  limit: z.number().int().positive().optional().default(60),
  threshold: z.number().min(0).max(1).optional(),
  seasonId: z.string().optional(),
  eventId: z.string().optional(),
  timeslot: z.string().optional(),
});

/**
 * Averages multiple embedding vectors into one representative vector.
 */
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 1) return embeddings[0];
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += emb[i];
  }
  return avg.map((v) => v / embeddings.length);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    const json = await req.json();
    const { embedding, embeddings, limit, threshold: reqThreshold, seasonId, eventId, timeslot } =
      searchSchema.parse(json);

    let queryEmbedding: number[];

    // Determine the query embedding
    if (embeddings && embeddings.length > 0) {
      // Multiple embeddings provided → average them for better accuracy
      queryEmbedding = averageEmbeddings(embeddings);
    } else if (embedding) {
      queryEmbedding = embedding;
    } else {
      // No embedding provided → use user's enrolled embedding
      const userId = session.user.id;
      if (!userId) {
        return NextResponse.json({ error: "ไม่พบรหัสผู้ใช้งานในระบบ" }, { status: 400 });
      }
      const userEmbed = await db
        .select()
        .from(userFaceEmbeddings)
        .where(eq(userFaceEmbeddings.userId, userId))
        .limit(1);

      if (userEmbed.length === 0) {
        return NextResponse.json(
          { error: "คุณยังไม่ได้สแกนใบหน้าเพื่อลงทะเบียน กรุณาลงทะเบียนใบหน้าก่อน" },
          { status: 400 }
        );
      }
      queryEmbedding = userEmbed[0].embedding;
    }

    // Determine similarity threshold
    // Default changed from 0.42 to 0.60 (Euclidean distance threshold)
    let threshold = reqThreshold;
    if (threshold === undefined) {
      const config = await db.select().from(filterConfig).where(eq(filterConfig.id, 1)).limit(1);
      threshold = config[0]?.faceSimilarityDist ?? 0.60;
    }

    const queryEmbeddingStr = `[${queryEmbedding.join(",")}]`;

    // Build WHERE clause — filter using Euclidean Distance (<->)
    let whereClause = sql`
      p.status = 'approved'
      AND pfe.confidence >= 0.4
      AND (pfe.embedding <-> ${queryEmbeddingStr}::vector) <= ${threshold}
    `;

    if (eventId && eventId !== "all" && eventId !== "null") {
      whereClause = sql`${whereClause} AND p.event_id = ${eventId}`;
    } else if (seasonId && seasonId !== "all" && seasonId !== "null") {
      whereClause = sql`${whereClause} AND p.season_id = ${seasonId}`;
    }

    if (timeslot && timeslot !== "all" && timeslot !== "null") {
      whereClause = sql`${whereClause} AND p.timeslot = ${timeslot}`;
    }

    // Euclidean distance search via pgvector, keeping Cosine Similarity for the score display
    const query = sql`
      SELECT
        pfe.photo_id as "photoId",
        pfe.face_index as "faceIndex",
        pfe.bbox_x as "bboxX",
        pfe.bbox_y as "bboxY",
        pfe.bbox_w as "bboxW",
        pfe.bbox_h as "bboxH",
        pfe.confidence as "confidence",
        (1 - (pfe.embedding <=> ${queryEmbeddingStr}::vector)) as "score",
        p.id as "id",
        p.event_id as "eventId",
        p.season_id as "seasonId",
        p.timeslot as "timeslot",
        p.drive_file_id as "driveFileId",
        p.drive_url as "driveUrl",
        p.thumbnail_url as "thumbnailUrl",
        p.thumbnail_sm as "thumbnailSm",
        p.filename as "filename",
        p.file_size as "fileSize",
        p.width as "width",
        p.height as "height",
        p.created_at as "createdAt"
      FROM photo_face_embeddings pfe
      JOIN photos p ON p.id = pfe.photo_id
      WHERE ${whereClause}
      ORDER BY pfe.embedding <-> ${queryEmbeddingStr}::vector ASC
      LIMIT ${limit}
    `;

    const results = await db.execute(query);
    const rows = results.rows || [];

    // Deduplicate photos by ID to prevent duplicate key warning on client
    const uniquePhotos: any[] = [];
    const seenIds = new Set<string>();
    for (const row of rows as any[]) {
      if (row && row.id && !seenIds.has(row.id)) {
        seenIds.add(row.id);
        uniquePhotos.push(row);
      }
    }

    return NextResponse.json({
      success: true,
      photos: uniquePhotos,
    });
  } catch (error: any) {
    if (error?.name === "ZodError" || error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Face search API error:", error);
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการค้นหาใบหน้า: ${error?.message || error}` }, { status: 500 });
  }
}
