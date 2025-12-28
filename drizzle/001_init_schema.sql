-- TopOut Platform - Initial Schema Migration
-- Version: 1.0.0-audit
-- Date: January 2025

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL DEFAULT 'user',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "avatar" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "client_id" VARCHAR REFERENCES "contacts"("id"),
  "status" TEXT NOT NULL DEFAULT 'new',
  "value" INTEGER,
  "deadline" TIMESTAMP,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "contact_id" VARCHAR REFERENCES "contacts"("id"),
  "scheduled_at" TIMESTAMP NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 60,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Notes table
CREATE TABLE IF NOT EXISTS "notes" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" VARCHAR,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "pinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS "files" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT,
  "uploaded_by" VARCHAR REFERENCES "users"("id"),
  "entity_type" TEXT,
  "entity_id" VARCHAR,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR REFERENCES "users"("id"),
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" VARCHAR,
  "details" JSONB,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_contacts_email" ON "contacts"("email");
CREATE INDEX IF NOT EXISTS "idx_contacts_status" ON "contacts"("status");
CREATE INDEX IF NOT EXISTS "idx_jobs_client_id" ON "jobs"("client_id");
CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_appointments_contact_id" ON "appointments"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_appointments_scheduled_at" ON "appointments"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_notes_entity" ON "notes"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_files_entity" ON "files"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_user_id" ON "audit_log"("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_timestamp" ON "audit_log"("timestamp");
