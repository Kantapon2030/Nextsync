// app/api/settings/change-password/route.ts
import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  newPassword: z.string().min(6, "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร"),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Validate input
    const json = await req.json();
    const body = changePasswordSchema.parse(json);

    // 3. Retrieve user from db
    const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userList.length === 0) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้ใช้งานในระบบ" }, { status: 404 });
    }

    const user = userList[0];

    // 4. Verify current password
    const isPasswordValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
    }

    // 5. Hash new password
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);

    // 6. Update in db
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Change password API error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
