import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  workerId: z.string().min(1),
  action: z.enum(["pause", "resume", "drain"]),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { workerId, action } = bodySchema.parse(await req.json());
  const status = action === "resume" ? "online" : action === "pause" ? "paused" : "draining";
  const result = await db.execute(sql`
    UPDATE worker_heartbeats SET status = ${status}
    WHERE worker_id = ${workerId}
  `);
  return NextResponse.json({ success: true, updated: result.rowCount ?? 0 });
}
