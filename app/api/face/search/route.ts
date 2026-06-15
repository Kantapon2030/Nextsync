// app/api/face/search/route.ts
// Uses the user's enrolled ArcFace 512-dim embedding to search for matching photos
// via pgvector cosine distance (<=>).
import { auth } from "@/lib/auth";
import { db, userFaceEmbeddings } from "@/lib/db";
import { eq, sql, SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsFromDB } from "@/lib/aiTuner";

// ArcFace cosine distance threshold:
//   0.0 = identical, 1.0 = opposite
//   Cross-scenario (makeup vs natural): 0.45–0.48 recommended
// Loaded from DB filterConfig.faceSimilarityDist (admin-adjustable 0.40–0.55)
const searchSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
  seasonId: z.string().optional(),
  eventId: z.string().optional(),
  timeslot: z.string().optional(),
  offset: z.number().int().nonnegative().max(10_000).optional(),
});

interface SearchRow extends Record<string, unknown> {
  distance: number | null;
}

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
    const { limit, seasonId, eventId, timeslot, offset = 0 } = searchSchema.parse(body);
    const settings = await getSettingsFromDB();
    const resultLimit = Math.min(limit ?? settings.maxResults, settings.maxResults);

    // Load user's enrolled ArcFace embedding
    const userEmb = await db
      .select({
        embedding: userFaceEmbeddings.embedding,
        templateType: userFaceEmbeddings.templateType,
        modelVersion: userFaceEmbeddings.modelVersion,
      })
      .from(userFaceEmbeddings)
      .where(eq(userFaceEmbeddings.userId, userId))

    if (!userEmb[0]) {
      return NextResponse.json(
        {
          error: "คุณยังไม่ได้สแกนใบหน้าเพื่อลงทะเบียน กรุณาลงทะเบียนใบหน้าก่อน",
          enrolled: false,
        },
        { status: 400 }
      );
    }

    const centroid = userEmb.find((embedding) => embedding.templateType === "centroid") ?? userEmb[0];
    const queryVector = centroid.embedding;
    const queryVectorStr = `[${queryVector.join(",")}]`;
    const templateDistances = userEmb
      .filter((embedding) => embedding.templateType !== "centroid")
      .map((embedding) => sql`(pfe.embedding <=> ${`[${embedding.embedding.join(",")}]`}::vector)`);
    const rerankDistance = templateDistances.length
      ? sql`LEAST(${sql.join(templateDistances, sql`, `)})`
      : sql`(pfe.embedding <=> ${queryVectorStr}::vector)`;

    const threshold = settings.cosineThreshold;

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
      WITH runtime_settings AS (
        SELECT set_config('hnsw.ef_search', ${String(settings.efSearch)}, true)
      )
      , candidates AS (
        SELECT pfe.photo_id
        FROM photo_face_embeddings pfe
        CROSS JOIN runtime_settings
        ORDER BY pfe.embedding <=> ${queryVectorStr}::vector
        LIMIT ${Math.max(resultLimit * 20, 200)}
      ), ranked AS (
      SELECT
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
        MIN(${rerankDistance}) AS "distance",
        MAX(1 - ${rerankDistance}) AS "score"
      FROM photo_face_embeddings pfe
      JOIN candidates c ON c.photo_id = pfe.photo_id
      JOIN photos p ON p.id = pfe.photo_id
      JOIN events e ON e.id = p.event_id AND e.is_active = true
      WHERE
        ${whereClause}
      GROUP BY p.id
      )
      SELECT *,
        CASE WHEN distance <= ${threshold * 0.72} THEN 'high'
             WHEN distance <= ${threshold * 0.88} THEN 'medium'
             ELSE 'low' END AS "confidenceTier"
      FROM ranked
      WHERE distance < ${threshold}
      ORDER BY distance ASC
      LIMIT ${resultLimit}
      OFFSET ${offset}
    `;

    const results = await db.execute(query);
    const rows = (results.rows ?? []) as SearchRow[];

    return NextResponse.json({
      success: true,
      photos: rows,
      count: rows.length,
      threshold,
      modelVersion: centroid.modelVersion ?? "buffalo_l-v1",
      nextOffset: rows.length === resultLimit ? offset + resultLimit : null,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Face search API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `เกิดข้อผิดพลาดในการค้นหาใบหน้า: ${message}` },
      { status: 500 }
    );
  }
}
