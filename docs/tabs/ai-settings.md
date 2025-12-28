# AI Settings

## Purpose
The AI Settings page configures global AI behavior, company instructions, tool permissions, and default operating modes for the Master Architect system.

## UI Behavior

### Layout Structure

#### Company Instructions Card
- **System Prompt Textarea**:
  - Base instructions for AI behavior
  - Company-specific context
  - Tone and personality guidelines

- **Active Channels Toggles**:
  - CRM Chat
  - GPT Actions
  - Voice
  - Widget

#### Default Pipeline Settings Card
- Default pipeline stage for new leads
- Default contact tags (multi-select)
- Default job tags (multi-select)

#### Global Tool Permissions Card
- Master list of AI tools
- Per-tool mode defaults (Draft/Assist/Auto)
- Channel-specific overrides available

#### AI Learning Settings Card
- Reflection score threshold
- Auto-approve threshold
- Learning feedback loop toggle

### Interactions
- **Save Settings**: Persist changes to database
- **Reset to Defaults**: Restore factory settings
- **Test Prompt**: Send test message to AI
- **View Tool Details**: Expand for tool documentation

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/company-instructions` | GET/PUT | Global AI settings |
| `/api/ai-tools` | GET | List available tools |
| `/api/ai-reflection/config` | GET/PUT | Learning settings |

## Backend/API Interactions
- Settings stored in `companyInstructions` table
- Runtime configuration merging
- Company settings override global defaults

## Automation (Neo8) Involvement
- Settings affect all Neo8-triggered AI operations
- Changes take effect immediately

## Configuration Hierarchy
```
Global Defaults
    ↓ (overridden by)
Company Instructions
    ↓ (overridden by)
Channel-Specific Settings
    ↓ (overridden by)
Per-Conversation Context
```

## Design Tokens
- Cards: `bg-glass-surface border-glass-border`
- Toggle active: Primary color
- Permission grid: Alternating row colors

## Test IDs
- `textarea-system-prompt`: System prompt
- `toggle-channel-{channel}`: Channel toggles
- `select-default-stage`: Pipeline stage
- `tool-permission-{tool}`: Tool permission controls
- `button-save-settings`: Save button
- `button-reset-defaults`: Reset button
