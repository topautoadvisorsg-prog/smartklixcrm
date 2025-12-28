# AI Receptionist Architecture

## Overview

The AI Receptionist handles voice interactions with callers, routing through the Master Architect for consistent tool execution and mode behaviors.

## Two Tiers

### Premium Tier (Future)
- Uses OpenAI Realtime Voice API
- Direct voice-to-voice with minimal latency
- Higher cost per call
- Not implemented yet

### Economy Tier (Current Implementation)
- Uses separate STT → LLM → TTS pipeline
- Lower cost per call
- Slightly higher latency
- **This is what we're building now**

## Economy Tier Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     ECONOMY TIER VOICE STACK                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   TWILIO    │  Telephony layer                               │
│  │  (Calls)    │  Handles actual phone calls                    │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐                                                │
│  │    n8n      │  Workflow orchestration                        │
│  │ (Webhooks)  │  Bridges Twilio ↔ Smart Klix                   │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               SMART KLIX VOICE ENDPOINT                  │   │
│  │         POST /api/voice/receptionist/turn                │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  ┌─────────┐    ┌─────────────┐    ┌─────────┐          │   │
│  │  │   STT   │ →  │   MASTER    │ →  │   TTS   │          │   │
│  │  │(Whisper)│    │  ARCHITECT  │    │ (OpenAI)│          │   │
│  │  └─────────┘    │ (gpt-4o-mini)│   └─────────┘          │   │
│  │                 └──────┬──────┘                          │   │
│  │                        │                                 │   │
│  │                        ▼                                 │   │
│  │                 ┌────────────┐                           │   │
│  │                 │ CRM TOOLS  │                           │   │
│  │                 │ (filtered) │                           │   │
│  │                 └────────────┘                           │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Voice Endpoint Specification

### Endpoint
```
POST /api/voice/receptionist/turn
```

### Request Body
```typescript
interface VoiceReceptionistRequest {
  channel: "voice";
  caller_phone: string;
  conversation_id: string;
  transcript: string;
  call_state?: {
    turn_count: number;
    failed_understanding_count: number;
    intents_detected: string[];
    entities_captured: Record<string, string>;
  };
}
```

### Response Body
```typescript
interface VoiceReceptionistResponse {
  reply_text: string;
  actions_taken: Array<{
    tool: string;
    status: "proposed" | "queued" | "executed";
    mode: "draft" | "assist" | "auto";
    result?: unknown;
  }>;
  conversation_id: string;
  metadata: {
    handoff_suggested: boolean;
    call_should_end: boolean;
    entities_captured: Record<string, string>;
    model_used: string;
  };
}
```

### Example Request
```json
{
  "channel": "voice",
  "caller_phone": "+15551234567",
  "conversation_id": "call_abc123",
  "transcript": "Hi, I need to schedule an HVAC maintenance appointment for next Tuesday",
  "call_state": {
    "turn_count": 1,
    "failed_understanding_count": 0,
    "intents_detected": [],
    "entities_captured": {}
  }
}
```

### Example Response
```json
{
  "reply_text": "I'd be happy to help you schedule an HVAC maintenance appointment. Let me check our availability for next Tuesday. Could you please confirm your name and the best callback number?",
  "actions_taken": [],
  "conversation_id": "call_abc123",
  "metadata": {
    "handoff_suggested": false,
    "call_should_end": false,
    "entities_captured": {
      "service_type": "HVAC maintenance",
      "preferred_date": "next Tuesday"
    },
    "model_used": "gpt-4o-mini"
  }
}
```

## Configuration Schema

### AI Receptionist Settings

Stored in `ai_receptionist_config` table:

```typescript
interface AiReceptionistConfig {
  id: string;
  
  // Mode and Provider
  enabled: boolean;
  voiceMode: "economy" | "premium";
  llmModel: string;           // e.g., "gpt-4o-mini" for economy
  sttProvider: string;        // e.g., "whisper"
  ttsProvider: string;        // e.g., "openai_tts"
  
  // Basic Behavior
  behaviorPrompt: string;     // System prompt for receptionist
  allowedIntents: {
    appointment_intake: boolean;
    lead_capture: boolean;
    faq_answers: boolean;
    job_status_inquiry: boolean;
  };
  maxCallDuration: number;    // in seconds
  maxFailedUnderstandings: number;
  
  // Per-Channel Tool Permissions
  toolPermissions: {
    [toolName: string]: {
      enabled: boolean;
      allowedModes: ("draft" | "assist" | "auto")[];
    };
  };
  
  // Call Handling
  failedAttemptsBeforeHandoff: number;
  fallbackBehavior: "take_message" | "voicemail" | "transfer";
  voicemailRouteId?: string;
  n8nWorkflowNotes?: string;
  
  // Logging and CRM
  storeTranscript: boolean;
  autoCreateContact: boolean;
  autoCreateNote: boolean;
  
  updatedAt: Date;
}
```

## Mode Behaviors for Voice Channel

| Mode | Voice Behavior |
|------|----------------|
| **Draft** | AI proposes actions in response text, never executes |
| **Assist** | AI queues tools for approval, caller notified of pending actions |
| **Auto** | AI executes allowed tools immediately, confirms to caller |

## n8n Integration Notes

The n8n workflow should:

1. **Receive Twilio webhook** when call connects
2. **Initialize conversation** with first turn to Smart Klix
3. **Loop voice turns:**
   - STT: Transcribe caller audio → text
   - Send transcript to `/api/voice/receptionist/turn`
   - TTS: Convert reply_text → audio
   - Play audio to caller
4. **Handle special cases:**
   - `handoff_suggested: true` → Transfer to human
   - `call_should_end: true` → End call gracefully
   - Max duration reached → Warn and end
5. **Store call record** on completion

## Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | Voice turn endpoint |
| `server/master-architect.ts` | AI execution with channel context |
| `shared/schema.ts` | Config schema |
| `client/src/pages/AIReceptionistConfig.tsx` | Settings UI |
