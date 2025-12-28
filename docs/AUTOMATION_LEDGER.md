# Automation Ledger

## Overview

The Automation Ledger is an immutable audit trail that records every agent-triggered mutation within the CRM. It provides accountability for AI actions by ensuring every state change has a traceable history.

## Core Rules

### What Gets Logged
Only **state-changing actions** are recorded:
- Create / update / delete entities (contacts, jobs, invoices, etc.)
- Send emails or messages
- Pipeline or status changes
- Any agent-triggered mutation or side effect

### What Does NOT Get Logged
- Read operations
- Queries and searches
- Lookups
- Questions
- Chat responses
- Informational queries ("How many X" or "What is Y")

**Rule: If nothing changed, nothing gets logged.**

## Schema

```sql
CREATE TABLE automation_ledger (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  agent_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id VARCHAR,
  mode TEXT NOT NULL DEFAULT 'dry_run',
  status TEXT NOT NULL DEFAULT 'pending',
  diff_json JSONB,
  reason TEXT,
  assist_queue_id VARCHAR,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `timestamp` | Timestamp | When the entry was created |
| `agent_name` | Text | The agent that triggered the action (e.g., "master_architect") |
| `action_type` | Text | Explicit action name (see Action Types below) |
| `entity_type` | Text | Type of entity affected (contact, job, invoice, etc.) |
| `entity_id` | UUID | ID of the affected entity (populated on success) |
| `mode` | Enum | dry_run | executed | rejected |
| `status` | Enum | pending | success | failed | flagged |
| `diff_json` | JSONB | Before/after state snapshot |
| `reason` | Text | Failure or flag reason |
| `assist_queue_id` | UUID | Link to assist_queue entry if applicable |

## Action Types

Explicit action names (not generic verbs):

- `create_contact`, `update_contact`, `delete_contact`
- `create_job`, `update_job`, `update_job_status`, `delete_job`
- `create_estimate`, `update_estimate`, `send_estimate`
- `create_invoice`, `update_invoice`, `send_invoice`
- `record_payment`
- `send_email`, `send_sms`
- `pipeline_transition`
- `create_appointment`, `update_appointment`, `delete_appointment`
- `create_note`
- `assign_technician`

## Mode Lifecycle

### Single-Entry Model
One ledger row per action, updated through its lifecycle:

1. **Creation** (always first)
   - `mode = "dry_run"`, `status = "pending"`
   - Entry created BEFORE any execution

2. **On Execution**
   - `mode = "executed"`, `status = "success" | "failed"`
   - `entity_id` populated on success

3. **On Rejection**
   - `mode = "rejected"`, `status = "pending"`
   - No new rows created

## Diff JSON Conventions

### Create Actions
Full snapshot of the created entity:
```json
{
  "type": "create",
  "snapshot": { "id": "...", "name": "John Doe", ... }
}
```

### Update Actions
Before and after state:
```json
{
  "type": "update",
  "before": { "name": "John Doe", "email": null },
  "after": { "name": "John Doe", "email": "john@example.com" }
}
```

### Delete Actions
Snapshot before deletion:
```json
{
  "type": "delete",
  "snapshot": { "id": "...", "name": "John Doe", ... }
}
```

### Send Actions
Optional metadata:
```json
{
  "type": "send",
  "metadata": { "to": "john@example.com", "subject": "Invoice #123" }
}
```

## API Endpoints

### GET /api/automation-ledger
Query ledger entries with optional filters.

**Query Parameters:**
- `agentName` - Filter by agent name
- `actionType` - Filter by action type
- `mode` - Filter by mode (dry_run, executed, rejected)
- `status` - Filter by status (pending, success, failed, flagged)
- `limit` - Maximum entries to return (default: 100)

**Example:**
```bash
curl "https://your-domain.com/api/automation-ledger?status=success&limit=50"
```

### GET /api/automation-ledger/:id
Get a single ledger entry by ID.

## Integration Points

The ledger is integrated at the `executeAITool()` function level in `server/ai-tools.ts`. This ensures:
- All mutations pass through one execution layer
- Ledger entry is created BEFORE execution
- Ledger is updated AFTER execution with success/failure
- No mutation can bypass logging

## Future Enhancements (Not Yet Implemented)

- Admin UI for viewing records
- Execution locking (dry_run → approve → execute flow)
- Undo/cleanup logic
- Role-based visibility
