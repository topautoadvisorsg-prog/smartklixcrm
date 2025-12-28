# Neo8Flow Stripe Payment Workflow - Builder Prompt

**Send this complete prompt to Neo8Flow (n8n) to build the Stripe Payment automation workflow.**

---

## BUILDER PROMPT

We need a complete n8n workflow that integrates with Smart Klix CRM for Stripe payment automation. Build all nodes, connections, and response handling as specified below.

### Flow Name

**Stripe Payment Automation Flow**

### Purpose

This workflow is triggered by the CRM when payment events occur. It handles:

1. Receiving payment event notifications from CRM's events outbox
2. Recording payment confirmations and updates
3. Writing activity log entries
4. Queueing for human approval when needed

**IMPORTANT: The CRM uses `stripe-replit-sync` to handle raw Stripe webhooks. This workflow receives processed payment events from the CRM's outbox dispatcher after Stripe sync is complete.**

---

## ARCHITECTURE OVERVIEW

### Payment Flow Sequence

```
1. Customer → Stripe Checkout/Payment Intent
2. Stripe → CRM webhook (handled by stripe-replit-sync)
3. stripe-replit-sync → Updates database automatically
4. CRM → Detects payment completion, creates outbox event
5. Outbox Dispatcher → Sends event to n8n
6. n8n → Processes automation (logging, approvals)
7. n8n → Calls back to CRM to confirm processing
```

### Why This Architecture?

- **stripe-replit-sync**: Handles raw Stripe webhooks, syncs to database
- **Outbox pattern**: Reliable event delivery to n8n
- **n8n workflow**: Business logic automation (logging, notifications)
- **Separation of concerns**: Stripe sync is reliable, automation is flexible

---

## INCOMING EVENT SPECIFICATION

### Webhook Endpoint

**POST** `{NEO8FLOW_BASE_URL}/events/payment`

### Required Headers

```
Content-Type: application/json
x-internal-token: {TENANT_TOKEN}
```

### Request Payload Structure

The CRM dispatches this structure via the outbox dispatcher:

```json
{
  "outbox_id": "uuid-string",
  "tenant_id": "tenant-uuid-string",
  "payload": {
    "event_type": "payment.completed",
    "payment": {
      "id": "payment-uuid",
      "invoiceId": "invoice-uuid",
      "contactId": "contact-uuid",
      "amount": "150.00",
      "method": "stripe",
      "stripePaymentIntentId": "pi_1234567890",
      "status": "completed",
      "paidAt": "2025-12-08T10:30:00.000Z"
    },
    "invoice": {
      "id": "invoice-uuid",
      "invoiceNumber": "INV-2025-0042",
      "jobId": "job-uuid",
      "contactId": "contact-uuid",
      "totalAmount": "150.00",
      "status": "paid"
    },
    "contact": {
      "id": "contact-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+15551234567"
    },
    "timestamp": "2025-12-08T10:30:00.000Z"
  }
}
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `payment.completed` | Payment was successfully processed |
| `payment.failed` | Payment attempt failed |
| `payment.refunded` | Payment was refunded |

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outbox_id` | string (UUID) | Yes | CRM outbox event ID |
| `tenant_id` | string | Yes | Tenant identifier |
| `payload.event_type` | string | Yes | Type of payment event |
| `payload.payment` | object | Yes | Payment record details |
| `payload.payment.id` | string | Yes | CRM payment ID |
| `payload.payment.invoiceId` | string | Yes | Related invoice ID |
| `payload.payment.contactId` | string | No | Customer contact ID |
| `payload.payment.amount` | string | Yes | Amount (decimal string) |
| `payload.payment.method` | string | Yes | Payment method |
| `payload.payment.status` | string | Yes | Payment status |
| `payload.invoice` | object | Yes | Invoice details |
| `payload.contact` | object | No | Contact details |
| `payload.timestamp` | string | Yes | Event timestamp |

---

## VALIDATION RULES

### 1. Token Validation

Check the `x-internal-token` header matches the expected `INTERNAL_TOKEN` environment variable.

