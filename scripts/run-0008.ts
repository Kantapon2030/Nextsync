import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }

  const migrationFile = path.join(__dirname, "../drizzle/migrations/0008_arcface_512dim.sql");
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found at: ${migrationFile}`);
    process.exit(1);
  }

  console.log("Connecting to database to execute migration 0008...");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log(`Running migration: 0008_arcface_512dim.sql...`);
    const sqlContent = fs.readFileSync(migrationFile, "utf8");
    await client.query(sqlContent);
    console.log(`✓ 0008_arcface_512dim.sql executed successfully!`);

    console.log("Updating filter_config.face_similarity_dist to 0.45...");
    await client.query("UPDATE filter_config SET face_similarity_dist = 0.45 WHERE id = 1;");
    console.log("✓ filter_config updated successfully!");

    console.log("✓ Database migration 0008 and configuration update completed!");
  } catch (err) {
    console.error("❌ Migration execution failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
