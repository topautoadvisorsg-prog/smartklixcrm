# Neo8Flow AI Receptionist (Economy Tier) - Builder Prompt

**Send this complete prompt to Neo8Flow (n8n) to build the AI Receptionist workflow for handling inbound voice calls.**

---

## BUILDER PROMPT

We need a complete n8n workflow that integrates with Smart Klix CRM for AI-powered voice receptionist functionality. This is the "Economy Tier" implementation that uses Twilio for STT/TTS with n8n as the orchestration layer.

### Flow Name

**AI Receptionist - Economy Tier**

### Purpose

This workflow handles inbound phone calls through Twilio, converting speech to text, routing the conversation through the CRM's Master Architect AI, and converting the response back to speech. The economy tier is designed for cost-effective voice automation.

**Architecture: Twilio STT → n8n webhook → CRM /api/voice/receptionist/turn → n8n → Twilio TTS**

---

## ECONOMY TIER ARCHITECTURE

### Call Flow Sequence

```
1. Caller dials → Twilio receives call
2. Twilio uses <Gather> to collect speech input
3. Twilio STT converts speech → text
4. Twilio sends transcript to n8n webhook
5. n8n calls CRM /api/voice/receptionist/turn endpoint
6. CRM processes through Master Architect AI
7. CRM returns response with reply_text
8. n8n responds with TwiML <Say> to play response
9. Loop continues until call ends
```

### Why Economy Tier?

- Uses `gpt-4o-mini` instead of full GPT-4 (10x cheaper)
- Twilio's built-in STT (included with calling)
- Simple webhook-based architecture
- No streaming (reduces complexity)
- Suitable for 80% of use cases

---

## TWILIO CONFIGURATION (Pre-requisites)

### Required Twilio Setup

1. **Phone Number**: Configure a Twilio phone number
2. **Webhook URL**: Set the voice webhook to your n8n webhook URL
3. **HTTP Method**: POST

### TwiML Bin for Initial Greeting (Optional)

Create a TwiML Bin for the initial greeting:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling Smart Klix. How can I help you today?</Say>
  <Gather input="speech" action="https://your-n8n-url.com/webhook/voice-turn" method="POST" speechTimeout="auto" language="en-US">
  </Gather>
</Response>
```

---

## INCOMING EVENT SPECIFICATION

### Webhook Endpoint (from Twilio)

**POST** `{NEO8FLOW_BASE_URL}/webhook/voice-turn`

### Twilio Request Parameters

Twilio sends these form-encoded parameters:

| Parameter | Description |
|-----------|-------------|
| `CallSid` | Unique call identifier |
| `From` | Caller's phone number (E.164 format) |
| `To` | Called number |
| `CallStatus` | Current call status |
| `SpeechResult` | Transcribed speech from caller |
| `Confidence` | Speech recognition confidence (0-1) |

### Authentication Notes

Twilio webhooks cannot send custom headers. The n8n workflow receives Twilio's standard form-encoded data. Authentication is handled at the n8n → CRM step, not the Twilio → n8n step.

---

## CRM API ENDPOINT

### Voice Turn Endpoint

**POST** `{CRM_BASE_URL}/api/voice/receptionist/turn`

### Required Headers

```
Content-Type: application/json
x-webhook-signature: {HMAC_SIGNATURE} (optional)
```

### Authentication

The CRM endpoint uses **optional HMAC-SHA256 signature verification**:

1. **If `N8N_WEBHOOK_SECRET` is configured in CRM**: Requests should include `x-webhook-signature` header with HMAC-SHA256 signature of the request body
2. **Migration mode (current)**: The endpoint allows unsigned requests but logs warnings

**To generate signature in n8n:**
```javascript
const crypto = require('crypto');
// IMPORTANT: Prefix with 'sha256=' to match CRM middleware format
const hmacDigest = crypto
  .createHmac('sha256', $env.N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(requestBody))
  .digest('hex');
