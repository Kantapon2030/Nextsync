ALTER TABLE photos ADD COLUMN IF NOT EXISTS source_modified_at timestamptz;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS source_checksum text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS source_sync_status text DEFAULT 'active';
ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_state text DEFAULT 'queued';
ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_version text;

ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'buffalo_l-v1';
ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'template';
ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS angle text;
ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS quality_score double precision;

ALTER TABLE photo_face_embeddings ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'buffalo_l-v1';
ALTER TABLE photo_face_embeddings ADD COLUMN IF NOT EXISTS quality_score double precision;

CREATE TABLE IF NOT EXISTS photo_processing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL UNIQUE REFERENCES photos(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  lease_owner text,
  lease_expires_at timestamptz,
  next_retry_at timestamptz DEFAULT now(),
  error_code text,
  error_message text,
  model_version text NOT NULL DEFAULT 'buffalo_l-v1',
  stage_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'online',
  hostname text,
  version text,
  model_version text,
  device text,
  gpu_name text,
  gpu_memory_mb integer,
  batch_size integer,
  current_task_id uuid,
  processed_total integer NOT NULL DEFAULT 0,
  failed_total integer NOT NULL DEFAULT 0,
  last_error text,
  last_seen_at timestamptz DEFAULT now(),
  started_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_processing_state_idx ON photos(processing_state);
CREATE INDEX IF NOT EXISTS photos_event_status_created_idx ON photos(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS photo_processing_tasks_claim_idx ON photo_processing_tasks(state, next_retry_at, priority);
CREATE INDEX IF NOT EXISTS photo_processing_tasks_event_state_idx ON photo_processing_tasks(event_id, state);

INSERT INTO photo_processing_tasks (photo_id, event_id, state, stage)
SELECT id, event_id, 'queued', 'queued'
FROM photos
WHERE status = 'pending'
ON CONFLICT (photo_id) DO NOTHING;
