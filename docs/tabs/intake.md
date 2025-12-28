# Intake Hub (Ingress Firewall & Normalization)

## Purpose

The Intake Hub is the **Single Point of Ingress** and acts as a strict **Data Firewall**.

It performs two critical functions:
1. **Passive Intake**: Receiving inbound data (Forms, Webhooks, Widgets)
2. **Active Intake**: Sending outbound requests for structured data (e.g., "Send Client Intake Form")

Its job is to capture, normalize, and stage raw data. It **NEVER** decides actions and **NEVER** mutates the CRM directly.

**Processing Authority**: ActionAI CRM
- Intake provides the *Fuel*
- ActionAI provides the *Engine*

## Configuration Philosophy (The 5-Minute Rule)

Configuration must be **Dead Simple**:
- No Workflow Builders
- No Scripting
- No Complex Condition Trees
- **Method**: Copy/Paste URL → Toggle Source → Done

## UI Layout (3-Column Control Room)

| Column | Name | Width | Purpose |
|--------|------|-------|---------|
| **Left** | Triage Queue | w-80 | Pending submissions list with status, source, timestamps |
| **Middle** | Raw Processing | flex-1 | Read-only terminal-style JSON viewer for raw payload |
| **Right** | Normalized Staging | w-[450px] | Editable form fields + Verify & Commit actions |

### Header Elements

| Element | Purpose |
|---------|---------|
| Title | "Intake Hub" with "Ingress Firewall" badge |
| View Toggle | Switch between "Triage Queue" and "Active Intake (Outbound)" |
| Source Configuration | Popover for managing webhook/widget sources |

### Left Column: Triage Queue

- Shows count of pending submissions
- Dedupe Watch indicator
- Each item displays:
  - Status indicator (amber dot for pending)
  - Source form name
  - Contact name (extracted from payload)
  - Timestamp
  - Source ID badge

### Middle Column: Raw Processing

- **Observation Mode** badge (read-only indicator)
- Raw JSON payload displayed in terminal style
- "Copy JSON" button on hover
- Metadata grid: Ingress Timestamp, Source Form ID

### Right Column: Normalized Staging

- Editable form fields:
  - First Name / Last Name
  - Email (Business)
  - Phone (Normalized)
  - Intent Summary
  - Proposed CRM Object (Lead/Contact/Deal/Ticket)
- **Dedupe Watch Banner**: Amber warning if potential match detected
- **Action Buttons**:
  - "Verify & Commit to ActionAI CRM" (primary)
  - "Reject & Archive" (destructive outline)

## Read-Only vs Editable

| Section | Editability | Owner |
|---------|-------------|-------|
| Triage Queue | Click to select only | System |
| Raw Processing (JSON) | **Read-Only** | System |
| Normalized Staging | **Editable** | Operator |

## Data Flow

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/intakes` | GET | List intake form definitions |
| `/api/intake-submissions` | GET | List all submissions |
| `/api/intake-submissions/:id` | PATCH | Update submission status (commit/reject) |

### Normalization Logic

The frontend extracts and normalizes payload fields:
- `firstName`, `first_name`, `fname` → firstName
- `lastName`, `last_name`, `lname` → lastName
- `email`, `work_email`, `businessEmail` → email
- `phone`, `phone_raw`, `phoneNumber` → phone
- `intent`, `intent_blob`, `message`, `notes` → intent

## Automation Ledger Events

| Event | When | Logged By |
|-------|------|-----------|
| `INTAKE_RECEIVED` | Raw payload lands | Neo8 webhook |
| `INTAKE_COMMITTED` | Operator clicks "Verify & Commit" | Intake Hub |
| `INTAKE_REJECTED` | Operator clicks "Reject" | Intake Hub |

**Note**: Backend ledger event logging is stubbed. Events are conceptually triggered but await ActionAI pipeline integration.

## Neo8 Workflow Integration

### Inbound Endpoint (Single)

| Webhook | Direction | Sources |
|---------|-----------|---------|
| `/webhook/lead-intake` | Inbound | Widget, Typeform, Zapier, etc. |

All sources flow through this single endpoint. Neo8 responsibilities:
- Normalize inbound payloads
- Attach source, timestamp, trace_id
- Forward into Intake Hub staging tables

### The Handoff Contract

1. **User**: Reviews Staged Data in Intake
2. **User**: Clicks "Verify & Commit"
3. **Intake**: Passes normalized payload to ActionAI CRM (Headless Path)
4. **Critical Trigger**: ActionAI reasons over payload and proposes action(s)
5. **Output**: Proposal lands in Review Queue

## Active Intake (Outbound)

The second view mode allows operators to send structured intake requests:

| Field | Options |
|-------|---------|
| Recipient | Contact email or phone |
| Intake Type | Lead Information, Job Details, Qualification Form |
| Delivery Channel | Email, SMS, Link |

**Flow**:
```
Operator → Active Intake → Neo8 → External User
Response → Intake Hub (Triage Queue)
```

**Status**: v1 placeholder implementation. Full Neo8 integration pending.

## Supported Sources

- Edge Agent (Website Widget)
- ChatGPT / ActionGPT (Handoffs from conversational flows)
- Forms (Webforms, Typeform, GHL)
- Manual (Operator submissions)
- Active Outreach (Outbound Email/SMS intake requests)

## Design Tokens

| Element | Classes |
|---------|---------|
| Header | `bg-glass-surface`, `border-border` |
| Sidebar | `bg-glass-surface`, `border-border` |
| Raw JSON Card | `bg-muted/30`, `border-border`, `font-mono` |
| Normalized Form | `bg-glass-surface` |
| Selected Item | `bg-primary/10`, `border-primary/30` |
| Dedupe Warning | `bg-amber-500/10`, `border-amber-500/20` |
| Commit Button | Primary gradient |
| Reject Button | `hover:bg-destructive/10` |

## Test IDs

| Element | Test ID |
|---------|---------|
| Triage Queue Tab | `tab-triage-queue` |
| Active Intake Tab | `tab-active-intake` |
| Source Config Button | `button-source-config` |
| Close Source Config | `button-close-source-config` |
| Triage Item | `triage-item-{id}` |
| First Name Input | `input-first-name` |
| Last Name Input | `input-last-name` |
| Email Input | `input-email` |
| Phone Input | `input-phone` |
| Intent Input | `input-intent` |
| Proposed Object Select | `select-proposed-object` |
| Verify & Commit Button | `button-verify-commit` |
| Reject Button | `button-reject` |
| Outbound Recipient Input | `input-outbound-recipient` |
| Outbound Type Select | `select-outbound-type` |
| Channel Buttons | `button-channel-email`, `button-channel-sms`, `button-channel-link` |
| Send Request Button | `button-send-intake-request` |

## What This Tab Is NOT

- **A brain**: It does not think or make decisions
- **An automation runner**: It does not execute workflows
- **A communication tool**: It sends *forms*, not *chats*

## Responsibilities (Locked)

1. **Capture**: Ingest raw intent + metadata
2. **Normalize**: Map fields to standard schema
3. **Dedupe**: Check for existing Phone/Email matches
4. **Staging**: Hold data in "Pending" state for human review

## Migration Note

**IntakeBuilder.tsx** is now the Intake Hub (triage + staging) and no longer a form builder UI. The filename is preserved to maintain existing routing and references.
