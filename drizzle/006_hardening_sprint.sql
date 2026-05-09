-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Staged proposals table
CREATE TABLE IF NOT EXISTS "staged_proposals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "status" text NOT NULL DEFAULT 'pending',
  "actions" jsonb NOT NULL,
  "reasoning" text,
  "risk_level" text,
  "summary" text,
  "related_entity" jsonb,
  "approved_by" text,
  "approved_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Add new columns to contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
