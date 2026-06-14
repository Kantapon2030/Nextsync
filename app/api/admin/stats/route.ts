// app/api/admin/stats/route.ts
// Extended to include photo_face_embeddings count and processing_jobs queue data
import { auth } from "@/lib/auth";
import { db, users, photos, photoFaceEmbeddings, processingJobs } from "@/lib/db";
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
      .from(photoFaceEmbeddings);
    const totalEmbeddings = Number(embeddingsCountResult[0]?.count || 0);

    // 4. Processing jobs by status
    const jobsSummary = await db
      .select({
        status: processingJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(processingJobs)
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
      .orderBy(sql`${photos.createdAt} DESC`)
      .limit(10);

    return NextResponse.json({
      success: true,
      totalUsers,
      photos: photoStats,
      totalEmbeddings,
      jobs: jobStats,
      recentJobs,
      recentActivity,
    });
  } catch (error) {
    console.error("GET stats API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติของระบบ" }, { status: 500 });
  }
}
