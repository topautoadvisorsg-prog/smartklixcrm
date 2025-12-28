# Voice Call Event Workflow - Deployment Guide

## Overview

This guide explains how to import and activate the **Voice Call Event Handler** workflow in your n8n instance and connect it to SmartKlix CRM.

---

## Prerequisites

Before deploying:

1. ✅ **n8n Instance**: Cloud or self-hosted n8n instance
2. ✅ **SmartKlix CRM**: Running and accessible at the base URL
3. ✅ **Twilio Account** (for missed call SMS): Optional but recommended
4. ✅ **Voice Provider**: Twilio, Vapi, or similar (will send webhooks to n8n)

---

## Deployment Steps

### Step 1: Import Workflow

1. Open your n8n instance
2. Click **"Add Workflow"** or **"Import from File"**
3. Upload `voice-call-event-workflow.json`
4. The workflow will appear as **"Voice Call Event Handler"**

### Step 2: Configure Twilio Credentials (Optional)

If you want to send SMS for missed calls:

1. In n8n, go to **Credentials** → **New Credential**
2. Select **"Twilio"**
3. Enter your Twilio credentials:
   - Account SID
   - Auth Token
4. Save as **"Twilio Account"**
5. Set environment variable `TWILIO_FROM_NUMBER` to your Twilio phone number

**Note**: If you skip this step, the SMS node will fail but the workflow will continue logging the missed call.

### Step 3: Verify SmartKlix CRM Integration

The workflow is pre-configured with:

**Base URL**: `https://5111a1a7-2f59-4ad2-9b99-d56328fad3c6-00-3byo21gezjnvn.worf.replit.dev`

**Auth Token**: `f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1`

All HTTP Request nodes are already configured. No changes needed unless:
- Your SmartKlix deployment URL changes
- You rotate the auth token

### Step 4: Activate the Workflow

1. Open the imported workflow in n8n
2. Toggle **"Active"** switch to **ON** (top right)
3. The webhook will now be live at:
   ```
   https://your-n8n-instance.app.n8n.cloud/webhook/voice-call-event
   ```

### Step 5: Get Your Webhook URL

1. In the workflow, click the **"Voice Call Webhook"** node
2. Click **"Test URL"** or **"Production URL"**
3. Copy the webhook URL (looks like):
   ```
   https://your-instance.app.n8n.cloud/webhook/voice-call-event
   ```

### Step 6: Configure Your Voice Provider

Provide your webhook URL to your voice provider (Twilio, Vapi, etc.):

**Example for Twilio**:
1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Under **"Voice & Fax"**, set:
   - **A call comes in**: Webhook
   - **URL**: `https://your-n8n-instance.app.n8n.cloud/webhook/voice-call-event`
   - **Method**: POST

**Example for Vapi**:
1. Configure server URL in Vapi dashboard
2. Set webhook endpoint to your n8n URL
3. Ensure payloads match expected format (see test payloads)

---

## Testing the Workflow

Use the test payloads from `VOICE_CALL_TEST_PAYLOADS.md`:

### Test 1: Completed Call with Job Details

```bash
curl -X POST "https://your-n8n-instance.app.n8n.cloud/webhook/voice-call-event" \
  -H "Content-Type: application/json" \
  -d '{
  "event": "call_completed",
  "call_id": "CA_TEST_123",
  "from_number": "+15551234567",
  "to_number": "+15559876543",
  "caller_name": "John Doe",
  "reason": "Wants estimate for exterior lighting",
  "details": {
    "job_type": "outdoor_lighting",
    "property_type": "residential",
    "address": "123 Main St",
    "city": "Ensenada",
    "budget": "1500-3000"
  },
  "ai_summary": "Caller requested exterior lighting estimate.",
  "timestamp": "2025-11-15T10:30:00Z"
}'
```

**Expected Result**:
- ✅ Contact created/updated in SmartKlix
- ✅ Job created (because job_type present)
- ✅ Activity logged
- ✅ 200 OK response

### Test 2: Missed Call

```bash
curl -X POST "https://your-n8n-instance.app.n8n.cloud/webhook/voice-call-event" \
  -H "Content-Type: application/json" \
  -d '{
  "event": "call_missed",
  "call_id": "CA_MISSED_123",
  "from_number": "+15557778888",
  "to_number": "+15559876543",
  "timestamp": "2025-11-15T14:20:00Z"
}'
```

**Expected Result**:
- ✅ Contact created/updated
- ✅ Lead created with "Missed call" reason
- ✅ SMS sent (if Twilio configured)
- ✅ Activity logged
- ✅ 200 OK response

---

## Verification

After testing, verify in SmartKlix CRM:

### 1. Check Contact Created

```bash
curl -X GET "https://5111a1a7-2f59-4ad2-9b99-d56328fad3c6-00-3byo21gezjnvn.worf.replit.dev/api/contacts/lookup?phone=%2B15551234567" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1"
```

Should return contact with name "John Doe".

### 2. Check Workflow Execution in n8n

1. In n8n workflow editor, click **"Executions"** tab
2. Find your test execution
3. Verify all nodes show green checkmarks
4. Click each node to see input/output data

### 3. Check SmartKlix Logs

SmartKlix logs all n8n API requests with `[N8N API]` prefix:

```bash
# In Replit console (if using Replit)
grep "[N8N API]" /tmp/logs/Start_application_*.log | tail -20
```

You should see:
```
[N8N API] POST /api/contacts/create - Request: {...}
[N8N API] /api/contacts/create 200 - Response: {...}
[N8N API] POST /api/jobs/create - Request: {...}
[N8N API] /api/jobs/create 200 - Response: {...}
```

---

## Production Deployment Checklist

Before going live:

