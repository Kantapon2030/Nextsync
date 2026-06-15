UPDATE photos p
SET processing_state = 'ready'
WHERE p.status IN ('approved', 'rejected')
  AND NOT EXISTS (
    SELECT 1 FROM photo_processing_tasks t WHERE t.photo_id = p.id
  );

INSERT INTO photo_processing_tasks (photo_id, event_id, state, stage)
SELECT p.id, p.event_id, 'queued', 'queued'
FROM photos p
WHERE p.status = 'pending'
ON CONFLICT (photo_id) DO NOTHING;
