// app/api/photos/[id]/route.ts
import { auth } from "@/lib/auth";
import { db, photos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updatePhotoSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]).optional(),
  rejectReason: z.enum(["blur", "dark", "bright", "eyes", "no_face"]).nullable().optional(),
  manuallyApproved: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const photoId = params.id;
    const photoList = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);

    if (photoList.length === 0) {
      return NextResponse.json({ error: "ไม่พบรูปภาพที่ต้องการ" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      photo: photoList[0],
    });
  } catch (error) {
    console.error("Error fetching single photo:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรูปภาพ" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role === "student") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลหรือช่างภาพ" }, { status: 401 });
    }

    const photoId = params.id;
    const json = await req.json();
    const body = updatePhotoSchema.parse(json);

    // Fetch original photo
    const photoList = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (photoList.length === 0) {
      return NextResponse.json({ error: "ไม่พบรูปภาพที่ต้องการ" }, { status: 404 });
    }

    // Update photo details
    const updatedData = {
      ...body,
      processedAt: new Date(),
    };

    const [updatedPhoto] = await db
      .update(photos)
      .set(updatedData)
      .where(eq(photos.id, photoId))
      .returning();

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Error updating single photo:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลรูปภาพ" }, { status: 500 });
  }
}
