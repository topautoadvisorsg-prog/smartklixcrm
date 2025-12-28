# Estimates Tab

## Purpose

The Estimates tab is a **drafting and commercial modeling surface** where pricing proposals are created, edited, and managed before execution. It serves as the human validation layer between AI proposals and customer-facing actions.

## Who Uses This

- **Sales Staff**: Create and edit customer pricing proposals
- **Operators**: Review AI-generated estimates before sending
- **Managers**: Approve high-value estimates

## What Problem It Solves

- Centralizes all estimate drafting and pricing decisions
- Provides human validation gate for AI-generated proposals
- Tracks estimate lifecycle from draft to conversion

## Dual-Path Governance Model

### Path 1: Human-Created Estimates (Direct Path)
| Step | Action |
|------|--------|
| Create | Human creates estimate in Estimates tab |
| Edit | Human modifies line items, pricing |
| Send | Human clicks Send - **no Review Queue required** |
| Convert | Human converts to Job/Invoice directly |

### Path 2: AI-Generated Estimates (Governed Path)
| Step | Action |
|------|--------|
| Draft | AI Action CRM creates estimate |
| Review | Estimate marked as "AI Generated" |
| Submit | Human clicks "Submit for Review" |
| Approve | Architect/Manager approves in Approval Hub |
| Execute | After approval, Send/Convert enabled |

**Governing Rule:** Review Queue is triggered by AI involvement, not by the tab itself.

## UI Layout

### List View (Estimates.tsx)
| Element | Description |
|---------|-------------|
| Header | Calculator icon, "ESTIMATES" title, count badge, New button |
| Search | Filter by ID, contact, job, status |
| Table | ID, Origin (Human/AI badge), Contact, Job, Amount, Status, Valid Until, Created |
| Row Actions | View, Send, Accept, Reject, Delete |

### Detail View (EstimateDetail.tsx)

**Header Section:**
| Element | Description |
|---------|-------------|
| Back Button | Return to list |
| Estimate ID | Short UUID with status badge |
| Origin Badge | "Human Created" (green) or "AI Generated" (amber) |
| Locked Badge | Shown after acceptance (amber lock icon) |
| Action Buttons | Context-dependent based on status and origin |

**Left Column (1/3 width):**
| Card | Contents |
|------|----------|
| Client Info | Name, email, phone, related job link |
| Validity | Expiry date with relative time |
| Audit Trail | Timeline of all status changes |

**Right Column (2/3 width):**
| Card | Contents |
|------|----------|
| Line Items (WBS) | Table with description, tier, qty, unit price, total |
| Pricing Summary | Subtotal, Tax, Grand Total (highlighted in primary) |
| Notes | Optional customer-facing notes |

## Status Flow

```
draft → sent → accepted → (converted to invoice/job)
              ↘ rejected
```

## Locked State Logic

After an estimate reaches `accepted` or `sent` status:
- Edit button hidden
- Line items become read-only
- "Locked" badge displayed
- Clone to create new estimate for revisions

## Action Buttons by State

| Status | Origin | Available Actions |
|--------|--------|-------------------|
| draft | Human | Edit, Preview, Send, Accept, Reject |
| draft | AI | Edit, Preview, **Submit for Review** |
| sent | Any | Preview, Accept, Reject |
| accepted | Any | Preview, Convert to Invoice, Convert to Job |
| rejected | Any | Preview, Edit (clone) |

## Automation Ledger Events

| Event | When Triggered |
|-------|----------------|
| `ESTIMATE_DRAFT_CREATED` | New estimate created (human or AI) |
| `ESTIMATE_UPDATED` | Line items or details modified |
| `ESTIMATE_SUBMITTED_FOR_REVIEW` | AI estimate submitted to Review Queue |
| `ESTIMATE_APPROVED` | Approved in Approval Hub |
| `ESTIMATE_REJECTED` | Rejected in Approval Hub |
| `ESTIMATE_SENT` | Emailed to customer |
| `ESTIMATE_CONVERTED_TO_INVOICE` | Converted to invoice |
| `ESTIMATE_CONVERTED_TO_JOB` | Converted to job |

## Neo8 Integration

| Webhook | Direction | Purpose |
|---------|-----------|---------|
| Draft creation | Inbound | AI Action CRM creates estimate |
| Email send | Outbound | Send estimate to customer (post-approval for AI) |
| Status sync | Bidirectional | Update status after external actions |

## Backend Connection

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/estimates` | GET | List all estimates |
| `/api/estimates/:id` | GET | Single estimate details |
| `/api/estimates` | POST | Create estimate |
| `/api/estimates/:id` | PATCH | Update estimate |
| `/api/estimates/:id/send` | POST | Send to customer |
| `/api/estimates/:id` | DELETE | Delete estimate |

## What This Tab Is NOT

- **Auto-execution surface**: Nothing sends without human click
- **AI execution point**: AI drafts, humans execute
- **Bypass for Review Queue**: AI-generated estimates must be reviewed

## Test IDs

| Element | Test ID |
|---------|---------|
| Page Container | `page-estimates` |
| Page Title | `text-page-title` |
| Search Input | `input-search-estimates` |
| Create Button | `button-create-estimate` |
| Estimate Row | `estimate-row-{id}` |
| Back Button | `button-back` |
| Preview Button | `button-preview-estimate` |
| Edit Button | `button-edit-estimate` |
| Send Button | `button-send-estimate` |
| Submit Review | `button-submit-review` |
| Accept Button | `button-accept-estimate` |
| Reject Button | `button-reject-estimate` |
| Convert Invoice | `button-convert-invoice` |
| Convert Job | `button-convert-job` |

## Design Tokens

| Element | Token |
|---------|-------|
| Header | `bg-glass-surface`, `border-glass-border`, `rounded-xl` |
| Cards | `bg-glass-surface`, `border-glass-border` |
| Human Origin Badge | `border-emerald-500/30`, `text-emerald-600` |
| AI Origin Badge | `border-amber-500/30`, `text-amber-600` |
| Locked Badge | `border-amber-500/30`, `text-amber-600` |
| Grand Total | `text-primary`, `font-mono` |
