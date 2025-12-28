# Payments

## Purpose
The Payments page is the **Financial Reconciliation Hub** - a financial execution + confirmation surface. It is NOT just a mirror of Stripe data. The CRM drafts Stripe-aligned **Payment Slips**, resolves authority, then sends them to n8n. Stripe only sees approved execution, never raw UI actions.

## Key Concept: Payment Slips

A **Payment Slip** is a structured draft payload that:
- Matches Stripe-required fields
- Can be Human-created or AI-created
- **Never auto-executes**
- Executes only after authority resolution

### Authority Flow

| Origin | Flow |
|--------|------|
| **Human** creates Payment Slip | Execute immediately → EOA → n8n → Stripe |
| **AI** creates Payment Slip | Review Queue → Approval → EOA → n8n → Stripe |

Payments are NOT special-cased. Same authority model as everywhere else.

## Payment Slip Schema

```typescript
PaymentSlip {
  id
  origin: "human" | "ai"
  status: "draft" | "approved" | "sent" | "completed" | "failed"
  
  amount
  currency
  
  contactId
  customerEmail
  customerName
  
  description
  memo
  
  invoiceId?      // optional
  estimateId?     // optional
  jobId?          // optional
  
  paymentMethodTypes: ["card", "us_bank_account", "terminal"]
  
  stripeIntentId? // filled AFTER execution
  processorRef?   // Stripe reference
  
  createdBy
  approvedBy?
  createdAt
}
```

## Execution Trigger

When approved (or human-created):
```
CRM → EOA Trigger
→ n8n workflow (/webhook/neo8/payments/execute)
→ Stripe PaymentIntent / Invoice / Terminal
→ Stripe Webhook
→ CRM Payments Tab (immutable record)
```

The Payments tab then mirrors the RESULT in the Transactions tab, not the draft.

## UI Structure

### Header
- Glassmorphic panel with DollarSign icon
- "Financial Reconciliation Hub" subtitle
- Total Collected aggregate
- "New Payment Slip" button

### Tabs

**Payment Slips Tab**:
- Shows draft/pending payment slips
- Origin badge (Human/AI)
- Status badge (draft/approved/sent/completed/failed)
- Execute button for human-created slips
- "Review Queue" link for AI-created slips

**Transactions Tab**:
- Shows completed payments (immutable Stripe records)
- Origin badge, status badge
- Click to view detail

### Payment Slip Creation Dialog
- Customer selector
- Amount input
- Payment method (Card, ACH, Terminal)
- Description
- Invoice linkage (optional)

## Ledger Events

| Event | When |
|-------|------|
| `PAYMENT_SLIP_CREATED` | Draft created |
| `PAYMENT_SLIP_APPROVED` | Approved (AI only) |
| `PAYMENT_EXECUTION_REQUESTED` | Sent to n8n |
| `PAYMENT_RECEIVED` | Stripe webhook confirms |
| `PAYMENT_FAILED` | Stripe failure webhook |
| `PAYMENT_REFUNDED` | Refund webhook |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payment-slips` | GET | List payment slips |
| `/api/payment-slips/:id` | GET | Get single slip |
| `/api/payment-slips` | POST | Create new slip |
| `/api/payment-slips/:id/execute` | POST | Execute slip (human-initiated) |
| `/api/payments` | GET | List completed payments |
| `/api/payments/:id` | GET | Get payment detail |

## Rules

**Must DO:**
- Create PaymentSlip draft model
- Respect authority (AI → Review Queue, Human → EOA)
- Send structured payload to n8n
- Log all actions to Automation Ledger

**Must NOT:**
- Call Stripe directly from UI
- Auto-send AI-generated payments
- Treat Payments tab as passive-only
- Edit settled payments (immutable)

## Design Tokens
- Container: `bg-glass-surface`, `border-glass-border`, `rounded-xl`
- Status colors follow standard badge conventions

## Test IDs
- `page-payments`: Main container
- `tab-slips`: Payment Slips tab
- `tab-transactions`: Transactions tab
- `button-create-slip`: Create slip button
- `slip-row-{id}`: Slip row
- `payment-row-{id}`: Transaction row
- `button-execute-{id}`: Execute slip button