**If invalid:** Return HTTP 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "timestamp": "<ISO8601>"
}
```

### 2. Required Fields

The following fields are REQUIRED:

- `outbox_id` (non-empty string)
- `tenant_id` (non-empty string)
- `payload` (object)
- `payload.event_type` (non-empty string)
- `payload.payment` (object)

**If missing:** Return HTTP 400 Bad Request

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Missing required fields",
  "details": "outbox_id, tenant_id, and payload.payment are required",
  "timestamp": "<ISO8601>"
}
```

---

## CRM API ENDPOINTS (EXISTING)

All endpoints require `Authorization: Bearer {CRM_AUTH_TOKEN}` header.

### 1. Write Activity Log

**POST** `{CRM_BASE_URL}/api/activity-log/write`

```json
{
  "entityType": "payment",
  "entityId": "payment-uuid",
  "action": "payment_completed",
  "details": {
    "amount": "150.00",
    "method": "stripe",
    "invoiceId": "invoice-uuid",
    "contactId": "contact-uuid"
  }
}
```

### 2. Queue for Approval (Assist Queue)

**POST** `{CRM_BASE_URL}/api/assist-queue`

```json
{
  "mode": "assist",
  "userRequest": "Payment requires review",
  "requiresApproval": true,
  "agentResponse": "Payment of $150.00 received for Invoice INV-2025-0042. Review and confirm.",
  "toolsCalled": [{"name": "process_payment", "args": {"paymentId": "uuid"}}],
  "toolResults": [{"result": "pending_review", "amount": "150.00"}]
}
```

### 3. Update Payment (if needed)

**PATCH** `{CRM_BASE_URL}/api/payments/{paymentId}`

```json
{
  "status": "completed",
  "paidAt": "2025-12-08T10:30:00.000Z"
}
```

### 4. Update Invoice (if needed)

**PATCH** `{CRM_BASE_URL}/api/invoices/{invoiceId}`

```json
{
  "status": "paid"
}
```

---

## PROCESSING LOGIC

### Event Routing

Route events based on `payload.event_type`:

```javascript
const eventHandlers = {
  'payment.completed': handlePaymentCompleted,
  'payment.failed': handlePaymentFailed,
  'payment.refunded': handlePaymentRefunded,
};
```

### Format Amount for Display

```javascript
function formatAmount(amountStr, currency = 'USD') {
  const amount = parseFloat(amountStr);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Example: formatAmount("150.00") => "$150.00"
```

---

## WORKFLOW NODES SPECIFICATION

Build the following nodes in order:

### Node 1: Webhook Trigger

- **Type:** Webhook
- **Name:** "Receive Payment Event"
- **HTTP Method:** POST
- **Path:** `events/payment`
- **Response Mode:** Using "Respond to Webhook" node

### Node 2: Validate Token (IF Node)

- **Type:** IF
- **Name:** "Validate Token"
- **Condition:** `{{ $json.headers['x-internal-token'] }}` equals `{{ $env.INTERNAL_TOKEN }}`
- **True Output:** Continue to Node 4
- **False Output:** Continue to Node 3

### Node 3: Unauthorized Response

- **Type:** Respond to Webhook
- **Name:** "Unauthorized Response"
- **Response Code:** 401
- **Response Body:**
```json
{
  "error": "Unauthorized",
  "timestamp": "{{ $now.toISO() }}"
}
```

### Node 4: Validate Required Fields (IF Node)

- **Type:** IF
- **Name:** "Validate Required Fields"
- **Condition:** Check that `body.outbox_id`, `body.tenant_id`, `body.payload`, `body.payload.event_type`, `body.payload.payment` exist
- **True Output:** Continue to Node 6
- **False Output:** Continue to Node 5

### Node 5: Validation Error Response

- **Type:** Respond to Webhook
- **Name:** "Validation Error Response"
- **Response Code:** 400
- **Response Body:**
```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Missing required fields",
  "details": "outbox_id, tenant_id, payload.event_type, and payload.payment are required",
  "timestamp": "{{ $now.toISO() }}"
}
```

### Node 6: Route by Event Type (Switch Node)

