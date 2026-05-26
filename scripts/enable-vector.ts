import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

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
    console.log("Testing raw table creation with vector(128)...");
    await client.query("CREATE TABLE IF NOT EXISTS test_vector_table (val vector(128));");
    console.log("✓ Test table created successfully!");
    
    // Clean up
    await client.query("DROP TABLE test_vector_table;");
    console.log("✓ Test table cleaned up successfully!");
  } catch (err) {
    console.error("❌ Raw SQL creation failed:", err);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch(err => {
  console.error("Error running test:", err);
  process.exit(1);
});
