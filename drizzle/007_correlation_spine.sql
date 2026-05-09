-- Phase 1: Add correlation spine to system
-- Adds correlation_id columns for tracing events across proposal → ledger → dispatch → callback

-- Add correlation_id to staged_proposals
ALTER TABLE staged_proposals ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS staged_proposals_correlation_id_idx ON staged_proposals(correlation_id);

-- Add correlation_id to automation_ledger (already added via schema, but ensure it exists)
ALTER TABLE automation_ledger ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS automation_ledger_correlation_id_idx ON automation_ledger(correlation_id);

-- Add comments for documentation
COMMENT ON COLUMN staged_proposals.correlation_id IS 'Links proposal → ledger → dispatch → callback for event tracing';
COMMENT ON COLUMN automation_ledger.correlation_id IS 'Links related events across proposal/dispatch/callback for event tracing';
