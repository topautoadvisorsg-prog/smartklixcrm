# SmartKlix Integration Guide

## Overview

This guide documents how SmartKlix CRM integrates with external systems (n8n workflows, websites, voice providers) and explains the complete data flow for each integration type.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         SmartKlix CRM                           │
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Dashboard  │         │  REST API    │                    │
│  │     UI       │────────▶│  Endpoints   │                    │
│  └──────────────┘         └──────────────┘                    │
│         │                        │                             │
│         │                        │                             │
│         ▼                        ▼                             │
│  ┌──────────────────────────────────────┐                     │
│  │        PostgreSQL Database           │                     │
│  └──────────────────────────────────────┘                     │
│                        │                                        │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐    ┌──────────┐
    │  N8N   │     │ Website │    │  Voice   │
    │Webhooks│     │  Forms  │    │ Provider │
    └────────┘     └─────────┘    └──────────┘
```

---

## Integration Types

### 1. Dashboard → N8N Workflow Integration

**Use Cases**: SMS, Email, Payment Links
**Flow**: Dashboard → N8N Webhook → External Service → N8N Callback → CRM

#### Supported Actions

| Action | Endpoint | Triggered From | External Service |
|--------|----------|----------------|------------------|
| Send SMS | `https://smartklix.app.n8n.cloud/webhook/smartklix-event` | Contact menu | Twilio |
| Send Email | `https://smartklix.app.n8n.cloud/webhook/smartklix-event` | Contact menu | SendGrid |
| Create Payment Link | `https://smartklix.app.n8n.cloud/webhook/smartklix-event` | Contact/Invoice menu | Stripe |

#### Implementation Details

**Frontend Components**:
- `client/src/components/SendSMSDialog.tsx` - SMS composition UI
- `client/src/components/SendEmailDialog.tsx` - Email composition UI
- `client/src/components/CreatePaymentLinkDialog.tsx` - Payment link UI
- `client/src/lib/n8nEvents.ts` - N8N webhook utilities

**Usage Example**:
```typescript
import { sendSMS } from "@/lib/n8nEvents";

// Send SMS to a contact
await sendSMS(
  contactId,
  phoneNumber,
  "Your estimate is ready!",
  { job_id: "123", estimate_id: "456" }
);
```

**Event Payload Structure**:
```json
{
  "event_type": "send_sms",
  "contact_id": "uuid",
  "phone_number": "+1234567890",
  "message": "Message text",
  "metadata": {
    "job_id": "123",
    "triggered_by": "dashboard",
    "timestamp": "2025-11-15T17:00:00Z"
  }
}
```

#### Complete Flow

1. **User Action**: User clicks "Send SMS" from contact dropdown
2. **Dialog Opens**: `SendSMSDialog` component renders
3. **User Submits**: Form validated, `sendSMS()` called
4. **N8N Webhook Called**: POST to `https://smartklix.app.n8n.cloud/webhook/smartklix-event`
5. **N8N Workflow Executes**:
   - Parses event
   - Calls Twilio API to send SMS
   - (Optional) Calls back to `/api/events/update` with result
6. **CRM Logs Result**: Audit log entry created
7. **User Notified**: Toast message confirms SMS queued

---

### 2. Website → CRM Direct Integration

**Use Cases**: Contact forms, landing pages, lead capture
**Flow**: Website Form → CRM API → Database

#### Supported Actions

| Action | Endpoint | Method | Authentication |
|--------|----------|--------|----------------|
| Create Contact | `/api/contacts/create` | POST | None (public) |
| Create Lead | `/api/leads/create` | POST | Bearer token |
| Write Activity | `/api/activity-log/write` | POST | Bearer token |

#### Implementation Details

**Frontend Component**:
- `client/src/components/ContactForm.tsx` - Reusable contact form
- `client/src/pages/PublicContact.tsx` - Demo page showing usage

**Usage Example**:
```typescript
import ContactForm from "@/components/ContactForm";

// Embed in any page
<ContactForm
  title="Get a Quote"
  metadata={{
    source: "landing_page",
    campaign: "summer_2025"
  }}
  onSuccess={() => console.log("Lead captured!")}
/>
```

**API Request**:
```javascript
POST /api/contacts/create
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+16193831345",
  "company": "Acme Corp",
  "status": "new"
}
```

