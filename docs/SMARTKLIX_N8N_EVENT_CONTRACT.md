# SmartKlix → N8N Event Contract Specification

**Version**: 1.0  
**Date**: November 15, 2025  
**Author**: SmartKlix CRM Development Team  
**Source File**: `client/src/lib/n8nEvents.ts`

---

## Overview

This document specifies the exact payload schemas sent from the SmartKlix CRM dashboard to N8N webhooks. These events trigger automated workflows (SMS, email, payment links, etc.).

**Architecture**:
```
SmartKlix Dashboard → N8N Webhook → External Service (Twilio/SendGrid/Stripe)
                                  → N8N calls back to /api/events/update
```

**Webhook URL**: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`

**Method**: `POST`

**Content-Type**: `application/json`

**Authentication**: None required (webhook is publicly accessible, security by obscurity)

---

## Event Types

The following event types are supported:

```typescript
type N8NEventType = 
  | "send_sms"
  | "send_email"
  | "create_payment_link"
  | "new_lead"
  | "missed_call"
```

---

## Base Event Structure

All events share a common base structure:

```typescript
interface N8NEvent {
  event_type: N8NEventType;     // REQUIRED - Event type identifier
  contact_id?: string;          // OPTIONAL - CRM contact UUID
  phone_number?: string;        // OPTIONAL - E.164 format phone number
  email?: string;               // OPTIONAL - Email address
  message?: string;             // OPTIONAL - Message content (SMS/Email)
  subject?: string;             // OPTIONAL - Email subject line
  metadata?: Record<string, unknown>;  // OPTIONAL - Additional context
}
```

**Field Naming Convention**: All fields use `snake_case` (NOT camelCase)

**Important**: The `metadata` object ALWAYS includes:
```json
{
  "triggered_by": "dashboard",
  "timestamp": "2025-11-15T10:00:00.000Z"
}
```

---

## Event Type 1: Send SMS

**Event Type**: `"send_sms"`

**Purpose**: Send an SMS message via Twilio integration

**Required Fields**:
- `event_type`: `"send_sms"`
- `contact_id`: Contact UUID from CRM
- `phone_number`: Recipient phone (E.164 format)
- `message`: SMS message text

**Optional Fields**:
- `metadata`: Additional context (job_id, estimate_id, etc.)

**Example Payload**:
```json
{
  "event_type": "send_sms",
  "contact_id": "abc-123-def-456",
  "phone_number": "+15551234567",
  "message": "Your appointment is confirmed for tomorrow at 10:00 AM. Reply CONFIRM to verify.",
  "metadata": {
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T10:30:00.521Z",
    "job_id": "job-uuid-789",
    "appointment_id": "appt-uuid-012"
  }
}
```

**Implementation**: `client/src/lib/n8nEvents.ts` line 68-85

**Dashboard Component**: `client/src/components/SendSMSDialog.tsx`

---

## Event Type 2: Send Email

**Event Type**: `"send_email"`

**Purpose**: Send an email via SendGrid integration

**Required Fields**:
- `event_type`: `"send_email"`
- `contact_id`: Contact UUID from CRM
- `email`: Recipient email address
- `subject`: Email subject line
- `message`: Email body (HTML or plain text)

**Optional Fields**:
- `metadata`: Additional context

**Example Payload**:
```json
{
  "event_type": "send_email",
  "contact_id": "abc-123-def-456",
  "email": "customer@example.com",
  "subject": "Your Estimate is Ready",
  "message": "<h1>Estimate #1234</h1><p>Thank you for your interest. Please find your estimate attached.</p>",
  "metadata": {
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T11:00:00.000Z",
    "estimate_id": "est-uuid-345",
    "estimate_amount": 4500.00
  }
}
```

**Implementation**: `client/src/lib/n8nEvents.ts` line 96-115

**Dashboard Component**: `client/src/components/SendEmailDialog.tsx`

---

## Event Type 3: Create Payment Link

**Event Type**: `"create_payment_link"`

**Purpose**: Generate a Stripe payment link for a customer

**Required Fields**:
- `event_type`: `"create_payment_link"`
- `contact_id`: Contact UUID from CRM
- `email`: Customer email for payment link

**Optional Fields**:
- `metadata`: MUST include payment details

**Metadata Fields** (typical):
- `amount`: Payment amount (number)
- `description`: Payment description
- `invoice_id`: CRM invoice UUID
- `currency`: Currency code (default: "usd")

**Example Payload**:
```json
{
  "event_type": "create_payment_link",
  "contact_id": "abc-123-def-456",
  "email": "customer@example.com",
  "metadata": {
    "amount": 4500.00,
    "description": "HVAC Repair - Invoice #INV-1234",
    "invoice_id": "inv-uuid-678",
    "currency": "usd",
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T12:00:00.000Z"
  }
}
```

**Implementation**: `client/src/lib/n8nEvents.ts` line 124-139

**Dashboard Component**: `client/src/components/CreatePaymentLinkDialog.tsx`

**Expected N8N Response**: N8N should call back to `/api/events/update` with:
```json
{
  "eventId": "inv-uuid-678",
  "eventType": "create_payment_link",
  "status": "success",
  "result": {
    "paymentLink": "https://pay.stripe.com/abc123"
  }
}
```

---

## Event Type 4: New Lead

**Event Type**: `"new_lead"`

**Purpose**: Trigger AI lead response workflow

**Required Fields**:
- `event_type`: `"new_lead"`
- `contact_id`: Contact UUID from CRM

**Optional Fields**:
- `metadata`: Lead context (source, reason, etc.)

**Example Payload**:
```json
{
  "event_type": "new_lead",
  "contact_id": "abc-123-def-456",
  "metadata": {
    "source": "website_form",
    "lead_type": "hvac_installation",
    "budget": "$5000-$8000",
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T13:00:00.000Z"
  }
}
```

**Expected N8N Workflow**:
1. Generate AI response (GPT-4)
2. Call back to `/api/events/update` with AI-generated follow-up text
3. CRM creates Note with AI response

---

## Event Type 5: Missed Call

**Event Type**: `"missed_call"`

**Purpose**: Trigger missed call follow-up workflow

**Required Fields**:
- `event_type`: `"missed_call"`
- `contact_id`: Contact UUID from CRM
- `phone_number`: Caller's phone number

**Optional Fields**:
- `metadata`: Call details (duration, timestamp, etc.)

**Example Payload**:
```json
{
  "event_type": "missed_call",
  "contact_id": "abc-123-def-456",
  "phone_number": "+15551234567",
  "metadata": {
    "call_sid": "CA987654321",
    "missed_at": "2025-11-15T14:00:00.000Z",
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T14:01:00.000Z"
  }
}
```

**Expected N8N Workflow**:
1. Send SMS to customer (e.g., "We missed your call! We'll call back soon.")
2. Log activity in CRM
3. Optionally generate AI follow-up response

---

## Field Validation Rules

### Phone Numbers
- **Format**: E.164 standard (`+1XXXXXXXXXX`)
- **Example**: `+15551234567` (NOT `555-123-4567` or `5551234567`)
- **Validation**: Must start with `+` and country code

### Email Addresses
- **Validation**: Standard email format (validated by Zod schema)
- **Example**: `user@example.com`

### Contact IDs
- **Format**: UUID string
- **Example**: `"550e8400-e29b-41d4-a716-446655440000"`
- **Validation**: Must be valid UUID

### Timestamps
- **Format**: ISO 8601 string
- **Example**: `"2025-11-15T14:30:00.521Z"`
- **Generated**: Automatically added to `metadata.timestamp`

---

## Implementation Functions

**TypeScript Utilities** (`client/src/lib/n8nEvents.ts`):

```typescript
// Base function - sends any event
async function sendN8NEvent(event: N8NEvent): Promise<void>

