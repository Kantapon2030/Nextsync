// app/api/admin/events/route.ts
import { auth } from "@/lib/auth";
import { db, events } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { extractDriveFolderId } from "@/lib/drive";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("seasonId");

    if (!seasonId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสปีการศึกษา" }, { status: 400 });
    }

    const eventList = await db
      .select()
      .from(events)
      .where(and(eq(events.seasonId, seasonId), eq(events.isActive, true)))
      .orderBy(events.sortOrder);

    return NextResponse.json({ success: true, events: eventList });
  } catch (error) {
    console.error("GET admin events error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลรายการกิจกรรมได้" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { id, seasonId, name, type, date, description, sortOrder } = await req.json();
    if (!id || !seasonId || !name || !type) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }

    const [newEvent] = await db
      .insert(events)
      .values({
        id,
        seasonId,
        name,
        type,
        date: date ? date : null,
        description: description || null,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, event: newEvent });
  } catch (error) {
    console.error("POST admin event error:", error);
    return NextResponse.json({ error: "ไม่สามารถสร้างกิจกรรมใหม่ได้" }, { status: 500 });
  }
}


export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { id, name, type, date, description, sortOrder, isActive, driveFolderId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ไม่พบรหัสกิจกรรม" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (date !== undefined) updateData.date = date ? date : null;
    if (description !== undefined) updateData.description = description || null;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) updateData.isActive = !!isActive;
    if (driveFolderId !== undefined) {
      const cleanFolderId = extractDriveFolderId(driveFolderId);
      updateData.driveFolderId = cleanFolderId || null;
      updateData.driveFolderUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : null;
      updateData.uploadUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : null;
    }

    const [updatedEvent] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error("PATCH admin event error:", error);
    return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลกิจกรรมได้" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ไม่พบรหัสกิจกรรม" }, { status: 400 });
    }

    // Soft delete by setting isActive to false
    const [deletedEvent] = await db
      .update(events)
      .set({ isActive: false })
      .where(eq(events.id, id))
      .returning();

    return NextResponse.json({ success: true, event: deletedEvent });
  } catch (error) {
    console.error("DELETE admin event error:", error);
    return NextResponse.json({ error: "ไม่สามารถลบกิจกรรมได้" }, { status: 500 });
  }
}
