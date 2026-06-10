-- Drop old IVFFlat index if it exists
DROP INDEX IF EXISTS photo_face_emb_idx;

-- Create HNSW index for 512-dimension ArcFace face embeddings
-- Optimized for cosine similarity search (using vector_cosine_ops)
-- Tuning params: m=16, ef_construction=64
CREATE INDEX CONCURRENTLY IF NOT EXISTS photo_face_hnsw_idx 
  ON photo_face_embeddings 
  USING hnsw (embedding vector_cosine_ops) 
  WITH (m = 16, ef_construction = 64);

-- Standard relational indexes to speed up typical photo query filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS photos_status_idx 
  ON photos (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS photos_event_id_idx 
  ON photos (event_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS photos_season_id_idx 
  ON photos (season_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS events_is_active_idx 
  ON events (is_active);
