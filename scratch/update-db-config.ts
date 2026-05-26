import { db, filterConfig } from "../lib/db";
import { eq } from "drizzle-orm";

async function main() {
  try {
    console.log("Updating database configuration row...");
    await db
      .update(filterConfig)
      .set({
        faceSimilarityDist: 0.60,
        minFaceConfidence: 0.50,
      })
      .where(eq(filterConfig.id, 1));
    
    console.log("Database configuration updated successfully!");
    const current = await db.select().from(filterConfig).limit(1);
    console.log("New config in DB:", current);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
