import { auth } from "@/lib/auth";
import { db, events, photos } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const eventId = params.id;
    const eventList = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const event = eventList[0];

    if (!event) {
      return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
    }

    // Count pending photos for this event (quality filter removed — blurScore no longer used)
    const [pendingRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(photos)
      .where(and(eq(photos.eventId, eventId), eq(photos.status, "pending")));

    const pendingCount = pendingRes?.count || 0;

    return NextResponse.json({
      success: true,
      syncStatus: event.syncStatus,
      lastSyncedAt: event.lastSyncedAt,
      photoCount: event.photoCount,
      pendingCount,
    });
  } catch (error) {
    console.error("GET sync-status error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลสถานะได้" }, { status: 500 });
  }
}
