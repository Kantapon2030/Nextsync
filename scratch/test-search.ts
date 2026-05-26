import { db, userFaceEmbeddings } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const users = await db.select().from(userFaceEmbeddings).limit(2);
    if (users.length === 0) {
      console.log("No users enrolled.");
      return;
    }

    for (const u of users) {
      console.log(`\nTesting search for User ID: ${u.userId}`);
      const queryEmbeddingStr = `[${u.embedding.join(",")}]`;
      const threshold = 0.60;

      // Query photos matching Euclidean distance <= 0.60
      const query = sql`
        SELECT
          pfe.photo_id as "photoId",
          pfe.confidence as "confidence",
          (pfe.embedding <-> ${queryEmbeddingStr}::vector) as "distance",
          (1 - (pfe.embedding <=> ${queryEmbeddingStr}::vector)) as "score"
        FROM photo_face_embeddings pfe
        JOIN photos p ON p.id = pfe.photo_id
        WHERE p.status = 'approved'
          AND pfe.confidence >= 0.4
          AND (pfe.embedding <-> ${queryEmbeddingStr}::vector) <= ${threshold}
        ORDER BY "distance" ASC
        LIMIT 60
      `;

      const results = await db.execute(query);
      const rows = results.rows || [];
      console.log(`Found ${rows.length} matched photos:`);
      for (const row of rows as any) {
        console.log(`- Photo: ${row.photoId}, Distance: ${row.distance.toFixed(4)}, Score (Cosine Similarity): ${row.score.toFixed(4)}, Confidence: ${row.confidence.toFixed(4)}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
