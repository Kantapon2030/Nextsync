// app/api/admin/pipeline/route.ts
// Manages AI pipeline tuning parameters: blur threshold, brightness range, batch size, thumbnail sizes
// Uses a separate config key prefix "pipeline_" stored in filter_config table columns
import { auth } from "@/lib/auth";
import { db, filterConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateSettingsCache } from "@/lib/aiTuner";

export const dynamic = "force-dynamic";

const pipelineSchema = z.object({
  qualityBlurThreshold: z.number().min(50).max(200).optional(),
  qualityBrightnessMin: z.number().int().min(0).max(254).optional(),
  qualityBrightnessMax: z.number().int().min(1).max(255).optional(),
  pipelineBatchSize: z.number().int().min(1).max(20).optional(),
  thumbnailSizeLg: z.number().int().min(400).max(2000).optional(),
  thumbnailSizeSm: z.number().int().min(100).max(800).optional(),
});

const PIPELINE_DEFAULTS = {
  qualityBlurThreshold: 100,
  qualityBrightnessMin: 30,
  qualityBrightnessMax: 240,
  pipelineBatchSize: 5,
  thumbnailSizeLg: 800,
  thumbnailSizeSm: 400,
};

type FilterConfigInsert = typeof filterConfig.$inferInsert;

function toPipeline(row: typeof filterConfig.$inferSelect) {
  return {
    qualityBlurThreshold: row.blurMin ?? PIPELINE_DEFAULTS.qualityBlurThreshold,
    qualityBrightnessMin: Math.round((row.brightnessMin ?? 0.12) * 255),
    qualityBrightnessMax: Math.round((row.brightnessMax ?? 0.94) * 255),
    pipelineBatchSize: row.pipelineBatchSize ?? PIPELINE_DEFAULTS.pipelineBatchSize,
    thumbnailSizeLg: row.thumbnailSizeLg ?? PIPELINE_DEFAULTS.thumbnailSizeLg,
    thumbnailSizeSm: row.thumbnailSizeSm ?? PIPELINE_DEFAULTS.thumbnailSizeSm,
  };
}

async function ensureConfigRow() {
  const existing = await db
    .select()
    .from(filterConfig)
    .where(eq(filterConfig.id, 1))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(filterConfig).values({
      id: 1,
      blurMin: PIPELINE_DEFAULTS.qualityBlurThreshold,
      brightnessMin: PIPELINE_DEFAULTS.qualityBrightnessMin / 255,
      brightnessMax: PIPELINE_DEFAULTS.qualityBrightnessMax / 255,
      eyeAspectRatioMin: 0.17,
      minFaceConfidence: 0.85,
      faceSimilarityDist: 0.35,
      watermarkEnabled: true,
    });
    return await db.select().from(filterConfig).where(eq(filterConfig.id, 1)).limit(1);
  }
  return existing;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const config = await ensureConfigRow();
    const row = config[0];

    return NextResponse.json({
      success: true,
      pipeline: toPipeline(row),
    });
  } catch (error) {
    console.error("GET pipeline settings error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า Pipeline" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const json = await req.json();
    const body = pipelineSchema.parse(json);

    await ensureConfigRow();

    const updateFields: Partial<FilterConfigInsert> = {
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };
    if (body.qualityBlurThreshold !== undefined) updateFields.blurMin = body.qualityBlurThreshold;
    // Convert 0-255 UI values back to 0-1 range for DB
    if (body.qualityBrightnessMin !== undefined) updateFields.brightnessMin = body.qualityBrightnessMin / 255;
    if (body.qualityBrightnessMax !== undefined) updateFields.brightnessMax = body.qualityBrightnessMax / 255;
    if (body.pipelineBatchSize !== undefined) updateFields.pipelineBatchSize = body.pipelineBatchSize;
    if (body.thumbnailSizeLg !== undefined) updateFields.thumbnailSizeLg = body.thumbnailSizeLg;
    if (body.thumbnailSizeSm !== undefined) updateFields.thumbnailSizeSm = body.thumbnailSizeSm;

    const [updated] = await db
      .update(filterConfig)
      .set(updateFields)
      .where(eq(filterConfig.id, 1))
      .returning();

    invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      pipeline: toPipeline(updated),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("PATCH pipeline settings error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า Pipeline" }, { status: 500 });
  }
}
