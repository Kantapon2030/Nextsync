import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying Drive integration migrations...");
  try {
    await db.execute(sql`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS drive_folder_id  TEXT,
        ADD COLUMN IF NOT EXISTS drive_folder_url TEXT,
        ADD COLUMN IF NOT EXISTS upload_url       TEXT,
        ADD COLUMN IF NOT EXISTS last_synced_at   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS sync_status      TEXT DEFAULT 'idle',
        ADD COLUMN IF NOT EXISTS upload_open      BOOLEAN DEFAULT true;
    `);
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

main().then(() => process.exit(0));
