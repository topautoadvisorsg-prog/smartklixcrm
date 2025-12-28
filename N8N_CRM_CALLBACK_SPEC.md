# N8N → SmartKlix CRM Callback Specification

**Version**: 1.0  
**Date**: November 15, 2025  
**Author**: SmartKlix CRM Development Team  
**Source Files**: `server/routes.ts`, `server/neo8-events.ts`

---

## Overview

This document specifies the callback endpoint that N8N workflows use to report results back to the SmartKlix CRM after processing events.

**Endpoint**: `POST /api/events/update`

**Purpose**: Receive workflow execution results from N8N (success/failure, generated data, etc.)

**Authentication**: Required (Bearer token)

**Source Schema**: `neo8InboundResultSchema` (server/neo8-events.ts line 32-46)

**Handler Implementation**: server/routes.ts line 725-857

---

## Authentication

**Required Header**:
```
Authorization: Bearer {N8N_INTERNAL_TOKEN}
```

**Environment Variable**: `N8N_INTERNAL_TOKEN`  
**Current Value**: `f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1`

**Error Responses**:
- `401 Unauthorized`: Missing or invalid authorization header
- `403 Forbidden`: Invalid token
- `503 Service Unavailable`: Token not configured

---

## Request Schema

**Content-Type**: `application/json`

**Zod Schema** (TypeScript):
```typescript
{
  eventId: string,                          // REQUIRED - Entity ID (contact, job, invoice, etc.)
  eventType: EventType,                     // REQUIRED - Original event type
  status: "success" | "error",              // REQUIRED - Execution status
  result?: {                                // OPTIONAL - Result data (required if status=success)
    aiGeneratedText?: string,               // AI-generated content (GPT response)
    paymentLink?: string,                   // Stripe payment URL
    emailSent?: boolean,                    // Email delivery confirmation
    smsSent?: boolean,                      // SMS delivery confirmation
    stripePaymentStatus?: string,           // Stripe payment status
    invoiceResult?: any,                    // Invoice creation result
    error?: string                          // Error message (if status=error)
  },
  timestamp: string                         // REQUIRED - ISO 8601 timestamp
}
```

**Supported Event Types**:
```typescript
type EventType = 
  | "new_lead"
  | "job_updated"
  | "send_sms"
  | "missed_call"
  | "send_email"
  | "invoice_created"
  | "create_payment_link"
```

---

## Field Validation

### Required Fields
- `eventId`: String (UUID recommended)
- `eventType`: Must be one of the supported event types
- `status`: Either `"success"` or `"error"`
- `timestamp`: ISO 8601 formatted date string

### Optional Fields
- `result`: Object containing workflow-specific results
  - `aiGeneratedText`: Generated text from GPT-4 or similar
  - `paymentLink`: Stripe payment link URL
  - `emailSent`: Boolean indicating email delivery
  - `smsSent`: Boolean indicating SMS delivery
  - `stripePaymentStatus`: Stripe API status
  - `invoiceResult`: Any invoice-related data
  - `error`: Error message when status is "error"

---

## Success Response (200 OK)

**Response Schema**:
```typescript
{
  success: true,
  eventId: string,              // Echo of request eventId
  eventType: string,            // Echo of request eventType
  result: object,               // Echo of request result
  persistedData: object | null  // Data saved to CRM (varies by event type)
}
```

**Example**:
```json
{
  "success": true,
  "eventId": "inv-uuid-678",
  "eventType": "create_payment_link",
  "result": {
    "paymentLink": "https://pay.stripe.com/abc123"
  },
  "persistedData": {
    "invoiceId": "inv-uuid-678",
    "paymentLink": "https://pay.stripe.com/abc123"
  }
}
```

---

## Error Response (400 Bad Request)

**Response Schema**:
```typescript
{
  success: false,
  error: string,                // Error message
  eventId?: string              // Echo of request eventId (if parseable)
}
```

**Example**:
```json
{
  "success": false,
  "error": "Unknown error from Neo8",
  "eventId": "contact-uuid-123"
}
```

---

## Event-Specific Behavior

### Event Type: `create_payment_link`

**Expected Result Fields**:
```json
{
  "result": {
    "paymentLink": "https://pay.stripe.com/abc123"
  }
}
```

