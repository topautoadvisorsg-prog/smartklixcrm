# Smart Klix CRM - White-Label AI CRM Platform
**Version:** 2.3.0 (Full Test Suite + Auth Hardening + Dead Code Purge)  
**Status:** Production-Ready — 191/192 tests passing  
**Last Updated:** May 9, 2026  
**Clean Code Doctrine:** Enforced  
**Architecture:** CRM Brain + External Agent Execution (Webhook-Based)

> **v2.3.0 Changes:** Complete automated test suite (8 test files, 191 passing). Fixed auth middleware PUBLIC_PATHS bug, job state machine CRM statuses, circuit breaker test isolation, intake/sync endpoint contract, MemStorage field persistence, security token dynamic resolution. Purged 12 dead utility files + 1 unmounted routes file. Hardcoded `userId` replaced with dynamic middleware resolution.

## Table of Contents
- [System Audit](#-critical-setup-requirements)
- [Overview](#overview)
- [Proposal System](#proposal-system)
- [AI Validation (Simple Function)](#ai-validation-simple-function)
- [External Agent Integration](#external-agent-integration)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Admin Chat & Operational Modes](#admin-chat--operational-modes)
- [AI Tools & Execution](#ai-tools--execution)
- [Clean Code Standards](#clean-code-standards)
- [Developer Workflow](#developer-workflow)
- [Troubleshooting](#troubleshooting)
- [Known Issues](#known-issues)

## Overview
Smart Klix CRM is a production-grade, single-tenant, white-label AI CRM automation platform for field service management. It orchestrates the entire Lead â†’ Estimate â†’ Job â†’ Invoice â†’ Payment pipeline with integrated AI automation.

### Architecture Philosophy (Updated April 20, 2026)

**SmartKlix is a lead-to-cash operating system for service businesses.**

Core loop:
1. **Acquisition**: Crawler discovers businesses (leads)
2. **Organization**: CRM stores and organizes contacts
3. **Work Lifecycle**: Jobs created and managed
4. **Field Operations**: Agents update work in real-time
5. **Financial Tracking**: Money tracked per job
6. **Reporting**: Everything exportable for analysis
7. **Outreach**: Automation converts leads to clients (future)

**CRM = Brain + Control Tower. External Agents Handle Execution.**

The CRM is the **Source of Truth + Internal Intelligence Only**:
- âœ… Manages all data (contacts, jobs, invoices, pipeline)
- âœ… Makes decisions via AI (OpenAI) + simple validation function
- âœ… Logs everything (audit trail)
- âœ… Sends proposals to external agents via webhook
- âœ… Receives and processes agent reports

**External Agents** handle all execution:
- âœ… Send messages (SMS, email, WhatsApp)
- âœ… Book appointments
- âœ… Process payments
- âœ… Execute workflows
- âœ… Report back to CRM

### System Modules

#### 1. CRM Core (âœ… COMPLETE)
- Contacts management with relationship tracking
- Jobs lifecycle management
- Contact-to-job relationship mapping
- Status: Production-ready

#### 2. Field Operations Module (âœ… COMPLETE)
- Field reports with type classification (progress | issue | completion | inspection)
- Job status updates from field agents
- Photo uploads (URL-based)
- Real-time job tracking
- Status: UI + Backend complete

#### 3. Financial Tracking Module (âœ… COMPLETE)
- Income/expense tracking per job
- Profit calculation per job/client
- Job-level economics
- Financial summaries
- Status: Production-ready

#### 4. Export System (âœ… FUNCTIONAL)
- CSV exports for all data entities:
  - Contacts
  - Jobs
  - Field Reports
  - Financial Records
- Server-side filtering (date range, status, contact)
- Row limit enforcement (5000 max)
- Relational data included (names, not just IDs)
- Status: Functional with guardrails

#### 5. Lead Crawler System (âš ï¸ PLANNED)
- Automated business discovery
- Niche-based filtering
- CRM ingestion pipeline
- Status: Conceptual design complete, implementation pending

#### 6. Outreach System (âš ï¸ FUTURE PHASE)
- Email/SMS automation
- Agent-based workflows
- Campaign management
- Status: Architecture defined, implementation pending

### Key Features
- **Complete CRM**: Contacts, jobs, and relationship management
- **Field Operations**: Real-time job updates from field agents
- **Financial Tracking**: Profit calculation per job/client
- **Export Center**: Business reporting via CSV downloads
- **AI-Powered Proposal Generation**: Admin Chat uses OpenAI to propose actions
- **Proposal Approval Workflow**: staged_proposals table with human review queue
- **Complete Pipeline Management**: Visual kanban board with drag-and-drop
- **Dual Chat Interfaces**: Public lead capture widget + admin intelligence bot
- **External Agent Integration**: Webhook-based proposal dispatch to agents
- **Comprehensive Analytics**: Real-time metrics and audit logging
- **White-Label Ready**: Fully customizable branding per deployment

---

## ðŸ”´ CRITICAL SETUP REQUIREMENTS

**Before deploying to production, you MUST configure the following:**

### 1. External Agent Gateway (REQUIRED)
The CRM requires an external agent gateway to execute actions (email, WhatsApp, payments, calendar).

**Add to `.env`:**
```bash
AGENT_WEBHOOK_URL=https://your-agent-gateway.com
AGENT_INTERNAL_TOKEN=$(openssl rand -hex 32)
```

**Agent Gateway Must Expose:**
- `POST /execute/task`
- `POST /execute/whatsapp`
- `POST /execute/email`
- `POST /execute/payment`

**See [SYSTEM_AUDIT_COMPLETE.md](./SYSTEM_AUDIT_COMPLETE.md) for complete agent deployment guide.**

### 2. PostgreSQL Database (REQUIRED — Supabase)
```bash
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-1-us-west-1.pooler.supabase.com:5432/postgres
```
Uses Supabase session pooler. Enable `pgvector` extension in Supabase SQL Editor before first deploy.

### 3. External Service Accounts
- **Twilio**: SMS/Voice (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
- **Resend**: Email (RESEND_API_KEY)
- **Stripe**: Payments (STRIPE_SECRET_KEY)
- **Firecrawl**: Web scraping (FIRECRAWL_API_KEY)
- **Calendly**: Booking (CALENDLY_API_KEY)
- **Retell AI**: AI phone receptionist (inbound/outbound calls)

### 4. Deployment (Railway)
Both services (CRM + External Agents) are deployed to Railway.
- CRM: `https://smartklixcrm-production.up.railway.app`
- External Agents: `https://web-production-a0d9f.up.railway.app`
- Railway auto-redeploys on push to `main`
- Bind server to `host: "0.0.0.0"` (not localhost) for Railway routing

---

### Architecture Model
**Single-Tenant Isolation:** Each customer deployment is independent with dedicated:
- PostgreSQL database (Supabase-backed)
- Secrets management
- External agent webhook endpoint
- Branding configuration

This design prioritizes data security, compliance, and customer control.

---

### Non-Negotiable System Constraints

The following are architectural laws. Do not treat them as suggestions:

1. **AI proposals require human approval** - All AI-generated actions go through staged_proposals before execution
2. **Validator runs before DB write** - Every proposal validated by `validator.ts` before creating staged_proposal
3. **Kill switch blocks all AI execution** - When active, no AI actions execute
4. **External dispatch via webhook only** - CRM sends proposals to external agents via POST to AGENT_WEBHOOK_URL
5. **Audit log records all mutations** - Every state change logged to audit_log table

### README Authority Statement

**This README is the authoritative system contract.**

If code behavior conflicts with this document, the code is wrong.

During migrations or refactors, prioritize this README over implementation details. It represents the intended architecture.

---

## Ledger & Governance Model

Smart Klix CRM is governed by an Event-Based Ledger Model.

The Ledger is the single source of historical truth for every meaningful action, decision, and outcome in the system.

This is not logging â€” it is a state evolution transcript.

### Ledger Anchoring Rules (Critical)

Each ledger is anchored to exactly one entity:

1. **Company Ledger**
   - Used when a company exists
   - All related contacts, jobs, invoices, payments, and actions roll up here

2. **Contact Ledger**
   - Used only when no company exists
   - All actions apply directly to the contact

There are:
- âŒ No sub-ledgers
- âŒ No nested entities
- âŒ No dual anchoring

An event belongs to one and only one ledger anchor.

### Ledger Enforcement Rule (Non-Negotiable)

Any operation that mutates business state (create, update, delete, execute, dispatch, approve, reject) **MUST** produce a corresponding ledger entry in `audit_log`.

**No entity mutation is considered valid unless a ledger event is written first or atomically with the change.**

Bypassing, batching without attribution, or silently mutating state without ledger emission is a system violation, even if functionality appears correct.

This protects against:
- "Quick fixes" that skip governance
- Performance shortcuts that lose traceability
- Junior dev refactors that break determinism
- AI tool misuse that creates unlinkable state changes

### Ledger Event Minimum Contract

Every ledger entry **MUST** include:

| Field | Type | Purpose |
|-------|------|---------|
| `ledgerAnchorType` | enum: `company` \| `contact` | Which entity this event belongs to |
| `ledgerAnchorId` | string (UUID) | ID of company or contact |
| `eventType` | enum (not free text) | Specific action (e.g., `ai_proposal_created`, `human_approved`) |
| `initiatorType` | enum: `AI` \| `Human` \| `System` \| `External` | Who or what triggered this |
| `initiatorId` | string | userId, AI agent ID, system name, or external service |
| `timestamp` | ISO 8601 | When the event occurred |
| `correlationId` | string (optional) | For chained or external actions (External Agent callbacks, webhooks) |

Events missing any required field (except optional `correlationId`) are **rejected as invalid**.

This ensures consistent audit trail structure and prevents schema drift.

### What Gets Written to the Ledger

Every meaningful system event generates a ledger entry:

- **AI Events**
  - AI proposal created
  - AI tool execution requested
  - AI validation decision (Policy Agent)
  - AI rejection with reason

- **Human Events**
  - Operator creates or updates a contact
  - Operator approves or rejects an action
  - Manual job, estimate, invoice, or payment actions

- **Governance Events**
  - Review Queue decisions
  - Policy validation outcomes
  - Assist Queue approvals or rejections

- **Execution Events**
  - External Agent dispatched
  - Payment link sent
  - Stripe/payment confirmation received
  - External callback processed

If it changes state, sends money, sends a message, or affects a customer â€” it goes on the ledger.

### Queue Routing Rule

All AI-initiated actions follow this deterministic path:

1. **AI proposes action** â†’ Ledger entry created (`eventType: ai_proposal_created`)
2. **Policy Agent validates** â†’ Ledger governance event written (`eventType: ai_review_decision`)
3. **Decision made:**
   - If action **requires human approval** (e.g., payments, estimate conversion): Move to Ready Execution
   - If action **does not require human approval** (e.g., data lookup, note creation): Move to Ready Execution (optional observability layer)
4. **If Ready Execution:** Operator confirms/rejects â†’ Ledger governance event written (`eventType: human_execution_decision`)
5. **Execution** (if confirmed): Dispatch to External Agent â†’ Ledger execution event written

This removes guesswork and ensures all routing decisions are ledger-recorded.

### Execution Eligibility Rules

An action is executable only if:

1. A valid ledger entry exists (proposing the action)
2. Required governance decisions exist:
   - If AI-initiated: Policy Agent validation event exists
   - If human-initiated: Action bypasses governance but is ledger-recorded
   - If requires human approval: Assist Queue approval event exists
3. No rejection event exists later in the ledger stream
4. All upstream dependencies have execution events

This makes execution deterministic and auditable.

**UI-Triggered Execution Guardrail:**

UI-triggered actions must validate execution eligibility against the Ledger before dispatch. UI intent alone is never sufficient to execute side effects.

Before any action that mutates state or triggers external integrations:
1. Check ledger eligibility rules
2. Verify all required governance events exist
3. Ensure no rejection events block execution
4. Only then dispatch to execution

This prevents UI bypasses from circumventing governance.

**Rule of Authority:**

- Actions initiated directly by a human operator do not require Review Queue validation.
- Actions initiated by AI always pass through Review Queue and/or Assist Queue before execution.
- **Human-initiated actions still require immediate ledger recording, but bypass Review Queue validation.** The ledger event is written before or atomically with the entity mutation.

**Ledger Anchor Resolution Timing:**

Ledger anchor resolution occurs once per action, at the moment the action is proposed.

The anchor does not change retroactively, even if a contact is later associated with a company.

This prevents retroactive roll-ups and ensures deterministic ledger histories.

### Ledger as the Execution Spine

Downstream systems do not act on intent â€” they act on Ledger state.

Flow example:
AI proposes an action â†’ Ledger
Policy Agent validates â†’ Ledger
Operator approves â†’ Ledger
Action dispatched to External Agent â†’ Ledger
External system confirms execution â†’ Ledger

This ensures:
- Full traceability
- Auditability
- Deterministic execution
- Safe AI autonomy

**Financial Actions Execution Authority (Critical):**

Financial actions (invoices, payment links, charges, refunds) are **never executed directly by AI**.

AI may *propose* these actions, but execution occurs only after required ledger governance events are satisfied (Policy Agent validation + human approval in Assist Queue).

This prevents accidental autonomous payments and ensures financial safety.

**Why the Ledger Exists:**

The Ledger exists to ensure that no action can occur in the system without a traceable, reviewable, and reversible history. It is the system's immune system.

**Important:** The Ledger is a conceptual and data-layer construct, not a UI. UI components (Review Queue, Assist Queue, entity pages) are views over ledger state, not authorities themselves. This prevents treating UI elements as decision authorities.

### Human-Only Execution Actions (Non-Automatable)

The following actions are **never executed autonomously by AI**, even with full approval chain:

- Sending payment links
- Charging cards / processing payments
- Issuing refunds
- Converting estimates to invoices
- Adjusting invoice amounts
- Canceling jobs or contracts

AI may:
- Propose these actions with supporting context
- Provide approval recommendations
- Auto-fill fields (amounts, dates, descriptions)

Humans must:
- Review the proposal
- Explicitly approve in Assist Queue
- Confirm execution via UI or API

This matches how you think about financial risk and maintains human accountability.

---

## AI Settings (System Constitution)

### Purpose

**AI Settings** is the **System Constitution**. It is the active configuration console where Architects define the purpose, behavior, and constraints of each AI entity.

This is not a passive status screen. It is the control room where the "Brains" are tuned.

### Who Uses This

- **Policy Agents**: To define system instructions and autonomy levels for AI entities.

### The 4-Entity Architecture (Configurable)

Smart Klix is organized around four distinct AI entities, each with separate concerns:

1. **Intake Agent**
   - **Role**: Intake & Triage
   - **Authority**: Classifies incoming messages, extracts data, determines routing
   - **Configuration**: Greeting scripts, data collection rules, triage logic
   - **Execution**: Cannot execute (read-only, proposal-only)

2. **Query Agent**
   - **Role**: Retrieval & Context
   - **Authority**: Searches knowledge base, retrieves customer history, contextualizes conversations
   - **Configuration**: Citation strictness, PII masking rules, search depth
   - **Execution**: Cannot execute (read-only, proposal-only)

3. **Proposal Agent**
   - **Role**: The System Brain â€” Reasoning & Decision-Making
   - **Authority**: Analyzes input, proposes actions, drafts payloads
   - **Configuration**: Bias toward action vs. discussion, autonomy levels (Manual/Semi/Full)
   - **Execution**: Cannot execute (proposal-only; execution requires Proposal Queue human confirmation)

4. **Policy Agent**
   - **Role**: Governance & Policy Enforcement
   - **Authority**: Validates AI proposals, enforces policy, makes governance decisions
   - **Configuration**: Validation schemas, policy rules, override thresholds
   - **Execution**: Cannot execute (governance-only, AI-driven validation)

### What AI Settings Is NOT

- âŒ A dashboard or status screen
- âŒ A role management system
- âŒ An execution control panel
- âŒ A simulation or debugging environment

**AI Settings defines constraints and behavior. Execution is controlled by Ledger governance, Review Queue, and Ready Execution.**

### AI Settings Contract

- Config changes update the orchestration runtime (e.g., Neo8) immediately
- Only Policy Agents can write to AI Settings
- All entities are read-only executors; they generate proposals, not direct state changes
- No entity can bypass Review Queue or Ready Execution

---

## Proposal Agent (Dual-Role Brain)

### Definition & Responsibility

**Proposal Agent** is the **System Brain**. It is responsible for reasoning, decision-making, and drafting operational proposals based on input data and customer interactions.

**Critical:** Proposal Agent has one responsibility: **To propose governed actions based on input.**

It is **NOT** a background-only service. It has two explicit interfaces that both lead to the same outcome: a proposal in Review Queue.

### The Two Input Paths (Dual Role)

#### A) The Headless Engine (Automated)

- **Input Source**: Intake Hub, Funnels, Event triggers
- **Trigger**: Data is committed (e.g., Form Submission, Webhook, Scheduled task)
- **Behavior**: Proposal Agent analyzes the payload, deduplicates, and generates a proposal
- **Output**: Review Queue (for Policy Agent validation)
- **Ledger Event**: `AI_PROPOSAL_CREATED`
- **Cannot**: Dispatch or execute without governance approval

#### B) The Proposal Agent Chat (Interactive)

- **Input Source**: Proposal Agent tab in sidebar (human operator typing instructions)
- **Trigger**: Operator submits a manual instruction (e.g., "Draft an invoice for Marcus")
- **Behavior**: Proposal Agent interprets intent, queries context, and drafts a proposal
- **Output**: Proposal Queue → Review stage (for Policy Agent validation)
- **Ledger Event**: `AI_PROPOSAL_CREATED`
- **Cannot**: Execute without governance approval

**Critical Rule:** Both paths lead to the **Same Outcome** (a proposal in the Review Queue).

There is no "fast path" that bypasses governance.

### Ledger Responsibility (First Writer in Chain of Custody)

Proposal Agent is the **First Writer** in the chain of custody.

- **When**: Immediately upon generating a draft proposal
- **Writes**: `AI_PROPOSAL_CREATED` event to audit_log
- **Contains**: The raw intent, reasoning, generated JSON payload, and proposed action details

This ensures full traceability from intent to execution.

### Capability Contract (What Proposal Agent Can Propose)

Proposal Agent is authorized to **PROPOSE** (not execute) the following actions only:

1. **Create Lead** - From normalized intake data
2. **Create Contact** - Maximum of 5 entities per proposal
3. **Create Task** - Follow-up tasks for human operators
4. **Draft Communication** - Email, SMS, or WhatsApp drafts (not send)
5. **Create Note** - Internal context logging
6. **Create Job** - Only if explicitly allowed by Policy Agent policy

These actions create new entities or draft communications. **They do not mutate existing state.**

### Hard Constraints (What Proposal Agent CANNOT Do)

Proposal Agent is strictly **FORBIDDEN** from:

- âŒ **Direct Mutation**: Cannot update existing records autonomously. Ever.
- âŒ **Overwrite**: Cannot change data it created without human approval
- âŒ **Direct Execution**: Cannot send emails, process payments, or dispatch to external systems
- âŒ **Bypass**: Cannot skip the Review Queue or Policy Agent governance
- âŒ **Financial Actions**: Cannot propose, execute, or approve payment-related actions

### Flag-Only Escalation Rule (Non-Negotiable)

If Proposal Agent detects an action it is not authorized to perform:

1. It must create a **Human Action Required** proposal
2. Route it through Review Queue for Policy Agent validation
3. Surface it in Ready Execution for human operator review
4. Human operator performs the action
5. Ledger records the human action (`HUMAN_EXECUTION_DECISION`)

**No partial updates. No silent failures. No workarounds.**

Examples:
- If asked to update an existing contact: Create a proposal for human to review and approve
- If asked to send an invoice: Create a proposal; human operator approves and executes in Ready Execution
- If asked to process a refund: Create a proposal; human must explicitly approve in Ready Execution

### Failure Policy (The 3-Strike Rule)

To prevent loops and hallucinations, the system enforces a strict kill-switch:

1. **First Failure**: Policy Agent rejects proposal. Proposal Agent requests redraft.
2. **Second Failure**: Policy Agent rejects proposal. Proposal Agent requests redraft.
3. **Third Failure**: **BLOCK**
   - Proposal Agent is suspended for this specific context/task
   - The task reverts to **Manual Handling Only**
   - Event is logged as "AI Unfit for Task" in audit_log

This prevents infinite loops and ensures human takes control.

---

## Review Queue (AI Governance)

### Purpose

The Review Queue is the **Automated Governance Processing Layer**.

It is the domain of the **Policy Agent**.

### Critical Architecture Rule

- âŒ **NO HUMANS** participate in this queue
- âœ… **Policy Agent** is the ONLY reviewer

This is non-negotiable. Review Queue is AI-to-AI validation, not human approval.

### What Happens Here

1. **Input**: Proposals arrive from **Proposal Agent** (from either Headless Engine or Proposal Agent Chat)
2. **Validation**: Policy Agent validates logic, schema, and policy compliance
3. **Decision**:
   - **Approved**: Automatically moves to **Ready Execution**
   - **Rejected**: Returned to Proposal Agent for redrafting (or archival after 3 failures)

### Ledger Responsibility

The Policy Agent writes the governance decision to the ledger.

- **Event Type**: `AI_REVIEW_DECISION`
- **Actor**: Policy Agent (AI)
- **Content**: Validation outcome, policy check results, and the decision (Approve/Reject)

### Observability Interface (Optional)

- **Role**: Passive observability only
- **Purpose**: Transparency, debugging, and auditability
- **Audience**: Human observers (no authority)
- **Controls**: None. No interaction, no intervention, no override.
- **Note**: This interface is optional and may be hidden or disabled in production.

### Review Queue UI Contract (If Implemented)

- âœ… Read-only observability
- âœ… Displays ledger-backed governance events only
- âŒ No mutation handlers
- âŒ No approval buttons
- âŒ No execution triggers
- âŒ No human decision capability

Any UI component that attempts to modify state or approve actions from Review Queue is **architecturally invalid**.

### The Flow

```
Proposal Agent (Propose)
     |
     v
Proposal Queue — Review tab (Policy Agent Validates)
     |
     v
Proposal Queue — Execute tab (Human Decides & Dispatches)
     |
     v
External Agent (Executes) → Callback → Automation Ledger
```

> **UI Note:** Review Queue and Ready Execution are both accessible from the single **Proposal Queue** tab in the sidebar. The tab has two sub-tabs: Review (AI governance) and Execute (human dispatch).

---

## Ready Execution (Human Authority & Dispatch)

### Purpose

**Ready Execution** is the **Final Human Authority**.

It is the **ONLY** place where a human operator exercises approval power and triggers real-world execution.

**CRITICAL ARCHITECTURE RULE**: âœ… **Human Operator** is the ONLY actor here.

### What Happens Here

1. **Input**: Proposals that have been **Approved by Policy Agent** (from Review Queue)
2. **Human Decision**: The Operator reviews the Policy Agent-validated payload
3. **Action**:
   - **Confirm**: Triggers the API/Integration (Real-world execution to External Agent, Stripe, databases, etc.)
   - **Reject**: Overrides the AI's approval, kills the workflow, and logs a terminal state

### Ledger Responsibility

The Human Operator logs the final reality.

- **Event Type**: `HUMAN_EXECUTION_DECISION`
- **Actor**: Human Operator (User ID recorded)
- **Content**: The explicit action (Confirmed/Rejected), user identity, timestamp, and final outcome (Sent/Cancelled)

### UI Layout & Components

- **Queue**: List of AI-Validated items ready for dispatch (from Review Queue)
- **Action Buttons**: 
  - "Confirm & Execute" - Dispatches to External Agent, Stripe, database
  - "Reject & Cancel" - Terminal rejection (no redraft loop)
- **Payload Display**: Full details of what AI proposed and Policy Agent validated
- **Security**: Identity confirmation modal before execution (especially for financial actions)

### The Flow

```
Review Queue (AI Validated)
     |
     v
Ready Execution (Human Reviews & Confirms)
     |
     v
External World (API, External Agent, Stripe, Database)
     |
     v
Ledger Records Result
```

### Critical Boundaries

**Ready Execution â‰  Review Queue**
- Review Queue: AI governance (no humans)
- Ready Execution: Human authority (only humans execute)

**Ready Execution â‰  Assist Queue**
- Assist Queue: Operator approves AI-generated content (e.g., draft emails, estimates)
- Ready Execution: Operator executes the approved action in the real world

### Headless Execution Engine Constraint

**The Headless Execution Engine cannot dispatch any action without passing Review Queue and Ready Execution approval.**

This applies to all paths:
- Headless Engine triggers → Proposal Queue (Review) → Proposal Queue (Execute) → Dispatch
- Proposal Agent Chat triggers → Proposal Queue (Review) → Proposal Queue (Execute) → Dispatch
- Direct API calls → Proposal Queue (Review) → Proposal Queue (Execute) → Dispatch

No action reaches external systems (External Agent, Stripe, database mutations) without this full chain.

---

## Core Data Flow

```
Contact Created
    â†“
Job Created (linked to contact)
    â†“
Field Reports Added (linked to job)
    â†“
Financial Records Tracked (linked to job/contact)
    â†“
Export to CSV (all entities with relational data)
```

Every entity is traceable. No orphan records allowed.

## System Rules (Non-Negotiable)

1. **All writes must pass validation layer** - Use `validators.ts` utilities, never inline validation
2. **No orphan relationships allowed** - Every foreign key must reference a valid entity
3. **All exports must enforce**:
   - Max row limit (5000 rows, hard fail)
   - Default date window (90 days, soft limit with transparency)
4. **All modules must be seed-testable** - Use `seed-utils.ts` for testing
5. **No feature depends on external APIs** - System must work in isolation
6. **All logic must be server-authoritative** - Never trust client-side validation
7. **Financial integrity is mandatory** - Amount > 0, type must be income/expense, job must belong to contact

## Development Rules

1. **Validate relationships before write operations** - Use `validators.ts` utilities
2. **Keep modules isolated but connected via IDs** - No cross-module dependencies
3. **Prefer server-side validation over frontend checks** - Never trust client input
4. **Maintain exportability for all data entities** - Every table must be exportable
5. **Avoid silent failures in workflows** - Always log and return errors
6. **System must work WITHOUT external APIs** - Graceful degradation required
7. **Every feature must be seed-testable** - Use `seed-utils.ts` for testing

## System Architecture

SmartKlix is organized in 5 explicit layers:

**Layer 1: Data Layer (DB)**
- PostgreSQL database (Supabase-backed)
- Drizzle ORM schemas (`shared/schema.ts`)
- Storage implementations (`server/storage.ts`)

**Layer 2: Business Logic Layer**
- Validation utilities (`server/validators.ts`)
- Storage interface methods
- Seed utilities (`server/seed-utils.ts`)

**Layer 3: Execution Layer (Routes)**
- API routes (`server/routes.ts`)
- Request validation (Zod)
- Business rule enforcement (via validators)

**Layer 4: Output Layer**
- Export center (CSV with guardrails)
- UI components (React)
- Response formatting

**Layer 5: Future Layer (Planned)**
- Crawler agent (lead discovery)
- Outreach automation (email/SMS)
- Lead scoring system

**Rule:** Logic lives in Layer 2, not Layer 3. Routes only orchestrate.

## Export Performance

### Current Implementation (MVP)
- Loads all records into memory
- Applies filters in-memory
- Generates CSV in-memory
- Safe for 1-5k records (testing)
- Acceptable for 5-20k records (MVP real usage)
- NOT suitable for 50k+ records (production scaling)

### Real Limitation
The bottleneck is not volume â€” it's **memory-bound CSV generation per request**.

### Future Optimization (Post-MVP)
- Database-level filtering with SQL WHERE clauses
- Streaming CSV generation (row-by-row, not all-in-memory)
- Pagination for large exports
- Background job processing for exports >5000 rows

---

## Quick Start

### Prerequisites
- Node.js 20+ (automatically provided by Replit)
- PostgreSQL database (use Replit's built-in database)
- OpenAI API access (via Replit AI Integrations - no personal key required)
- External Agent instance (optional, for workflow automation)

### Step 1: Database Setup
The project uses Replit's built-in PostgreSQL database. If not already created:
```bash
# Database is automatically provisioned by Replit
# Connection available via DATABASE_URL environment variable
```

### Step 2: Start the Application
```bash
# Install dependencies (automatic on Replit)
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```
The application runs on https://your-repl.replit.dev (port 5000).

### Step 3: Verify Health
```bash
curl https://your-repl.replit.dev/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "ai_agent": "ready",
  "storage": "database",
  "timestamp": "2025-12-21T..."
}
```

### Placeholder Mode
The app gracefully degrades when services are not configured:

| Service | Fallback Behavior |
|---------|-------------------|
| Database | Falls back to in-memory storage |
| OpenAI | Shows "not_configured" status |
| External Agent | Displays pending status |

This allows development without all external dependencies.

**Ledger Guarantees in Placeholder Mode:**

In Placeholder Mode (in-memory storage), ledger guarantees apply logically but durability is not enforced. Events are recorded and governance rules are applied, but data is not persisted across restarts.

**Production deployments must use persistent storage** to ensure ledger durability and full audit trail preservation. Never rely on in-memory ledger state for production accountability.

## Environment Configuration

### Required Environment Variables
| Variable | Description | How to Set |
|----------|-------------|------------|
| DATABASE_URL | PostgreSQL connection string | Auto-set by Replit Database |
| PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE | Individual DB credentials | Auto-set by Replit Database |

### AI Integration (Replit AI Integrations)
This project uses Replit AI Integrations for OpenAI access. These are automatically configured:

| Variable | Description |
|----------|-------------|
| AI_INTEGRATIONS_OPENAI_API_KEY | Managed by Replit AI Integrations |
| AI_INTEGRATIONS_OPENAI_BASE_URL | Managed by Replit AI Integrations |

**Important:** You do NOT need a personal OpenAI API key. Replit's internal test keys are used automatically.

To verify AI integration status:
```bash
curl https://your-repl.replit.dev/api/health
# Check "ai_agent" field in response
```

### Optional Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| AGENT_WEBHOOK_URL | Agent gateway base URL for external execution | None (agent features disabled) |
| AGENT_INTERNAL_TOKEN | Token for agent to CRM API calls | None |
| SESSION_SECRET | Express session security | Auto-generated |
| APP_BASE_URL | Your deployed app URL (for callbacks) | Auto-detected |

### Branding Variables
| Variable | Description | Default |
|----------|-------------|---------|
| TENANT_NAME | Company name | "Smart Klix" |
| TENANT_LOGO_URL | Company logo URL | Built-in logo |

Colors and theme are configured via Settings UI in-app (defaults: Yellow #FDB913, Blue #1E40AF).

## Project Structure
```
smart-klix-crm/
â”œâ”€â”€ client/                      # Frontend (React 18 + TypeScript)
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/          # Reusable UI components
â”‚   â”‚   â”‚   â”œâ”€â”€ ui/              # Shadcn UI primitives (Button, Card, etc.)
â”‚   â”‚   â”‚   â”œâ”€â”€ AppSidebar.tsx   # Main navigation sidebar
â”‚   â”‚   â”‚   â”œâ”€â”€ CreateJobDialog.tsx
â”‚   â”‚   â”‚   â””â”€â”€ ...
â”‚   â”‚   â”œâ”€â”€ pages/               # Page components (one per route)
â”‚   â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx    # Main dashboard with metrics
â”‚   â”‚   â”‚   â”œâ”€â”€ Contacts.tsx     # Customer management
â”‚   â”‚   â”‚   â”œâ”€â”€ Jobs.tsx         # Project tracking
â”‚   â”‚   â”‚   â”œâ”€â”€ Pipeline.tsx     # Visual kanban board
â”‚   â”‚   â”‚   â”œâ”€â”€ AdminChat.tsx    # AI intelligence bot
â”‚   â”‚   â”‚   â””â”€â”€ ...
â”‚   â”‚   â”œâ”€â”€ hooks/               # Custom React hooks
â”‚   â”‚   â”‚   â””â”€â”€ use-toast.ts     # Toast notification hook
â”‚   â”‚   â”œâ”€â”€ lib/                 # Utilities and config
â”‚   â”‚   â”‚   â”œâ”€â”€ queryClient.ts   # TanStack Query setup
â”‚   â”‚   â”‚   â””â”€â”€ utils.ts         # Helper functions
â”‚   â”‚   â”œâ”€â”€ App.tsx              # Root component with routing
â”‚   â”‚   â””â”€â”€ main.tsx             # Application entry point
â”‚   â””â”€â”€ index.css                # Tailwind + theme variables
â”‚
â”œâ”€â”€ server/                      # Backend (Express + TypeScript)
â”‚   â”œâ”€â”€ index.ts                 # Express app entry point
â”‚   â”œâ”€â”€ routes.ts                # API routes (all with Zod validation)
â”‚   â”œâ”€â”€ storage.ts               # Storage interface + implementations
â”‚   â”œâ”€â”€ db.ts                    # Database connection (Drizzle + Supabase)
â”‚   â”œâ”€â”€ master-architect.ts      # AI agent orchestrator
â”‚   â”œâ”€â”€ ai-tools.ts              # OpenAI function calling tools (26 tools)
â”‚   â”œâ”€â”€ pipeline.ts              # Job pipeline state machine
â”‚   â”œâ”€â”€ vite.ts                  # Vite dev server integration
â”‚   â””â”€â”€ replit_integrations/     # Replit AI Integration blueprints
â”‚       â”œâ”€â”€ chat/                # Chat completion utilities
â”‚       â”‚   â”œâ”€â”€ index.ts         # Main chat function
â”‚       â”‚   â””â”€â”€ storage.ts       # Chat history storage
â”‚       â”œâ”€â”€ image/               # Image generation utilities
â”‚       â”‚   â””â”€â”€ index.ts         # DALL-E integration
â”‚       â””â”€â”€ batch/               # Batch processing utilities
â”‚           â””â”€â”€ utils.ts         # Batch job helpers
â”‚
â”œâ”€â”€ shared/                      # Shared types and schemas
â”‚   â””â”€â”€ schema.ts                # Drizzle ORM schemas + Zod validation
â”‚                                # (Single source of truth for all types)
â”‚
â”œâ”€â”€ docs/                        # Documentation (MUST be updated)
â”‚   â”œâ”€â”€ API_REFERENCE.md         # Complete API documentation
â”‚   â”œâ”€â”€ DEPLOYMENT_GUIDE.md      # Production deployment guide
â”‚   â”œâ”€â”€ DEVELOPER_ONBOARDING.md  # New developer setup
â”‚   â”œâ”€â”€ AUDIT_REPORT.md          # Latest audit findings
â”‚   â””â”€â”€ architecture.md          # System architecture decisions
â”‚
â”œâ”€â”€ replit.md                    # Project memory and architecture notes
â”œâ”€â”€ package.json                 # Dependencies (DO NOT EDIT MANUALLY)
â”œâ”€â”€ tsconfig.json                # TypeScript configuration
â”œâ”€â”€ tailwind.config.ts           # Tailwind CSS configuration
â”œâ”€â”€ vite.config.ts               # Vite configuration (DO NOT EDIT)
â””â”€â”€ drizzle.config.ts            # Drizzle ORM configuration (DO NOT EDIT)
```

### Folder Rules (Clean Code Doctrine)
- No `misc/`, `helpers2/`, `junk/` folders - Every folder has a clear purpose
- No circular dependencies - Modules import in one direction
- No random utils hidden deep - Utilities are in `lib/` or `hooks/`
- One responsibility per file - Components do one thing well

## Technology Stack

### Frontend Stack
| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI framework with hooks | 18.x |
| TypeScript | Type safety (strict mode) | 5.x |
| TailwindCSS | Utility-first styling | 3.x |
| Shadcn UI | Accessible component primitives | Latest |
| TanStack Query | Server state management | 5.x |
| Wouter | Lightweight routing | 3.x |
| React Hook Form | Form management | 7.x |
| Zod | Form validation | 3.x |
| Framer Motion | Animations | 11.x |
| DnD Kit | Drag-and-drop (Pipeline) | 6.x |

### Backend Stack
| Technology | Purpose | Version |
|------------|---------|---------|
| Express.js | Web server | 4.x |
| TypeScript | Type safety (strict mode) | 5.x |
| Drizzle ORM | Type-safe database queries | 0.38.x |
| PostgreSQL | Production database (Supabase) | 16.x |
| OpenAI SDK | AI agent (GPT-4o) | 4.x |
| Zod | Runtime validation | 3.x |
| WebSocket (ws) | Real-time chat streaming | 8.x |

### External Integrations
| Service | Purpose |
|---------|---------|
| Replit AI Integrations | OpenAI API access (managed keys) |
| Replit Database | PostgreSQL hosting (Supabase-backed) |
| External Agent | Workflow automation (SMS, email, payments) |

## Database Schema

### Core Entities
| Table | Description | Key Fields |
|-------|-------------|------------|
| users | User accounts | username, email, role, passwordHash |
| contacts | Customers, leads, prospects | name, email, phone, status |
| jobs | Field service projects | title, status, amount, contactId |
| appointments | Scheduled meetings | title, date, contactId |
| estimates | Price quotes | jobId, amount, status |
| invoices | Bills for work | jobId, amount, status |
| payments | Payment transactions | invoiceId, amount, method |
| notes | Notes on contacts/jobs | content, contactId, jobId |
| files | File metadata | filename, path, contactId |
| audit_log | Authoritative Ledger Event Stream | ledgerAnchorType, ledgerAnchorId, eventType, initiatorType, initiatorId, timestamp, correlationId |

> **Note:** `audit_log` is the authoritative implementation of the Ledger event stream and must conform to the **Ledger Event Minimum Contract** defined earlier in this document. Required fields: `ledgerAnchorType`, `ledgerAnchorId`, `eventType`, `initiatorType`, `initiatorId`, `timestamp`. Legacy fields (`action`, `entity`) must map deterministically to `eventType` and `ledgerAnchorType` to prevent schema drift during migration. It must not be bypassed, pruned, or replaced without preserving full event history and governance guarantees.

### AI System Tables
| Table | Description | Purpose |
|-------|-------------|---------|
| conversations | Chat threads | Public widget + admin chat |
| messages | Individual messages | Role, content, metadata |
| memory_entries | AI memory storage | Embeddings, importance scores |
| ai_tasks | Tool execution history | What AI tools were called |
| assist_queue | Pending approvals | Actions awaiting human review |
| ai_reflection | Quality scores | AI decision quality metrics |
| master_architect_config | AI configuration | Model, temperature, prompts |
| company_instructions | Per-company AI behavior | Custom prompts per tenant |

### Storage Interface Pattern
All database operations go through the `IStorage` interface in `server/storage.ts`:

```typescript
// Example: How storage interface works
interface IStorage {
  // Contacts
  listContacts(limit?: number): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: string, data: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  
  // Jobs
  listJobs(limit?: number): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  createJob(data: InsertJob): Promise<Job>;
  updateJob(id: string, data: Partial<Job>): Promise<Job>;
  
  // ... all other entities follow same pattern
}
```

Two implementations exist:
- `MemStorage` - In-memory (development without database)
- `DbStorage` - PostgreSQL (production)

## API Reference

### Health Check
`GET /api/health`
Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "ai_agent": "ready",
  "storage": "database",
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```

### Core CRUD Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/contacts | GET | List all contacts |
| /api/contacts | POST | Create contact |
| /api/contacts/:id | PATCH | Update contact |
| /api/contacts/:id | DELETE | Delete contact |
| /api/jobs | GET | List all jobs |
| /api/jobs | POST | Create job |
| /api/jobs/:id | PATCH | Update job |
| /api/notes | GET | List notes |
| /api/notes | POST | Create note |
| /api/notes/:id | PATCH | Update note |
| /api/notes/:id | DELETE | Delete note |

### Pipeline Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/jobs/:id/assign-technician | POST | Assign tech to job |
| /api/jobs/:id/update-status | POST | Change job status |
| /api/jobs/:id/record-payment | POST | Record payment |

### AI Chat Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/ai/chat | POST | Send message to AI |
| /api/ai/execute-tool | POST | Execute AI tool |
| /api/conversations | GET | List conversations |
| /api/conversations/:id | GET | Get conversation |
| /api/assist-queue | GET | Pending AI actions |
| /api/assist-queue/:id/approve | POST | Approve action |
| /api/assist-queue/:id/reject | POST | Reject action |

### Lead Intake Endpoint
`POST /api/intake/lead`
```json
{
  "tenantId": "your-tenant-id",
  "idempotencyKey": "unique-event-key",
  "eventType": "lead.created",
  "channel": "widget",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-555-5555",
    "message": "Need HVAC service"
  }
}
```
All POST/PATCH routes include Zod validation. See `docs/API_REFERENCE.md` for complete documentation.

## Policy Agent & Operational Modes

### Policy Agent Overview

The Policy Agent is the AI Governance Engine that validates all Proposal Agent proposals. Located in `server/master-architect.ts`.

**Role**: Governance and Policy Enforcement
- Receives proposals from Proposal Agent
- Validates against policy schemas
- Makes approval/rejection decisions
- Writes governance events to Ledger

Policy Agent is NOT an execution engine. It is a validation and governance layer.

### Operational Modes (Proposal Agent)

**Critical:** These modes apply to **Proposal Agent**, not Policy Agent.

| Mode | Behavior | Execution Path |
|------|----------|-----------------|
| Draft | Proposal Agent suggests actions; no governance execution | Proposal Agent proposes â†’ Operator reviews in UI (no auto-execution) |
| Assist | Proposal Agent queues proposals for approval | Proposal Agent proposes â†’ Review Queue (Policy Agent validates) â†’ Ready Execution (human confirms) |
| Auto | Proposal Agent auto-generates proposals aggressively | Proposal Agent proposes â†’ Review Queue (Policy Agent validates) â†’ Ready Execution (human confirms) |

**Critical:** All modes route through Review Queue and Ready Execution. There is no "Auto mode" that bypasses human authority for financial or critical actions.

**Auto mode does NOT mean "autonomous execution." It means Proposal Agent is aggressive in generating proposals. Execution always requires human confirmation in Ready Execution.**

### AI Tools & Execution

#### Tool Categories (26 Available)

The Proposal Agent can invoke these proposal tools (defined in `server/ai-tools.ts`):

**Contact Management:**
- `create_contact` - Add new leads/customers
- `update_contact` - Modify contact information
- `delete_contact` - Remove contacts
- `search_contacts` - Find customer records

**Job Management:**
- `create_job` - Start new projects
- `update_job` - Modify job details
- `update_job_status` - Move through pipeline
- `get_job_details` - Retrieve job information
- `assign_technician` - Assign tech to job

**Estimates & Invoices:**
- `create_estimate` - Generate price quotes
- `send_estimate` - Email to customers
- `accept_estimate` / `reject_estimate`
- `create_invoice` - Generate bills
- `send_invoice` - Email invoices
- `record_payment` - Record payments

**Notes & Communication:**
- `create_note` - Add contextual notes
- `update_note` - Modify notes
- `delete_note` - Remove notes

#### Financial Tools Execution Constraint (Critical)

**Important:** Tools related to invoices, payments, refunds, or financial state changes are **proposal-only, never executable**.

These tools can be invoked by Proposal Agent to PROPOSE:
- `send_invoice` - Propose sending invoice
- `record_payment` - Propose recording payment
- `create_invoice` - Propose creating invoice
- Any tool that mutates financial records

**What happens when Proposal Agent invokes a financial tool:**
1. Proposal Agent generates a proposal (not execution)
2. Ledger entry created: `AI_PROPOSAL_CREATED` (financial action proposal)
3. Policy Agent validates the proposal
4. If approved â†’ Ready Execution shows the proposal for human confirmation
5. **Human operator explicitly confirms execution in Ready Execution**
6. Only then is the action dispatched to External Agent, Stripe, or internal systems

**Even in Auto mode, financial tools require explicit human confirmation in Ready Execution. This is a non-negotiable safety boundary.**

There is NO mode where financial actions execute autonomously.

#### Tool Tier System

Tools are classified into tiers for execution control:

```typescript
// server/ai-tools.ts
export type AIToolTier = "immediate" | "gated" | "financial";

// "immediate" - Proposal only (search, read operations)
// "gated" - Proposal only (create, update, delete); requires Ready Execution human confirmation
// "financial" - Proposal only; always requires explicit human execution, never autonomous
```

All tools are proposal-only. Execution requires Ready Execution human confirmation.

#### How AI Integration Works

```
User Message
     |
     v
Proposal Agent (server/master-architect.ts)
     |
     v
OpenAI API (via Replit AI Integrations)
     |
     v
Tool Invocation (server/ai-tools.ts)
     |
     v
Proposal Created (Ledger: AI_PROPOSAL_CREATED)
     |
     v
Review Queue (Policy Agent validates)
     |
     v
Ready Execution (Human confirms)
     |
     v
Execution or Rejection
```

No tool execution happens without human confirmation in Ready Execution.

## Email (Communication Dispatch & Intelligence)

### Core Intent
The Email tab is a **Unified Communication Feed**, not a traditional productivity inbox.
Its primary purpose is **Visibility** and **Traceability** of all contact-linked communications.

### Sub-Tab Structure
The Email tab contains two sub-tabs:

#### Sub-Tab A: Emails (Personal)
- **Purpose**: Human-sent, personal communication
- **Provider**: Gmail API (OAuth connected)
- **Context**: Free-text subject and body, ad-hoc follow-ups
- **Authority**: 
  - Human initiates directly
  - Proposal Agent may DRAFT, but proposals go through Review Queue
  - Dispatch goes through Neo8 Engine

#### Sub-Tab B: Email Accounts (Company/System)
- **Purpose**: System and business email identity
- **Provider**: SendGrid via Neo8 Engine
- **Context**: Template-only, transactional messages (invoices, notifications)
- **Constraint**: No free-text editing at send time - template selection only
- **Authority**:
  - Human or Proposal Agent can select templates
  - Proposal Agent proposals MUST go through Review Queue
  - Human approval required before execution

### The Identity Model (Critical)

| Identity | Author | Provider | Context | Content |
|----------|--------|----------|---------|---------|
| Personal | Human | Gmail API | Ad-hoc, personal | Free-text |
| Company | System | SendGrid | Transactional | Template-only |

### The Friction Rule
- **Behavior**: Switching identities in the Compose Modal **clears the draft body**
- **Reason**: Prevents cross-contamination (e.g., sending casual draft via formal System channel)
- **Implementation**: Proper UI dialog confirmation, not browser `confirm()`

### Backend Contract (Non-Negotiable)
The Frontend CRM **NEVER** sends emails directly. All outbound dispatch actions are requests to the **Neo8 Engine**.

1. **UI Action**: User clicks "Authorize Dispatch"
2. **Payload**: UI constructs JSON payload (`target`, `body/template`, `identity_provider`)
3. **Ledger**: `EMAIL_DISPATCH_AUTHORIZED` written to automation ledger
4. **Neo8**: Receives payload, validates, routes to provider (Gmail/SendGrid)
5. **Tracking**: Open/Click events webhoooked back to update status badges

### Email Ledger Events
| Event | When Written | Actor |
|-------|--------------|-------|
| `EMAIL_DISPATCH_AUTHORIZED` | User clicks Authorize Dispatch | Human/Proposal Agent |
| `EMAIL_DISPATCH_SENT` | Neo8 confirms send | System |
| `EMAIL_DELIVERED` | Provider confirms delivery | System |
| `EMAIL_OPENED` | Recipient opens email | System |
| `EMAIL_CLICKED` | Recipient clicks link | System |
| `EMAIL_FAILED` | Delivery failed (bounce) | System |

### Privacy & Filtering Rules
- **Ingress Filter**: Emails displayed only if they match a CRM Contact or Job
- **Exclusion**: Private/personal emails never ingested
- **Governance**: CRM remains operational tool, not personal data leak

### Template System
- Templates are **read-only at send time**
- Template management handled in system configuration
- Company emails REQUIRE template selection - no free-text

### Explicit Non-Goals
- âŒ **Inbox Zero**: This is an audit log, not a to-do list
- âŒ **Marketing Builder**: Bulk campaigns in Funnels/Social Planner
- âŒ **Real-Time Chat**: Use WhatsApp for instant messaging
- âŒ **Auto-Send**: Background automation lives in Proposal Agent

## WhatsApp & SMS (Operational Messaging Engine)

### Core Purpose
The WhatsApp tab is the **Instant Operations Channel** for high-velocity, low-latency communication for logistics and field coordination. This is **NOT chat** - it's a review + dispatch interface.

### Client ID - Root of the System (NON-NEGOTIABLE)
**Nothing exists without a Client ID.**

| Without Client ID | Consequence |
|-------------------|-------------|
| No Client ID | No Lead |
| No Client ID | No Outreach |
| No Client ID | No Proposal Agent proposal |
| No Client ID | No Ledger entry |
| No Client ID | No Messaging (SMS/WhatsApp/Email) |

**Client ID Format:**
```
<first_name>_<4-digit-random>
```
Examples: `joe_4837`, `maria_9021`, `alex_1174`

### ID Model
| Identifier | Purpose | Scope |
|------------|---------|-------|
| **Client ID** | Primary anchor (`joe_4837`) | CRM-wide, mandatory |
| **Conversation ID** | Neo8 lifecycle grouping (`joe_4837-1`) | Internal to ledger/outreach |
| **Provider IDs** | WhatsApp/SMS message refs | Metadata only on ledger events |

### Authority Boundaries
**Proposal Agent CAN:**
- Draft SMS/WhatsApp messages
- Propose outreach tied to a valid Client ID
- Ask clarifying questions before drafting

**Proposal Agent CANNOT:**
- Send messages directly
- Bypass review
- Message without a Client ID

### Dispatch Flow (Required)
```
CRM UI
â†’ Review Queue (approval required)
â†’ Authorization
â†’ Neo8 Engine
â†’ Provider (WhatsApp/SMS via Twilio)
â†’ Ledger Write
```

**CRM never sends directly. All dispatch goes to Neo8.**

### Neo8 Trigger Payload
```json
{
  "event": "WHATSAPP_DISPATCH_AUTHORIZED",
  "client_id": "joe_4837",
  "conversation_id": "joe_4837-1",
  "payload": {
    "message": "Hey Joe, just following up on your estimate.",
    "channel": "whatsapp"
  }
}
```

### Phase 1 Ledger Events (Current Implementation)
| Event | When Written |
|-------|--------------|
| `WHATSAPP_DRAFTED` | Proposal Agent generates message |
| `WHATSAPP_DISPATCH_AUTHORIZED` | Human approves |
| *(STOP HERE)* | Neo8 not connected yet |

**NOT YET implemented (Neo8 callbacks):**
- `WHATSAPP_SENT`
- `WHATSAPP_DELIVERED`
- `WHATSAPP_FAILED`

### UI Layout
- **Triage Rail (Left)**: Conversations sorted by urgency with session status rings
- **Chat Stream (Center)**: Bubble view with session active/expired indicator
- **Context Deck (Right)**: Identity, Active Job, AI Analysis (collapsible)
- **Template Modal**: For re-engaging expired sessions (24h WhatsApp rule)

### Session Timer (24h Window)
WhatsApp Business API restricts free-form messaging after 24h from last customer message. When session expires:
- Free-form input is locked
- Only authorized templates can be sent
- Template requires Meta pre-approval

### Explicit Non-Goals
- âŒ **Real-time chat**: This is dispatch prep, not conversation
- âŒ **Marketing blaster**: No bulk spam
- âŒ **Bot builder**: Logic lives in Funnels or AI Voice
- âŒ **Direct send**: CRM never sends directly

## External Agent Integration

### Overview

The CRM communicates with external agents via webhooks. This is a simple, bidirectional system:

1. **Outbound (CRM â†’ Agents):** Events fire to wake up agents
2. **Inbound (Agents â†’ CRM):** Agents report back via existing intake hub

### Outbound Webhook System

**Configuration:**

Set these environment variables:
```bash
AGENT_WEBHOOK_URL=https://your-agent-system.com/api/events
AGENT_WEBHOOK_SECRET=your-secret-key
```

**Event Types:**

| Event | Trigger | Purpose |
|-------|---------|---------|
| `lead_created` | New contact created | Initiate welcome sequence |
| `lead_updated` | Contact data changed | Update agent context |
| `pipeline_changed` | Contact moves stage | Execute stage-specific follow-up |
| `appointment_booked` | New appointment scheduled | Send confirmation |
| `appointment_cancelled` | Appointment cancelled | Notify parties |
| `job_created` | New job created | Start job workflow |
| `job_status_updated` | Job status changed | Update timeline |
| `invoice_created` | New invoice created | Send payment request |
| `invoice_overdue` | Invoice past due | Send payment reminder |
| `intake_submitted` | New lead intake received | Qualify and route |
| `no_response_detected` | Customer unresponsive | Re-engagement campaign |

**Event Payload Structure:**

```json
{
  "eventId": "evt_1234567890_abc123",
  "eventType": "lead_created",
  "timestamp": "2026-04-17T10:30:00.000Z",
  "contact": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-555-5555",
    "company": "ABC Corp",
    "niche": "construction",
    "status": "new",
    "customerType": "lead",
    "preferredChannel": "sms",
    "lastContactedAt": null,
    "nextFollowUpAt": "2026-04-18T10:30:00.000Z",
    "tags": ["hot-lead", "commercial"]
  },
  "instruction": "New lead created. Initiate welcome sequence and qualify the lead.",
  "context": {
    "job": { /* optional job data */ },
    "invoice": { /* optional invoice data */ },
    "appointment": { /* optional appointment data */ }
  }
}
```

**Contact Fields for Agent Routing:**

| Field | Type | Purpose |
|-------|------|---------|
| `niche` | string | Industry/vertical (healthcare, construction, etc.) |
| `preferredChannel` | string | email, whatsapp, or sms |
| `lastContactedAt` | timestamp | When was this contact last reached |
| `nextFollowUpAt` | timestamp | When should agent follow up next |

### Inbound Agent Reports

Agents report back to the CRM's **existing intake hub** in JSON format.

**Example Agent Report:**

```json
{
  "contactId": "uuid",
  "actionTaken": "SMS sent",
  "response": "Customer replied: interested",
  "nextAction": "Schedule appointment",
  "timestamp": "2026-04-17T10:35:00.000Z",
  "metadata": {
    "messageId": "twilio_msg_123",
    "status": "delivered"
  }
}
```

The intake hub receives this â†’ processes it â†’ updates contact record â†’ logs to audit_log.

### Implementation Files

| File | Purpose |
|------|---------|
| `server/agent-dispatcher.ts` | Outbound webhook dispatcher (321 lines) |
| `server/validator.ts` | Simple decision function (309 lines) |
| `shared/schema.ts` | Updated contacts table with agent fields |
| `drizzle/005_agent_integration_fields.sql` | Database migration |

### Security

- Webhook secret sent via `X-Webhook-Secret` header
- All outbound events logged to audit_log
- Failed dispatches retried and logged
- Placeholders used in development mode

---

## External Agent Integration (DEPRECATED)

**Note:** External Agent integration has been replaced with the External Agent Integration system above.

### Legacy Documentation (For Reference Only)

Smart Klix previously integrated with External Agent for external automation:
- SMS/Email: Customer communications
- Payment Links: Stripe/payment processing
- Voice Calls: Inbound/outbound call handling
- Calendar Sync: External calendar integration

This has been replaced by the agent webhook system which is more flexible and simpler.

### Integration Flow
```
Dashboard Action
     |
     v
POST to Agent Gateway (AGENT_WEBHOOK_URL)
     |
     v
Agent Gateway Executes
     |
     v
Agent Calls Back via /api/agent/callback
     |
     v
CRM Updates Status
```

### Required Environment Variables
```bash
AGENT_WEBHOOK_URL=https://your-agent-gateway.com
AGENT_INTERNAL_TOKEN=your-secret-token
APP_BASE_URL=https://your-app.replit.dev
```

### Agent Gateway Callbacks & Ledger Linkage (Critical)

All external callbacks (agent gateway, Stripe, webhooks) **must reference the originating ledger action ID**.

**Callback Contract:**

1. When dispatching to agent gateway, include the ledger entry ID:
   ```typescript
   POST https://agent-gateway/execute/task
   {
     "action": "send_sms",
     "ledgerActionId": "abc123...",
     "data": { ... }
   }
   ```

2. When External Agent calls back via `/api/events/update`, the callback must include the originating ledger ID:
   ```typescript
   POST /api/events/update
   {
     "ledgerActionId": "abc123...",
     "status": "completed",
     "result": { ... }
   }
   ```

3. Callbacks without correlation IDs are **invalid** and must not mutate business state.

4. Orphaned callbacks (no matching ledger action) are recorded as **informational events only**.

This ensures:
- Full traceability of external integrations
- No silent side effects
- Deterministic rollback capability
- Audit trail completeness

## Clean Code Standards
This project follows the Clean Code Doctrine. All contributors must adhere to these standards.

### Core Principles
- Code must be human readable - No clever or cryptic code
- One clear responsibility per file/module
- No dead code - No commented blocks, no unused imports
- Strict TypeScript everywhere - No `any` without documented reason
- Explicit logic - No hidden side effects, no magic shortcuts

### Naming Conventions
```typescript
// GOOD - Descriptive names
const customerLead = await getContact(id);
const jobTicket = await createJob(data);
const invoiceStatus = invoice.status;

// BAD - Cryptic names
const x1 = await getContact(id);
const tmp = await createJob(data);
const data2 = invoice.status;
```

### Comment Guidelines
```typescript
// GOOD - Explains WHY
// We split this to avoid locking the queue worker during long operations
const batch = splitIntoBatches(items, 100);

// BAD - Explains WHAT (obvious from code)
// This loops over jobs
for (const job of jobs) { ... }
```

### Documentation Requirements
When adding new features, update the relevant `/docs` files:

| Change Type | Update File |
|-------------|-------------|
| New table | `shared/schema.ts` + `docs/architecture.md` |
| New endpoint | `docs/API_REFERENCE.md` |
| New AI tool | `server/ai-tools.ts` + add description |
| New workflow | `docs/architecture.md` |
| Bug fix | `docs/AUDIT_REPORT.md` |

### Before Marking "Done"
- Lint passes with zero warnings
- TypeScript compiles without errors (`npm run typecheck`)
- Routes manually verified
- Documentation updated
- No dead code or debug leftovers
- Structure matches architecture

## Developer Workflow

### Getting Started
1. Clone/Fork the Repl
2. Read this README completely
3. Check environment variables - Use Replit Secrets panel
4. Run the app - `npm run dev`
5. Verify health endpoint - Should show all services connected

### Making Changes
```bash
# 1. Make code changes
# 2. Verify TypeScript
npm run typecheck

# 3. Test locally
npm run dev

# 4. Push database changes (if any)
npm run db:push

# 5. Commit with clear message
git commit -m "feat: add customer search filter"
```

## Troubleshooting

### Common Issues

#### Database Connection Fails
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Verify connection
curl https://your-repl.replit.dev/api/health
```
**Solutions:**
- Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/db`
- Verify Replit Database is provisioned
- Try removing `DATABASE_URL` to use in-memory mode

#### AI Agent Not Working
```bash
# Check health endpoint
curl https://your-repl.replit.dev/api/health | jq '.ai_agent'
```
**Solutions:**
- AI uses Replit AI Integrations (no personal key needed)
- Check if `AI_INTEGRATIONS_OPENAI_API_KEY` exists in secrets
- Restart the workflow

#### TypeScript Errors
```bash
# Run type check
npm run typecheck
```
**Common fixes:**
1. Missing type imports - add to imports
2. Schema mismatch - update `shared/schema.ts`
3. Storage method missing - add to `IStorage` interface

#### Frontend Not Loading
- Check workflow is running in Replit
- Verify port 5000 is bound
- Check browser console for errors
- Clear cache and hard refresh

#### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run dev
```

#### Health Check
```bash
curl https://your-repl.replit.dev/api/health | jq
```

## Current Status

### Production-Ready
- âœ… CRM Core (contacts, jobs, relationships)
- âœ… Field Operations (reports, photos, status tracking)
- âœ… Financial Tracking (income, expenses, profit)
- âœ… Export System (CSV with guardrails)
- âœ… Seed System (test data generation)
- âœ… Validation Layer (unified, with financial integrity checks)

### In Development
- âš ï¸ Lead Crawler Integration (pipeline bridge needed)
- âš ï¸ Outreach Automation (email/SMS agents)

### Technical Debt
- Pre-existing TypeScript errors in Stripe/Campaign modules (non-blocking)
- Export authentication configuration (UI works, direct API needs session)

## Known Issues

### Critical Issues
| Issue | Status | Workaround |
|-------|--------|------------|
| Authentication not implemented | Placeholder mode | Use for development only |
| Calendar POST route missing | Known | Appointments can't be created via dialog |
| Notes page not routed | Known | Page exists but unreachable |

### Pending Enhancements
- Authentication system (JWT + RBAC)
- File upload storage (S3/local)
- Real-time notifications (WebSocket)
- Email/SMS sending (via External Agent)
- Advanced AI memory (embeddings)
- Multi-language support

### Testing Status
- **Manual testing:** `data-testid` attributes on all interactive elements
- **Automated testing:** Vitest + Supertest configured but not written
- **E2E testing:** Planned (Playwright)

## Documentation Index
| Document | Purpose |
|----------|---------|
| API Reference | Complete API documentation |
| Deployment Guide | Production deployment |
| Developer Onboarding | New developer setup |
| Audit Report | Latest code audit |
| Architecture | System architecture decisions |

Remember: If the code is not clean, readable, and documented, it is not done.


