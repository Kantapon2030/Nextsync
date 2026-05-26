// app/api/admin/users/route.ts
import { auth } from "@/lib/auth";
import { db, users, userFaceEmbeddings } from "@/lib/db";
import { eq, or, ilike, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateUserSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["student", "photographer", "admin"]).optional(),
  resetFace: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";

    let conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(users.studentId, `%${search}%`),
          ilike(users.displayName, `%${search}%`)
        )
      );
    }

    if (role) {
      conditions.push(eq(users.role, role as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const usersList = await db
      .select({
        id: users.id,
        studentId: users.studentId,
        displayName: users.displayName,
        role: users.role,
        faceEnrolled: users.faceEnrolled,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(whereClause)
      .orderBy(users.createdAt);

    return NextResponse.json({
      success: true,
      users: usersList,
    });
  } catch (error) {
    console.error("GET admin users error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 401 });
    }

    const json = await req.json();
    const body = updateUserSchema.parse(json);

    // Fetch existing user to ensure they exist
    const [existingUser] = await db.select().from(users).where(eq(users.id, body.id)).limit(1);
    if (!existingUser) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้ที่ต้องการแก้ไข" }, { status: 404 });
    }

    const updateData: Partial<typeof users.$inferInsert> = {};

    if (body.role !== undefined) {
      updateData.role = body.role;
    }

    if (body.resetFace === true) {
      updateData.faceEnrolled = false;
      // Delete face embeddings from database
      await db.delete(userFaceEmbeddings).where(eq(userFaceEmbeddings.userId, body.id));
    }

    const [rawUpdatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, body.id))
      .returning();

    const updatedUser = rawUpdatedUser ? {
      id: rawUpdatedUser.id,
      studentId: rawUpdatedUser.studentId,
      displayName: rawUpdatedUser.displayName,
      role: rawUpdatedUser.role,
      faceEnrolled: rawUpdatedUser.faceEnrolled,
      createdAt: rawUpdatedUser.createdAt,
      lastLogin: rawUpdatedUser.lastLogin,
    } : undefined;

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("PUT admin users error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ใช้งาน" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "ไม่ได้รับอนุญาต เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "ไม่พบไอดีผู้ใช้งานที่ต้องการลบ" }, { status: 400 });
    }

    // Delete the user (cascade deletes userFaceEmbeddings because of DB reference option)
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      message: "ลบผู้ใช้สำเร็จแล้ว",
    });
  } catch (error) {
    console.error("DELETE admin users error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบผู้ใช้งาน" }, { status: 500 });
  }
}