- [ ] Workflow imported and activated in n8n
- [ ] Twilio credentials configured (if using SMS)
- [ ] `TWILIO_FROM_NUMBER` environment variable set
- [ ] All 4 test scenarios passed (see VOICE_CALL_TEST_PAYLOADS.md)
- [ ] Verified contacts/jobs/leads created in SmartKlix
- [ ] Verified activity logs written
- [ ] Voice provider configured with webhook URL
- [ ] Tested with real incoming call (if possible)
- [ ] Monitoring/alerting configured for workflow failures

---

## Workflow Node Reference

### Webhook Trigger
- **Path**: `/webhook/voice-call-event`
- **Method**: POST
- **Response**: Returns to webhook after full execution

### Route by Event Type
- **Type**: Switch node
- **Routes**: `call_completed` → Completed path, else → Missed path

### Create/Update Contact Nodes
- **Endpoint**: POST `/api/contacts/create`
- **Deduplication**: Automatic by phone number
- **Returns**: Contact object with `id`

### Job/Lead Decision (Completed Path Only)
- **Type**: IF node
- **Condition**: Checks if `details.job_type` exists
- **True**: Create Job → **False**: Create Lead

### Create Job Node
- **Endpoint**: POST `/api/jobs/create`
- **Fields**: jobType, propertyType, address, city, description, metadata
- **Triggers**: When job_type is present

### Create Lead Nodes
- **Endpoint**: POST `/api/leads/create`
- **Fields**: contactId, reason, summary
- **Triggers**: When no job_type OR on missed calls

### Send SMS (Missed Path Only)
- **Type**: Twilio node
- **Requires**: Twilio credentials + `TWILIO_FROM_NUMBER` env var
- **Message**: "Hi! We missed your call. We'll call you back shortly. Thank you!"

### Activity Log Nodes
- **Endpoint**: POST `/api/activity-log/write`
- **Type**: call
- **Direction**: inbound
- **Summary**: AI summary or fallback text

### Event Update Node
- **Endpoint**: POST `/api/events/update`
- **Purpose**: Reports workflow execution back to SmartKlix
- **Optional**: Can be disabled if not needed

---

## Troubleshooting

### Issue: Webhook not receiving requests

**Solution**:
1. Verify workflow is **Active** (toggle in top right)
2. Check webhook URL is correct in voice provider settings
3. Test with curl command first to isolate issue
4. Check n8n execution history for incoming requests

### Issue: Contact not created

**Solution**:
1. Check SmartKlix logs for `[N8N API]` errors
2. Verify auth token is correct
3. Ensure phone number format is correct (+country code)
4. Test `/api/contacts/create` endpoint directly with curl

### Issue: SMS not sending

**Solution**:
1. Verify Twilio credentials configured in n8n
2. Check `TWILIO_FROM_NUMBER` environment variable exists
3. Ensure Twilio account has sufficient balance
4. Test Twilio node independently

### Issue: Job not created (Lead created instead)

**Solution**:
1. Verify payload includes `details.job_type` field
2. Check node uses correct data path: `$('Voice Call Webhook').first().json.details.job_type`
3. Review n8n execution to see IF node decision

### Issue: 401 Unauthorized errors

**Solution**:
1. Verify auth token matches in all HTTP Request nodes
2. Check SmartKlix API is accessible
3. Test endpoints with curl to confirm auth works

---

## Monitoring

### n8n Workflow Monitoring

- **Executions Tab**: Review all workflow runs
- **Error Workflow**: Create error handling workflow (optional)
- **Webhook Logs**: Check incoming request patterns

### SmartKlix CRM Monitoring

- **API Logs**: Monitor `[N8N API]` prefix logs
- **Activity Log**: Review logged calls in CRM
- **Contact Growth**: Track new contacts from calls

---

## Advanced Configuration

### Custom SMS Message

Edit the **"Send SMS (Missed Call)"** node:
```javascript
// Current message
"Hi! We missed your call. We'll call you back shortly. Thank you!"

// Example custom message
"Thanks for calling {{ $env.COMPANY_NAME }}! We missed you but will follow up within 1 hour."
```

### Additional Metadata

Add more fields to activity log:
```javascript
metadata: {
  call_id: ...,
  job_type: ...,
  budget: ...,
  // Add custom fields
  call_duration: $('Voice Call Webhook').first().json.duration,
  recording_url: $('Voice Call Webhook').first().json.recording_url
}
```

### Conditional SMS

Only send SMS during business hours:
```javascript
// Add IF node before SMS with condition
{{ new Date().getHours() >= 9 && new Date().getHours() < 17 }}
```

---

## Support & Documentation

- **Test Payloads**: `VOICE_CALL_TEST_PAYLOADS.md`
- **API Documentation**: `N8N_TEST_PAYLOADS.md`
- **Architecture**: `docs/architecture.md`
- **Workflow File**: `voice-call-event-workflow.json`

---

## Success Metrics

After deployment, monitor:

1. **Workflow Success Rate**: Should be >95%
2. **Contact Creation Rate**: Every call should create/update contact
3. **SMS Delivery Rate**: For missed calls (if configured)
4. **Job Conversion Rate**: % of calls with job_type that create jobs
5. **Average Processing Time**: Should be <2 seconds per call

---

## Next Steps

After successful deployment:

1. ✅ Monitor first 24 hours of production calls
2. ✅ Review activity logs for data quality
3. ✅ Train team on new lead/job entries
4. ✅ Configure alerts for workflow failures
5. ✅ Consider adding outbound call workflows
6. ✅ Integrate with additional voice providers (if needed)

---

## Version History

- **v1.0** (2025-11-15): Initial release
  - Call completed handling (job/lead decision)
  - Missed call handling (SMS notification)
  - Full SmartKlix CRM integration
  - Comprehensive logging and error handling
