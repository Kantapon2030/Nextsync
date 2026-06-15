\set worker_password `echo "$SHOTSYNC_WORKER_DB_PASSWORD"`

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shotsync_worker') THEN
    CREATE ROLE shotsync_worker LOGIN;
  END IF;
END $$;

ALTER ROLE shotsync_worker PASSWORD :'worker_password';
GRANT CONNECT ON DATABASE postgres TO shotsync_worker;
GRANT USAGE ON SCHEMA public TO shotsync_worker;
GRANT SELECT, UPDATE ON photos, photo_processing_tasks, worker_heartbeats TO shotsync_worker;
GRANT SELECT ON events TO shotsync_worker;
GRANT SELECT, INSERT, DELETE ON photo_face_embeddings TO shotsync_worker;
