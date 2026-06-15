import { auth } from "@/lib/auth";
import { db, events, photos } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { triggerQualityFilter } from "@/lib/pipeline";
import { NextResponse } from "next/server";
import { syncEventPhotos } from "@/lib/syncEventPhotos";

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
      const syncResult = await syncEventPhotos({
        id: event.id,
        seasonId: event.seasonId,
        driveFolderId: event.driveFolderId,
      });

      // Update syncStatus = 'done', lastSyncedAt, photoCount
      await db
        .update(events)
        .set({
          lastSyncedAt: new Date(),
          syncStatus: "done",
          photoCount: syncResult.total,
        })
        .where(eq(events.id, eventId));

      await triggerQualityFilter(eventId);

      return NextResponse.json({
        success: true,
        synced: syncResult.added,
        removed: syncResult.removed,
        skipped: syncResult.total - syncResult.added,
        total: syncResult.total,
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
