// app/api/cron/sync/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createHash, timingSafeEqual } from "crypto";
import { db, events } from "@/lib/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { triggerQualityFilter } from "@/lib/pipeline";
import { NextResponse } from "next/server";
import { syncEventPhotos } from "@/lib/syncEventPhotos";

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
      console.warn(`[CRON] [${timestamp}] Unauthorized sync attempt from IP: ${ip}`);
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Fetch active events that have a Drive folder linked and are open for uploads
    const activeEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.isActive, true),
          eq(events.uploadOpen, true),
          isNotNull(events.driveFolderId)
        )
      );

    const results = [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const event of activeEvents) {
      // Prevent running multiple syncs in quick succession (e.g. within 5 minutes)
      if (event.lastSyncedAt && event.lastSyncedAt > fiveMinutesAgo) {
        continue;
      }

      try {
        console.log(`[CRON] Auto-syncing event ${event.id} (${event.name})`);
        
        const syncResult = await syncEventPhotos({
          id: event.id,
          seasonId: event.seasonId,
          driveFolderId: event.driveFolderId!,
        });

        // Update lastSyncedAt, syncStatus = 'done', photoCount
        await db
          .update(events)
          .set({
            lastSyncedAt: new Date(),
            syncStatus: "done",
            photoCount: syncResult.total,
          })
          .where(eq(events.id, event.id));

        // Trigger the quality filter pipeline (awaited to prevent early environment shutdown on Vercel)
        try {
          await triggerQualityFilter(event.id);
        } catch (err) {
          console.error(`[CRON] Quality filter trigger failed for event ${event.id}:`, err);
        }

        results.push({
          eventId: event.id,
          synced: syncResult.added,
          removed: syncResult.removed,
        });
      } catch (err) {
        console.error(`[CRON] Failed to sync event ${event.id}:`, err);
        await db.update(events).set({ syncStatus: "error" }).where(eq(events.id, event.id));
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("GET cron sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
