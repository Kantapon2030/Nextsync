// app/api/photographer/sync-stats/route.ts
import { auth } from "@/lib/auth";
import { db, events, photos, seasons } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "photographer" && session.user.role !== "admin")) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const seasonIdParam = searchParams.get("seasonId");

    let seasonId: string;
    let seasonName: string;

    if (seasonIdParam) {
      const targetSeason = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, seasonIdParam))
        .limit(1);
      if (targetSeason.length === 0) {
        return NextResponse.json({ error: "ไม่พบปีการศึกษาที่ระบุ" }, { status: 404 });
      }
      seasonId = targetSeason[0].id;
      seasonName = targetSeason[0].name;
    } else {
      // Get active season
      const activeSeason = await db
        .select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .limit(1);

      if (activeSeason.length === 0) {
        return NextResponse.json({ success: true, stats: [] });
      }

      seasonId = activeSeason[0].id;
      seasonName = activeSeason[0].name;
    }

    // Get all active events for the season
    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.seasonId, seasonId), eq(events.isActive, true)))
      .orderBy(events.sortOrder);

    // Get photo counts grouped by eventId and status
    const counts = await db
      .select({
        eventId: photos.eventId,
        status: photos.status,
        count: sql<number>`count(*)::int`,
      })
      .from(photos)
      .where(eq(photos.seasonId, seasonId))
      .groupBy(photos.eventId, photos.status);

    // Format stats
    const statsMap: Record<string, { approved: number; rejected: number; pending: number }> = {};
    (counts as any[]).forEach((c) => {
      if (!c.eventId) return;
      if (!statsMap[c.eventId]) {
        statsMap[c.eventId] = { approved: 0, rejected: 0, pending: 0 };
      }
      if (c.status === "approved") statsMap[c.eventId].approved = c.count;
      if (c.status === "rejected") statsMap[c.eventId].rejected = c.count;
      if (c.status === "pending") statsMap[c.eventId].pending = c.count;
    });
    const result = (eventList as any[]).map((e) => {
      const eventStats = statsMap[e.id] || { approved: 0, rejected: 0, pending: 0 };
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        date: e.date,
        driveFolderUrl: e.driveFolderUrl,
        uploadUrl: e.uploadUrl,
        lastSyncedAt: e.lastSyncedAt,
        syncStatus: e.syncStatus,
        uploadOpen: e.uploadOpen,
        photoCount: e.photoCount,
        stats: {
          approved: eventStats.approved,
          rejected: eventStats.rejected,
          pending: eventStats.pending,
          total: eventStats.approved + eventStats.rejected + eventStats.pending,
        }
      };
    });

    return NextResponse.json({
      success: true,
      seasonId,
      seasonName,
      stats: result,
    });
  } catch (error) {
    console.error("Error getting photographer sync stats:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลสถิติการซิงค์ได้" }, { status: 500 });
  }
}
