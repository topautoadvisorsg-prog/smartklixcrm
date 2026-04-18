-- Migration: Add agent integration fields to contacts table
-- Date: 2026-04-17
-- Purpose: Support external agent system with contact routing and tracking

ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS niche TEXT,
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS contacts_niche_idx ON contacts(niche);
CREATE INDEX IF NOT EXISTS contacts_preferred_channel_idx ON contacts(preferred_channel);

-- Add comments for documentation
COMMENT ON COLUMN contacts.niche IS 'Industry/niche for agent routing (healthcare, construction, etc.)';
COMMENT ON COLUMN contacts.preferred_channel IS 'Preferred contact channel for agents (email, whatsapp, sms)';
COMMENT ON COLUMN contacts.last_contacted_at IS 'Timestamp of last agent contact';
COMMENT ON COLUMN contacts.next_follow_up_at IS 'Scheduled next follow-up timestamp';
