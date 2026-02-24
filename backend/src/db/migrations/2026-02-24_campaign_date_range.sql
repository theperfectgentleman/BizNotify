BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_reach INTEGER;

UPDATE campaigns
SET start_at = COALESCE(start_at, created_at, NOW())
WHERE start_at IS NULL;

UPDATE campaigns
SET end_at = COALESCE(end_at, scheduled_at, start_at + INTERVAL '30 days')
WHERE end_at IS NULL;

ALTER TABLE campaigns ALTER COLUMN start_at SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN end_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_campaigns_range_valid'
      AND conrelid = 'campaigns'::regclass
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT ck_campaigns_range_valid CHECK (start_at <= end_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_start_at ON campaigns(start_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_at ON campaigns(end_at);

COMMIT;
