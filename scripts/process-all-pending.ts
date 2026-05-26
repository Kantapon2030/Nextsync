// Redirect @tensorflow/tfjs-node to @tensorflow/tfjs to bypass native build issues on Windows/Node 24
if (typeof require !== "undefined") {
  const Module = require("module");
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id: string) {
    if (id === "@tensorflow/tfjs-node") {
      return originalRequire.call(this, "@tensorflow/tfjs");
    }
    return originalRequire.apply(this, arguments);
  };
}

import { db, photos } from "../lib/db";
import { processPhotoBatch } from "../lib/pipeline";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Locating all events with pending photos...");
    const pendingEvents = await db
      .select({ eventId: photos.eventId, count: sql<number>`count(*)` })
      .from(photos)
      .where(sql`status = 'pending'`)
      .groupBy(photos.eventId);

    if (pendingEvents.length === 0) {
      console.log("No pending photos found in database!");
      return;
    }

    console.log("Found pending photos in the following events:");
    for (const item of pendingEvents) {
      console.log(`- Event: ${item.eventId} (${item.count} photos pending)`);
    }

    for (const item of pendingEvents) {
      const eventId = item.eventId;
      console.log(`\n========================================`);
      console.log(`Starting processing for event: ${eventId}`);
      console.log(`========================================`);

      let hasMore = true;
      while (hasMore) {
        // Process in batches of 15 for faster local CLI execution
        const { processed, remaining } = await processPhotoBatch(eventId, 15);
        console.log(`Processed ${processed} photos. Remaining: ${remaining}`);
        hasMore = remaining > 0 && processed > 0;
      }
    }

    console.log("\nAll pending photos have been processed successfully!");
  } catch (error) {
    console.error("Error running batch processing:", error);
  } finally {
    process.exit(0);
  }
}

main();
