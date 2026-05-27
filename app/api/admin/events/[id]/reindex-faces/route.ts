// app/api/admin/events/[id]/reindex-faces/route.ts
// Deletes all photo_face_embeddings for an event and re-triggers the pipeline
// to rebuild the face index using ArcFace 512-dim.
// Use this after: changing models, fixing thresholds, or data corruption.
import { auth } from "@/lib/auth";
import { db, events, photos, photoFaceEmbeddings } from "@/lib/db";
import { eq, inArray, sql } from "drizzle-orm";
import { triggerProcessing } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const eventId = params.id;

    // Verify event exists
    const eventList = await db
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!eventList[0]) {
      return NextResponse.json({ error: "ไม่พบ Event นี้" }, { status: 404 });
    }

    // Get all photo IDs for this event
    const eventPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.eventId, eventId));

    const photoIds = eventPhotos.map((p) => p.id);
    let deletedEmbeddings = 0;

    // Delete all face embeddings for these photos
    if (photoIds.length > 0) {
      // Process in chunks to avoid hitting query param limits
      const chunkSize = 100;
      for (let i = 0; i < photoIds.length; i += chunkSize) {
        const chunk = photoIds.slice(i, i + chunkSize);
        await db
          .delete(photoFaceEmbeddings)
          .where(inArray(photoFaceEmbeddings.photoId, chunk));
      }
      deletedEmbeddings = photoIds.length; // approximate
    }

    // Reset photo faceCount and re-queue all photos as 'pending' for reprocessing
    await db
      .update(photos)
      .set({
        faceCount: 0,
        status: "pending",
        processedAt: null,
      })
      .where(eq(photos.eventId, eventId));

    // Re-trigger the processing pipeline (will re-download, re-thumbnail, re-index faces)
    triggerProcessing(eventId).catch((err) => {
      console.error("[REINDEX] Pipeline trigger error:", err);
    });

    return NextResponse.json({
      success: true,
      event: eventList[0].name,
      photosQueued: photoIds.length,
      embeddingsDeleted: deletedEmbeddings,
      message: "Face re-index เริ่มต้นแล้ว ระบบกำลัง rebuild ใน background",
    });
  } catch (error) {
    console.error("POST reindex-faces error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถเริ่ม re-index ได้" },
      { status: 500 }
    );
  }
}
