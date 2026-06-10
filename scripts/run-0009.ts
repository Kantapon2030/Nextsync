import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;

// ESM-compatible __dirname shim (ts-node reparsed this file as ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }

  const migrationFile = path.join(__dirname, "../drizzle/migrations/0009_vector_index.sql");
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found at: ${migrationFile}`);
    process.exit(1);
  }

  console.log("Connecting to database to execute migration 0009...");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log(`Running migration: 0009_vector_index.sql...`);
    const sql = fs.readFileSync(migrationFile, "utf8");
    
    // Split SQL by semicolons to execute statements individually.
    // This is required for CREATE INDEX CONCURRENTLY.
    const statements = sql
      .split(/;(?:\s*[\r\n]+|$)/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await client.query(statement);
    }
    console.log("✓ Migration 0009_vector_index.sql completed successfully!");
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
