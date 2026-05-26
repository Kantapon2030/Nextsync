// app/api/admin/seasons/route.ts
import { auth } from "@/lib/auth";
import { db, seasons } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const seasonList = await db.select().from(seasons).orderBy(desc(seasons.createdAt));
    return NextResponse.json({ success: true, seasons: seasonList });
  } catch (error) {
    console.error("GET seasons error:", error);
    return NextResponse.json({ error: "ไม่สามารถดึงข้อมูลปีการศึกษาได้" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { id, name, year, isActive } = await req.json();
    if (!id || !name || !year) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }

    // If setting active, deactivate others
    if (isActive) {
      await db.update(seasons).set({ isActive: false });
    }

    const [newSeason] = await db
      .insert(seasons)
      .values({
        id,
        name,
        year: parseInt(year),
        isActive: !!isActive,
      })
      .returning();

    return NextResponse.json({ success: true, season: newSeason });
  } catch (error) {
    console.error("POST season error:", error);
    return NextResponse.json({ error: "ไม่สามารถสร้างปีการศึกษาใหม่ได้" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
    }

    const { id, name, year, isActive } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ไม่พบรหัสปีการศึกษา" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (year !== undefined) updateData.year = parseInt(year);
    if (isActive !== undefined) {
      updateData.isActive = !!isActive;
      if (isActive) {
        // Deactivate others
        await db.update(seasons).set({ isActive: false });
      }
    }

    const [updatedSeason] = await db
      .update(seasons)
      .set(updateData)
      .where(eq(seasons.id, id))
      .returning();

    return NextResponse.json({ success: true, season: updatedSeason });
  } catch (error) {
    console.error("PATCH season error:", error);
    return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลปีการศึกษาได้" }, { status: 500 });
  }
}
