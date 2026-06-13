// app/api/cron/process/route.ts
export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db, processingJobs, photos } from "@/lib/db";
import { eq, sql, and } from "drizzle-orm";
import { processPhotoBatch } from "@/lib/pipeline";

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron auth header
    const cronSecret = process.env.CRON_SECRET;

    // Critical Guard: Ensure CRON_SECRET is configured.
    if (!cronSecret) {
      console.error("[CRON] Security Alert: CRON_SECRET is not configured in environmental variables.");
      return new Response("Internal Server Error", { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const expectedHeader = `Bearer ${cronSecret}`;

    const expectedHash = createHash("sha256").update(expectedHeader).digest();
    const actualHash = createHash("sha256").update(authHeader).digest();

    if (!timingSafeEqual(expectedHash, actualHash)) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const timestamp = new Date().toISOString();
      console.warn(`[CRON] [${timestamp}] Unauthorized process attempt from IP: ${ip}`);
      return new Response("Unauthorized", { status: 401 });
    }

    // ── Self-Healing: Reset jobs ที่ค้าง running > 10 นาที → queued ──
    const stuckResetResult = await db
      .update(processingJobs)
      .set({ status: "queued", startedAt: null })
      .where(
        and(
          eq(processingJobs.status, "running"),
          sql`${processingJobs.startedAt} < NOW() - INTERVAL '10 minutes'`
        )
      );
    console.log(`[CRON] Reset ${stuckResetResult.rowCount ?? 0} stuck jobs back to queued`);

    // ── Auto-create missing jobs: photos pending แต่ไม่มี job ──
    const eventsNeedingJobs = await db.execute(sql`
      SELECT DISTINCT p.event_id
      FROM photos p
      LEFT JOIN processing_jobs pj 
        ON p.event_id = pj.event_id 
        AND pj.status IN ('queued', 'running')
      WHERE p.status = 'pending'
        AND pj.id IS NULL
    `);

    for (const row of eventsNeedingJobs.rows as { event_id: string }[]) {
      await db.insert(processingJobs).values({
        id: crypto.randomUUID(),
        eventId: row.event_id,
        status: "queued",
        createdAt: new Date(),
      });
      console.log(`[CRON] Auto-created missing job for event ${row.event_id}`);
    }

    // 2. Find the oldest queued job
    const job = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.status, "queued"))
      .orderBy(processingJobs.createdAt)
      .limit(1);

    if (!job[0]) {
      return NextResponse.json({ message: "No jobs" });
    }

    const currentJob = job[0];

    // 3. Mark job as running and record started time
    await db
      .update(processingJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(processingJobs.id, currentJob.id));

    try {
      // Process 5 photos per batch run to stay well within serverless timeouts
      const BATCH_SIZE = 5;
      const { processed, remaining } = await processPhotoBatch(currentJob.eventId, BATCH_SIZE);

      if (remaining === 0) {
        // Job is fully complete
        await db
          .update(processingJobs)
          .set({
            status: "done",
            doneAt: new Date(),
            processed: sql`processed + ${processed}`,
          })
          .where(eq(processingJobs.id, currentJob.id));
      } else {
        // Still photos remaining -> reset to queued so the next cron run picks it up
        await db
          .update(processingJobs)
          .set({
            status: "queued",
            processed: sql`processed + ${processed}`,
          })
          .where(eq(processingJobs.id, currentJob.id));
      }

      return NextResponse.json({ processed, remaining });
    } catch (processError) {
      console.error(`Error processing batch for job ${currentJob.id}:`, processError);
      
      // Mark job as error
      await db
        .update(processingJobs)
        .set({ status: "error", doneAt: new Date() })
        .where(eq(processingJobs.id, currentJob.id));

      throw processError;
    }
  } catch (error) {
    console.error("GET process cron error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