**Response**:
```json
{
  "success": true,
  "contact": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+16193831345",
    "status": "new",
    "createdAt": "2025-11-15T17:00:00Z"
  },
  "existed": false
}
```

#### Complete Flow

1. **User Fills Form**: User enters name, email, phone on website
2. **Form Validates**: React Hook Form + Zod validation
3. **API Called**: POST `/api/contacts/create` with form data
4. **CRM Processes**:
   - Upserts contact by phone number
   - Creates audit log entry
   - Returns contact object
5. **Success Feedback**: User sees "Message Sent!" confirmation
6. **CRM Dashboard**: Contact immediately visible in Contacts page

---

### 3. Voice Provider → N8N → CRM Integration

**Use Cases**: Call tracking, missed call follow-up, lead qualification
**Flow**: Voice Provider → N8N Webhook → CRM API → Database

#### Supported Events

| Event Type | Webhook | Actions Taken |
|------------|---------|---------------|
| call_completed | `/webhook/voice-call-event` | Create contact, create job/lead, log activity |
| call_missed | `/webhook/voice-call-event` | Create contact, create lead, send SMS, log activity |

#### Implementation Details

**N8N Workflow**: `voice-call-event-workflow.json`
**Documentation**: `VOICE_CALL_TEST_PAYLOADS.md`

**Event Payload Example**:
```json
{
  "event": "call_completed",
  "call_id": "CALL_123",
  "from_number": "+16193831345",
  "to_number": "+15559876543",
  "caller_name": "John Doe",
  "reason": "Wants estimate for outdoor lighting",
  "details": {
    "job_type": "outdoor_lighting",
    "property_type": "residential",
    "address": "123 Main St",
    "budget": "2000-4000"
  },
  "ai_summary": "Customer requested lighting estimate",
  "timestamp": "2025-11-15T17:00:00Z"
}
```

#### Complete Flow (Completed Call)

1. **Call Ends**: Voice provider (Twilio/Vapi) sends webhook to n8n
2. **N8N Routes Event**: Determines `call_completed` path
3. **Contact Upserted**: POST `/api/contacts/create` with caller info
4. **Job/Lead Decision**:
   - If `details.job_type` exists → Create Job
   - Else → Create Lead with reason
5. **Activity Logged**: POST `/api/activity-log/write` with AI summary
6. **Result Reported**: (Optional) POST `/api/events/update`

#### Complete Flow (Missed Call)

1. **Call Missed**: Voice provider sends webhook to n8n
2. **N8N Routes Event**: Determines `call_missed` path
3. **Contact Upserted**: POST `/api/contacts/create` with phone only
4. **Lead Created**: POST `/api/leads/create` with "Missed call" reason
5. **SMS Sent**: Twilio sends "Sorry we missed your call!" message
6. **Activity Logged**: POST `/api/activity-log/write`

---

## Dashboard Actions (First Release)

### Direct CRM API (No N8N)

These actions call the CRM API directly and don't require n8n:

✅ **Create Contact**
- **UI**: "New Contact" button on Contacts page
- **Endpoint**: POST `/api/contacts/create`
- **Features**: Name, email, phone, company, status

✅ **Update Contact**
- **UI**: Contact detail page / Edit dialog
- **Endpoint**: POST `/api/contacts/update`
- **Features**: Modify any contact field

✅ **Create Job**
- **UI**: "New Job" button on Jobs page
- **Endpoint**: POST `/api/jobs/create`
- **Features**: Title, client, type, value, schedule

✅ **Update Job**
- **UI**: Job detail page / Status dropdown
- **Endpoint**: PATCH `/api/jobs/:id`
- **Features**: Status changes, assignments, notes

✅ **View Activity Logs**
- **UI**: Audit Log page
- **Endpoint**: GET `/api/audit-log`
- **Features**: Filter by entity, date, user

### N8N Integration (External Services)

These actions trigger n8n workflows for external integrations:

✅ **Send SMS**
- **UI**: Contact dropdown menu → "Send SMS"
- **Webhook**: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`
- **Service**: Twilio
- **Features**: Message composition, metadata tracking

✅ **Send Email**
- **UI**: Contact dropdown menu → "Send Email"
- **Webhook**: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`
- **Service**: SendGrid
- **Features**: Subject, body, HTML support

