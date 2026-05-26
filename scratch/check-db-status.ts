import { db, photos, photoFaceEmbeddings, userFaceEmbeddings } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const totalPhotos = await db.select({ count: sql<number>`count(*)` }).from(photos);
    const pendingPhotos = await db.select({ count: sql<number>`count(*)` }).from(photos).where(sql`status = 'pending'`);
    const approvedPhotos = await db.select({ count: sql<number>`count(*)` }).from(photos).where(sql`status = 'approved'`);
    const rejectedPhotos = await db.select({ count: sql<number>`count(*)` }).from(photos).where(sql`status = 'rejected'`);
    const totalPhotoEmbeddings = await db.select({ count: sql<number>`count(*)` }).from(photoFaceEmbeddings);
    const totalUserEmbeddings = await db.select({ count: sql<number>`count(*)` }).from(userFaceEmbeddings);

    console.log("Database status:");
    console.log("- Total photos:", totalPhotos[0]?.count);
    console.log("- Pending photos:", pendingPhotos[0]?.count);
    console.log("- Approved photos:", approvedPhotos[0]?.count);
    console.log("- Rejected photos:", rejectedPhotos[0]?.count);
    console.log("- Total photo face embeddings:", totalPhotoEmbeddings[0]?.count);
    console.log("- Total user face embeddings:", totalUserEmbeddings[0]?.count);
  } catch (error) {
    console.error("Error reading database status:", error);
  } finally {
    process.exit(0);
  }
}

main();
