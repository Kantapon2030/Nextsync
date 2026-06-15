import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function enqueuePhotoTasks(photoIds: string[], priority = 100) {
  if (photoIds.length === 0) return 0;

  const result = await db.execute(sql`
    INSERT INTO photo_processing_tasks (photo_id, event_id, state, stage, priority, next_retry_at, updated_at)
    SELECT p.id, p.event_id, 'queued', 'queued', ${priority}, now(), now()
    FROM photos p
    WHERE p.id = ANY(${photoIds}::uuid[])
    ON CONFLICT (photo_id) DO UPDATE SET
      state = 'queued',
      stage = 'queued',
      priority = LEAST(photo_processing_tasks.priority, EXCLUDED.priority),
      attempts = 0,
      lease_owner = NULL,
      lease_expires_at = NULL,
      next_retry_at = now(),
      error_code = NULL,
      error_message = NULL,
      completed_at = NULL,
      updated_at = now()
    RETURNING photo_id
  `);

  return result.rowCount ?? 0;
}

export async function retryFailedPhotoTasks(eventId?: string) {
  const eventFilter = eventId ? sql`AND event_id = ${eventId}` : sql``;
  const result = await db.execute(sql`
    UPDATE photo_processing_tasks
    SET state = 'queued',
        stage = 'queued',
        attempts = 0,
        lease_owner = NULL,
        lease_expires_at = NULL,
        next_retry_at = now(),
        error_code = NULL,
        error_message = NULL,
        updated_at = now()
    WHERE state = 'failed' ${eventFilter}
  `);
  return result.rowCount ?? 0;
}
