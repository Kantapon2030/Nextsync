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

  const migrationsDir = path.join(__dirname, "../drizzle/migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  // Get all SQL files and sort them alphabetically
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (sqlFiles.length === 0) {
    console.log("No SQL migration files found.");
    process.exit(0);
  }

  console.log(`Connecting to database to execute ${sqlFiles.length} migration(s)...`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}...`);
      const sql = fs.readFileSync(filePath, "utf8");
      
      // Split SQL file by semicolons followed by whitespace/newlines
      // or at the end of the string to execute statements individually.
      // This is required to support CREATE INDEX CONCURRENTLY which
      // cannot be executed inside a multi-statement transaction block.
      const statements = sql
        .split(/;(?:\s*[\r\n]+|$)/)
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const statement of statements) {
        await client.query(statement);
      }
      console.log(`✓ ${file} executed successfully!`);
    }
    console.log("✓ All database migrations completed successfully!");
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
