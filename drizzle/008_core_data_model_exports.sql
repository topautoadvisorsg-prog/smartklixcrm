-- Migration: Core Data Model + Export Support
-- Date: 2026-04-20
-- Purpose: Add field reports, financial records, and contact tracking fields

-- Add contact type and source fields to contacts table
ALTER TABLE "contacts" 
  ADD COLUMN IF NOT EXISTS "contact_type" TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';

-- Add comments for documentation
COMMENT ON COLUMN contacts.contact_type IS 'Contact type: individual or business';
COMMENT ON COLUMN contacts.source IS 'Lead source: crawler, manual, referral, intake';

-- Create field_reports table
CREATE TABLE IF NOT EXISTS "field_reports" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" VARCHAR NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "contact_id" VARCHAR NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL DEFAULT 'progress', -- progress | issue | completion | inspection
  "notes" TEXT,
  "photos" TEXT[] DEFAULT ARRAY[]::text[],
  "status_update" TEXT,
  "created_by" VARCHAR REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create financial_records table
CREATE TABLE IF NOT EXISTS "financial_records" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" VARCHAR REFERENCES "jobs"("id") ON DELETE SET NULL,
  "contact_id" VARCHAR NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL, -- income | expense
  "category" TEXT,
  "amount" NUMERIC NOT NULL,
  "description" TEXT,
  "date" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "field_reports_job_id_idx" ON "field_reports"("job_id");
CREATE INDEX IF NOT EXISTS "field_reports_contact_id_idx" ON "field_reports"("contact_id");
CREATE INDEX IF NOT EXISTS "field_reports_type_idx" ON "field_reports"("type");

CREATE INDEX IF NOT EXISTS "financial_records_job_id_idx" ON "financial_records"("job_id");
CREATE INDEX IF NOT EXISTS "financial_records_contact_id_idx" ON "financial_records"("contact_id");
CREATE INDEX IF NOT EXISTS "financial_records_type_idx" ON "financial_records"("type");
CREATE INDEX IF NOT EXISTS "financial_records_date_idx" ON "financial_records"("date");

-- Add comments for documentation
COMMENT ON TABLE field_reports IS 'Field worker documentation tied to jobs and contacts';
COMMENT ON TABLE financial_records IS 'Internal job economics tracking (separate from invoices/payments)';
COMMENT ON COLUMN financial_records.type IS 'Transaction type: income or expense';