**CRM Actions**:
1. Locates invoice by `eventId`
2. Appends payment link to invoice notes
3. Returns `{ invoiceId, paymentLink }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "inv-uuid-678",
    "eventType": "create_payment_link",
    "status": "success",
    "result": {
      "paymentLink": "https://pay.stripe.com/abc123"
    },
    "timestamp": "2025-11-15T12:05:00.000Z"
  }'
```

**Example Response** (200):
```json
{
  "success": true,
  "eventId": "inv-uuid-678",
  "eventType": "create_payment_link",
  "result": {
    "paymentLink": "https://pay.stripe.com/abc123"
  },
  "persistedData": {
    "invoiceId": "inv-uuid-678",
    "paymentLink": "https://pay.stripe.com/abc123"
  }
}
```

---

### Event Type: `send_email`

**Expected Result Fields**:
```json
{
  "result": {
    "emailSent": true
  }
}
```

**CRM Actions**:
1. Creates audit log entry for email status
2. Logs success/failure based on `emailSent` boolean
3. Returns `{ emailSent }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "contact-uuid-123",
    "eventType": "send_email",
    "status": "success",
    "result": {
      "emailSent": true
    },
    "timestamp": "2025-11-15T11:05:00.000Z"
  }'
```

**Example Response** (200):
```json
{
  "success": true,
  "eventId": "contact-uuid-123",
  "eventType": "send_email",
  "result": {
    "emailSent": true
  },
  "persistedData": {
    "emailSent": true
  }
}
```

---

### Event Type: `send_sms`

**Expected Result Fields**:
```json
{
  "result": {
    "smsSent": true
  }
}
```

**CRM Actions**:
1. Creates audit log entry for SMS status
2. Logs success/failure based on `smsSent` boolean
3. Returns `{ smsSent }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "contact-uuid-456",
    "eventType": "send_sms",
    "status": "success",
    "result": {
      "smsSent": true
    },
    "timestamp": "2025-11-15T10:35:00.000Z"
  }'
```

**Example Response** (200):
```json
{
  "success": true,
  "eventId": "contact-uuid-456",
  "eventType": "send_sms",
  "result": {
    "smsSent": true
  },
  "persistedData": {
    "smsSent": true
  }
}
```

---

### Event Type: `new_lead`

**Expected Result Fields**:
```json
{
  "result": {
    "aiGeneratedText": "Thank you for your interest! We've reviewed your request for HVAC installation..."
  }
}
```

**CRM Actions**:
1. Creates a Note attached to the contact with title "AI Lead Response"
2. Note content is the AI-generated text
3. Returns `{ noteCreated: true, aiText }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "contact-uuid-789",
    "eventType": "new_lead",
    "status": "success",
    "result": {
      "aiGeneratedText": "Thank you for contacting SmartKlix HVAC! I see you are interested in a new AC installation. Our team can help with units ranging from 2-5 tons. Would you like to schedule a free consultation?"
    },
    "timestamp": "2025-11-15T13:10:00.000Z"
  }'
```

**Example Response** (200):
```json
{
  "success": true,
  "eventId": "contact-uuid-789",
  "eventType": "new_lead",
  "result": {
    "aiGeneratedText": "Thank you for contacting SmartKlix HVAC!..."
  },
  "persistedData": {
    "noteCreated": true,
    "aiText": "Thank you for contacting SmartKlix HVAC!..."
  }
}
```

---

### Event Type: `job_updated`

**Expected Result Fields**:
```json
{
  "result": {
    "aiGeneratedText": "Job status updated to In Progress. Technician dispatched."
  }
}
```

**CRM Actions**:
1. Locates job by `eventId`
2. Creates a Note attached to the job with title "Job Update Notification"
3. Note content is the AI-generated text
4. Returns `{ jobId, noteCreated: true }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "job-uuid-012",
    "eventType": "job_updated",
    "status": "success",
    "result": {
      "aiGeneratedText": "Your job has been updated to In Progress. Our technician is on the way!"
    },
    "timestamp": "2025-11-15T14:00:00.000Z"
  }'
```

---

### Event Type: `missed_call`

**Expected Result Fields**:
```json
{
  "result": {
    "aiGeneratedText": "We're sorry we missed your call. A representative will contact you within 15 minutes."
  }
}
```

