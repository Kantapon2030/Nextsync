import { auth } from "@/lib/auth";
import { db, processingJobs } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db
      .update(processingJobs)
      .set({
        status: "queued",
        errorMsg: null,
        startedAt: null,
        doneAt: null,
      })
      .where(eq(processingJobs.status, "error"));

    return NextResponse.json({ success: true, retried: result.rowCount ?? 0 });
  } catch (error) {
    console.error("PATCH retry failed jobs error:", error);
    return NextResponse.json({ error: "Failed to retry jobs" }, { status: 500 });
  }
}
