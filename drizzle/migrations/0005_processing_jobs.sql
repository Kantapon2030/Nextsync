CREATE TABLE IF NOT EXISTS processing_jobs (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL,
  status     TEXT DEFAULT 'queued'
             CHECK (status IN ('queued','running','done','error')),
  processed  INTEGER DEFAULT 0,
  total      INTEGER DEFAULT 0,
  error_msg  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  done_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status
  ON processing_jobs (status, created_at);
