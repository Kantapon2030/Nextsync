// app/api/admin/stats/route.ts
import { auth } from "@/lib/auth";
import { db, users, photos } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    // 1. Get total users count
    const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.count || 0);

    // 2. Get photos summary by status
    const statusSummary = (await db
      .select({
        status: photos.status,
        count: sql<number>`count(*)`,
      })
      .from(photos)
      .groupBy(photos.status)) as { status: "approved" | "rejected" | "pending" | null; count: number }[];

    const photoStats = {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    };

    statusSummary.forEach((row) => {
      const count = Number(row.count || 0);
      photoStats.total += count;
      if (row.status === "approved") photoStats.approved = count;
      if (row.status === "rejected") photoStats.rejected = count;
      if (row.status === "pending") photoStats.pending = count;
    });

    // 3. Recent uploads feed
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
      recentActivity,
    });
  } catch (error) {
    console.error("GET stats API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติของระบบ" }, { status: 500 });
  }
}
