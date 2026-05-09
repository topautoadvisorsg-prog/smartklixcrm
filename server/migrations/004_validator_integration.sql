-- VALIDATOR INTEGRATION MIGRATION
-- Adds validator decision tracking to assist_queue table
-- Date: 2026-02-09
-- Priority: CRITICAL - Required for production governance

-- Add validator decision tracking columns
ALTER TABLE assist_queue 
  ADD COLUMN IF NOT EXISTS validator_decision TEXT,
  ADD COLUMN IF NOT EXISTS validator_risk_level TEXT;

-- Add indexes for validator queries
CREATE INDEX IF NOT EXISTS assist_queue_validator_decision_idx 
  ON assist_queue(validator_decision);

CREATE INDEX IF NOT EXISTS assist_queue_validator_risk_idx 
  ON assist_queue(validator_risk_level);

-- Add comments for documentation
COMMENT ON COLUMN assist_queue.validator_decision IS 'Validator decision: approve/reject';
COMMENT ON COLUMN assist_queue.validator_risk_level IS 'Validator risk assessment: low/medium/high/critical';
