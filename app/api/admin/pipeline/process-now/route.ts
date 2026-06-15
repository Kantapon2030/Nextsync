import { auth } from "@/lib/auth";
import { db, events, processingJobs } from "@/lib/db";
import { getSettingsFromDB } from "@/lib/aiTuner";
import { processPhotoBatch } from "@/lib/pipeline";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [row] = await db
      .select({ job: processingJobs })
      .from(processingJobs)
      .innerJoin(events, and(eq(events.id, processingJobs.eventId), eq(events.isActive, true)))
      .where(eq(processingJobs.status, "queued"))
      .orderBy(processingJobs.createdAt)
      .limit(1);

    if (!row) {
      return NextResponse.json({ success: true, message: "No active queued jobs" });
    }

    const claimed = await db
      .update(processingJobs)
      .set({ status: "running", startedAt: new Date(), errorMsg: null })
      .where(and(eq(processingJobs.id, row.job.id), eq(processingJobs.status, "queued")));

    if ((claimed.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Job was claimed by another worker" }, { status: 409 });
    }

    try {
      const settings = await getSettingsFromDB();
      const { processed, remaining } = await processPhotoBatch(
        row.job.eventId,
        settings.pipelineBatchSize
      );

      await db
        .update(processingJobs)
        .set({
          status: remaining === 0 ? "done" : "queued",
          doneAt: remaining === 0 ? new Date() : null,
          startedAt: null,
          processed: sql`processed + ${processed}`,
          total: sql`processed + ${processed} + ${remaining}`,
        })
        .where(eq(processingJobs.id, row.job.id));

      return NextResponse.json({
        success: true,
        eventId: row.job.eventId,
        processed,
        remaining,
      });
    } catch (error) {
      await db
        .update(processingJobs)
        .set({
          status: "error",
          doneAt: new Date(),
          errorMsg: error instanceof Error ? error.message : "Unknown processing error",
        })
        .where(eq(processingJobs.id, row.job.id));
      throw error;
    }
  } catch (error) {
    console.error("POST process-now error:", error);
    return NextResponse.json({ error: "Failed to process queued job" }, { status: 500 });
  }
}