// Convenience wrappers
async function sendSMS(
  contactId: string,
  phoneNumber: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void>

async function sendEmail(
  contactId: string,
  email: string,
  subject: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void>

async function createPaymentLink(
  contactId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void>
```

**Error Handling**:
```typescript
if (!response.ok) {
  throw new Error(`N8N webhook failed: ${response.status} - ${errorText}`);
}
```

---

## N8N Workflow Configuration Checklist

For N8N workflow developers, verify:

1. ✅ Webhook URL: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`
2. ✅ HTTP Method: `POST`
3. ✅ Content-Type: `application/json`
4. ✅ Authentication: None required (public webhook)
5. ✅ Parse incoming JSON body
6. ✅ Access fields using: `{{ $json.event_type }}`, `{{ $json.contact_id }}`, etc.
7. ✅ Use `{{ $json.metadata.amount }}` for nested metadata fields
8. ✅ Call back to CRM at `/api/events/update` with Bearer token
9. ✅ Include `eventId` (usually `contact_id` or relevant entity ID)
10. ✅ Include `eventType` (original event type)
11. ✅ Include `status`: "success" or "error"
12. ✅ Include `result` object with action-specific data

---

## Testing the Event Contract

**Test Payload** (send_sms):
```bash
curl -X POST "https://smartklix.app.n8n.cloud/webhook/smartklix-event" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "send_sms",
    "contact_id": "test-contact-123",
    "phone_number": "+15551234567",
    "message": "Test SMS from SmartKlix CRM",
    "metadata": {
      "triggered_by": "dashboard",
      "timestamp": "2025-11-15T15:00:00.000Z",
      "test": true
    }
  }'
```

**Expected Behavior**:
1. N8N workflow receives event
2. Logs execution in N8N UI (Executions tab)
3. Processes through workflow nodes
4. Calls back to `/api/events/update` with result

---

## Common Integration Errors

### Error 1: Field Name Mismatch
```json
// ❌ WRONG - camelCase
{
  "eventType": "send_sms",
  "contactId": "abc-123"
}

// ✅ CORRECT - snake_case
{
  "event_type": "send_sms",
  "contact_id": "abc-123"
}
```

### Error 2: Missing Metadata
```json
// ❌ WRONG - Missing standard metadata
{
  "event_type": "send_sms",
  "contact_id": "abc-123",
  "phone_number": "+15551234567",
  "message": "Test"
}

// ✅ CORRECT - Includes metadata
{
  "event_type": "send_sms",
  "contact_id": "abc-123",
  "phone_number": "+15551234567",
  "message": "Test",
  "metadata": {
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T15:00:00.000Z"
  }
}
```

### Error 3: Invalid Phone Format
```json
// ❌ WRONG
"phone_number": "555-123-4567"
"phone_number": "5551234567"

// ✅ CORRECT
"phone_number": "+15551234567"
```

---

**End of SmartKlix → N8N Event Contract Specification v1.0**
