// app/api/admin/photos/route.ts
import { auth } from "@/lib/auth";
import { db, photos } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteFromR2 } from "@/lib/r2";

const bulkSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกรูปภาพอย่างน้อย 1 รูป"),
  action: z.enum(["approve", "reject"]),
  rejectReason: z.enum(["blur", "dark", "bright", "eyes", "no_face"]).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const json = await req.json();
    const { photoIds, action, rejectReason } = bulkSchema.parse(json);

    const status = action === "approve" ? "approved" : "rejected";
    const manuallyApproved = action === "approve";

    // Admin: update any selected photos
    const result = await db
      .update(photos)
      .set({
        status,
        rejectReason: status === "rejected" ? rejectReason : null,
        manuallyApproved,
        processedAt: new Date(),
      })
      .where(inArray(photos.id, photoIds))
      .returning();

    return NextResponse.json({
      success: true,
      updated: result.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Bulk photos API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการปรับปรุงสถานะรูปภาพ" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ error: "กรุณาเลือกรูปภาพอย่างน้อย 1 รูป" }, { status: 400 });
    }

    const photoIds = idsParam.split(",");

    interface PhotoToDelete {
      id: string;
      thumbnailUrl: string | null;
      thumbnailSm: string | null;
    }

    // Fetch details of photos to delete their thumbnails
    const photosToDelete = (await db
      .select({
        id: photos.id,
        thumbnailUrl: photos.thumbnailUrl,
        thumbnailSm: photos.thumbnailSm,
      })
      .from(photos)
      .where(inArray(photos.id, photoIds))) as PhotoToDelete[];

    if (photosToDelete.length === 0) {
      return NextResponse.json({ error: "ไม่พบรูปภาพที่ต้องการลบ" }, { status: 404 });
    }

    const authorizedIds = photosToDelete.map((p) => p.id);

    // Delete photos (cascade delete handles photoFaceEmbeddings relationships)
    await db.delete(photos).where(inArray(photos.id, authorizedIds));

    // Cleanup R2 thumbnails in background / try-catch
    for (const p of photosToDelete) {
      if (p.thumbnailUrl) {
        const parts = p.thumbnailUrl.split("/");
        const key = parts[parts.length - 1];
        try {
          await deleteFromR2(key);
        } catch (err) {
          console.error("Failed to delete R2 thumbnail:", key, err);
        }
      }
      if (p.thumbnailSm) {
        const parts = p.thumbnailSm.split("/");
        const key = parts[parts.length - 1];
        try {
          await deleteFromR2(key);
        } catch (err) {
          console.error("Failed to delete R2 sm thumbnail:", key, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted: authorizedIds.length,
    });
  } catch (error) {
    console.error("Delete photos API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบรูปภาพ" }, { status: 500 });
  }
}
