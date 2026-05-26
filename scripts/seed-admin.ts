import { db, users, seasons, events } from "../lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

// Basic helper to load .env.local or .env
function loadEnv() {
  const envPaths = [
    path.join(__dirname, "../.env.local"),
    path.join(__dirname, "../.env")
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach(line => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          let val = parts.slice(1).join("=").trim();
          // Strip quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      });
      break;
    }
  }
}

async function main() {
  loadEnv();
  
  const studentId = process.env.ADMIN_STUDENT_ID || "00000";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD not set in .env.local");
  }
  const displayName = "ผู้ดูแลระบบ (Admin)";
  
  console.log(`Seeding admin user: ID=${studentId}...`);
  
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.studentId, studentId)).limit(1);
  if (existing.length > 0) {
    console.log("Admin user already exists. Updating password...");
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(users)
      .set({ passwordHash, role: "admin", displayName })
      .where(eq(users.studentId, studentId));
    console.log("Admin user updated successfully.");
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      studentId,
      passwordHash,
      displayName,
      role: "admin",
      faceEnrolled: false
    });
    console.log("Admin user created successfully.");
  }

  console.log("Seeding default season and events...");
  await db.insert(seasons).values({
    id: "sports_2567",
    name: "กีฬาสี ปีการศึกษา 2567",
    year: 2567,
    isActive: true,
  }).onConflictDoNothing();

  const defaultEvents = [
    { id: "day1", name: "วันที่ 1 — พิธีเปิด", type: "indoor" as const, sortOrder: 1, seasonId: "sports_2567" },
    { id: "day2", name: "วันที่ 2 — การแข่งขัน", type: "indoor" as const, sortOrder: 2, seasonId: "sports_2567" },
    { id: "day3", name: "วันที่ 3 — รอบชิงชนะเลิศ", type: "indoor" as const, sortOrder: 3, seasonId: "sports_2567" },
    { id: "outdoor_main", name: "วันกีฬาสีนอกสถานที่", type: "outdoor" as const, sortOrder: 4, seasonId: "sports_2567" },
  ];

  for (const e of defaultEvents) {
    await db.insert(events).values(e).onConflictDoNothing();
  }
  console.log("Season and events seeded successfully.");
  
  process.exit(0);
}

main().catch(err => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
