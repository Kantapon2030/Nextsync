import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const checks = {
    orphanEmbeddings: sql`SELECT count(*)::int AS count FROM photo_face_embeddings pfe LEFT JOIN photos p ON p.id=pfe.photo_id WHERE p.id IS NULL`,
    duplicateDriveIds: sql`SELECT count(*)::int AS count FROM (SELECT drive_file_id FROM photos GROUP BY drive_file_id HAVING count(*) > 1) duplicates`,
    readyWithoutThumbnail: sql`SELECT count(*)::int AS count FROM photos WHERE processing_state='ready' AND (thumbnail_url IS NULL OR thumbnail_sm IS NULL)`,
    activeWithoutTask: sql`SELECT count(*)::int AS count FROM photos p LEFT JOIN photo_processing_tasks t ON t.photo_id=p.id WHERE p.processing_state NOT IN ('ready','failed') AND t.id IS NULL`,
    doneTaskNotReady: sql`SELECT count(*)::int AS count FROM photo_processing_tasks t JOIN photos p ON p.id=t.photo_id WHERE t.state='done' AND p.processing_state <> 'ready'`,
  };

  const result: Record<string, number> = {};
  for (const [name, query] of Object.entries(checks)) {
    const rows = await db.execute(query);
    result[name] = Number(rows.rows?.[0]?.count ?? 0);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(Object.values(result).some((count) => count > 0) ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
