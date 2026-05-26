ALTER TABLE events
  ADD COLUMN drive_folder_id  TEXT,
  ADD COLUMN drive_folder_url TEXT,
  ADD COLUMN upload_url       TEXT,
  ADD COLUMN last_synced_at   TIMESTAMPTZ,
  ADD COLUMN sync_status      TEXT DEFAULT 'idle',
  ADD COLUMN upload_open      BOOLEAN DEFAULT true;
