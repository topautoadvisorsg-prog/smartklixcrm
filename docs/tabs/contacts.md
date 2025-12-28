# Contacts (Relationship Context Surface)

## Purpose

The Contacts tab is the **Single Source of Truth for Identity**. It is a **Context Surface**, not a Work Surface.

Its sole responsibility is to aggregate and display the "State of the Relationship" by pulling data from the Ledger, Jobs, and Communication modules.

## Canonical Architecture Rules (The 4 "No's")

To preserve data integrity, the Contacts tab serves as a passive viewer for operational data:

1. **NO Reasoning**: It does not calculate risk or sentiment (it only displays what Discovery AI has calculated)
2. **NO Automation**: It cannot trigger sequences, workflows, or drip campaigns directly
3. **NO Execution**: It cannot charge cards, send invoices, or dispatch technicians
4. **NO Workflow Logic**: It does not track "Stage" or "Pipeline Status" (that lives in Pipeline)

## UI Behavior

### Layout Structure (3-Column Grid)

| Zone | Name | Behavior |
|------|------|----------|
| **Left Sidebar** | Contact List | Searchable, scrollable list with avatar, name, company, last activity, and circular warmth indicator. Always visible. |
| **Header** | Contact Header | Large avatar, name, company, status badge, and "Send Intake Request" primary action button |
| **Column 1** | Static Identity [Editable] | Form fields: Name, Title/Role, Company, Email, Phone, Address + Save Changes button |
| **Column 2** | Relationship Signals [AI-Derived] | Read-only: Semi-circle warmth gauge, churn risk bar, last interaction card, sentiment sparkline |
| **Column 3** | Ledger Aggregates [Read-Only] | Lifetime revenue, job history list with "Jump to Job" links, quick actions |

### Read-Only vs Editable

| Section | Editability | Owner |
|---------|-------------|-------|
| Static Identity | **Editable** | User |
| Relationship Signals | **Read-Only** | Discovery AI |
| Ledger Aggregates | **Read-Only** | Ledger |
| Job History | **Read-Only** | Jobs module |

### Visual Elements

- **Warmth Score**: Semi-circle gauge (0-100)
  - Red: < 40%
  - Amber: 40-70%
  - Purple: > 70%
- **Churn Risk**: Horizontal progress bar
  - Emerald: < 30% (low risk)
  - Red: >= 30% (high risk)
- **Sentiment Trend**: Sparkline chart showing 7-point trend
- **Last Interaction**: Card with icon and time ago

### Interactions

| Action | Result |
|--------|--------|
| Click contact row | Loads contact detail in 3-column grid |
| Search | Real-time filtering by name, email, phone, company, tags |
| Status Filter | Filter by contact status |
| Sort | By name, created date, or status |
| Save Changes | Updates static identity fields |
| Send Intake Request | Triggers Neo8 lead-intake workflow |
| Jump to Job | Navigates to Jobs tab |
| Quick Actions | Opens SMS/Email/Payment dialogs |

## Data Flow

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/contacts` | GET | Fetch all contacts |
| `/api/contacts` | POST | Create new contact (via dialog) |
| `/api/contacts/:id` | PATCH | Update contact fields |
| `/api/jobs` | GET | Fetch jobs (filtered client-side by contactId) |

### Data Transformations

- Contact list filtered and sorted client-side
- Job history filtered by `contactId`
- Lifetime revenue aggregated from completed jobs

### AI Signal Placeholders

**IMPORTANT**: Warmth Score, Churn Risk, Sentiment Trend, and Last Interaction are currently placeholder values.

- **Owner**: Discovery AI (pending backend integration)
- **Source**: `getPlaceholderAISignals()` utility function
- **Status**: Awaiting Discovery AI endpoints
- **Editability**: Locked - users cannot manually adjust these values

## Backend/API Interactions

- GET contacts on page load
- GET jobs for job history display
- POST for new contact creation
- PATCH for field updates (save changes)

## Automation (Neo8) Involvement

### Outbound Triggers

| Action | Webhook | Direction |
|--------|---------|-----------|
| Send Intake Request | `/webhook/lead-intake` | Outbound |
| Send SMS | `/webhook/whatsapp/send` | Outbound |
| Send Email | `/webhook/google/gmail` | Outbound |

### Canonical Flow for Intake

1. **Contacts Tab**: Operator clicks "Send Intake Request"
2. **External World**: Client fills out the form
3. **Intake Hub**: Raw response arrives here (Contacts is bypassed)
4. **Intake Hub**: Data is normalized and staged
5. **Intake Hub**: Operator performs "Verify & Commit"
6. **ActionAI CRM**: Receives payload and proposes updates to Contact Record

**Constraint**: Contacts NEVER processes the return signal. All updates return via Intake Hub → ActionAI loop.

### Ledger Relationship

The Contacts tab acts as a **Read-Only Viewport** into the Automation Ledger:

- **Financial Aggregates**: Lifetime Revenue is a calculated sum of `PAYMENT_SETTLED` events
- **Job History**: Displays filtered list of Jobs linked to this contact
- **Immutability**: Cannot delete a Job or edit an Invoice from Contacts screen

## Design Tokens

| Element | Classes |
|---------|---------|
| Sidebar | `bg-glass-surface`, `border-border` |
| Identity Card | `bg-glass-surface`, `border-glass-border`, `rounded-xl` |
| AI Signals Card | `bg-purple-500/5`, `border-purple-500/20`, `rounded-xl` |
| Ledger Card | `bg-glass-surface`, `border-glass-border`, `rounded-xl` |
| Selected Contact | `bg-primary/10`, `border-primary/30` |
| Warmth Gauge | Purple gradient for arc |
| Churn Low | `bg-emerald-500` |
| Churn High | `bg-red-500` |

## Test IDs

| Element | Test ID |
|---------|---------|
| Create Contact Button | `button-create-contact` |
| Search Input | `input-search-contacts` |
| Status Filter | `select-status-filter` |
| Sort Button | `button-sort` |
| Contact Row | `contact-row-{id}` |
| Send Intake Button | `button-send-intake` |
| Save Changes Button | `button-save-contact` |
| Quick SMS | `button-quick-sms` |
| Quick Email | `button-quick-email` |
| Quick Payment | `button-quick-payment` |
| Jump to Job | `button-jump-job-{id}` |

## What This Tab Is NOT

- **Action Console**: Cannot "Ask AI to draft an email" here. Navigate to Action Console.
- **Pipeline**: Cannot move a deal stage here. Navigate to Pipeline.
- **Inbox**: Cannot reply to an SMS here. Navigate to WhatsApp or Email.

## Allowed Actions (Strictly Scoped)

- Navigation: "Jump to Job", "Jump to Action Console"
- Inspection: Viewing history, logs, and files
- Static Edits: Updating Phone, Email, or Address (Identity Mutation)
- Initiation: Triggering an "Active Intake" request