**CRM Actions**:
1. Creates a Note attached to the contact with title "Missed Call Follow-up"
2. Note content is the AI-generated text
3. Returns `{ noteCreated: true, followUpCreated: true }` in `persistedData`

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "contact-uuid-345",
    "eventType": "missed_call",
    "status": "success",
    "result": {
      "aiGeneratedText": "Sorry we missed your call at 2:00 PM. We will call you back shortly!"
    },
    "timestamp": "2025-11-15T14:01:00.000Z"
  }'
```

---

## Error Handling

### Status: "error"

When `status: "error"`, the `result.error` field should contain the error message.

**Example Request**:
```bash
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "eventId": "contact-uuid-999",
    "eventType": "send_sms",
    "status": "error",
    "result": {
      "error": "Twilio API error: Invalid phone number format"
    },
    "timestamp": "2025-11-15T15:00:00.000Z"
  }'
```

**Example Response** (200):
```json
{
  "success": false,
  "error": "Twilio API error: Invalid phone number format",
  "eventId": "contact-uuid-999"
}
```

**CRM Actions**:
- Audit log entry created with error details
- No additional data persisted
- Returns `success: false`

---

## Audit Logging

**All callbacks are logged** to the `auditLog` table regardless of success/failure.

**Audit Entry Fields**:
```typescript
{
  userId: null,                     // N8N callbacks are system-level
  action: "neo8_event_result",
  entityType: "automation",
  entityId: eventId,
  details: {
    eventType: string,
    status: "success" | "error",
    result: object,
    timestamp: string
  }
}
```

**Error Audit Entries**:
```typescript
{
  action: "neo8_event_error",
  details: {
    error: string,
    body: object  // Original request body
  }
}
```

---

## N8N Workflow Implementation Guide

**Step 1: Capture Original Event Data**

When receiving event at N8N webhook, store:
- `eventId` (usually `contact_id` or entity-specific ID)
- `event_type` (to pass back as `eventType`)

**Step 2: Execute Workflow**

Process the event through Twilio/SendGrid/Stripe/GPT-4 nodes

**Step 3: Call Back to CRM**

Use HTTP Request node:
```
POST https://5111a1a7-2f59-4ad2-9b99-d56328fad3c6-00-3byo21gezjnvn.worf.replit.dev/api/events/update

Headers:
  Content-Type: application/json
  Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1

Body:
{
  "eventId": "{{ $json.contact_id }}",
  "eventType": "{{ $json.event_type }}",
  "status": "success",
  "result": {
    "smsSent": true
  },
  "timestamp": "{{ $now.toISOString() }}"
}
```

**Step 4: Handle Errors**

If any node fails, call back with:
```json
{
  "eventId": "{{ $json.contact_id }}",
  "eventType": "{{ $json.event_type }}",
  "status": "error",
  "result": {
    "error": "{{ $error.message }}"
  },
  "timestamp": "{{ $now.toISOString() }}"
}
```

---

## Testing Checklist

1. ✅ Test successful `send_sms` callback
2. ✅ Test successful `send_email` callback
3. ✅ Test successful `create_payment_link` callback
4. ✅ Test successful `new_lead` callback with AI text
5. ✅ Test successful `missed_call` callback with AI text
6. ✅ Test error callback with `status: "error"`
7. ✅ Test authentication (valid token)
8. ✅ Test authentication (invalid token → 403)
9. ✅ Test missing required fields → 400
10. ✅ Verify audit log entries are created
11. ✅ Verify Notes are created when `aiGeneratedText` is provided
12. ✅ Verify invoice updates when `paymentLink` is provided

---

## Common Integration Errors

### Error 1: Missing Authorization Header
```bash
# ❌ WRONG
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -d '{...}'

# ✅ CORRECT
curl -X POST "https://.../api/events/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{...}'
```

### Error 2: Invalid Event Type
```json
// ❌ WRONG - "send_text" is not a valid event type
{
  "eventType": "send_text",
  ...
}

// ✅ CORRECT
{
  "eventType": "send_sms",
  ...
}
```

### Error 3: Missing Required Fields
```json
// ❌ WRONG - Missing eventId and timestamp
{
  "eventType": "send_sms",
  "status": "success"
}

// ✅ CORRECT
{
  "eventId": "contact-uuid-123",
  "eventType": "send_sms",
  "status": "success",
  "result": {
    "smsSent": true
  },
  "timestamp": "2025-11-15T10:00:00.000Z"
}
```

---

**End of N8N → SmartKlix CRM Callback Specification v1.0**
