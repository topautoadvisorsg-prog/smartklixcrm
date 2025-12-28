# Neo8 ↔ CRM Integration Contracts

> **Core Principle**: CRM owns intent, retries, approvals, memory, and escalation. Neo8 executes and waits for callbacks.

---

## Execution Model Summary

### GPT Role (Initiation Only)
- GPT initiates actions via structured function/tool calls
- GPT sends requests only to CRM action APIs, never to Neo8 or third-party services
- GPT never executes external side effects directly

### CRM Role (System of Record & Control Plane)
- Policy enforcement, approval requirements, retry logic, escalation thresholds
- Long-term memory and audit via `auditLog` and `assistQueue`
- For internal actions: CRM executes directly
- For external actions: CRM delegates to Neo8

### Neo8 Role (Execution Only)
- Receives explicit execution commands from CRM
- Executes external integrations (Twilio, SendGrid, Stripe, Google, Voice)
- Returns structured execution results
- Never receives requests directly from GPT
- Does not decide, approve, retry, or escalate

### AI Receptionist Exception
- Only inbound execution handled by Neo8 without prior CRM initiation
- Economic mode: Neo8 manages Twilio Gather + multi-turn state → sends results to CRM
- Premium mode: Neo8 receives final transcript only
- All lead creation and follow-up actions originate in CRM after voice processing

### Intake Sources (All Route to CRM)
- Website widget → CRM
- Contact forms → CRM
- GPT create-lead actions → CRM
- Manual CRM entry → CRM
- AI Receptionist output → Neo8 voice processing → CRM

---

## A. Follow-Up & Qualification Trigger

### Ownership
- **CRM**: Decides when to trigger, owns retry logic, stores inbound replies
- **Neo8**: Executes outreach, reports success/failure

### Trigger Sources
1. Pipeline/status change events
2. Manual button clicks in Approval Hub

### Webhook Endpoint
```
POST {N8N_WEBHOOK_BASE_URL}/webhook/followup
```

### Payload Schema
```typescript
{
  contactId: string;          // UUID - Required
  channel: "sms" | "email" | "both";
  templateId?: string;        // Template to use
  intent?: string;            // e.g., "qualification", "follow_up", "booking"
  meetingLink?: string;       // Optional calendar booking link
  delayMinutes?: number;      // Delay before sending (0 = immediate)
  priority?: "low" | "normal" | "high" | "urgent";
  metadata?: Record<string, string>;
}
```

### Example Payload
```json
{
  "contactId": "550e8400-e29b-41d4-a716-446655440000",
  "channel": "email",
  "intent": "qualification",
  "templateId": "tmpl_qual_01",
  "priority": "high"
}
```

### Inbound Reply Handling
- Replies are logged to CRM (`emails` table)
- CRM may re-trigger outreach if needed
- Neo8 does NOT process inbound replies

---

## B. AI Receptionist Mode Flag

### Ownership
- **CRM**: Declares voice mode, stores configuration
- **Neo8**: Routes to appropriate processing path

### Voice Modes

#### Economic Mode
- **Endpoint**: `/webhook/voice/receptionist`
- **Flow**: Twilio STT → n8n → Master Architect → Twilio TTS
- **Payload**:
```typescript
{
  callId: string;
  callerId: string;
  contactId?: string;
  voiceMode: "economic";
  transcript: string;
  intent?: string;
  timestamp: string;  // ISO 8601
}
```

#### Premium Mode
- **Endpoint**: Direct OpenAI real-time API
- **Flow**: Twilio Media Stream → OpenAI Realtime API → AI Receptionist Server → Neo8 → CRM
- **Payload**:
```typescript
{
  callId: string;
  callerId: string;
  contactId?: string;
  voiceMode: "premium";
  sessionId: string;
  timestamp: string;  // ISO 8601
}
```

### Premium Mode Result Callback (Neo8 → CRM)
```
POST /api/voice/receptionist/premium/result
```

**Payload Schema**:
```typescript
{
  callId: string;
  contactId?: string;           // UUID
  callerPhone: string;
  transcript: string;
  summary: string;
  extractedData: {
    name?: string;
    phone?: string;
    email?: string;
    reason?: string;
    appointmentRequested?: boolean;
    preferredTime?: string;
    urgency?: "low" | "normal" | "high" | "urgent";
    notes?: string;
  };
  callDuration: number;         // seconds
  callOutcome?: "completed" | "transferred" | "voicemail" | "dropped" | "error";
  timestamp: string;            // ISO 8601
}
```

