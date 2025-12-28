# Jobs (Operations Queue & Lifecycle)

## Purpose

The Jobs tab is the **Field Execution Engine**. It tracks the physical work being done, from "Scheduled" to "Completed". It is the primary interface for Technicians and Dispatchers.

## Who Uses This

| Role | Purpose |
|------|---------|
| **Dispatchers** | Assign work and monitor status |
| **Technicians** | View schedule, clock in/out, upload photos |
| **Managers** | Track operational reality vs. quoted expectations |

## What Problem It Solves

- Decouples "Sales" (Pipeline) from "Execution" (Jobs)
- Tracks operational reality (Time on site, parts used) vs. quoted expectations
- Provides visibility into field operations in real-time

## UI Layout

### List View (Operations Queue)

| Element | Purpose |
|---------|---------|
| Header | Title "Operations Queue", job count, status summary badges |
| Status Badges | Quick visibility of In Progress (pulsing amber), Scheduled (blue), Completed (green) |
| Search/Filter | Filter by text, status |
| Job Table | ID, Title, Client, Value, Finance Status, Job Status, Actions |

### Detail View (Job Hero)

| Section | Width | Content |
|---------|-------|---------|
| **Hero Header** | Full | Job title, status badge, ID, client, scheduled date, financial state, primary action button |
| **Left Pane** | w-[380px] | Operational Context (description, priority, assigned techs), AI Watch alerts, Field Sync status |
| **Right Pane** | flex-1 | Tabbed interface (Overview, Messages, Work Logs, Finances) |

### Right Pane Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Service summary, timeline, quick actions |
| **Messages** | Read-only historical communication log |
| **Work Logs** | Field documentation (photos), signature capture |
| **Finances** | Linked estimates/invoices (navigation only) |

## Click-by-Click Behavior

1. **Row Click**: Opens detail view for selected job
2. **Status Change**: Primary action button progresses job status (Start Job → Complete Job → Create Invoice)
3. **Upload**: In Work Logs tab, click upload area to add field photos
4. **Financials**: In Finances tab, linked artifacts are navigational only - edits occur in Estimates/Invoices modules

## Data Flow

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs` | GET | List all jobs |
| `/api/jobs/:id` | GET | Get single job details |
| `/api/jobs` | POST | Create new job |
| `/api/jobs/:id` | PATCH | Update job status/details |
| `/api/contacts` | GET | Load contact names for display |

### Finance Status Derivation

Finance status is derived from job.status (operational state):

| Condition | Finance Status |
|-----------|----------------|
| job.status === "paid" | paid |
| job.status === "invoiced" | invoiced |
| job.status === "completed" AND value > 0 | outstanding |
| value > 0 (any other status) | outstanding |
| Default (no value) | unquoted |

## AI Operational Watch

The left pane includes an **AI Operational Watch** section that displays when job status is "in_progress":

- **Duration Alert**: Flags when job duration exceeds historical benchmarks
- **Visual Treatment**: Red accent with pulsing indicator
- **Authority**: Informational only - no action required

This is a static placeholder. Real AI monitoring integration is pending.

## Design Tokens

| Element | Classes |
|---------|---------|
| Header | `bg-glass-surface`, `border-border` |
| Cards | `bg-glass-surface`, `border-glass-border` |
| AI Watch | `bg-destructive/5`, `border-destructive/20` |
| In Progress Row | `bg-amber-500/5` |
| Status Badges | Colored variants (amber/blue/green/red) |
| Finance Colors | emerald (paid), amber (outstanding), blue (invoiced), muted (unquoted) |

## Test IDs

| Element | Test ID |
|---------|---------|
| Create Job Button | `button-create-job` |
| Search Input | `input-search-jobs` |
| Status Filter | `select-status-filter` |
| Clear Filters | `button-clear-filters` |
| Job Row | `job-row-{id}` |
| Row Menu | `button-menu-{id}` |
| Back Button | `button-back-to-list` |
| Primary Action | `button-primary-action` |
| Overview Tab | `tab-overview` |
| Messages Tab | `tab-messages` |
| Work Logs Tab | `tab-work_logs` |
| Finances Tab | `tab-finances` |
| Update Status | `button-update-status` |
| Edit Job | `button-edit-job` |
| View Full | `button-view-full-details` |

## Edge Cases & Constraints

| Scenario | Behavior |
|----------|----------|
| Cancellation | Requires a "Reason Code" (not yet implemented) |
| Re-Open | Only Architects can re-open a "Completed" job |
| Missing Client | Displays "No Client" |
| Missing Value | Displays "-" with "unquoted" finance status |
| Missing Schedule | Displays "Not set" |

## What This Tab Is NOT

- A calendar (Use Calendar tab for time-blocking)
- A billing editor (Use Estimates or Invoices modules)
- A communication tool (Messages are read-only historical logs)

## Status Flow

```
lead_intake → estimate_sent → scheduled → in_progress → completed → invoiced → paid
```

Each status transition should be logged to the Automation Ledger (pending integration).
