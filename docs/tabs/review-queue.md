# Review Queue (Master Architect Domain)

## Purpose

The Review Queue is the **Automated Governance Processing Layer**. It is the domain of the **Master Architect AI**.

**CRITICAL ARCHITECTURE RULE**:
- NO HUMANS participate in this queue
- Master Architect AI is the ONLY reviewer
- This is a READ-ONLY observability interface for humans

## What Appears Here

**ONLY AI-generated proposals:**
- Actions from AI Action CRM
- Actions from Automation / n8n workflows
- System-initiated AI workflows

**Does NOT appear here:**
- Human-created actions (estimates, payments, edits)
- Operator-initiated actions
- Any action already reviewed by a human

## Authority Flow

### AI-Originated Flow (Uses Review Queue)
```
AI Action CRM
    |
Automation Ledger (event recorded)
    |
Review Queue
    |
Master Architect AI Validation
    |
Automation Ledger (decision recorded)
    |
Ready Execution (if approved)
    |
n8n / External Execution
```

### Human-Originated Flow (Skips Review Queue)
```
Human Action
    |
Automation Ledger (event recorded)
    |
(SKIPS Review Queue)
    |
Ready Execution or Immediate Execution
```

## Validation Process

The Master Architect AI evaluates each proposal:
1. **Logic Check** - Logical correctness of the proposed action
2. **Schema Check** - Schema integrity and data validation
3. **Policy Compliance** - Business policy and safety rules

### Outcomes
- **Approved** - Automatically routes to Ready Execution
- **Rejected** - Returned to source with rejection reason

## Ledger Events

- **Event Type**: `AI_REVIEW_DECISION`
- **Actor**: Master Architect (AI)
- **Content**: Validation outcome, policy check results, decision (Approve/Reject)

## UI Layout

### Header
- Status badge: "System Controlled | Read-Only Access"
- Master Architect status indicator

### Left Panel: The Queue
- Active AI proposals table
- Columns: Proposal ID, Origin, Summary, Validation Progress, Status
- Validation progress stepper: Logic -> Schema -> Policy
- Status badges: Green (Approved), Red (Rejected), Amber (In Validation)

### Right Panel: Activity Ledger
- High-frequency stream of `AI_REVIEW_DECISION` events
- Shows governance decision speed and outcomes

## What This Tab Is NOT

- NOT a human approval screen (humans approve in Ready Execution)
- NOT a task list for operators
- NOT an interface for manual intervention

## API Endpoints Used (Read-Only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assist-queue` | GET | List AI proposals |
| `/api/automation-ledger` | GET | List governance decisions |

## Design Tokens

- Background: `bg-glass-surface`
- Borders: `border-glass-border`
- In Validation: Amber glow, spinning indicator
- Approved: Emerald glow, checkmark
- Rejected: Red glow, X mark

## Test IDs

- `text-page-title`: Page title
- `badge-read-only`: Read-only status badge
- `card-proposal-{id}`: Proposal cards
- `ledger-entry-{id}`: Ledger entries

## Files

- `client/src/pages/ReviewQueue.tsx` - Read-only observability interface
- `shared/schema.ts` - assistQueue table (data source)
- `server/routes.ts` - API endpoints for assist queue and automation ledger