✅ **Create Payment Link**
- **UI**: Contact dropdown menu → "Create Payment Link"
- **Webhook**: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`
- **Service**: Stripe
- **Features**: Amount, description, invoice linking

---

## Testing Guide

### Test Dashboard N8N Integration

1. Navigate to `/contacts` page
2. Click the "⋮" menu on any contact
3. Select "Send SMS"
4. Compose message and click "Send SMS"
5. **Expected**: Toast message "SMS Queued", n8n workflow executes
6. **Verify**: Check n8n execution logs and CRM audit log

### Test Website Integration

1. Navigate to `/public-contact` page
2. Fill out the contact form
3. Click "Send Message"
4. **Expected**: "Message Sent!" confirmation
5. **Verify**: New contact appears in `/contacts` page

### Test Voice Integration

```bash
# Test completed call
curl -X POST "https://smartklix.app.n8n.cloud/webhook/voice-call-event" \
  -H "Content-Type: application/json" \
  -d @test-payloads/call_completed.json

# Test missed call
curl -X POST "https://smartklix.app.n8n.cloud/webhook/voice-call-event" \
  -H "Content-Type: application/json" \
  -d @test-payloads/call_missed.json
```

---

## Troubleshooting

### N8N Webhooks Return 500

**Symptom**: Dashboard shows "N8N webhook failed: 500"
**Cause**: N8N workflow configuration issue
**Solution**:
1. Check n8n workflow is activated
2. Verify data paths in workflow nodes
3. Check Twilio/SendGrid credentials
4. Review n8n execution logs

### Contacts Not Created

**Symptom**: Contact form submits but no contact in CRM
**Cause**: API validation failure or network error
**Solution**:
1. Check browser console for error messages
2. Verify CRM API is running (`GET /api/health`)
3. Check `[N8N API]` logs in server output
4. Ensure at least one of phone/email/name is provided

### SMS/Email Not Sending

**Symptom**: N8N webhook succeeds but no SMS/email received
**Cause**: External service (Twilio/SendGrid) not configured
**Solution**:
1. Check n8n workflow credentials
2. Verify Twilio/SendGrid account has credits
3. Check phone number format (E.164: +1234567890)
4. Review external service API logs

---

## Security Notes

### Authentication Requirements

- **Public endpoints**: `/api/contacts/create` (for website forms)
- **N8N endpoints**: Require `N8N_INTERNAL_TOKEN` bearer authentication
- **Dashboard endpoints**: (Future) Will require JWT authentication

### Data Validation

All endpoints use Zod schemas for validation:
- Contact creation: At least one of phone/email/name required
- Phone numbers: No strict validation (flexible for international formats)
- Email addresses: Standard email format validation

---

## Next Steps

### Phase 2 Enhancements

1. **Add authentication** to dashboard
2. **Implement job estimates** workflow
3. **Add invoice generation** and PDF export
4. **Create AI Assist Queue** approvals UI
5. **Add real-time notifications** for events

### Integration Expansion

1. **Calendar integration** (Google Calendar, Outlook)
2. **Document storage** (AWS S3, Google Drive)
3. **Accounting integration** (QuickBooks, Xero)
4. **Customer portal** (self-service invoice viewing)

---

## File Reference

### Frontend Components
- `client/src/lib/n8nEvents.ts` - N8N webhook utilities
- `client/src/components/SendSMSDialog.tsx` - SMS UI
- `client/src/components/SendEmailDialog.tsx` - Email UI
- `client/src/components/CreatePaymentLinkDialog.tsx` - Payment UI
- `client/src/components/ContactForm.tsx` - Website form
- `client/src/pages/Contacts.tsx` - Dashboard page with n8n actions
- `client/src/pages/PublicContact.tsx` - Public contact page demo

### Backend API
- `server/routes.ts` - All CRM API endpoints
- `server/neo8-events.ts` - N8N event handling
- `server/storage.ts` - Database operations

### Documentation
- `N8N_TEST_PAYLOADS.md` - N8N webhook test examples
- `VOICE_CALL_TEST_PAYLOADS.md` - Voice event test examples
- `voice-call-event-workflow.json` - N8N workflow export
- `VOICE_WORKFLOW_DEPLOYMENT.md` - Deployment guide

### Configuration
- `shared/schema.ts` - Database schema
- `.env` - Environment variables (N8N_INTERNAL_TOKEN, etc.)