**Response**:
```typescript
{
  success: boolean;
  contactId?: string;           // Created or matched contact
  message: string;
  actionsQueued: number;        // Number of approval queue items created
}
```

### Voice Events Endpoint (Neo8 → CRM)
```
POST /api/voice/events
```

Unified endpoint for call lifecycle events.

**Payload Schema**:
```typescript
{
  eventType: "scheduled" | "answered" | "missed" | "completed" | "transferred" | "voicemail";
  callId: string;
  contactId?: string;           // UUID
  callerPhone?: string;
  timestamp: string;            // ISO 8601
  metadata?: Record<string, string>;
  callDuration?: number;        // seconds
  outcome?: string;
}
```

### Voice Receptionist Config (CRM → Premium Server)
```
GET /api/voice/receptionist/config
```

Returns current AI Receptionist configuration for Premium Server (excludes `behaviorPrompt` - that lives on Premium Server).

**Response**:
```typescript
{
  enabled: boolean;
  voiceMode: "economy" | "premium";
  operatingMode: "inbound_only" | "inbound_outbound";
  llmModel: string;
  sttProvider: string;
  ttsProvider: string;
  ttsVoice: string;
  languagePreference: string;
  allowedIntents: Record<string, boolean>;
  maxCallDuration: number;
  maxFailedUnderstandings: number;
  toolPermissions: Record<string, { enabled: boolean; allowedModes: string[] }>;
  failedAttemptsBeforeHandoff: number;
  fallbackBehavior: "take_message" | "voicemail" | "transfer";
  storeTranscript: boolean;
  autoCreateContact: boolean;
  autoCreateNote: boolean;
}
```

### Configuration Source
- `aiReceptionistConfig` table in CRM database
- `voiceMode` field explicitly declares mode

---

## C. Master Architect Review Callback

### Ownership
- **CRM**: Owns approval decisions, retry counts, escalation thresholds
- **Neo8**: Waits for callback, executes or exits based on instruction

### Callback Endpoint (CRM → Neo8)
```
POST {N8N_WEBHOOK_BASE_URL}/webhook/master-architect/review
```

### Payload Schema
```typescript
{
  action: "APPROVE" | "RETRY" | "ESCALATE";
  taskId: string;             // UUID
  queueItemId?: string;       // UUID
  retryCount: number;         // Current retry count
  maxRetries: number;         // CRM-defined limit
  escalationThreshold?: number;
  reason?: string;            // Human-provided reason
  reviewedBy?: string;        // User who reviewed
  timestamp: string;          // ISO 8601
}
```

### Action Behaviors

| Action | Neo8 Behavior |
|--------|---------------|
| `APPROVE` | Execute the queued action |
| `RETRY` | Re-attempt with same parameters |
| `ESCALATE` | Exit execution, notify designated escalation path |

### Example Payloads

**Approval**:
```json
{
  "action": "APPROVE",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "queueItemId": "660e8400-e29b-41d4-a716-446655440001",
  "retryCount": 0,
  "maxRetries": 3,
  "reviewedBy": "user_admin",
  "timestamp": "2025-12-13T10:30:00Z"
}
```

**Escalation**:
```json
{
  "action": "ESCALATE",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "retryCount": 3,
  "maxRetries": 3,
  "reason": "Max retries exceeded, customer unresponsive",
  "timestamp": "2025-12-13T10:30:00Z"
}
```

---

## D. Google Workspace Actions

### Ownership
- **CRM**: System of record, logs all actions to `auditLog`
- **Neo8**: Executes actions, reports results

### Webhook Endpoints

| Service | Endpoint |
|---------|----------|
| Gmail | `/webhook/google/gmail` |
| Calendar | `/webhook/google/calendar` |
| Sheets | `/webhook/google/sheets` |
| Docs | `/webhook/google/docs` |

### Gmail Payload
```typescript
{
  action: "gmail.send" | "gmail.reply";
  to: string;           // Email address
  subject: string;
  body: string;
  threadId?: string;    // For replies
  contactId?: string;   // UUID for audit linking
}
```

