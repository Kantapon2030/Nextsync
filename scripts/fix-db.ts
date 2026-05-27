import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }

  console.log("Connecting to database to fix schema...");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log("Altering processing_jobs table to ensure error_msg exists...");
    await client.query("ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS error_msg TEXT;");
    console.log("✓ Column error_msg verified/added successfully!");
  } catch (err) {
    console.error("❌ Schema fix failed:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
