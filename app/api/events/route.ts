// app/api/events/route.ts
import { db, seasons, events } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId");

    let targetSeason;
    if (seasonId) {
      const result = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
      targetSeason = result[0];
    } else {
      const result = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      targetSeason = result[0];
    }

    if (!targetSeason) {
      return NextResponse.json({ season: null, events: [] });
    }

    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.seasonId, targetSeason.id), eq(events.isActive, true)))
      .orderBy(events.sortOrder);

    return NextResponse.json({
      success: true,
      season: targetSeason,
      events: eventList,
    });
  } catch (error) {
    console.error("GET events error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลรายการกิจกรรมได้" }, { status: 500 });
  }
}
