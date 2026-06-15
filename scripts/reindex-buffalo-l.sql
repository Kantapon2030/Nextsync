-- Run once during the announced maintenance window after taking a backup.
BEGIN;
DELETE FROM photo_face_embeddings;
DELETE FROM user_face_embeddings;
UPDATE users SET face_enrolled = false;
UPDATE photos SET processing_state = 'queued', processing_version = NULL;
INSERT INTO photo_processing_tasks (photo_id, event_id, state, stage)
SELECT id, event_id, 'queued', 'queued' FROM photos
ON CONFLICT (photo_id) DO UPDATE SET
  state='queued', stage='queued', attempts=0, next_retry_at=now(),
  lease_owner=NULL, lease_expires_at=NULL, completed_at=NULL, updated_at=now();
COMMIT;