- **Type:** Switch
- **Name:** "Route by Event Type"
- **Rules:**
  - `payment.completed` → Payment Completed Handler
  - `payment.failed` → Payment Failed Handler
  - `payment.refunded` → Payment Refunded Handler
  - Default → Unknown Event Handler

### Node 7: Payment Completed Handler (Code Node)

- **Type:** Code
- **Name:** "Payment Completed Handler"
- **JavaScript:**

```javascript
const body = $input.first().json.body;
const { outbox_id, tenant_id, payload } = body;
const { payment, invoice, contact, event_type } = payload;

// Format amount for display
const amount = parseFloat(payment.amount || '0');
const amountFormatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(amount);

return [{
  json: {
    outbox_id,
    tenant_id,
    event_type,
    status: 'success',
    payload: {
      payment,
      invoice,
      contact,
    },
    processed: {
      amount_formatted: amountFormatted,
      action: 'log_activity',
    },
    activityLog: {
      entityType: 'payment',
      entityId: payment.id,
      action: 'payment_completed',
      details: {
        amount: payment.amount,
        method: payment.method,
        invoiceId: payment.invoiceId,
        contactId: payment.contactId || contact?.id,
        stripePaymentIntentId: payment.stripePaymentIntentId || null,
        invoiceNumber: invoice?.invoiceNumber,
        contactName: contact?.name,
      },
    },
  },
}];
```

### Node 8: Payment Failed Handler (Code Node)

- **Type:** Code
- **Name:** "Payment Failed Handler"
- **JavaScript:**

```javascript
const body = $input.first().json.body;
const { outbox_id, tenant_id, payload } = body;
const { payment, invoice, contact, event_type } = payload;

const amount = parseFloat(payment.amount || '0');
const amountFormatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(amount);

return [{
  json: {
    outbox_id,
    tenant_id,
    event_type,
    status: 'success',
    payload: {
      payment,
      invoice,
      contact,
    },
    processed: {
      amount_formatted: amountFormatted,
      action: 'log_and_queue_review',
    },
    activityLog: {
      entityType: 'payment',
      entityId: payment.id,
      action: 'payment_failed',
      details: {
        amount: payment.amount,
        method: payment.method,
        invoiceId: payment.invoiceId,
        errorMessage: payment.errorMessage || 'Payment declined',
      },
    },
    assistQueue: {
      mode: 'assist',
      userRequest: `Payment failed for ${contact?.name || 'customer'}`,
      requiresApproval: true,
      agentResponse: `Payment of ${amountFormatted} failed for Invoice ${invoice?.invoiceNumber || 'N/A'}. Please follow up with customer.`,
      toolsCalled: [{ name: 'flag_failed_payment', args: { paymentId: payment.id } }],
      toolResults: [{ result: 'failed', amount: payment.amount }],
    },
  },
}];
```

### Node 9: Payment Refunded Handler (Code Node)

- **Type:** Code
- **Name:** "Payment Refunded Handler"
- **JavaScript:**

```javascript
const body = $input.first().json.body;
const { outbox_id, tenant_id, payload } = body;
const { payment, invoice, contact, event_type } = payload;

const amount = parseFloat(payment.amount || '0');
const amountFormatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
}).format(amount);

return [{
  json: {
    outbox_id,
    tenant_id,
    event_type,
    status: 'success',
    payload: {
      payment,
      invoice,
      contact,
    },
    processed: {
      amount_formatted: amountFormatted,
      action: 'log_activity',
    },
    activityLog: {
      entityType: 'payment',
      entityId: payment.id,
      action: 'payment_refunded',
      details: {
        amount: payment.amount,
        method: payment.method,
        invoiceId: payment.invoiceId,
        reason: payment.refundReason || 'Customer requested refund',
      },
    },
  },
}];
```

### Node 10: Unknown Event Handler (Code Node)

- **Type:** Code
- **Name:** "Unknown Event Handler"
- **JavaScript:**

```javascript
const body = $input.first().json.body;
const { outbox_id, tenant_id, payload } = body;

return [{
  json: {
    outbox_id,
    tenant_id,
    event_type: payload.event_type,
    status: 'success',
    payload,
    processed: {
      warning: `Unknown event type: ${payload.event_type}`,
      action: 'log_only',
    },
    activityLog: {
      entityType: 'system',
      entityId: outbox_id,
      action: 'unknown_payment_event',
      details: {
        event_type: payload.event_type,
      },
    },
  },
}];
```

