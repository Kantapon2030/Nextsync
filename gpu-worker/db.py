import contextlib
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row


def backoff_seconds(attempt: int) -> int:
    return min(1800, 15 * (2 ** max(0, attempt - 1)))


class QueueDB:
    def __init__(self, url: str, worker_id: str, lease_seconds: int):
        self.url = url
        self.worker_id = worker_id
        self.lease_seconds = lease_seconds

    @contextlib.contextmanager
    def connect(self):
        with psycopg.connect(self.url, row_factory=dict_row) as conn:
            yield conn

    def claim(self):
        with self.connect() as conn, conn.transaction():
            task = conn.execute(
                """
                SELECT t.*, p.drive_file_id, p.filename
                FROM photo_processing_tasks t
                JOIN photos p ON p.id = t.photo_id
                WHERE (
                  t.state IN ('queued', 'retry')
                  AND COALESCE(t.next_retry_at, now()) <= now()
                ) OR (
                  t.state = 'running' AND t.lease_expires_at < now()
                )
                ORDER BY t.priority ASC, t.created_at ASC
                FOR UPDATE OF t SKIP LOCKED
                LIMIT 1
                """
            ).fetchone()
            if not task:
                return None
            lease = datetime.now(timezone.utc) + timedelta(seconds=self.lease_seconds)
            conn.execute(
                """
                UPDATE photo_processing_tasks
                SET state='running', stage='downloading', attempts=attempts+1,
                    lease_owner=%s, lease_expires_at=%s, stage_started_at=now(),
                    error_code=NULL, error_message=NULL, updated_at=now()
                WHERE id=%s
                """,
                (self.worker_id, lease, task["id"]),
            )
            conn.execute(
                "UPDATE photos SET processing_state='downloading' WHERE id=%s",
                (task["photo_id"],),
            )
            task["attempts"] += 1
            return task

    def stage(self, task_id, photo_id, stage):
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE photo_processing_tasks
                SET stage=%s, stage_started_at=now(), lease_expires_at=now()+(%s || ' seconds')::interval,
                    updated_at=now()
                WHERE id=%s AND lease_owner=%s
                """,
                (stage, self.lease_seconds, task_id, self.worker_id),
            )
            conn.execute("UPDATE photos SET processing_state=%s WHERE id=%s", (stage, photo_id))

    def complete(self, task, photo_values, faces):
        with self.connect() as conn, conn.transaction():
            conn.execute("DELETE FROM photo_face_embeddings WHERE photo_id=%s", (task["photo_id"],))
            for index, face in enumerate(faces):
                bbox = face["bbox"]
                conn.execute(
                    """
                    INSERT INTO photo_face_embeddings
                      (photo_id, embedding, face_index, bbox_x, bbox_y, bbox_w, bbox_h,
                       confidence, quality_score, model, model_version)
                    VALUES (%s, %s::vector, %s, %s, %s, %s, %s, %s, %s, 'buffalo_l', %s)
                    """,
                    (
                        task["photo_id"], face["vector"], index, bbox[0], bbox[1],
                        bbox[2] - bbox[0], bbox[3] - bbox[1], face["score"],
                        face["quality"], photo_values["model_version"],
                    ),
                )
            conn.execute(
                """
                UPDATE photos SET thumbnail_url=%s, thumbnail_sm=%s, width=%s, height=%s,
                  face_count=%s, status='approved', processing_state='ready',
                  processing_version=%s, processed_at=now(), reject_reason=NULL
                WHERE id=%s
                """,
                (
                    photo_values["thumbnail_url"], photo_values["thumbnail_sm"],
                    photo_values["width"], photo_values["height"], len(faces),
                    photo_values["model_version"], task["photo_id"],
                ),
            )
            conn.execute(
                """
                UPDATE photo_processing_tasks SET state='done', stage='ready', completed_at=now(),
                  lease_owner=NULL, lease_expires_at=NULL, updated_at=now()
                WHERE id=%s AND lease_owner=%s
                """,
                (task["id"], self.worker_id),
            )

    def fail(self, task, code: str, message: str):
        attempts = task["attempts"]
        state = "failed" if attempts >= task["max_attempts"] else "retry"
        delay = backoff_seconds(attempts)
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE photo_processing_tasks SET state=%s, stage='failed', error_code=%s,
                  error_message=%s, next_retry_at=now()+(%s || ' seconds')::interval,
                  lease_owner=NULL, lease_expires_at=NULL, updated_at=now()
                WHERE id=%s
                """,
                (state, code, message[:2000], delay, task["id"]),
            )
            conn.execute("UPDATE photos SET processing_state='failed' WHERE id=%s", (task["photo_id"],))

    def heartbeat(self, status, device, batch_size, gpu_memory_mb=0, current_task=None, error=None, processed=0, failed=0):
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO worker_heartbeats
                  (worker_id, status, hostname, version, model_version, device, gpu_name, gpu_memory_mb,
                   batch_size, current_task_id, processed_total, failed_total, last_error, last_seen_at)
                VALUES (%s,%s,%s,'1.0.0','buffalo_l-v1',%s,%s,%s,%s,%s,%s,%s,%s,now())
                ON CONFLICT (worker_id) DO UPDATE SET
                  status=CASE WHEN worker_heartbeats.status IN ('paused','draining')
                              THEN worker_heartbeats.status ELSE EXCLUDED.status END,
                  device=EXCLUDED.device, gpu_name=EXCLUDED.gpu_name, gpu_memory_mb=EXCLUDED.gpu_memory_mb, batch_size=EXCLUDED.batch_size,
                  current_task_id=EXCLUDED.current_task_id, processed_total=EXCLUDED.processed_total,
                  failed_total=EXCLUDED.failed_total, last_error=EXCLUDED.last_error, last_seen_at=now()
                """,
                (
                    self.worker_id, status, __import__("socket").gethostname(), device, device,
                    gpu_memory_mb, batch_size, current_task, processed, failed, error,
                ),
            )
            row = conn.execute("SELECT status FROM worker_heartbeats WHERE worker_id=%s", (self.worker_id,)).fetchone()
            return row["status"]
