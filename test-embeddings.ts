import { db, userFaceEmbeddings, photoFaceEmbeddings, photos } from "./lib/db";
import { sql, eq } from "drizzle-orm";

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

async function test() {
  try {
    console.log("Fetching enrolled user embeddings...");
    const userEmbeds = await db.select().from(userFaceEmbeddings).limit(5);
    console.log(`Enrolled users count: ${userEmbeds.length}`);
    if (userEmbeds.length === 0) {
      console.log("No enrolled users found in database.");
      return;
    }

    const user = userEmbeds[0];
    console.log(`Analyzing user ID: ${user.userId}`);
    const uEmb = user.embedding;
    console.log(`Enrolled embedding size: ${uEmb.length}, sample values: [${uEmb.slice(0, 5).join(", ")}]`);

    console.log("\nFetching photo face embeddings...");
    const photoEmbeds = await db
      .select({
        id: photoFaceEmbeddings.id,
        photoId: photoFaceEmbeddings.photoId,
        embedding: photoFaceEmbeddings.embedding,
        confidence: photoFaceEmbeddings.confidence,
        filename: photos.filename
      })
      .from(photoFaceEmbeddings)
      .innerJoin(photos, eq(photos.id, photoFaceEmbeddings.photoId))
      .limit(200);

    console.log(`Loaded ${photoEmbeds.length} photo face embeddings.`);
    if (photoEmbeds.length === 0) {
      console.log("No photo face embeddings found in DB.");
      return;
    }

    const sampleP = photoEmbeds[0];
    console.log(`Sample photo embedding size: ${sampleP.embedding.length}, sample values: [${sampleP.embedding.slice(0, 5).join(", ")}]`);

    // Compute similarities
    const matches = photoEmbeds.map(p => {
      const sim = cosineSimilarity(uEmb, p.embedding);
      return {
        photoId: p.photoId,
        filename: p.filename,
        confidence: p.confidence,
        similarity: sim
      };
    });

    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);

    console.log("\nTop 15 Cosine Similarity matches:");
    console.table(matches.slice(0, 15));

  } catch (error) {
    console.error("Diagnostic failed:", error);
  } finally {
    process.exit(0);
  }
}

test();
