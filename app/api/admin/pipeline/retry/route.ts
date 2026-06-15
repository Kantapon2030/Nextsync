import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute(sql`
      UPDATE processing_jobs pj
      SET status = 'queued', error_msg = NULL, started_at = NULL, done_at = NULL
      WHERE pj.status = 'error'
        AND EXISTS (
          SELECT 1 FROM events e
          WHERE e.id = pj.event_id AND e.is_active = true
        )
    `);

    return NextResponse.json({ success: true, retried: result.rowCount ?? 0 });
  } catch (error) {
    console.error("PATCH retry failed jobs error:", error);
    return NextResponse.json({ error: "Failed to retry jobs" }, { status: 500 });
  }
}
