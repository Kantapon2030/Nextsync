// app/api/photos/route.ts
import { auth } from "@/lib/auth";
import { db, photos, seasons, events } from "@/lib/db";
import { eq, and, desc, like, sql, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "24")));
    const statusParam = searchParams.get("status") || "approved";
    const seasonId = searchParams.get("seasonId");
    const eventId = searchParams.get("eventId");
    const timeslot = searchParams.get("timeslot");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Security Check: Students can only view "approved" photos.
    // If photographer or admin, they can query other statuses like "pending" or "rejected".
    let targetStatus = statusParam;
    if (!session?.user || session.user.role === "student") {
      targetStatus = "approved";
    }

    const conditions = [];

    // Filter only photos that belong to ACTIVE events
    const activeEventsResult = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.isActive, true));
    const activeEventIds = activeEventsResult.map((e: { id: string }) => e.id);

    if (activeEventIds.length === 0) {
      return NextResponse.json({
        success: true,
        photos: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }
    conditions.push(inArray(photos.eventId, activeEventIds));

    // Filter by Event or Season
    if (eventId && eventId !== "all" && eventId !== "null") {
      conditions.push(eq(photos.eventId, eventId));
    } else {
      let targetSeasonId = seasonId;
      if (!targetSeasonId || targetSeasonId === "all" || targetSeasonId === "null") {
        // Resolve active season
        const activeSeason = await db
          .select()
          .from(seasons)
          .where(eq(seasons.isActive, true))
          .limit(1);
        if (activeSeason.length > 0) {
          targetSeasonId = activeSeason[0].id;
        }
      }
      if (targetSeasonId) {
        conditions.push(eq(photos.seasonId, targetSeasonId));
      }
    }

    // Filter by timeslot
    if (timeslot && timeslot !== "all" && timeslot !== "null") {
      conditions.push(eq(photos.timeslot, timeslot));
    }

    if (targetStatus && targetStatus !== "all") {
      conditions.push(eq(photos.status, targetStatus as any));
    }

    if (search) {
      conditions.push(like(photos.filename, `%${search}%`));
    }

    const photographerIdParam = searchParams.get("photographerId");
    if (photographerIdParam) {
      conditions.push(eq(photos.photographerId, photographerIdParam));
    }

    const whereClause = and(...conditions);

    // Get total matching records
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);

    // Fetch photos
    const photosList = await db
      .select()
      .from(photos)
      .where(whereClause)
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(
      {
        success: true,
        photos: photosList,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error retrieving photos:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลรูปภาพได้" }, { status: 500 });
  }
}
