import { Client } from "pg";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }
  
  const client = new Client({ connectionString: url });
  await client.connect();
  
  try {
    console.log("Checking if pgvector extension is enabled...");
    const res = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
    if (res.rows.length === 0) {
      console.log("pgvector extension is not enabled. Enabling it now...");
      await client.query("CREATE EXTENSION IF NOT EXISTS vector;");
      console.log("✓ pgvector extension enabled successfully!");
    } else {
      console.log("✓ pgvector extension is already enabled.");
    }
  } catch (err) {
    console.error("❌ Failed to check or enable pgvector:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
