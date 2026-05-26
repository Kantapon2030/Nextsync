-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','photographer','team_leader','admin')),
  team_color    TEXT CHECK (team_color IN ('blue','green','red','yellow')),
  face_enrolled BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- Create user face embeddings table
CREATE TABLE IF NOT EXISTS user_face_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding   vector(128) NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_face_embeddings_embedding_idx ON user_face_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  date        DATE,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY CHECK (id IN ('blue','green','red','yellow')),
  name_th     TEXT NOT NULL,
  color_hex   TEXT NOT NULL,
  leader_id   UUID REFERENCES users(id),
  drive_folder_id TEXT,
  zone_description TEXT,
  photo_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL REFERENCES events(id),
  team_color      TEXT NOT NULL CHECK (team_color IN ('blue','green','red','yellow')),
  photographer_id UUID REFERENCES users(id),
  drive_file_id   TEXT NOT NULL UNIQUE,
  drive_url       TEXT NOT NULL,
  thumbnail_url   TEXT,
  thumbnail_sm    TEXT,
  filename        TEXT NOT NULL,
  file_size       INTEGER,
  width           INTEGER,
  height          INTEGER,
  blur_score      FLOAT,
  brightness      FLOAT,
  face_count      INTEGER DEFAULT 0,
  eyes_open       BOOLEAN,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('approved','rejected','pending')),
  reject_reason   TEXT CHECK (reject_reason IN ('blur','dark','bright','eyes','no_face')),
  manually_approved BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS photos_event_status_idx ON photos (event_id, status);
-- CREATE INDEX IF NOT EXISTS photos_team_status_idx ON photos (team_color, status);
CREATE INDEX IF NOT EXISTS photos_photographer_idx ON photos (photographer_id);

-- Create photo face embeddings table
CREATE TABLE IF NOT EXISTS photo_face_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  embedding   vector(128) NOT NULL,
  face_index  INTEGER DEFAULT 0,
  bbox_x      FLOAT, bbox_y FLOAT, bbox_w FLOAT, bbox_h FLOAT,
  confidence  FLOAT
);
CREATE INDEX IF NOT EXISTS photo_face_embeddings_embedding_idx ON photo_face_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create filter config table
CREATE TABLE IF NOT EXISTS filter_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  team_color            TEXT DEFAULT 'global',
  blur_min              FLOAT DEFAULT 80.0,
  brightness_min        FLOAT DEFAULT 0.12,
  brightness_max        FLOAT DEFAULT 0.88,
  eye_aspect_ratio_min  FLOAT DEFAULT 0.17,
  min_face_confidence   FLOAT DEFAULT 0.65,
  face_similarity_dist  FLOAT DEFAULT 0.45,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            UUID REFERENCES users(id)
);

-- Create team invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_color  TEXT NOT NULL,
  invited_by  UUID NOT NULL REFERENCES users(id),
  student_id  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('photographer','team_leader')),
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Insert seed values
INSERT INTO events (id, name, date) VALUES ('colorrun_2024', 'ShotSync Color Run 2024', '2024-11-15') ON CONFLICT DO NOTHING;

INSERT INTO teams VALUES
  ('blue',   'ทีมน้ำเงิน', '#2563EB', NULL, NULL, NULL, 0, NOW()),
  ('green',  'ทีมเขียว',   '#16A34A', NULL, NULL, NULL, 0, NOW()),
  ('red',    'ทีมแดง',     '#DC2626', NULL, NULL, NULL, 0, NOW()),
  ('yellow', 'ทีมเหลือง',  '#CA8A04', NULL, NULL, NULL, 0, NOW())
  ON CONFLICT DO NOTHING;

INSERT INTO filter_config (id, blur_min, brightness_min, brightness_max, eye_aspect_ratio_min, min_face_confidence, face_similarity_dist)
VALUES (1, 80.0, 0.12, 0.88, 0.17, 0.65, 0.45) ON CONFLICT DO NOTHING;
