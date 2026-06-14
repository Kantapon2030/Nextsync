ALTER TABLE filter_config
  ADD COLUMN IF NOT EXISTS ef_search integer DEFAULT 64,
  ADD COLUMN IF NOT EXISTS max_results integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pipeline_batch_size integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS thumbnail_size_lg integer DEFAULT 800,
  ADD COLUMN IF NOT EXISTS thumbnail_size_sm integer DEFAULT 400;
