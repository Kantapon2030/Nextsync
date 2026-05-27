// app/api/face/enroll/route.ts
// Receives 1-3 face images via multipart/form-data,
// sends them to the Python ArcFace service, stores the 512-dim embedding.
import { auth } from "@/lib/auth";
import { db, users, userFaceEmbeddings } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { enrollFace } from "@/lib/faceApi";

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

    // Parse multipart form — expect image1 (required), image2, image3 (optional)
    const form = await req.formData();
    const files: File[] = [];

    for (const key of ["image1", "image2", "image3"]) {
      const f = form.get(key);
      if (f instanceof File && f.size > 0) {
        files.push(f);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "กรุณาส่งรูปภาพอย่างน้อย 1 รูป" },
        { status: 400 }
      );
    }

    // Call Python ArcFace service → returns 512-dim mean embedding
    const embedding = await enrollFace(files);

    // Upsert: delete old embedding, insert new 512-dim one
    await db
      .delete(userFaceEmbeddings)
      .where(eq(userFaceEmbeddings.userId, userId));

    await db.insert(userFaceEmbeddings).values({
      userId,
      embedding,              // number[512]
      facesUsed: files.length,
      model: "ArcFace",
    });

    // Mark user as enrolled
    await db
      .update(users)
      .set({ faceEnrolled: true })
      .where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      facesUsed: files.length,
      dim: embedding.length,
    });
  } catch (error: any) {
    console.error("Face enrollment API error:", error);
    return NextResponse.json(
      { error: error.message ?? "เกิดข้อผิดพลาดในการบันทึกข้อมูลใบหน้า" },
      { status: 400 }
    );
  }
}
