// app/api/face/search/route.ts
// Uses the user's enrolled ArcFace 512-dim embedding to search for matching photos
// via pgvector cosine distance (<=>).
import { auth } from "@/lib/auth";
import { db, userFaceEmbeddings, filterConfig } from "@/lib/db";
import { eq, sql, SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// ArcFace cosine distance threshold:
//   0.0 = identical, 1.0 = opposite
//   Cross-scenario (makeup vs natural): 0.45–0.48 recommended
// Loaded from DB filterConfig.faceSimilarityDist (admin-adjustable 0.40–0.55)
const DEFAULT_THRESHOLD = 0.45;

const searchSchema = z.object({
  limit: z.number().int().positive().optional().default(200),
  seasonId: z.string().optional(),
  eventId: z.string().optional(),
  timeslot: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "ไม่พบรหัสผู้ใช้งานในระบบ" },
        { status: 400 }
      );
    }

    // Parse optional filter params from body
    const body = await req.json().catch(() => ({}));
    const { limit, seasonId, eventId, timeslot } = searchSchema.parse(body);

    // Load user's enrolled ArcFace embedding
    const userEmb = await db
      .select({ embedding: userFaceEmbeddings.embedding })
      .from(userFaceEmbeddings)
      .where(eq(userFaceEmbeddings.userId, userId))
      .limit(1);

    if (!userEmb[0]) {
      return NextResponse.json(
        {
          error: "คุณยังไม่ได้สแกนใบหน้าเพื่อลงทะเบียน กรุณาลงทะเบียนใบหน้าก่อน",
          enrolled: false,
        },
        { status: 400 }
      );
    }

    const queryVector = userEmb[0].embedding; // number[512]
    const queryVectorStr = `[${queryVector.join(",")}]`;

    // Load threshold from DB config (admin-adjustable), fallback to default
    const config = await db
      .select({ faceSimilarityDist: filterConfig.faceSimilarityDist })
      .from(filterConfig)
      .where(eq(filterConfig.id, 1))
      .limit(1);
    const threshold = config[0]?.faceSimilarityDist ?? DEFAULT_THRESHOLD;

    // Build optional filter conditions using parameterized sql fragments (no raw strings)
    const conditions: SQL[] = [sql`p.status = 'approved'`];

    // Filter by eventId or seasonId
    if (eventId && eventId !== "all" && eventId !== "null") {
      conditions.push(sql`p.event_id = ${eventId}`);
    } else if (seasonId && seasonId !== "all" && seasonId !== "null") {
      conditions.push(sql`p.season_id = ${seasonId}`);
    }

    // Filter by timeslot
    if (timeslot && timeslot !== "all" && timeslot !== "null") {
      conditions.push(sql`p.timeslot = ${timeslot}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // pgvector cosine distance search (<=>) operator
    // DISTINCT ON photo to avoid returning same photo multiple times (multi-face photos)
    const query = sql`
      SELECT DISTINCT ON (p.id)
        p.id AS "id",
        p.event_id AS "eventId",
        p.season_id AS "seasonId",
        p.timeslot AS "timeslot",
        p.drive_file_id AS "driveFileId",
        p.drive_url AS "driveUrl",
        p.thumbnail_url AS "thumbnailUrl",
        p.thumbnail_sm AS "thumbnailSm",
        p.filename AS "filename",
        p.file_size AS "fileSize",
        p.width AS "width",
        p.height AS "height",
        p.face_count AS "faceCount",
        p.created_at AS "createdAt",
        (pfe.embedding <=> ${queryVectorStr}::vector) AS "distance",
        (1 - (pfe.embedding <=> ${queryVectorStr}::vector)) AS "score"
      FROM photo_face_embeddings pfe
      JOIN photos p ON p.id = pfe.photo_id
      JOIN events e ON e.id = p.event_id AND e.is_active = true
      WHERE
        ${whereClause}
        AND (pfe.embedding <=> ${queryVectorStr}::vector) < ${threshold}
      ORDER BY p.id, (pfe.embedding <=> ${queryVectorStr}::vector) ASC
      LIMIT ${limit}
    `;

    const results = await db.execute(query);
    const rows = results.rows ?? [];

    // Sort final results by best distance
    const sorted = [...rows].sort(
      (a: any, b: any) => (a.distance ?? 1) - (b.distance ?? 1)
    );

    return NextResponse.json({
      success: true,
      photos: sorted,
      count: sorted.length,
      threshold,
    });
  } catch (error: any) {
    if (error?.name === "ZodError" || error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Face search API error:", error);
    return NextResponse.json(
      { error: `เกิดข้อผิดพลาดในการค้นหาใบหน้า: ${error?.message || error}` },
      { status: 500 }
    );
  }
}
