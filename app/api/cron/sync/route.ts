import { createHash, timingSafeEqual } from "crypto";
import { db, events, photos } from "@/lib/db";
import { and, eq, isNotNull, inArray, sql } from "drizzle-orm";
import { getNewFilesFromFolder } from "@/lib/drive";
import { triggerQualityFilter } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron auth header
    const cronSecret = process.env.CRON_SECRET;

    // Critical Guard: Ensure CRON_SECRET is configured.
    // Without this guard, if CRON_SECRET is undefined, the check would validate
    // against "Bearer undefined", allowing unauthorized requests that present this header.
    if (!cronSecret) {
      console.error("[CRON] Security Alert: CRON_SECRET is not configured in environmental variables.");
      return new Response("Internal Server Error", { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const expectedHeader = `Bearer ${cronSecret}`;

    // Timing-safe comparison using SHA-256 to prevent timing attacks.
    // By hashing both values to a fixed-length (32 bytes), we prevent timingSafeEqual
    // from throwing a RangeError due to mismatched lengths, and guarantee constant-time execution.
    const expectedHash = createHash("sha256").update(expectedHeader).digest();
    const actualHash = createHash("sha256").update(authHeader).digest();

    if (!timingSafeEqual(expectedHash, actualHash)) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const timestamp = new Date().toISOString();
      console.warn(`[CRON] [${timestamp}] Unauthorized sync attempt from IP: ${ip}`);
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Fetch active events that have a Drive folder linked and are open for uploads
    const activeEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.isActive, true),
          eq(events.uploadOpen, true),
          isNotNull(events.driveFolderId)
        )
      );

    const results = [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const event of activeEvents) {
      // Prevent running multiple syncs in quick succession (e.g. within 5 minutes)
      if (event.lastSyncedAt && event.lastSyncedAt > fiveMinutesAgo) {
        continue;
      }

      try {
        console.log(`[CRON] Auto-syncing event ${event.id} (${event.name})`);
        
        // Fetch new files
        const newFiles = await getNewFilesFromFolder(
          event.driveFolderId!,
          event.lastSyncedAt ?? undefined
        );

        let toInsert = [...newFiles];

        if (newFiles.length > 0) {
          // Check existing photos for this event in the database
          const existing = await db
            .select({ driveFileId: photos.driveFileId })
            .from(photos)
            .where(eq(photos.eventId, event.id));
          const existingIds = new Set(existing.map((e: { driveFileId: string }) => e.driveFileId));
          toInsert = newFiles.filter((f) => !existingIds.has(f.driveFileId));

          if (toInsert.length > 0) {
            // Bulk insert new files as pending
            await db.insert(photos).values(
              toInsert.map((f) => ({
                id: crypto.randomUUID(),
                eventId: event.id,
                seasonId: event.seasonId,
                driveFileId: f.driveFileId,
                driveUrl: f.driveUrl,
                downloadUrl: f.downloadUrl,
                filename: f.filename,
                fileSize: f.fileSize,
                status: "pending" as const,
                createdAt: new Date(),
              }))
            );
          }
        }

        // Update lastSyncedAt, syncStatus = 'done', photoCount
        await db
          .update(events)
          .set({
            lastSyncedAt: new Date(),
            syncStatus: "done",
            photoCount: sql`photo_count + ${toInsert.length}`,
          })
          .where(eq(events.id, event.id));

        // Trigger the quality filter pipeline (async)
        triggerQualityFilter(event.id).catch((err) => {
          console.error(`[CRON] Quality filter trigger failed for event ${event.id}:`, err);
        });

        results.push({ eventId: event.id, synced: toInsert.length });
      } catch (err) {
        console.error(`[CRON] Failed to sync event ${event.id}:`, err);
        await db.update(events).set({ syncStatus: "error" }).where(eq(events.id, event.id));
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("GET cron sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