### Node 11: Write Activity Log (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Write Activity Log"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/activity-log/write`
- **Authentication:** None (we set header manually)
- **Send Headers:** Yes
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Send Body:** Yes
- **Body Content Type:** JSON
- **JSON Body:** `{{ $json.activityLog }}`

### Node 12: Check if Queue Needed (IF Node)

- **Type:** IF
- **Name:** "Needs Approval Queue?"
- **Condition:** Check if `$json.assistQueue` exists
- **True Output:** Continue to Node 13
- **False Output:** Skip to Node 14

### Node 13: Queue for Approval (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Queue for Approval"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/assist-queue`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Body:** `{{ $json.assistQueue }}`

### Node 14: Future Automation Placeholder

- **Type:** No Operation (NoOp)
- **Name:** "Payment - Future Automation Placeholder"
- **Purpose:** Placeholder for future automation:
  - Email notifications via SendGrid
  - SMS receipts via Twilio
  - Slack notifications for large payments
  - Accounting software sync

### Node 15: Success Response

- **Type:** Respond to Webhook
- **Name:** "Success Response"
- **Response Code:** 200
- **Response Body:**
```json
{
  "status": "ok",
  "outbox_id": "{{ $json.outbox_id }}",
  "event_type": "{{ $json.event_type }}",
  "message": "payment event processed"
}
```

---

## NODE CONNECTIONS

```
[1: Receive Payment Event]
         |
         v
[2: Validate Token]
    |           |
    v           v
  (True)      (False)
    |           |
    v           v
[4: Validate    [3: Unauthorized Response] --> END
 Required Fields]
    |           |
    v           v
  (True)      (False)
    |           |
    v           v
[6: Route      [5: Validation Error Response] --> END
 by Event Type]
    |
    +---> payment.completed --> [7: Payment Completed Handler]
    |
    +---> payment.failed --> [8: Payment Failed Handler]
    |
    +---> payment.refunded --> [9: Payment Refunded Handler]
    |
    +---> default --> [10: Unknown Event Handler]
    |
    +--> All handlers merge into:
         |
         v
    [11: Write Activity Log]
         |
         v
    [12: Needs Approval Queue?]
         |           |
         v           v
       (Yes)       (No)
         |           |
         v           |
    [13: Queue       |
     for Approval]   |
         |           |
         +-----+-----+
               |
               v
    [14: Future Automation Placeholder]
               |
               v
    [15: Success Response]
               |
               v
              END
```

---

## ENVIRONMENT VARIABLES

Configure these in n8n:

