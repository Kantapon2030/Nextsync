import { NextResponse } from "next/server";
import { db, processingJobs } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { processPhotoBatch } from "@/lib/pipeline";

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron auth header
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
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
