BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS cloned_from_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS campaign_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title               TEXT,
  message_body        TEXT NOT NULL,
  channel             TEXT NOT NULL DEFAULT 'generic' CHECK (channel IN ('sms', 'whatsapp', 'generic', 'dnd')),
  sender_id           TEXT,
  message_type        TEXT NOT NULL DEFAULT 'plain' CHECK (message_type IN ('plain', 'unicode')),
  scheduled_at        TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft','scheduled','queued','sending','sent','partial','failed','cancelled')),
  queue_job_id        TEXT,
  position            INTEGER NOT NULL,
  locked_at           TIMESTAMPTZ,
  cloned_from_item_id UUID REFERENCES campaign_items(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_campaign_items_campaign_position UNIQUE (campaign_id, position)
);

CREATE TABLE IF NOT EXISTS campaign_item_groups (
  campaign_item_id UUID NOT NULL REFERENCES campaign_items(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_item_id, group_id)
);

CREATE TABLE IF NOT EXISTS campaign_item_contacts (
  campaign_item_id UUID NOT NULL REFERENCES campaign_items(id) ON DELETE CASCADE,
  contact_id       UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_item_id, contact_id)
);

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'campaign_item_id'
    ) THEN
      ALTER TABLE public.messages
        ADD COLUMN campaign_item_id UUID REFERENCES campaign_items(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'campaign_item_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_messages_campaign_item_id ON public.messages(campaign_item_id);
    CREATE INDEX IF NOT EXISTS idx_messages_campaign_item_status ON public.messages(campaign_item_id, status);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_campaigns_cloned_from_campaign_id ON campaigns(cloned_from_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign_id ON campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_items_status_scheduled_at ON campaign_items(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign_status ON campaign_items(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_items_scheduled_at ON campaign_items(scheduled_at);

CREATE OR REPLACE TRIGGER trg_campaign_items_updated_at
  BEFORE UPDATE ON campaign_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO campaign_items (campaign_id, title, message_body, channel, scheduled_at, status, position, created_at, updated_at)
SELECT
  c.id,
  c.title,
  c.message_body,
  CASE WHEN c.channel = 'sms' THEN 'generic' ELSE c.channel END,
  COALESCE(c.scheduled_at, c.created_at),
  CASE
    WHEN c.status = 'failed' THEN 'failed'
    WHEN c.status = 'completed' THEN 'sent'
    WHEN c.status = 'processing' THEN 'sending'
    ELSE 'scheduled'
  END,
  1,
  c.created_at,
  c.updated_at
FROM campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM campaign_items ci WHERE ci.campaign_id = c.id
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'campaign_item_id'
  ) THEN
    UPDATE public.messages m
    SET campaign_item_id = ci.id
    FROM campaign_items ci
    WHERE m.campaign_id = ci.campaign_id
      AND ci.position = 1
      AND m.campaign_item_id IS NULL;
  END IF;
END $$;

COMMIT;
