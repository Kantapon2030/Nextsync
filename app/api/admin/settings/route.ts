// app/api/admin/settings/route.ts
// Manages face search tuning parameters: ef_search, cosine_threshold, max_results, min_face_confidence
// Stored as individual rows in filter_config using id-based single-row pattern
import { auth } from "@/lib/auth";
import { db, filterConfig } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateSettingsCache } from "@/lib/aiTuner";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  efSearch: z.number().int().min(16).max(128).optional(),
  cosineThreshold: z.number().min(0.10).max(0.60).optional(),
  maxResults: z.number().int().min(10).max(200).optional(),
  minFaceConfidence: z.number().min(0.50).max(0.99).optional(),
});

// Default values
const DEFAULTS = {
  efSearch: 64,
  cosineThreshold: 0.35,
  maxResults: 50,
  minFaceConfidence: 0.85,
};

type FilterConfigInsert = typeof filterConfig.$inferInsert;

function toSettings(row: typeof filterConfig.$inferSelect) {
  return {
    efSearch: row.efSearch ?? DEFAULTS.efSearch,
    cosineThreshold: row.faceSimilarityDist ?? DEFAULTS.cosineThreshold,
    maxResults: row.maxResults ?? DEFAULTS.maxResults,
    minFaceConfidence: row.minFaceConfidence ?? DEFAULTS.minFaceConfidence,
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
      blurMin: 100,
      brightnessMin: 0.12,
      brightnessMax: 0.94,
      eyeAspectRatioMin: 0.17,
      minFaceConfidence: DEFAULTS.minFaceConfidence,
      faceSimilarityDist: DEFAULTS.cosineThreshold,
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
      settings: toSettings(row),
    });
  } catch (error) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ" }, { status: 401 });
    }

    const json = await req.json();
    const body = settingsSchema.parse(json);

    await ensureConfigRow();

    const updateFields: Partial<FilterConfigInsert> = {
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };
    if (body.efSearch !== undefined) updateFields.efSearch = body.efSearch;
    if (body.cosineThreshold !== undefined) updateFields.faceSimilarityDist = body.cosineThreshold;
    if (body.maxResults !== undefined) updateFields.maxResults = body.maxResults;
    if (body.minFaceConfidence !== undefined) updateFields.minFaceConfidence = body.minFaceConfidence;

    const [updated] = await db
      .update(filterConfig)
      .set(updateFields)
      .where(eq(filterConfig.id, 1))
      .returning();

    // Invalidate the in-memory settings cache
    invalidateSettingsCache();

    return NextResponse.json({
      success: true,
      settings: toSettings(updated),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("PATCH settings error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า" }, { status: 500 });
  }
}
