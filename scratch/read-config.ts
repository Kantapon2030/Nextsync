import { db, filterConfig } from "../lib/db";

async function main() {
  try {
    const config = await db.select().from(filterConfig).limit(1);
    console.log("Current filter config:", config);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
