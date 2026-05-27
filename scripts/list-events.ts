import { db, events } from "../lib/db";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const allEvents = await db.select({ id: events.id, name: events.name }).from(events);
  console.log("=== Active Events in Database ===");
  allEvents.forEach((ev) => {
    console.log(`- ID: "${ev.id}" | Name: "${ev.name}"`);
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
