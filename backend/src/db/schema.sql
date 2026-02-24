-- BizNotify Database Schema
-- Run with: psql -U postgres -d biznotify -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  parent_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  first_name   TEXT,
  last_name    TEXT,
  metadata     JSONB DEFAULT '{}',
  opt_out      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact <-> Group (Many-to-Many)
CREATE TABLE IF NOT EXISTS contact_groups (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, group_id)
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  message_body TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  scheduled_at TIMESTAMPTZ,
  start_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  target_reach INTEGER,
  cloned_from_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','processing','completed','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cloned_from_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
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

-- Campaign Items (multiple scheduled messages under one campaign)
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

-- Campaign Item Audience (group + direct contacts)
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

-- Messages (individual send tracking)
CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id) ON DELETE CASCADE,
  target_phone      TEXT,
  termii_message_id TEXT,
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','expired')),
  error_reason      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_termii_message_id ON messages(termii_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contact_groups_group_id ON contact_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_cloned_from_campaign_id ON campaigns(cloned_from_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_at ON campaigns(start_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_at ON campaigns(end_at);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign_id ON campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_items_status_scheduled_at ON campaign_items(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign_status ON campaign_items(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_items_scheduled_at ON campaign_items(scheduled_at);

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_campaign_items_updated_at
  BEFORE UPDATE ON campaign_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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

-- Backfill legacy campaigns into one default campaign item
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

-- ── Default Admin Seed ──────────────────────────────────────────────
-- Email:    admin@biznotify.com
-- Password: admin1234
-- Hash generated with bcrypt cost=12. Change the password after first login!
INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@biznotify.com',
  '$2b$12$GGfVQKJ9qK2O.uhpEvhVaOxGM8BM65JZw0MuK4pSbz28v3iNan5Be',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
