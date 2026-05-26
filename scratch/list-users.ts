import { db, users } from "../lib/db";

async function main() {
  try {
    const list = await db.select().from(users);
    console.log("Users:", list.map(u => ({ id: u.id, studentId: u.studentId, displayName: u.displayName, role: u.role })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
