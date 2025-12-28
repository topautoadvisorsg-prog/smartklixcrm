# Smart Klix AI Channels Architecture

## Single Brain Design

All AI channels route through the **Master Architect** - the single AI brain for reasoning and tool execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                         SMART KLIX CRM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐ │
│   │   CRM Chat      │    │  ChatGPT Actions │    │   Voice    │ │
│   │   (Internal)    │    │   (External)     │    │ Receptionist│ │
│   └────────┬────────┘    └────────┬────────┘    └─────┬──────┘ │
│            │                      │                    │        │
│            │                      │                    │        │
│            ▼                      ▼                    ▼        │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    MASTER ARCHITECT                      │  │
│   │                (Single AI Brain)                         │  │
│   │                                                          │  │
│   │  • Unified reasoning and tool execution                  │  │
│   │  • Per-channel tool permissions                          │  │
│   │  • Draft / Assist / Auto modes                           │  │
│   │  • Reflection and self-improvement                       │  │
│   └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                      CRM TOOLS                           │  │
│   │                                                          │  │
│   │  create_contact  │  create_lead   │  add_note           │  │
│   │  update_job      │  schedule_apt  │  send_sms           │  │
│   │  create_estimate │  create_invoice│  record_payment     │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Channel Details

### 1. CRM Chat (Internal)

**Purpose:** Internal staff chat interface for CRM operations

**Entrypoint:** `POST /api/ai/chat/internal`

**Source file:** `server/routes.ts` → calls `MasterArchitect.execute()`

**Flow:**
```
User Message → CRM Chat UI → /api/ai/chat/internal → MasterArchitect → Tools → Response
```

### 2. ChatGPT Actions (External)

**Purpose:** External GPT Actions hitting our API

**Entrypoint:** `POST /api/gpt-actions/:action`

**Source file:** `server/routes.ts` → calls `MasterArchitect.execute()`

**Flow:**
```
GPT Action → /api/gpt-actions/:action → MasterArchitect → Tools → Response
```

### 3. Voice Receptionist (Economy Tier)

**Purpose:** Handle inbound calls via Twilio and n8n

**Entrypoint:** `POST /api/voice/receptionist/turn`

**Source file:** `server/routes.ts` → calls `MasterArchitect.execute()`

**Flow:**
```
Twilio Call → n8n Webhook → /api/voice/receptionist/turn → MasterArchitect → Tools → Response → n8n → Twilio
```

## Mode Behaviors

Each channel respects the same three modes:

| Mode | Behavior |
|------|----------|
| **Draft** | Propose actions only, never execute |
| **Assist** | Queue actions for human approval |
| **Auto** | Execute allowed actions immediately |

## Per-Channel Tool Permissions

Tool permissions can be configured per-channel:

```typescript
{
  "create_contact": {
    "enabled": true,
    "allowedModes": ["draft", "assist", "auto"],
    "channels": {
      "chat": { "enabled": true, "allowedModes": ["draft", "assist", "auto"] },
      "actions": { "enabled": true, "allowedModes": ["assist", "auto"] },
      "voice": { "enabled": true, "allowedModes": ["draft", "assist"] }
    }
  }
}
```

## Key Files

| File | Purpose |
|------|---------|
| `server/master-architect.ts` | Master Architect class and AI logic |
| `server/ai-tools.ts` | Tool definitions and execution |
| `server/routes.ts` | API endpoints for all channels |
| `shared/schema.ts` | Database schemas including AI config |
| `server/storage.ts` | Storage layer for config persistence |