const signature = 'sha256=' + hmacDigest;
// Result format: "sha256=abc123..." (required by CRM)
```

**Rate Limiting:** 100 requests per minute per IP address.

### Request Payload

```json
{
  "channel": "voice",
  "caller_phone": "+15551234567",
  "conversation_id": "CA1234567890abcdef",
  "transcript": "Hi, I'd like to schedule an appointment",
  "call_state": {
    "turn_count": 1,
    "failed_understanding_count": 0,
    "intents_detected": [],
    "entities_captured": {}
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | Must be "voice" |
| `caller_phone` | string | Yes | Caller phone in E.164 format |
| `conversation_id` | string | Yes | Unique call ID (use Twilio CallSid) |
| `transcript` | string | Yes | User's transcribed speech |
| `call_state` | object | No | State tracking for multi-turn conversation |
| `call_state.turn_count` | number | No | Number of conversation turns |
| `call_state.failed_understanding_count` | number | No | Count of failed comprehension attempts |
| `call_state.intents_detected` | string[] | No | Intents identified so far |
| `call_state.entities_captured` | object | No | Captured data (name, email, phone, etc.) |

### CRM Response

**Success (200):**

```json
{
  "reply_text": "I'd be happy to help you schedule an appointment. What day works best for you?",
  "actions_taken": [
    {
      "tool": "create_contact",
      "status": "success",
      "mode": "assist",
      "result": { "contactId": "123", "action": "created" }
    }
  ],
  "conversation_id": "CA1234567890abcdef",
  "metadata": {
    "handoff_suggested": false,
    "call_should_end": false,
    "entities_captured": {
      "name": "John Doe",
      "intent": "schedule_appointment"
    },
    "model_used": "gpt-4o-mini",
    "caller_known": false
  }
}
```

### Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `reply_text` | string | Text to speak back to caller |
| `actions_taken` | array | CRM actions executed during this turn |
| `actions_taken[].tool` | string | Tool/function name that was called |
| `actions_taken[].status` | string | Execution status (success, error, pending) |
| `actions_taken[].mode` | string | Agent mode used (draft, assist, auto) |
| `actions_taken[].result` | object | Result data from the tool execution |
| `conversation_id` | string | Echo of conversation ID |
| `metadata.handoff_suggested` | boolean | True if human takeover needed |
| `metadata.call_should_end` | boolean | True if conversation is complete |
| `metadata.entities_captured` | object | Data extracted from conversation |
| `metadata.model_used` | string | LLM model used (e.g., gpt-4o-mini) |
| `metadata.caller_known` | boolean | True if caller exists in CRM contacts

**Error (503 - Receptionist Disabled):**

```json
{
  "error": "AI Receptionist is not enabled",
  "reply_text": "I'm sorry, our automated system is currently unavailable. Please leave a message and we'll call you back.",
  "actions_taken": [],
  "conversation_id": "CA1234567890abcdef",
  "metadata": {
    "handoff_suggested": true,
    "call_should_end": true
  }
}
```

---

## CALL HANDLING LOGIC

### Conversation State Management

Track state across multiple turns using n8n's context or workflow variables:

```javascript
// Initialize or retrieve call state
let callState = $('Get Call State').item.json || {
  turn_count: 0,
  failed_understanding_count: 0,
  intents_detected: [],
  entities_captured: {}
};

// Increment turn count
callState.turn_count++;

// Update from CRM response
if (response.metadata?.entities_captured) {
  callState.entities_captured = {
    ...callState.entities_captured,
    ...response.metadata.entities_captured
  };
}
```

### End Call Conditions

End the call when any of these conditions are met:

1. `metadata.call_should_end === true`
2. `turn_count > 10` (maximum turns reached)
3. `failed_understanding_count >= 3` (too many failed attempts)
4. `metadata.handoff_suggested === true` (transfer to human)

### Fallback Behavior

When the call should end or fallback is needed:

```javascript
// Fallback messages based on config
const fallbackMessages = {
  take_message: "I'll make sure someone gets back to you. Thank you for calling!",
  voicemail: "Please leave a message after the tone and we'll return your call.",
  transfer: "Let me transfer you to a team member who can help."
};
```

---

## TWIML RESPONSE GENERATION

### Standard Continuation Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{reply_text}</Say>
  <Gather input="speech" action="{webhook_url}" method="POST" speechTimeout="auto" language="en-US">
  </Gather>
</Response>
```

### End Call Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{reply_text}</Say>
  <Hangup/>
</Response>
```

### Voicemail Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please leave a message after the tone.</Say>
  <Record maxLength="120" action="{recording_handler_url}" recordingStatusCallback="{status_callback_url}"/>
</Response>
```

---

## WORKFLOW NODES SPECIFICATION

Build the following nodes in order:

### Node 1: Webhook Trigger (Twilio Voice)

- **Type:** Webhook
- **Name:** "Receive Voice Turn"
- **HTTP Method:** POST
- **Path:** `webhook/voice-turn`
- **Response Mode:** Using "Respond to Webhook" node

### Node 2: Extract Twilio Data (Code Node)

- **Type:** Code
- **Name:** "Extract Twilio Data"
- **JavaScript:**

```javascript
// Parse Twilio form-encoded data
const body = $input.first().json.body || {};

const twilioData = {
  callSid: body.CallSid || '',
  from: body.From || '',
  to: body.To || '',
  callStatus: body.CallStatus || '',
  speechResult: body.SpeechResult || '',
  confidence: parseFloat(body.Confidence || '0'),
};

// Validate required fields
if (!twilioData.callSid) {
  throw new Error('Missing CallSid from Twilio');
}

if (!twilioData.speechResult) {
  // No speech detected - return prompt to speak again
  return [{
    json: {
      type: 'no_speech',
      callSid: twilioData.callSid,
      message: "I didn't catch that. Could you please repeat?"
    }
  }];
}

return [{
  json: {
    type: 'speech_received',
    ...twilioData
  }
}];
```

### Node 3: Handle No Speech (IF Node)

- **Type:** IF
- **Name:** "Has Speech?"
- **Condition:** `{{ $json.type }}` equals `speech_received`
- **True Output:** Continue to Node 4
- **False Output:** Continue to Node 10 (No Speech Response)

### Node 4: Get/Initialize Call State (Code Node)

- **Type:** Code
- **Name:** "Get Call State"
- **Purpose:** Retrieve or initialize call state from storage

```javascript
// In a real implementation, you'd store this in Redis or a database
// For simplicity, we'll use static context per workflow execution
// n8n's $getWorkflowStaticData('global') can be used for simple state

const callSid = $('Extract Twilio Data').item.json.callSid;
const staticData = $getWorkflowStaticData('global');

// Initialize or retrieve state for this call
if (!staticData.calls) {
  staticData.calls = {};
}

let callState = staticData.calls[callSid] || {
  turn_count: 0,
  failed_understanding_count: 0,
  intents_detected: [],
  entities_captured: {}
};

// Increment turn count
callState.turn_count++;

// Store back
staticData.calls[callSid] = callState;

return [{
  json: {
    callSid,
    callState
  }
}];
```

### Node 5: Call CRM Voice Turn (HTTP Request)

- **Type:** HTTP Request
- **Name:** "CRM Voice Turn"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/voice/receptionist/turn`
- **Authentication:** None (manual headers)
- **Send Headers:** Yes
- **Headers:**
  - `Content-Type`: `application/json`
  - `x-webhook-signature`: `{{ $json.signature }}` (only set when signature is non-empty; format: `sha256=<hex-digest>`)
- **Send Body:** Yes
- **Body Content Type:** JSON
- **JSON Body:**

```json
{
  "channel": "voice",
  "caller_phone": "{{ $('Extract Twilio Data').item.json.from }}",
  "conversation_id": "{{ $('Extract Twilio Data').item.json.callSid }}",
  "transcript": "{{ $('Extract Twilio Data').item.json.speechResult }}",
  "call_state": {{ JSON.stringify($('Get Call State').item.json.callState) }}
}
```

**Optional Signature Node (Node 4b):** If `N8N_WEBHOOK_SECRET` is configured, add a Code node before this to generate the HMAC signature:

```javascript
const crypto = require('crypto');
const body = {
  channel: "voice",
  caller_phone: $('Extract Twilio Data').item.json.from,
  conversation_id: $('Extract Twilio Data').item.json.callSid,
  transcript: $('Extract Twilio Data').item.json.speechResult,
  call_state: $('Get Call State').item.json.callState
};

// IMPORTANT: Signature MUST have 'sha256=' prefix to match CRM middleware format
let signature = '';
if ($env.N8N_WEBHOOK_SECRET) {
  const hmacDigest = crypto
    .createHmac('sha256', $env.N8N_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
  signature = 'sha256=' + hmacDigest;
}
// Only set x-webhook-signature header when signature is non-empty

return [{ json: { ...body, signature } }];
```

### Node 6: Handle CRM Response (Code Node)

- **Type:** Code
- **Name:** "Handle CRM Response"
- **JavaScript:**

```javascript
const twilioData = $('Extract Twilio Data').item.json;
const callState = $('Get Call State').item.json.callState;
const crmResponse = $input.first().json;

// Update call state with CRM response
const staticData = $getWorkflowStaticData('global');
if (staticData.calls && staticData.calls[twilioData.callSid]) {
  const state = staticData.calls[twilioData.callSid];
  
  // Merge captured entities
  if (crmResponse.metadata?.entities_captured) {
    state.entities_captured = {
      ...state.entities_captured,
      ...crmResponse.metadata.entities_captured
    };
  }
  
  // Track intents
  if (crmResponse.actions_taken) {
    crmResponse.actions_taken.forEach(action => {
      if (action.result && !state.intents_detected.includes(action.result)) {
        state.intents_detected.push(action.result);
      }
    });
  }
}

// Determine if call should end
const shouldEnd = 
  crmResponse.metadata?.call_should_end === true ||
  crmResponse.metadata?.handoff_suggested === true ||
  callState.turn_count >= 10;

// Determine response type
let responseType = 'continue';
if (shouldEnd) {
  if (crmResponse.metadata?.handoff_suggested) {
    responseType = 'handoff';
  } else {
    responseType = 'end';
  }
}

// Clean up state if call is ending
if (shouldEnd && staticData.calls) {
  delete staticData.calls[twilioData.callSid];
}

return [{
  json: {
    responseType,
    replyText: crmResponse.reply_text || "I'm having trouble understanding. Let me transfer you.",
    callSid: twilioData.callSid,
    callerPhone: twilioData.from,
    metadata: crmResponse.metadata || {},
    actionsTaken: crmResponse.actions_taken || []
  }
}];
```

### Node 7: Route Response (Switch Node)

- **Type:** Switch
- **Name:** "Route Response"
- **Rules:**
  - `continue` → Node 8 (Continue Call Response)
  - `end` → Node 9 (End Call Response)
  - `handoff` → Node 11 (Handoff Response)
  - Default → Node 8

### Node 8: Continue Call Response (Respond to Webhook)

- **Type:** Respond to Webhook
- **Name:** "Continue Call Response"
- **Response Code:** 200
- **Response Content Type:** text/xml
- **Response Body:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{{ $json.replyText }}</Say>
  <Gather input="speech" action="{{ $env.WEBHOOK_URL }}" method="POST" speechTimeout="auto" language="en-US">
  </Gather>
</Response>
```

### Node 9: End Call Response (Respond to Webhook)

- **Type:** Respond to Webhook
- **Name:** "End Call Response"
- **Response Code:** 200
- **Response Content Type:** text/xml
- **Response Body:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{{ $json.replyText }}</Say>
  <Hangup/>
</Response>
```

### Node 10: No Speech Response (Respond to Webhook)

- **Type:** Respond to Webhook
- **Name:** "No Speech Response"
- **Response Code:** 200
- **Response Content Type:** text/xml
- **Response Body:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">{{ $json.message }}</Say>
  <Gather input="speech" action="{{ $env.WEBHOOK_URL }}" method="POST" speechTimeout="auto" language="en-US">
  </Gather>
</Response>
```

### Node 11: Handoff Response (Respond to Webhook)

- **Type:** Respond to Webhook
- **Name:** "Handoff Response"
- **Response Code:** 200
- **Response Content Type:** text/xml
- **Response Body:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Let me transfer you to a team member who can help. Please hold.</Say>
  <Dial timeout="30">
    <Number>{{ $env.HANDOFF_PHONE_NUMBER }}</Number>
  </Dial>
  <Say voice="Polly.Joanna">I'm sorry, no one is available. Please leave a message after the tone.</Say>
  <Record maxLength="120" action="{{ $env.RECORDING_HANDLER_URL }}" recordingStatusCallback="{{ $env.RECORDING_STATUS_URL }}"/>
</Response>
```

### Node 12: Log Voice Turn (HTTP Request) - Optional

- **Type:** HTTP Request
- **Name:** "Log Voice Turn"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/activity-log/write`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Body:**

```json
{
  "entityType": "voice_call",
  "entityId": "{{ $('Extract Twilio Data').item.json.callSid }}",
  "action": "voice_turn_completed",
  "details": {
    "caller_phone": "{{ $('Extract Twilio Data').item.json.from }}",
    "transcript": "{{ $('Extract Twilio Data').item.json.speechResult }}",
    "response": "{{ $('Handle CRM Response').item.json.replyText }}",
    "actions_taken": {{ JSON.stringify($('Handle CRM Response').item.json.actionsTaken) }},
    "response_type": "{{ $('Handle CRM Response').item.json.responseType }}"
  }
}
```

---

## NODE CONNECTIONS

```
[1: Receive Voice Turn]
         |
         v
[2: Extract Twilio Data]
         |
         v
[3: Has Speech?]
    |           |
    v           v
  (Yes)       (No)
    |           |
    v           v
[4: Get Call   [10: No Speech Response] --> END
 State]
    |
    v
[5: CRM Voice Turn]
    |
    v
[6: Handle CRM Response]
    |
    v
[7: Route Response]
    |
    +---> continue --> [8: Continue Call Response] --> END
    |
    +---> end --> [9: End Call Response] --> END
    |
    +---> handoff --> [11: Handoff Response] --> END

(Optional parallel branch from Node 6)
    |
    v
[12: Log Voice Turn] --> (continues in background)
```

---

## ENVIRONMENT VARIABLES

Configure these in n8n:

| Variable | Description | Example |
|----------|-------------|---------|
| `CRM_BASE_URL` | Base URL of Smart Klix CRM | `https://your-crm.replit.app` |
| `N8N_WEBHOOK_SECRET` | HMAC secret for request signing (optional, matches CRM's `N8N_WEBHOOK_SECRET`) | `your-shared-secret-key` |
| `WEBHOOK_URL` | Full URL of this n8n webhook (for Twilio callback) | `https://your-n8n.com/webhook/voice-turn` |
| `HANDOFF_PHONE_NUMBER` | Phone number for human handoff | `+15551234567` |
| `RECORDING_HANDLER_URL` | Webhook to receive recordings | `https://your-n8n.com/webhook/recording` |
| `RECORDING_STATUS_URL` | Webhook for recording status updates | `https://your-n8n.com/webhook/recording-status` |

**Note:** The `N8N_WEBHOOK_SECRET` is optional during migration. If configured, n8n should sign requests with HMAC-SHA256 and include the signature in the `x-webhook-signature` header.

---

## TWILIO VOICE SETTINGS

### Recommended Twilio Voice Options

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| Voice | `Polly.Joanna` | Natural-sounding AWS Polly voice |
| Language | `en-US` | Adjust for your audience |
| speechTimeout | `auto` | Automatically detect end of speech |
| timeout | `5` | Seconds to wait for speech before fallback |
| input | `speech` | Speech input only (not DTMF) |

### Alternative Voices

| Voice | Style | Use Case |
|-------|-------|----------|
| `Polly.Joanna` | Professional female | General business |
| `Polly.Matthew` | Professional male | Alternative |
| `Polly.Amy` | British female | UK audience |
| `Polly.Brian` | British male | UK audience |
| `alice` | Standard Twilio | Budget option |

---

## ADDITIONAL WORKFLOWS (Optional Extensions)

### Recording Handler Workflow

Handle voicemail recordings when calls go to voicemail:

```
[Webhook: Receive Recording]
    |
    v
[Extract Recording Data]
    |
    v
[Download Recording from Twilio]
    |
    v
[Create Lead in CRM with Recording URL]
    |
    v
[Queue for Follow-up]
```

### Outbound Call Workflow (Future)

For AI-initiated outbound calls:

```
[Trigger: New Hot Lead]
    |
    v
[Check Business Hours]
    |
    v
[Initiate Twilio Call]
    |
    v
[Connect to Voice Turn Handler]
```

---

## CRM INTEGRATION POINTS

### What the CRM Handles

1. **Contact Lookup**: Identifies callers by phone number
2. **Master Architect AI**: Processes conversation through AI
3. **Intent Detection**: Identifies caller needs (appointment, lead capture, FAQ)
4. **Entity Extraction**: Captures name, email, appointment details
5. **Action Execution**: Creates contacts, leads, appointments in CRM
6. **Audit Logging**: Records all voice turns for compliance

### What n8n Handles

1. **Twilio Integration**: Receives webhooks, generates TwiML
2. **State Management**: Tracks conversation across turns
3. **Response Routing**: Determines continue/end/handoff
4. **TTS Voice Selection**: Configures voice for responses

---

## TESTING

### Manual Test Flow

1. Configure Twilio phone number with n8n webhook
2. Call the phone number
3. Speak: "Hi, I'd like to schedule an appointment"
4. Verify AI responds appropriately
5. Continue conversation to test multi-turn
6. Test edge cases:
   - No speech detected
   - Call exceeds max turns
   - Handoff trigger
   - Call completion

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Normal greeting | AI introduces itself and asks how to help |
| Appointment request | AI captures details, confirms, creates in CRM |
| Unclear speech | AI asks for clarification, increments failed count |
| After 3 failures | Handoff to human or voicemail |
| Known caller | AI greets by name, shows context |
| Call completion | AI summarizes, says goodbye, hangs up |

### Verify in CRM

After testing, check:
- Audit log entries for voice turns
- New contacts created from calls
- Activity log entries
- Approval Hub for any queued actions

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Twilio not receiving response | Check n8n webhook is publicly accessible |
| Invalid TwiML errors | Validate XML syntax, ensure proper encoding |
| CRM returning 401 | Verify `CRM_AUTH_TOKEN` matches `N8N_INTERNAL_TOKEN` |
| CRM returning 503 | Enable AI Receptionist in CRM settings |
| No speech detected repeatedly | Lower Twilio `timeout` setting, check microphone |
| Slow response times | Check CRM latency, consider caching |
| State not persisting | Verify n8n static data or use external storage |

---

## SECURITY CONSIDERATIONS

1. **Token Validation**: CRM validates Bearer token on all requests
2. **Phone Number Validation**: Validate E.164 format before CRM calls
3. **Rate Limiting**: CRM applies rate limits to webhook endpoints
4. **PII Handling**: Transcripts contain sensitive data - log carefully
5. **Recording Storage**: Twilio recordings expire - download if needed
6. **Call Recording Consent**: Check local laws for call recording disclosure

---

## COST OPTIMIZATION

### Economy Tier Cost Breakdown

| Component | Cost Estimate |
|-----------|---------------|
| Twilio Voice | ~$0.014/min inbound |
| Twilio STT | Included with voice |
| GPT-4o-mini | ~$0.15/1M input tokens |
| n8n Workflow | Based on plan |

### Tips to Reduce Costs

1. Use `gpt-4o-mini` (default for economy tier)
2. Keep prompts concise
3. Set reasonable `maxCallDuration` (5 min default)
4. Use fallback for complex queries instead of long AI conversations
5. Cache frequently asked questions
