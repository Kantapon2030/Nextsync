-- Migration: Add watermark_enabled column to filter_config
ALTER TABLE filter_config ADD COLUMN IF NOT EXISTS watermark_enabled boolean DEFAULT true;
