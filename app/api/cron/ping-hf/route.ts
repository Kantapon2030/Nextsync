export const dynamic = "force-dynamic";

import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[PING-HF] CRON_SECRET is not configured");
    return new Response("Internal Server Error", { status: 500 });
  }

  const expectedHash = createHash("sha256")
    .update(`Bearer ${cronSecret}`)
    .digest();
  const actualHash = createHash("sha256")
    .update(req.headers.get("Authorization") ?? "")
    .digest();

  if (!timingSafeEqual(expectedHash, actualHash)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url =
    process.env.FACE_API_URL ??
    "https://kantapon020-shotsync-face-api.hf.space";

  try {
    const res = await fetch(`${url}/health`, {
      headers: process.env.FACE_API_SECRET
        ? { Authorization: `Bearer ${process.env.FACE_API_SECRET}` }
        : undefined,
      signal: AbortSignal.timeout(8000),
    });
    const hf: unknown = await res.json().catch(() => null);
    console.log("[PING-HF] Space responded with", res.status);
    return NextResponse.json({ ok: res.ok, status: res.status, hf });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("[PING-HF] HF Space unreachable:", message);
    return NextResponse.json({ ok: false, error: message });
  }
}
