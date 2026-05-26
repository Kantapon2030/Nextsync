// app/api/seasons/route.ts
import { db, seasons } from "@/lib/db";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const seasonList = await db
      .select()
      .from(seasons)
      .orderBy(desc(seasons.createdAt));

    return NextResponse.json({
      success: true,
      seasons: seasonList,
    });
  } catch (error) {
    console.error("GET seasons public error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลปีการศึกษาได้" }, { status: 500 });
  }
}
