-- Migration: Unify approval queues
-- Extends staged_proposals with governance columns from assist_queue
-- assist_queue retained for rollback safety — remove in future migration

ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'ai_chat';
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS user_request TEXT;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS validator_decision TEXT;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS validator_reason TEXT;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS rejected_by TEXT;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS escalated_to_operator BOOLEAN DEFAULT FALSE;
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS mode TEXT;

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_staged_proposals_status ON staged_proposals(status);
CREATE INDEX IF NOT EXISTS idx_staged_proposals_origin ON staged_proposals(origin);
CREATE INDEX IF NOT EXISTS idx_staged_proposals_idempotency_key ON staged_proposals(idempotency_key);
