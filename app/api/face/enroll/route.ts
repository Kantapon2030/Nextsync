// app/api/face/enroll/route.ts
import { auth } from "@/lib/auth";
import { db, users, userFaceEmbeddings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const enrollSchema = z.object({
  embedding: z.array(z.number()).length(128, "Face embedding vector must be exactly 128 elements"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    const json = await req.json();
    const { embedding } = enrollSchema.parse(json);
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "ไม่พบรหัสผู้ใช้งานในระบบ" }, { status: 400 });
    }

    // Delete existing embedding for this user (if any) to ensure 1 embedding per user
    await db.delete(userFaceEmbeddings).where(eq(userFaceEmbeddings.userId, userId));

    // Insert new embedding
    await db.insert(userFaceEmbeddings).values({
      userId,
      embedding,
    });

    // Update user faceEnrolled status
    await db.update(users).set({ faceEnrolled: true }).where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Face enrollment API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดของระบบ ในการบันทึกข้อมูลใบหน้า" }, { status: 500 });
  }
}
