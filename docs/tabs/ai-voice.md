# AI Voice (AI Receptionist)

## Purpose
The AI Voice page configures the AI Receptionist system that handles inbound phone calls. It supports both Economy (Twilio STT → n8n → Master Architect → Twilio TTS) and Premium (direct OpenAI real-time voice) tiers.

## UI Behavior

### Layout Structure - Three Tabs

#### 1. Setup Tab
- **Basic Settings Card**:
  - Enable/disable toggle
  - Voice selection dropdown
  - Language preference
  - Behavior prompt textarea

- **Allowed Intents Card**:
  - Schedule Appointments (checkbox)
  - Capture New Leads (checkbox)
  - Answer Common Questions (checkbox)
  - Check Job Status (checkbox)

- **Information Collection Card**:
  - Fields to collect from callers
  - Add/remove field buttons
  - Drag to reorder

#### 2. Call Handling Tab
- Max call duration (minutes)
- Max failed understanding attempts
- Failed attempts before handoff
- Fallback behavior (take message/voicemail/transfer)
- Human handoff rules

#### 3. Advanced Tab
- **Technical Settings**:
  - Voice mode (economy/premium)
  - LLM model selection
  - STT/TTS provider selection
  - Operating mode (Draft/Assist/Auto)

- **Tool Permissions Grid**:
  - Tools: Create Contact, Create Lead, Add Note, Schedule Appointment, Update Job Status
  - Mode checkboxes for each: Suggest, Queue, Auto

- **Developer Notes** (Collapsible):
  - Workflow IDs
  - Technical configuration

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai-receptionist/config` | GET | Load configuration |
| `/api/ai-receptionist/config` | PUT | Save configuration |

## Backend/API Interactions
- Configuration stored in `aiReceptionistConfig` table
- Per-channel tool permissions
- Mode-based access restrictions

## Automation (Neo8) Involvement
### Economy Tier Flow
```
Twilio STT → n8n webhook (/webhook/voice/receptionist)
           → /api/voice/receptionist/turn
           → Master Architect (with voice channel tools)
           → n8n
           → Twilio TTS → Caller
```

### Premium Tier Flow
```
Twilio → OpenAI Real-Time Voice API → Master Architect → Response
```

## Tool Permission Modes
| UI Label | Internal Key | Behavior |
|----------|--------------|----------|
| Suggest | `draft` | AI proposes actions only |
| Queue | `assist` | AI queues for approval |
| Auto | `auto` | AI acts immediately |

## Design Tokens
- Tab panels: `bg-glass-surface`
- Config cards: `border-glass-border`
- Enable toggle: Primary color when active
- Permission grid: Striped rows

## Test IDs
- `tab-setup`: Setup tab
- `tab-call-handling`: Call handling tab
- `tab-advanced`: Advanced tab
- `toggle-receptionist-enabled`: Enable toggle
- `select-voice`: Voice dropdown
- `checkbox-intent-{intent}`: Intent checkboxes
- `tool-permission-{tool}-{mode}`: Permission checkboxes
