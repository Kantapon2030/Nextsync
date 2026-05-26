// app/api/register/route.ts
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  studentId: z.string(),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
  displayName: z.string().optional(),
  role: z.enum(["student", "photographer"]).optional().default("student"),
  inviteCode: z.string().optional(),
}).refine((data) => {
  if (data.role === "student") {
    return /^\d{5}$/.test(data.studentId);
  }
  return data.studentId.length >= 3;
}, {
  message: "รหัสนักเรียนต้องเป็นตัวเลข 5 หลัก",
  path: ["studentId"],
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = registerSchema.parse(json);

    // If photographer, validate invite code
    if (body.role === "photographer") {
      if (body.inviteCode !== process.env.PHOTOGRAPHER_INVITE_CODE) {
        return NextResponse.json(
          { error: "รหัสเชิญช่างภาพไม่ถูกต้อง" },
          { status: 403 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.studentId, body.studentId))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "รหัสผู้ใช้งาน/รหัสนักเรียนนี้ถูกใช้ในการสมัครสมาชิกไปแล้ว" },
        { status: 400 }
      );
    }

    // Hash password with 12 rounds
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Determine final role
    let finalRole: "student" | "photographer" | "admin" = body.role;
    if (body.role === "student") {
      const adminStudentId = process.env.ADMIN_STUDENT_ID || "00000";
      if (body.studentId === adminStudentId) {
        finalRole = "admin";
      }
    }

    const [newUser] = await db
      .insert(users)
      .values({
        studentId: body.studentId,
        passwordHash,
        displayName: body.displayName || (finalRole === "photographer" ? `ช่างภาพ ${body.studentId}` : `นักเรียน ${body.studentId}`),
        role: finalRole,
        faceEnrolled: false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      userId: newUser.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
