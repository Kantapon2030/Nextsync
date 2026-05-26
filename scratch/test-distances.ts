import { db, userFaceEmbeddings, photoFaceEmbeddings } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const users = await db.select().from(userFaceEmbeddings).limit(2);
    if (users.length < 2) {
      console.log("Not enough enrolled users to compare.");
      return;
    }

    const u1 = users[0];
    const u2 = users[1];

    console.log(`User 1 ID: ${u1.userId}`);
    console.log(`User 2 ID: ${u2.userId}`);

    // Compute distance between the two users
    const distResult = await db.execute(sql`
      SELECT 
        ${`[${u1.embedding.join(",")}]`}::vector <=> ${`[${u2.embedding.join(",")}]`}::vector as dist_cos,
        ${`[${u1.embedding.join(",")}]`}::vector <-> ${`[${u2.embedding.join(",")}]`}::vector as dist_eucl
    `);
    console.log("Distance between User 1 and User 2:", distResult.rows[0]);

    // Let's get distance distribution for User 1
    const u1EmbeddingStr = `[${u1.embedding.join(",")}]`;
    const distList = await db.execute(sql`
      SELECT 
        pfe.photo_id as "photoId",
        pfe.embedding <=> ${u1EmbeddingStr}::vector as dist_cos,
        pfe.embedding <-> ${u1EmbeddingStr}::vector as dist_eucl
      FROM photo_face_embeddings pfe
      ORDER BY dist_cos ASC
    `);

    console.log("\nTop 15 closest photos to User 1 (sorted by Cosine Distance):");
    for (let i = 0; i < Math.min(15, distList.rows.length); i++) {
      const row = distList.rows[i] as any;
      console.log(`Rank ${i+1}: Photo: ${row.photoId}, Cosine Dist: ${row.dist_cos}, Euclidean Dist: ${row.dist_eucl}`);
    }

    console.log("\nBottom 15 furthest photos to User 1 (sorted by Cosine Distance):");
    const len = distList.rows.length;
    for (let i = Math.max(0, len - 15); i < len; i++) {
      const row = distList.rows[i] as any;
      console.log(`Rank ${i+1}: Photo: ${row.photoId}, Cosine Dist: ${row.dist_cos}, Euclidean Dist: ${row.dist_eucl}`);
    }

  } catch (error) {
    console.error("Error comparing:", error);
  } finally {
    process.exit(0);
  }
}

main();
