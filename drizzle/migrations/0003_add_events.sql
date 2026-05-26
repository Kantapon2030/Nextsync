-- Migration: Add Seasons and Event Hierarchy System

-- 1. Drop existing event_id constraint from photos
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_event_id_fkey;

-- 2. Drop existing events table
DROP TABLE IF EXISTS events;

-- 3. Create event_type enum type if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM ('indoor', 'outdoor');
  END IF;
END $$;

-- 4. Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  year        INTEGER NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create events table with season_id relation
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  season_id   TEXT NOT NULL REFERENCES seasons(id),
  name        TEXT NOT NULL,
  type        event_type NOT NULL,
  date        DATE,
  sort_order  INTEGER DEFAULT 0,
  description TEXT,
  cover_url   TEXT,
  is_active   BOOLEAN DEFAULT true,
  photo_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add columns to photos
ALTER TABLE photos ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES seasons(id);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS timeslot TEXT CHECK (timeslot IN ('morning', 'afternoon'));

-- 7. Seed initial season and events
INSERT INTO seasons (id, name, year, is_active, created_at)
VALUES ('sports_2567', 'กีฬาสี ปีการศึกษา 2567', 2567, true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, season_id, name, type, date, sort_order, is_active) VALUES
  ('day1', 'sports_2567', 'วันที่ 1 — พิธีเปิด', 'indoor', '2024-11-13', 1, true),
  ('day2', 'sports_2567', 'วันที่ 2 — การแข่งขัน', 'indoor', '2024-11-14', 2, true),
  ('day3', 'sports_2567', 'วันที่ 3 — รอบชิงชนะเลิศ', 'indoor', '2024-11-15', 3, true),
  ('outdoor_main', 'sports_2567', 'วันกีฬาสีนอกสถานที่', 'outdoor', '2024-11-16', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 8. Fix existing photos data consistency (map to seeded event)
UPDATE photos SET season_id = 'sports_2567', event_id = 'day3' WHERE event_id = 'colorrun_2024' OR event_id IS NULL;

-- 9. Add foreign key back
ALTER TABLE photos ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id);
