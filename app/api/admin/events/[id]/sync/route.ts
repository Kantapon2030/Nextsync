import { auth } from "@/lib/auth";
import { db, events, photos } from "@/lib/db";
import { eq, inArray, sql, and } from "drizzle-orm";
import { getNewFilesFromFolder } from "@/lib/drive";
import { triggerQualityFilter } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const eventId = params.id;
    const eventList = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const event = eventList[0];

    if (!event || !event.driveFolderId) {
      return NextResponse.json({ error: "No Drive folder linked to this event" }, { status: 400 });
    }

    // Reset rejected photos of this event to pending and null blurScore so they get re-evaluated on sync
    await db
      .update(photos)
      .set({
        status: "pending",
        blurScore: null,
        rejectReason: null,
        processedAt: null,
      })
      .where(and(eq(photos.eventId, eventId), eq(photos.status, "rejected")));

    // Update syncStatus = 'syncing'
    await db.update(events).set({ syncStatus: "syncing" }).where(eq(events.id, eventId));

    try {
      // Fetch new files modified since lastSyncedAt
      const newFiles = await getNewFilesFromFolder(
        event.driveFolderId,
        event.lastSyncedAt ?? undefined
      );

      let toInsert = [...newFiles];

      if (newFiles.length > 0) {
        // Query to check which file IDs already exist in database for this event to prevent duplicates
        const existing = await db
          .select({ driveFileId: photos.driveFileId })
          .from(photos)
          .where(eq(photos.eventId, eventId));

        const existingIds = new Set(existing.map((e: { driveFileId: string }) => e.driveFileId));
        toInsert = newFiles.filter((f) => !existingIds.has(f.driveFileId));

        if (toInsert.length > 0) {
          // Bulk insert new files as 'pending'
          await db.insert(photos).values(
            toInsert.map((f) => ({
              id: crypto.randomUUID(),
              eventId: eventId,
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

      // Update syncStatus = 'done', lastSyncedAt, photoCount
      await db
        .update(events)
        .set({
          lastSyncedAt: new Date(),
          syncStatus: "done",
          photoCount: sql`photo_count + ${toInsert.length}`,
        })
        .where(eq(events.id, eventId));

      // Trigger the quality filter pipeline asynchronously (fire-and-forget)
      triggerQualityFilter(eventId).catch((err) => {
        console.error("Async quality filter pipeline crash:", err);
      });

      return NextResponse.json({
        success: true,
        synced: toInsert.length,
        skipped: newFiles.length - toInsert.length,
        total: newFiles.length,
      });
    } catch (syncError) {
      // Revert status to error
      await db.update(events).set({ syncStatus: "error" }).where(eq(events.id, eventId));
      throw syncError;
    }
  } catch (error) {
    console.error("POST sync error:", error);
    return NextResponse.json({ error: "ไม่สามารถซิงค์รูปภาพได้" }, { status: 500 });
  }
}
