// app/api/admin/config/route.ts
import { auth } from "@/lib/auth";
import { db, filterConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Quality filter fields removed — only face recognition + watermark settings remain
const configSchema = z.object({
  minFaceConfidence: z.number().min(0).max(1).optional(),
  faceSimilarityDist: z.number().min(0).max(1).optional(),
  watermarkEnabled: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    // Find the single global configuration (id = 1)
    let config = await db
      .select()
      .from(filterConfig)
      .where(eq(filterConfig.id, 1))
      .limit(1);

    // If not found, insert default global configs
    if (config.length === 0) {
      const [inserted] = await db
        .insert(filterConfig)
        .values({
          id: 1,
          blurMin: 0,
          brightnessMin: 0,
          brightnessMax: 1,
          eyeAspectRatioMin: 0,
          minFaceConfidence: 0.50,
          faceSimilarityDist: 0.60,
          watermarkEnabled: true,
        })
        .returning();
      config = [inserted];
    }

    return NextResponse.json({
      success: true,
      config: {
        minFaceConfidence: config[0].minFaceConfidence,
        faceSimilarityDist: config[0].faceSimilarityDist,
        watermarkEnabled: config[0].watermarkEnabled ?? true,
      },
    });
  } catch (error) {
    console.error("GET config error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    // Only super_admin or admin can modify settings
    if (!session?.user || !["admin", "super_admin"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "ไม่พบรหัสผู้ใช้งานในระบบ" }, { status: 400 });
    }

    const json = await req.json();
    const body = configSchema.parse(json);

    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (body.minFaceConfidence !== undefined) updateFields.minFaceConfidence = body.minFaceConfidence;
    if (body.faceSimilarityDist !== undefined) updateFields.faceSimilarityDist = body.faceSimilarityDist;
    if (body.watermarkEnabled !== undefined) {
      // Only super_admin can toggle watermark
      if (session.user.role !== "super_admin" && session.user.role !== "admin") {
        return NextResponse.json({ error: "ต้องการสิทธิ์ Super Admin เพื่อเปลี่ยนการตั้งค่า Watermark" }, { status: 403 });
      }
      updateFields.watermarkEnabled = body.watermarkEnabled;
    }

    // Find or create config row
    const existing = await db
      .select()
      .from(filterConfig)
      .where(eq(filterConfig.id, 1))
      .limit(1);

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(filterConfig)
        .set(updateFields)
        .where(eq(filterConfig.id, 1))
        .returning();
    } else {
      [result] = await db
        .insert(filterConfig)
        .values({
          id: 1,
          blurMin: 0,
          brightnessMin: 0,
          brightnessMax: 1,
          eyeAspectRatioMin: 0,
          minFaceConfidence: 0.50,
          faceSimilarityDist: 0.60,
          watermarkEnabled: true,
          ...updateFields,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      config: {
        minFaceConfidence: result.minFaceConfidence,
        faceSimilarityDist: result.faceSimilarityDist,
        watermarkEnabled: result.watermarkEnabled ?? true,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("PUT config error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า" }, { status: 500 });
  }
}
