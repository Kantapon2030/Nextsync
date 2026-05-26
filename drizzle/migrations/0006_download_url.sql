ALTER TABLE photos ADD COLUMN download_url TEXT;

-- backfill ด้วย formula จาก drive_file_id ที่มีอยู่
UPDATE photos
SET download_url = 'https://drive.google.com/uc?export=download&id=' || drive_file_id
WHERE download_url IS NULL AND drive_file_id IS NOT NULL;
