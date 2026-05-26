
import { auth } from "@/lib/auth";
import { db, events } from "@/lib/db";
import { eq } from "drizzle-orm";
import { closeFolderUpload } from "@/lib/drive";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const eventId = params.id;
    const eventList = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    const event = eventList[0];

    if (!event) {
      return NextResponse.json({ error: "ไม่พบกิจกรรม" }, { status: 404 });
    }

    if (event.driveFolderId) {
      try {
        await closeFolderUpload(event.driveFolderId);
      } catch (err) {
        console.error(`Failed to close Drive folder permissions for folder ${event.driveFolderId}:`, err);
      }
    }

    // Set uploadOpen to false in DB
    const [updatedEvent] = await db
      .update(events)
      .set({ uploadOpen: false })
      .where(eq(events.id, eventId))
      .returning();

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: "Uploads closed and folder is read-only",
    });
  } catch (error) {
    console.error("POST close-upload error:", error);
    return NextResponse.json({ error: "ไม่สามารถปิดการอัปโหลดได้" }, { status: 500 });
  }
}
