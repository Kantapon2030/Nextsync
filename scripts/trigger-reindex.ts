import { db, events, photos, photoFaceEmbeddings } from "../lib/db";
import { eq, inArray } from "drizzle-orm";
import { triggerProcessing } from "../lib/pipeline";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("กรุณาระบุ eventId! ตัวอย่าง: npx tsx scripts/trigger-reindex.ts colorrun_2024");
    process.exit(1);
  }

  console.log(`🔍 กำลังตรวจสอบข้อมูลสำหรับ Event ID: ${eventId}...`);

  // Verify event exists
  const eventList = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!eventList[0]) {
    console.error(`❌ ไม่พบ Event ID: ${eventId} ในฐานข้อมูล`);
    process.exit(1);
  }

  console.log(`Found Event: ${eventList[0].name}`);

  // Get all photo IDs for this event
  const eventPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.eventId, eventId));

  const photoIds = eventPhotos.map((p) => p.id);
  console.log(`📸 พบรูปภาพทั้งหมดใน Event นี้: ${photoIds.length} รูป`);

  // Delete all face embeddings for these photos
  if (photoIds.length > 0) {
    console.log("🧹 กำลังลบข้อมูล Face Embeddings เก่าออก...");
    const chunkSize = 100;
    for (let i = 0; i < photoIds.length; i += chunkSize) {
      const chunk = photoIds.slice(i, i + chunkSize);
      await db
        .delete(photoFaceEmbeddings)
        .where(inArray(photoFaceEmbeddings.photoId, chunk));
    }
  }

  // Reset photo faceCount and re-queue all photos as 'pending' for reprocessing
  console.log("🔄 กำลังรีเซ็ตสถานะรูปภาพทั้งหมดเป็น pending...");
  await db
    .update(photos)
    .set({
      faceCount: 0,
      status: "pending",
      processedAt: null,
    })
    .where(eq(photos.eventId, eventId));

  console.log("⚡ กำลังเริ่มรัน Pipeline สแกนใบหน้าใหม่ใน Background...");
  await triggerProcessing(eventId);

  console.log("✓ เริ่มต้น Pipeline สำเร็จแล้ว! คุณสามารถปิดสคริปต์นี้ได้เลย ระบบจะรันต่อใน background");
  
  // Wait a few seconds to let the background promise start logging
  await new Promise((resolve) => setTimeout(resolve, 5000));
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ เกิดข้อผิดพลาด:", err);
  process.exit(1);
});
