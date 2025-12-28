# Smart Klix CRM - White-Label AI CRM Platform
**Version:** 1.0.0
**Status:** Production-Ready Base Platform
**Last Updated:** December 2025
**Clean Code Doctrine:** Enforced

## Table of Contents
- [Overview](#overview)
- [Ledger & Governance Model](#ledger--governance-model)
- [AI Settings (System Constitution)](#ai-settings--system-constitution)
- [ActionAI CRM (Dual-Role Brain)](#actionai-crm--dual-role-brain)
- [Review Queue (AI Governance)](#review-queue--ai-governance)
- [Ready Execution (Human Authority)](#ready-execution--human-authority)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Master Architect & Operational Modes](#master-architect--operational-modes)
- [AI Tools & Execution](#ai-tools--execution)
- [N8N Integration](#n8n-integration)
- [Clean Code Standards](#clean-code-standards)
- [Developer Workflow](#developer-workflow)
- [Troubleshooting](#troubleshooting)
- [Known Issues](#known-issues)

## Overview
Smart Klix CRM is a production-grade, single-tenant, white-label AI CRM automation platform for field service management. It orchestrates the entire Lead to Estimate to Job to Invoice to Payment pipeline with integrated AI automation.

### Key Features
- **AI-Powered Automation:** Master Architect agent with Draft/Assist/Auto modes
- **Complete Pipeline Management:** Visual kanban board with drag-and-drop
- **Dual Chat Interfaces:** Public lead capture widget + admin intelligence bot
- **N8N Workflow Integration:** External automation for SMS, email, payments
- **Comprehensive Analytics:** Real-time metrics and audit logging
- **White-Label Ready:** Fully customizable branding per deployment

### Architecture Model
**Single-Tenant Isolation:** Each customer deployment is independent with dedicated:
- PostgreSQL database (Neon-backed)
- Secrets management
- N8N workflow runtime
- Branding configuration

This design prioritizes data security, compliance, and customer control.

---

### Non-Negotiable System Constraints

The following are architectural laws. Do not treat them as suggestions:

1. **Do not treat UI as authority** — UI is observational only. Authority lives in the Ledger.
2. **Do not bypass ledger writes** — Every state mutation requires a ledger entry. No shortcuts.
3. **Do not infer state from UI** — State is determined by the Ledger, not by UI visibility.
4. **Do not execute actions based on intent** — Only execute actions with valid ledger records.
5. **Do not "simplify" governance flows** — Review Queue and Assist Queue exist for safety.
6. **Do not collapse governance logic** — Master Architect and human approval are separate authorities.

### README Authority Statement

**This README is the authoritative system contract.**

If code behavior conflicts with this document, the code is wrong.

During migrations or refactors, prioritize this README over implementation details. It represents the intended architecture.

---

## Ledger & Governance Model

Smart Klix CRM is governed by an Event-Based Ledger Model.

The Ledger is the single source of historical truth for every meaningful action, decision, and outcome in the system.

This is not logging — it is a state evolution transcript.

### Ledger Anchoring Rules (Critical)

Each ledger is anchored to exactly one entity:

1. **Company Ledger**
   - Used when a company exists
   - All related contacts, jobs, invoices, payments, and actions roll up here

2. **Contact Ledger**
   - Used only when no company exists
   - All actions apply directly to the contact

There are:
- ❌ No sub-ledgers
- ❌ No nested entities
- ❌ No dual anchoring

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
| `correlationId` | string (optional) | For chained or external actions (N8N callbacks, webhooks) |

Events missing any required field (except optional `correlationId`) are **rejected as invalid**.

This ensures consistent audit trail structure and prevents schema drift.

### What Gets Written to the Ledger

Every meaningful system event generates a ledger entry:

- **AI Events**
  - AI proposal created
  - AI tool execution requested
  - AI validation decision (Master Architect)
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
  - N8N workflow dispatched
  - Payment link sent
  - Stripe/payment confirmation received
  - External callback processed

If it changes state, sends money, sends a message, or affects a customer — it goes on the ledger.

### Queue Routing Rule

All AI-initiated actions follow this deterministic path:

1. **AI proposes action** → Ledger entry created (`eventType: ai_proposal_created`)
2. **Master Architect validates** → Ledger governance event written (`eventType: ai_review_decision`)
3. **Decision made:**
   - If action **requires human approval** (e.g., payments, estimate conversion): Move to Ready Execution
   - If action **does not require human approval** (e.g., data lookup, note creation): Move to Ready Execution (optional observability layer)
4. **If Ready Execution:** Operator confirms/rejects → Ledger governance event written (`eventType: human_execution_decision`)
5. **Execution** (if confirmed): Dispatch to N8N or execute internally → Ledger execution event written

This removes guesswork and ensures all routing decisions are ledger-recorded.

### Execution Eligibility Rules

An action is executable only if:

1. A valid ledger entry exists (proposing the action)
2. Required governance decisions exist:
   - If AI-initiated: Master Architect validation event exists
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

Downstream systems do not act on intent — they act on Ledger state.

Flow example:
AI proposes an action → Ledger
Master Architect validates → Ledger
Operator approves → Ledger
Action dispatched to N8N → Ledger
External system confirms execution → Ledger

This ensures:
- Full traceability
- Auditability
- Deterministic execution
- Safe AI autonomy

**Financial Actions Execution Authority (Critical):**

Financial actions (invoices, payment links, charges, refunds) are **never executed directly by AI**.

AI may *propose* these actions, but execution occurs only after required ledger governance events are satisfied (Master Architect validation + human approval in Assist Queue).

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

- **Master Architects**: To define system instructions and autonomy levels for AI entities.

### The 4-Entity Architecture (Configurable)

Smart Klix is organized around four distinct AI entities, each with separate concerns:

1. **Edge Agent**
   - **Role**: Intake & Triage
   - **Authority**: Classifies incoming messages, extracts data, determines routing
   - **Configuration**: Greeting scripts, data collection rules, triage logic
   - **Execution**: Cannot execute (read-only, proposal-only)

2. **Discovery AI**
   - **Role**: Retrieval & Context
   - **Authority**: Searches knowledge base, retrieves customer history, contextualizes conversations
   - **Configuration**: Citation strictness, PII masking rules, search depth
   - **Execution**: Cannot execute (read-only, proposal-only)

3. **ActionAI CRM**
   - **Role**: The System Brain — Reasoning & Decision-Making
   - **Authority**: Analyzes input, proposes actions, drafts payloads
   - **Configuration**: Bias toward action vs. discussion, autonomy levels (Manual/Semi/Full)
   - **Execution**: Cannot execute (proposal-only; execution requires Review Queue + Ready Execution)

4. **Master Architect**
   - **Role**: Governance & Policy Enforcement
   - **Authority**: Validates AI proposals, enforces policy, makes governance decisions
   - **Configuration**: Validation schemas, policy rules, override thresholds
   - **Execution**: Cannot execute (governance-only, AI-driven validation)

### What AI Settings Is NOT

- ❌ A dashboard or status screen
- ❌ A role management system
- ❌ An execution control panel
- ❌ A simulation or debugging environment

**AI Settings defines constraints and behavior. Execution is controlled by Ledger governance, Review Queue, and Ready Execution.**

### AI Settings Contract

- Config changes update the orchestration runtime (e.g., Neo8) immediately
- Only Master Architects can write to AI Settings
- All entities are read-only executors; they generate proposals, not direct state changes
- No entity can bypass Review Queue or Ready Execution

---

## ActionAI CRM (Dual-Role Brain)

### Definition & Responsibility

**ActionAI CRM** is the **System Brain**. It is responsible for reasoning, decision-making, and drafting operational proposals based on input data and customer interactions.

**Critical:** ActionAI CRM has one responsibility: **To propose governed actions based on input.**

It is **NOT** a background-only service. It has two explicit interfaces that both lead to the same outcome: a proposal in Review Queue.

### The Two Input Paths (Dual Role)

#### A) The Headless Engine (Automated)

- **Input Source**: Intake Hub, Funnels, Event triggers
- **Trigger**: Data is committed (e.g., Form Submission, Webhook, Scheduled task)
- **Behavior**: ActionAI analyzes the payload, deduplicates, and generates a proposal
- **Output**: Review Queue (for Master Architect AI validation)
- **Ledger Event**: `AI_PROPOSAL_CREATED`
- **Cannot**: Dispatch or execute without governance approval

#### B) The Action Console (Interactive)

- **Input Source**: Action Console tab (human operator typing instructions)
- **Trigger**: Operator submits a manual instruction (e.g., "Draft an invoice for Marcus")
- **Behavior**: ActionAI interprets intent, queries context, and drafts a proposal
- **Output**: Review Queue (for Master Architect AI validation)
- **Ledger Event**: `AI_PROPOSAL_CREATED`
- **Cannot**: Execute without governance approval

**Critical Rule:** Both paths lead to the **Same Outcome** (a proposal in the Review Queue).

There is no "fast path" that bypasses governance.

### Ledger Responsibility (First Writer in Chain of Custody)

ActionAI CRM is the **First Writer** in the chain of custody.

- **When**: Immediately upon generating a draft proposal
- **Writes**: `AI_PROPOSAL_CREATED` event to audit_log
- **Contains**: The raw intent, reasoning, generated JSON payload, and proposed action details

This ensures full traceability from intent to execution.

### Capability Contract (What ActionAI CRM Can Propose)

ActionAI CRM is authorized to **PROPOSE** (not execute) the following actions only:

1. **Create Lead** - From normalized intake data
2. **Create Contact** - Maximum of 5 entities per proposal
3. **Create Task** - Follow-up tasks for human operators
4. **Draft Communication** - Email, SMS, or WhatsApp drafts (not send)
5. **Create Note** - Internal context logging
6. **Create Job** - Only if explicitly allowed by Master Architect policy

These actions create new entities or draft communications. **They do not mutate existing state.**

### Hard Constraints (What ActionAI CRM CANNOT Do)

ActionAI CRM is strictly **FORBIDDEN** from:

- ❌ **Direct Mutation**: Cannot update existing records autonomously. Ever.
- ❌ **Overwrite**: Cannot change data it created without human approval
- ❌ **Direct Execution**: Cannot send emails, process payments, or dispatch to external systems
- ❌ **Bypass**: Cannot skip the Review Queue or Master Architect governance
- ❌ **Financial Actions**: Cannot propose, execute, or approve payment-related actions

### Flag-Only Escalation Rule (Non-Negotiable)

If ActionAI CRM detects an action it is not authorized to perform:

1. It must create a **Human Action Required** proposal
2. Route it through Review Queue for Master Architect validation
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

1. **First Failure**: Master Architect rejects proposal. ActionAI requests redraft.
2. **Second Failure**: Master Architect rejects proposal. ActionAI requests redraft.
3. **Third Failure**: **BLOCK**
   - ActionAI CRM is suspended for this specific context/task
   - The task reverts to **Manual Handling Only**
   - Event is logged as "AI Unfit for Task" in audit_log

This prevents infinite loops and ensures human takes control.

---

## Review Queue (AI Governance)

### Purpose

The Review Queue is the **Automated Governance Processing Layer**.

It is the domain of the **Master Architect AI**.

### Critical Architecture Rule

- ❌ **NO HUMANS** participate in this queue
- ✅ **Master Architect AI** is the ONLY reviewer

This is non-negotiable. Review Queue is AI-to-AI validation, not human approval.

### What Happens Here

1. **Input**: Proposals arrive from **ActionAI CRM** (from either Headless Engine or Action Console)
2. **Validation**: Master Architect validates logic, schema, and policy compliance
3. **Decision**:
   - **Approved**: Automatically moves to **Ready Execution**
   - **Rejected**: Returned to ActionAI CRM for redrafting (or archival after 3 failures)

### Ledger Responsibility

The Master Architect writes the governance decision to the ledger.

- **Event Type**: `AI_REVIEW_DECISION`
- **Actor**: Master Architect (AI)
- **Content**: Validation outcome, policy check results, and the decision (Approve/Reject)

### Observability Interface (Optional)

- **Role**: Passive observability only
- **Purpose**: Transparency, debugging, and auditability
- **Audience**: Human observers (no authority)
- **Controls**: None. No interaction, no intervention, no override.
- **Note**: This interface is optional and may be hidden or disabled in production.

### Review Queue UI Contract (If Implemented)

- ✅ Read-only observability
- ✅ Displays ledger-backed governance events only
- ❌ No mutation handlers
- ❌ No approval buttons
- ❌ No execution triggers
- ❌ No human decision capability

Any UI component that attempts to modify state or approve actions from Review Queue is **architecturally invalid**.

### The Flow

```
ActionAI CRM (Propose)
     |
     v
Review Queue (Master Architect Validates)
     |
     v
Ready Execution (Human Decides & Executes)
```

---

## Ready Execution (Human Authority & Dispatch)

### Purpose

**Ready Execution** is the **Final Human Authority**.

It is the **ONLY** place where a human operator exercises approval power and triggers real-world execution.

**CRITICAL ARCHITECTURE RULE**: ✅ **Human Operator** is the ONLY actor here.

### What Happens Here

1. **Input**: Proposals that have been **Approved by Master Architect** (from Review Queue)
2. **Human Decision**: The Operator reviews the Master Architect-validated payload
3. **Action**:
   - **Confirm**: Triggers the API/Integration (Real-world execution to N8N, Stripe, databases, etc.)
   - **Reject**: Overrides the AI's approval, kills the workflow, and logs a terminal state

### Ledger Responsibility

The Human Operator logs the final reality.

- **Event Type**: `HUMAN_EXECUTION_DECISION`
- **Actor**: Human Operator (User ID recorded)
- **Content**: The explicit action (Confirmed/Rejected), user identity, timestamp, and final outcome (Sent/Cancelled)

### UI Layout & Components

- **Queue**: List of AI-Validated items ready for dispatch (from Review Queue)
- **Action Buttons**: 
  - "Confirm & Execute" - Dispatches to N8N, Stripe, database
  - "Reject & Cancel" - Terminal rejection (no redraft loop)
- **Payload Display**: Full details of what AI proposed and Master Architect validated
- **Security**: Identity confirmation modal before execution (especially for financial actions)

### The Flow

```
Review Queue (AI Validated)
     |
     v
Ready Execution (Human Reviews & Confirms)
     |
     v
External World (API, N8N, Stripe, Database)
     |
     v
Ledger Records Result
```

### Critical Boundaries

**Ready Execution ≠ Review Queue**
- Review Queue: AI governance (no humans)
- Ready Execution: Human authority (only humans execute)

**Ready Execution ≠ Assist Queue**
- Assist Queue: Operator approves AI-generated content (e.g., draft emails, estimates)
- Ready Execution: Operator executes the approved action in the real world

### Headless Execution Engine Constraint

**The Headless Execution Engine cannot dispatch any action without passing Review Queue and Ready Execution approval.**

This applies to all paths:
- Headless Engine triggers → Review Queue → Ready Execution → Dispatch
- Action Console triggers → Review Queue → Ready Execution → Dispatch
- Direct API calls → Review Queue → Ready Execution → Dispatch

No action reaches external systems (N8N, Stripe, database mutations) without this full chain.

---

## Quick Start

### Prerequisites
- Node.js 20+ (automatically provided by Replit)
- PostgreSQL database (use Replit's built-in database)
- OpenAI API access (via Replit AI Integrations - no personal key required)
- N8N instance (optional, for workflow automation)

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
| N8N | Displays pending status |

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
| N8N_WEBHOOK_URL | N8N webhook base URL | None (N8N features disabled) |
| N8N_INTERNAL_TOKEN | Token for N8N to CRM API calls | None |
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
├── client/                      # Frontend (React 18 + TypeScript)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # Shadcn UI primitives (Button, Card, etc.)
│   │   │   ├── AppSidebar.tsx   # Main navigation sidebar
│   │   │   ├── CreateJobDialog.tsx
│   │   │   └── ...
│   │   ├── pages/               # Page components (one per route)
│   │   │   ├── Dashboard.tsx    # Main dashboard with metrics
│   │   │   ├── Contacts.tsx     # Customer management
│   │   │   ├── Jobs.tsx         # Project tracking
│   │   │   ├── Pipeline.tsx     # Visual kanban board
│   │   │   ├── AdminChat.tsx    # AI intelligence bot
│   │   │   └── ...
│   │   ├── hooks/               # Custom React hooks
│   │   │   └── use-toast.ts     # Toast notification hook
│   │   ├── lib/                 # Utilities and config
│   │   │   ├── queryClient.ts   # TanStack Query setup
│   │   │   └── utils.ts         # Helper functions
│   │   ├── App.tsx              # Root component with routing
│   │   └── main.tsx             # Application entry point
│   └── index.css                # Tailwind + theme variables
│
├── server/                      # Backend (Express + TypeScript)
│   ├── index.ts                 # Express app entry point
│   ├── routes.ts                # API routes (all with Zod validation)
│   ├── storage.ts               # Storage interface + implementations
│   ├── db.ts                    # Database connection (Drizzle + Neon)
│   ├── master-architect.ts      # AI agent orchestrator
│   ├── ai-tools.ts              # OpenAI function calling tools (26 tools)
│   ├── pipeline.ts              # Job pipeline state machine
│   ├── vite.ts                  # Vite dev server integration
│   └── replit_integrations/     # Replit AI Integration blueprints
│       ├── chat/                # Chat completion utilities
│       │   ├── index.ts         # Main chat function
│       │   └── storage.ts       # Chat history storage
│       ├── image/               # Image generation utilities
│       │   └── index.ts         # DALL-E integration
│       └── batch/               # Batch processing utilities
│           └── utils.ts         # Batch job helpers
│
├── shared/                      # Shared types and schemas
│   └── schema.ts                # Drizzle ORM schemas + Zod validation
│                                # (Single source of truth for all types)
│
├── docs/                        # Documentation (MUST be updated)
│   ├── API_REFERENCE.md         # Complete API documentation
│   ├── DEPLOYMENT_GUIDE.md      # Production deployment guide
│   ├── DEVELOPER_ONBOARDING.md  # New developer setup
│   ├── AUDIT_REPORT.md          # Latest audit findings
│   └── architecture.md          # System architecture decisions
│
├── replit.md                    # Project memory and architecture notes
├── package.json                 # Dependencies (DO NOT EDIT MANUALLY)
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── vite.config.ts               # Vite configuration (DO NOT EDIT)
└── drizzle.config.ts            # Drizzle ORM configuration (DO NOT EDIT)
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
| PostgreSQL | Production database (Neon) | 16.x |
| OpenAI SDK | AI agent (GPT-4o) | 4.x |
| Zod | Runtime validation | 3.x |
| WebSocket (ws) | Real-time chat streaming | 8.x |

### External Integrations
| Service | Purpose |
|---------|---------|
| Replit AI Integrations | OpenAI API access (managed keys) |
| Replit Database | PostgreSQL hosting (Neon-backed) |
| N8N | Workflow automation (SMS, email, payments) |

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

## Master Architect & Operational Modes

### Master Architect Overview

The Master Architect is the AI Governance Engine that validates all ActionAI CRM proposals. Located in `server/master-architect.ts`.

**Role**: Governance and Policy Enforcement
- Receives proposals from ActionAI CRM
- Validates against policy schemas
- Makes approval/rejection decisions
- Writes governance events to Ledger

Master Architect is NOT an execution engine. It is a validation and governance layer.

### Operational Modes (ActionAI CRM)

**Critical:** These modes apply to **ActionAI CRM**, not Master Architect.

| Mode | Behavior | Execution Path |
|------|----------|-----------------|
| Draft | ActionAI CRM suggests actions; no governance execution | ActionAI proposes → Operator reviews in UI (no auto-execution) |
| Assist | ActionAI CRM queues proposals for approval | ActionAI proposes → Review Queue (Master Architect validates) → Ready Execution (human confirms) |
| Auto | ActionAI CRM auto-generates proposals aggressively | ActionAI proposes → Review Queue (Master Architect validates) → Ready Execution (human confirms) |

**Critical:** All modes route through Review Queue and Ready Execution. There is no "Auto mode" that bypasses human authority for financial or critical actions.

**Auto mode does NOT mean "autonomous execution." It means ActionAI CRM is aggressive in generating proposals. Execution always requires human confirmation in Ready Execution.**

### AI Tools & Execution

#### Tool Categories (26 Available)

The ActionAI CRM can invoke these proposal tools (defined in `server/ai-tools.ts`):

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

These tools can be invoked by ActionAI CRM to PROPOSE:
- `send_invoice` - Propose sending invoice
- `record_payment` - Propose recording payment
- `create_invoice` - Propose creating invoice
- Any tool that mutates financial records

**What happens when ActionAI CRM invokes a financial tool:**
1. ActionAI CRM generates a proposal (not execution)
2. Ledger entry created: `AI_PROPOSAL_CREATED` (financial action proposal)
3. Master Architect validates the proposal
4. If approved → Ready Execution shows the proposal for human confirmation
5. **Human operator explicitly confirms execution in Ready Execution**
6. Only then is the action dispatched to N8N, Stripe, or internal systems

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
ActionAI CRM (server/master-architect.ts)
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
Review Queue (Master Architect validates)
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
  - ActionAI may DRAFT, but proposals go through Review Queue
  - Dispatch goes through Neo8 Engine

#### Sub-Tab B: Email Accounts (Company/System)
- **Purpose**: System and business email identity
- **Provider**: SendGrid via Neo8 Engine
- **Context**: Template-only, transactional messages (invoices, notifications)
- **Constraint**: No free-text editing at send time - template selection only
- **Authority**:
  - Human or ActionAI can select templates
  - ActionAI proposals MUST go through Review Queue
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
| `EMAIL_DISPATCH_AUTHORIZED` | User clicks Authorize Dispatch | Human/ActionAI |
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
- ❌ **Inbox Zero**: This is an audit log, not a to-do list
- ❌ **Marketing Builder**: Bulk campaigns in Funnels/Social Planner
- ❌ **Real-Time Chat**: Use WhatsApp for instant messaging
- ❌ **Auto-Send**: Background automation lives in ActionAI

## WhatsApp & SMS (Operational Messaging Engine)

### Core Purpose
The WhatsApp tab is the **Instant Operations Channel** for high-velocity, low-latency communication for logistics and field coordination. This is **NOT chat** - it's a review + dispatch interface.

### Client ID - Root of the System (NON-NEGOTIABLE)
**Nothing exists without a Client ID.**

| Without Client ID | Consequence |
|-------------------|-------------|
| No Client ID | No Lead |
| No Client ID | No Outreach |
| No Client ID | No ActionAI proposal |
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
**ActionAI CAN:**
- Draft SMS/WhatsApp messages
- Propose outreach tied to a valid Client ID
- Ask clarifying questions before drafting

**ActionAI CANNOT:**
- Send messages directly
- Bypass review
- Message without a Client ID

### Dispatch Flow (Required)
```
CRM UI
→ Review Queue (approval required)
→ Authorization
→ Neo8 Engine
→ Provider (WhatsApp/SMS via Twilio)
→ Ledger Write
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
| `WHATSAPP_DRAFTED` | ActionAI generates message |
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
- ❌ **Real-time chat**: This is dispatch prep, not conversation
- ❌ **Marketing blaster**: No bulk spam
- ❌ **Bot builder**: Logic lives in Funnels or AI Voice
- ❌ **Direct send**: CRM never sends directly

## N8N Integration

### Overview
Smart Klix integrates with N8N for external automation:
- SMS/Email: Customer communications
- Payment Links: Stripe/payment processing
- Voice Calls: Inbound/outbound call handling
- Calendar Sync: External calendar integration

### Integration Flow
```
Dashboard Action
     |
     v
POST to N8N Webhook (N8N_WEBHOOK_URL)
     |
     v
N8N Workflow Executes
     |
     v
N8N Calls Back via /api/events/update
     |
     v
CRM Updates Status
```

### Required Environment Variables
```bash
N8N_WEBHOOK_URL=https://your-n8n.com/webhook
N8N_INTERNAL_TOKEN=your-secret-token
APP_BASE_URL=https://your-app.replit.dev
```

### N8N Callbacks & Ledger Linkage (Critical)

All external callbacks (N8N, Stripe, webhooks) **must reference the originating ledger action ID**.

**Callback Contract:**

1. When dispatching to N8N, include the ledger entry ID:
   ```typescript
   POST https://n8n-instance/webhook
   {
     "action": "send_sms",
     "ledgerActionId": "abc123...",
     "data": { ... }
   }
   ```

2. When N8N calls back via `/api/events/update`, the callback must include the originating ledger ID:
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
- Email/SMS sending (via N8N)
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
