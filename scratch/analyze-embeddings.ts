import { db, userFaceEmbeddings, photoFaceEmbeddings } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const users = await db.select().from(userFaceEmbeddings).limit(2);
    console.log("Found enrolled users:", users.length);
    if (users.length === 0) {
      console.log("No users with enrolled face embeddings.");
      return;
    }

    for (const u of users) {
      console.log(`\nAnalyzing user ID: ${u.userId}`);
      const embedding = u.embedding;
      const embeddingStr = `[${embedding.join(",")}]`;

      // Fetch the top 10 closest matches
      const closest = await db.execute(sql`
        SELECT 
          pfe.photo_id as "photoId",
          pfe.confidence as "confidence",
          pfe.face_index as "faceIndex",
          (1 - (pfe.embedding <=> ${embeddingStr}::vector)) as "similarity",
          pfe.embedding <=> ${embeddingStr}::vector as "distance"
        FROM photo_face_embeddings pfe
        ORDER BY "similarity" DESC
        LIMIT 10
      `);

      console.log("Top 10 closest photo faces by similarity:");
      if (closest.rows && closest.rows.length > 0) {
        for (const row of closest.rows as any) {
          console.log(`- Photo: ${row.photoId}, Similarity: ${row.similarity}, Distance: ${row.distance}, Confidence: ${row.confidence}`);
        }
      } else {
        console.log("No photo face embeddings found in DB.");
      }
    }
  } catch (error) {
    console.error("Error analyzing embeddings:", error);
  } finally {
    process.exit(0);
  }
}

main();
