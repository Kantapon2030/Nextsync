// app/api/photos/route.ts
import { auth } from "@/lib/auth";
import { db, photos, seasons, events } from "@/lib/db";
import { eq, and, desc, lt, like, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);

    // ── Pagination params (cursor-based + backward-compat offset) ──
    const cursor = searchParams.get("cursor"); // ID of last item in previous page
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "30")));

    const statusParam = searchParams.get("status") || "approved";
    const seasonId = searchParams.get("seasonId");
    const eventId = searchParams.get("eventId");
    const timeslot = searchParams.get("timeslot");
    const search = searchParams.get("search");
    const photographerIdParam = searchParams.get("photographerId");

    // Security: students can only view approved photos
    let targetStatus = statusParam;
    if (!session?.user || session.user.role === "student") {
      targetStatus = "approved";
    }

    // ── Build WHERE conditions ────────────────────────────────────────
    // Fix N+1: JOIN events inline instead of separate query for active events
    const conditions = [
      // Only include photos from active events (JOIN approach avoids N+1)
      sql`EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = ${photos.eventId}
          AND e.is_active = true
      )`,
    ];

    // Filter by Event or Season
    if (eventId && eventId !== "all" && eventId !== "null") {
      conditions.push(eq(photos.eventId, eventId));
    } else {
      let targetSeasonId = seasonId;
      if (!targetSeasonId || targetSeasonId === "all" || targetSeasonId === "null") {
        // Resolve active season
        const activeSeason = await db
          .select({ id: seasons.id })
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
      conditions.push(eq(photos.status, targetStatus as "approved" | "pending" | "rejected"));
    }

    if (search) {
      conditions.push(like(photos.filename, `%${search}%`));
    }

    if (photographerIdParam) {
      conditions.push(eq(photos.photographerId, photographerIdParam));
    }

    // ── Cursor-based pagination ───────────────────────────────────────
    if (cursor) {
      // Fetch photos older than (created_at, id) of the cursor row
      // Use createdAt-based cursor for stable ordering
      const cursorRow = await db
        .select({ createdAt: photos.createdAt })
        .from(photos)
        .where(eq(photos.id, cursor))
        .limit(1);

      if (cursorRow[0]?.createdAt) {
        conditions.push(
          sql`(${photos.createdAt} < ${cursorRow[0].createdAt} OR (${photos.createdAt} = ${cursorRow[0].createdAt} AND ${photos.id} < ${cursor}))`
        );
      }
    }

    const whereClause = and(...conditions);

    // ── Execute queries ───────────────────────────────────────────────
    const offset = cursor ? 0 : (page - 1) * limit;

    // Count (only for offset-based pagination — skip for cursor mode)
    let total = 0;
    let totalPages = 1;
    if (!cursor) {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(photos)
        .where(whereClause);
      total = Number(countResult[0]?.count || 0);
      totalPages = Math.ceil(total / limit);
    }

    // Fetch photos
    const photosList = await db
      .select()
      .from(photos)
      .where(whereClause)
      .orderBy(desc(photos.createdAt), desc(photos.id))
      .limit(limit + 1) // fetch one extra to determine hasMore
      .offset(offset);

    // Determine next cursor
    const hasMore = photosList.length > limit;
    const items = hasMore ? photosList.slice(0, limit) : photosList;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return NextResponse.json(
      {
        success: true,
        photos: items,
        total,
        page: cursor ? null : page,
        limit,
        totalPages: cursor ? null : totalPages,
        nextCursor,
        hasMore,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Error retrieving photos:", error);
    return NextResponse.json(
      { error: "ไม่สามารถดึงข้อมูลรูปภาพได้" },
      { status: 500 }
    );
  }
}
