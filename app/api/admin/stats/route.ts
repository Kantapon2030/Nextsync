// app/api/admin/stats/route.ts
// Extended to include photo_face_embeddings count and processing_jobs queue data
import { auth } from "@/lib/auth";
import { db, users, photos, photoFaceEmbeddings, processingJobs, events } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    // 1. Total users
    const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    // 2. Photos by status
    const statusSummary = (await db
      .select({
        status: photos.status,
        count: sql<number>`count(*)`,
      })
      .from(photos)
      .innerJoin(events, eq(events.id, photos.eventId))
      .where(eq(events.isActive, true))
      .groupBy(photos.status)) as { status: "approved" | "rejected" | "pending" | null; count: number }[];

    const photoStats = { total: 0, approved: 0, rejected: 0, pending: 0 };
    statusSummary.forEach((row) => {
      const count = Number(row.count || 0);
      photoStats.total += count;
      if (row.status === "approved") photoStats.approved = count;
      if (row.status === "rejected") photoStats.rejected = count;
      if (row.status === "pending") photoStats.pending = count;
    });

    // 3. Total face embeddings indexed
    const embeddingsCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(photoFaceEmbeddings)
      .innerJoin(photos, eq(photos.id, photoFaceEmbeddings.photoId))
      .innerJoin(events, eq(events.id, photos.eventId))
      .where(eq(events.isActive, true));
    const totalEmbeddings = Number(embeddingsCountResult[0]?.count || 0);

    // 4. Processing jobs by status
    const jobsSummary = await db
      .select({
        status: processingJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(processingJobs)
      .innerJoin(events, eq(events.id, processingJobs.eventId))
      .where(eq(events.isActive, true))
      .groupBy(processingJobs.status);

    const jobStats = { queued: 0, running: 0, done: 0, error: 0 };
    jobsSummary.forEach((row) => {
      const count = Number(row.count || 0);
      if (row.status === "queued") jobStats.queued = count;
      if (row.status === "running") jobStats.running = count;
      if (row.status === "done") jobStats.done = count;
      if (row.status === "error") jobStats.error = count;
    });

    // 5. Recent jobs (active + failed) with event info
    const recentJobs = await db
      .select({
        id: processingJobs.id,
        eventId: processingJobs.eventId,
        status: processingJobs.status,
        processed: processingJobs.processed,
        total: processingJobs.total,
        errorMsg: processingJobs.errorMsg,
        createdAt: processingJobs.createdAt,
        startedAt: processingJobs.startedAt,
        doneAt: processingJobs.doneAt,
      })
      .from(processingJobs)
      .innerJoin(events, eq(events.id, processingJobs.eventId))
      .where(eq(events.isActive, true))
      .orderBy(sql`${processingJobs.createdAt} DESC`)
      .limit(20);

    // 6. Recent activity (latest photo uploads)
    const recentActivity = await db
      .select({
        id: photos.id,
        filename: photos.filename,
        status: photos.status,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .innerJoin(events, eq(events.id, photos.eventId))
      .where(eq(events.isActive, true))
      .orderBy(sql`${photos.createdAt} DESC`)
      .limit(10);

    const taskSummary = await db.execute(sql`
      SELECT stage, state, count(*)::int AS count
      FROM photo_processing_tasks
      GROUP BY stage, state
    `);
    const taskStages = (taskSummary.rows ?? []).reduce<Record<string, number>>((summary, row) => {
      const stage = String(row.stage);
      summary[stage] = (summary[stage] ?? 0) + Number(row.count);
      return summary;
    }, {});
    const activeTasks = (taskSummary.rows ?? []).reduce(
      (total, row) => total + (["queued", "running", "retry"].includes(String(row.state)) ? Number(row.count) : 0),
      0
    );

    const throughputResult = await db.execute(sql`
      SELECT count(*)::int AS completed
      FROM photo_processing_tasks
      WHERE completed_at >= now() - interval '5 minutes'
    `);
    const throughputPerMinute = Number(throughputResult.rows?.[0]?.completed ?? 0) / 5;
    const etaMinutes = throughputPerMinute > 0 ? Math.ceil(activeTasks / throughputPerMinute) : null;

    const workersResult = await db.execute(sql`
      SELECT worker_id AS "workerId", status, hostname, version,
             model_version AS "modelVersion", device, gpu_name AS "gpuName",
             gpu_memory_mb AS "gpuMemoryMb", batch_size AS "batchSize",
             current_task_id AS "currentTaskId", processed_total AS "processedTotal",
             failed_total AS "failedTotal", last_error AS "lastError",
             last_seen_at AS "lastSeenAt",
             (last_seen_at > now() - interval '45 seconds') AS online
      FROM worker_heartbeats
      ORDER BY last_seen_at DESC
    `);

    return NextResponse.json({
      success: true,
      totalUsers,
      photos: photoStats,
      totalEmbeddings,
      jobs: jobStats,
      recentJobs,
      recentActivity,
      taskStages,
      throughputPerMinute,
      etaMinutes,
      workers: workersResult.rows ?? [],
    });
  } catch (error) {
    console.error("GET stats API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติของระบบ" }, { status: 500 });
  }
}
