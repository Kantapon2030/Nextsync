
import { auth } from "@/lib/auth";
import { db, events } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createDriveFolder } from "@/lib/drive";
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

    // Create folder in Drive using the event's name
    const folder = await createDriveFolder(event.name);

    // Save to DB
    const [updatedEvent] = await db
      .update(events)
      .set({
        driveFolderId: folder.folderId,
        driveFolderUrl: folder.folderUrl,
        uploadUrl: folder.uploadUrl,
      })
      .where(eq(events.id, eventId))
      .returning();

    return NextResponse.json({
      success: true,
      uploadUrl: folder.uploadUrl,
      driveFolderUrl: folder.folderUrl,
      event: updatedEvent,
      message: "Drive folder created and shared",
    });
  } catch (error) {
    console.error("POST create-folder error:", error);
    return NextResponse.json({ error: "ไม่สามารถสร้างโฟลเดอร์ Google Drive ได้" }, { status: 500 });
  }
}