| Variable | Description | Example |
|----------|-------------|---------|
| `INTERNAL_TOKEN` | Expected token in incoming `x-internal-token` header | `sk_tenant_abc123` |
| `CRM_BASE_URL` | Base URL of Smart Klix CRM | `https://your-crm.replit.app` |
| `CRM_AUTH_TOKEN` | Token for `Authorization: Bearer` header (matches CRM's `N8N_INTERNAL_TOKEN`) | `n8n_sync_token_xyz` |

---

## CRM INTEGRATION: DISPATCH PAYMENT EVENTS

To enable this workflow, the CRM must dispatch payment events to the outbox. Add this code to the CRM:

### 1. Create Payment Event Dispatcher

Create `server/payment-events.ts`:

```typescript
import { storage } from "./storage";

interface PaymentEventPayload {
  event_type: "payment.completed" | "payment.failed" | "payment.refunded";
  payment: {
    id: string;
    invoiceId: string;
    contactId?: string;
    amount: string;
    method: string;
    stripePaymentIntentId?: string;
    status: string;
    paidAt?: string;
    errorMessage?: string;
    refundReason?: string;
  };
  invoice?: {
    id: string;
    invoiceNumber?: string;
    jobId?: string;
    contactId: string;
    totalAmount: string;
    status: string;
  };
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  timestamp: string;
}

export async function dispatchPaymentEvent(
  payload: PaymentEventPayload,
  tenantId: string = "default"
): Promise<string> {
  // Create outbox event for payment
  const event = await storage.createEventsOutboxEntry({
    eventType: "payment",
    channel: "stripe",
    payload: payload,
    tenantId: tenantId,
    idempotencyKey: `payment-${payload.payment.id}-${payload.event_type}`,
  });
  
  return event.id;
}
```

### 2. Call Dispatcher After Payment Processing

In the Stripe webhook handler or payment confirmation:

```typescript
import { dispatchPaymentEvent } from "./payment-events";

// After successful payment confirmation
await dispatchPaymentEvent({
  event_type: "payment.completed",
  payment: {
    id: payment.id,
    invoiceId: payment.invoiceId,
    contactId: payment.contactId,
    amount: payment.amount,
    method: payment.method,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    status: "completed",
    paidAt: payment.paidAt?.toISOString(),
  },
  invoice: invoice ? {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    jobId: invoice.jobId,
    contactId: invoice.contactId,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
  } : undefined,
  contact: contact ? {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
  } : undefined,
  timestamp: new Date().toISOString(),
});
```

### 3. Update Outbox Dispatcher

Ensure `server/outbox-dispatcher.ts` handles `eventType: "payment"`:

```typescript
// Add to event type routing in outbox-dispatcher.ts
case "payment":
  await dispatchToNeo8Flow("payment", event.payload);
  break;
```

---

## TESTING

### Manual Test with cURL

```bash
curl -X POST "https://your-n8n-url.com/webhook/events/payment" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: your-token" \
  -d '{
    "outbox_id": "evt_test_123",
    "tenant_id": "tenant_001",
    "payload": {
      "event_type": "payment.completed",
      "payment": {
        "id": "pay_test_456",
        "invoiceId": "inv_test_789",
        "contactId": "con_test_abc",
        "amount": "150.00",
        "method": "stripe",
        "status": "completed",
        "paidAt": "2025-12-08T10:30:00.000Z"
      },
      "invoice": {
        "id": "inv_test_789",
        "invoiceNumber": "INV-TEST-001",
        "contactId": "con_test_abc",
        "totalAmount": "150.00",
        "status": "paid"
      },
      "contact": {
        "id": "con_test_abc",
        "name": "Test Customer",
        "email": "test@example.com"
      },
      "timestamp": "2025-12-08T10:30:00.000Z"
    }
  }'
```

### Expected Response

```json
{
  "status": "ok",
  "outbox_id": "evt_test_123",
  "event_type": "payment.completed",
  "message": "payment event processed"
}
```

### Test Scenarios

| Scenario | Event Type | Expected Actions |
|----------|------------|------------------|
| Successful payment | `payment.completed` | Log activity |
| Failed payment | `payment.failed` | Log activity + queue for approval |
| Refund processed | `payment.refunded` | Log activity |

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Verify `x-internal-token` matches n8n's `INTERNAL_TOKEN` env var |
| 400 Validation Error | Check all required fields are present |
| CRM API 401 | Verify `CRM_AUTH_TOKEN` matches CRM's `N8N_INTERNAL_TOKEN` |
| Activity log not created | Check `/api/activity-log/write` endpoint and payload format |
| Assist queue not populated | Verify `/api/assist-queue` endpoint exists |

---

## FUTURE ENHANCEMENTS

Add nodes for these features when ready:

1. **Email Receipts** - Send email receipts via SendGrid integration
2. **SMS Notifications** - Send SMS via Twilio for payment confirmations
3. **Slack Alerts** - Post to Slack for large payments (> $1000)
4. **Accounting Sync** - Sync payments to QuickBooks/Xero
5. **AI Summary** - Daily payment summary via Master Architect

---

## RELATED WORKFLOWS

- **Lead Intake Flow** - `docs/n8n-lead-intake-builder-prompt.md`
- **Follow-Up & Qualification Flow** - `docs/n8n-follow-up-qualification-builder-prompt.md`
- **AI Receptionist Flow** - `docs/n8n-ai-receptionist-builder-prompt.md`