### Calendar Payload
```typescript
{
  action: "calendar.create" | "calendar.update" | "calendar.cancel";
  eventId?: string;     // Required for update/cancel
  title: string;
  description?: string;
  startTime: string;    // ISO 8601
  endTime: string;      // ISO 8601
  attendees?: string[]; // Email addresses
  contactId?: string;   // UUID for audit linking
}
```

### Sheets Payload
```typescript
{
  action: "sheets.append";
  spreadsheetId: string;
  sheetName: string;
  values: string[][];   // 2D array of cell values
  contactId?: string;
}
```

### Docs Payload
```typescript
{
  action: "docs.create" | "docs.update" | "docs.append" | "docs.replace" | "docs.export";
  documentId?: string;  // Required for update/append/replace/export
  title?: string;       // For create
  content?: string;     // For create/update/append
  placeholders?: Record<string, string>;  // For replace
  exportFormat?: "pdf" | "plain";         // For export
  contactId?: string;
}
```

---

## E. WhatsApp Messaging

### Ownership
- **CRM**: Decides when/what to send, owns conversation history, handles replies
- **Neo8**: Executes send via Twilio, forwards inbound messages to CRM

### Outbound Webhook Endpoint (CRM → Neo8)
```
POST {N8N_WEBHOOK_BASE_URL}/webhook/whatsapp/send
```

### Outbound Payload Schema
```typescript
{
  action: "whatsapp.send";
  contactId: string;         // UUID - Required
  to: string;                // E.164 format (e.g., "+14155551234")
  message: string;           // 1-4096 characters
  templateId?: string;       // Twilio template ID for approved templates
  conversationId?: string;   // UUID for threading
  metadata?: Record<string, string>;
}
```

### Example Outbound Payload
```json
{
  "action": "whatsapp.send",
  "contactId": "550e8400-e29b-41d4-a716-446655440000",
  "to": "+14155551234",
  "message": "Hi! Your appointment is confirmed for tomorrow at 2pm.",
  "conversationId": "660e8400-e29b-41d4-a716-446655440001"
}
```

### Inbound Webhook Endpoint (Neo8 → CRM)
```
POST /api/whatsapp/inbound
```

### Inbound Payload Schema
```typescript
{
  channel: "whatsapp";
  from: string;              // Sender phone number
  to: string;                // Recipient (business) number
  body: string;              // Message content
  messageSid: string;        // Twilio message SID
  timestamp: string;         // ISO 8601
  mediaUrl?: string;         // URL if media attached
  mediaContentType?: string; // MIME type if media attached
  rawPayload?: Record<string, unknown>;  // Full Twilio webhook data
}
```

### Example Inbound Payload
```json
{
  "channel": "whatsapp",
  "from": "+14155551234",
  "to": "+18005551234",
  "body": "Yes, that time works for me!",
  "messageSid": "SM1234567890abcdef",
  "timestamp": "2025-12-14T10:30:00Z"
}
```

### Key Behaviors
- **Neo8 does NOT**: Auto-reply, process with AI, retry sends, or store messages
- **CRM handles**: Contact lookup, conversation threading, AI processing, response decisions
- **Media**: Neo8 forwards media URLs; CRM decides how to process/store

---

## Execution Result (Neo8 → CRM)

All Neo8 executions return a standardized result:

```typescript
{
  success: boolean;
  executionId: string;
  timestamp: string;    // ISO 8601
  error?: string;       // Only if success=false
  data?: Record<string, unknown>;  // Action-specific results
}
```

---

## Failure Expectations

| Scenario | CRM Responsibility | Neo8 Responsibility |
|----------|-------------------|---------------------|
| Payload validation fails | N/A | Return error immediately |
| External API fails | Decide retry/escalate | Report failure, await callback |
| Timeout | Decide retry/escalate | Report timeout as failure |
| Authentication fails | Provide valid credentials | Report auth error |

---

## Type Definitions Location

All typed schemas are defined in:
```
shared/contracts/neo8-payloads.ts
```

Import and validate payloads:
```typescript
import { FollowUpTriggerPayloadSchema } from "@shared/contracts/neo8-payloads";

const result = FollowUpTriggerPayloadSchema.safeParse(incomingPayload);
if (!result.success) {
  // Handle validation error
}
```
