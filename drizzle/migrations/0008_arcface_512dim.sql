-- Migration: 0008_arcface_512dim.sql
-- Upgrade face embedding vectors from 128-dim (face-api.js) to 512-dim (ArcFace)
-- WARNING: All existing face embeddings will be deleted. Users must re-enroll.

-- Step 1: Drop existing pgvector indexes (required before column changes)
DROP INDEX IF EXISTS user_face_emb_idx;
DROP INDEX IF EXISTS photo_face_emb_idx;
-- Also drop any older naming patterns
DROP INDEX IF EXISTS user_face_embeddings_embedding_idx;
DROP INDEX IF EXISTS photo_face_embeddings_embedding_idx;

-- Step 2: Migrate user_face_embeddings
ALTER TABLE user_face_embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE user_face_embeddings ADD COLUMN embedding vector(512);
ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS faces_used INTEGER DEFAULT 1;
ALTER TABLE user_face_embeddings ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'ArcFace';

-- Step 3: Migrate photo_face_embeddings
ALTER TABLE photo_face_embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE photo_face_embeddings ADD COLUMN embedding vector(512);
ALTER TABLE photo_face_embeddings ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'ArcFace';

-- Step 4: Create IVFFlat indexes for cosine similarity search
-- IVFFlat is faster than HNSW for 10K–100K records
-- Note: indexes require data to be present; empty table is fine for creation
CREATE INDEX user_face_emb_idx
  ON user_face_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX photo_face_emb_idx
  ON photo_face_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 5: Reset all users — they must re-enroll with ArcFace
UPDATE users SET face_enrolled = false;
DELETE FROM user_face_embeddings;
DELETE FROM photo_face_embeddings;

-- Step 6: Reset photo face counts (will be re-indexed by pipeline)
UPDATE photos SET face_count = 0 WHERE face_count > 0;
