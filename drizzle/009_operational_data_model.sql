-- Migration: Operational Data Model Enhancement (Phase 1)
-- Date: 2026-04-20
-- Purpose: Add operational fields for professional services workflow
-- Impact: Jobs, Field Reports, Financial Records

-- ========================================
-- JOBS TABLE ENHANCEMENTS
-- ========================================

-- Rename value → estimated_value
ALTER TABLE "jobs" RENAME COLUMN "value" TO "estimated_value";

-- Add actual_value column (calculated from invoices)
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "actual_value" NUMERIC;

-- Rename description → scope
ALTER TABLE "jobs" RENAME COLUMN "description" TO "scope";

-- Update jobType default from 'lead' to 'project'
ALTER TABLE "jobs" ALTER COLUMN "job_type" SET DEFAULT 'project';

-- Add comments for documentation
COMMENT ON COLUMN jobs.estimated_value IS 'Estimated project value (renamed from value)';
COMMENT ON COLUMN jobs.actual_value IS 'Actual billed amount from invoices';
COMMENT ON COLUMN jobs.scope IS 'Service scope/deliverables (renamed from description)';

-- ========================================
-- FIELD REPORTS TABLE ENHANCEMENTS
-- ========================================

-- Rename notes → observations
ALTER TABLE "field_reports" RENAME COLUMN "notes" TO "observations";

-- Add structured reporting fields
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "actions_taken" TEXT;
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "recommendations" TEXT;

-- Add issue tracking fields
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT 'low';
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "resolution_status" TEXT DEFAULT 'open';

-- Add time tracking fields
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP DEFAULT NOW();
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP;
ALTER TABLE "field_reports" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN field_reports.observations IS 'What was observed/found (renamed from notes)';
COMMENT ON COLUMN field_reports.actions_taken IS 'What actions were performed';
COMMENT ON COLUMN field_reports.recommendations IS 'Recommended next steps';
COMMENT ON COLUMN field_reports.severity IS 'Issue severity: low, medium, high, critical';
COMMENT ON COLUMN field_reports.resolution_status IS 'Issue status: open, in_progress, resolved, escalated';
COMMENT ON COLUMN field_reports.started_at IS 'Work start time';
COMMENT ON COLUMN field_reports.completed_at IS 'Work end time';
COMMENT ON COLUMN field_reports.duration_minutes IS 'Calculated duration in minutes';

-- ========================================
-- FINANCIAL RECORDS TABLE ENHANCEMENTS
-- ========================================

-- Update category to have default value
ALTER TABLE "financial_records" ALTER COLUMN "category" SET DEFAULT 'other';
ALTER TABLE "financial_records" ALTER COLUMN "category" SET NOT NULL;

-- Add payment tracking fields
ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "is_estimated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT 'pending';
ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "transaction_ref" TEXT;
ALTER TABLE "financial_records" ADD COLUMN IF NOT EXISTS "is_billable" BOOLEAN NOT NULL DEFAULT true;

-- Add index on category for filtering
CREATE INDEX IF NOT EXISTS "financial_records_category_idx" ON "financial_records"("category");

-- Add comments for documentation
COMMENT ON COLUMN financial_records.category IS 'Transaction category: materials, labor, travel, equipment, subcontractor, permit, payment_received, refund, other';
COMMENT ON COLUMN financial_records.is_estimated IS 'Estimated vs actual flag';
COMMENT ON COLUMN financial_records.payment_status IS 'Payment status: pending, completed, failed, refunded';
COMMENT ON COLUMN financial_records.payment_method IS 'Payment method: cash, card, bank_transfer, check, online, other';
COMMENT ON COLUMN financial_records.transaction_ref IS 'External reference/transaction ID';
COMMENT ON COLUMN financial_records.is_billable IS 'Whether expense can be billed to client';

-- ========================================
-- VERIFY MIGRATION
-- ========================================

-- Check that all columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name IN ('jobs', 'field_reports', 'financial_records')
ORDER BY table_name, ordinal_position;
