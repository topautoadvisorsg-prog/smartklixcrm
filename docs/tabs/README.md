# Smart Klix CRM - Tab Documentation

This directory contains comprehensive documentation for all CRM tabs/pages.

## Documentation Structure

Each tab README includes:
- **Purpose**: What the tab does
- **UI Behavior**: Layout, interactions, visual elements
- **Data Flow**: API endpoints and data transformations
- **Backend/API Interactions**: Server communication
- **Automation (Neo8) Involvement**: Workflow integrations
- **Design Tokens**: Styling classes used
- **Test IDs**: Data-testid attributes for testing

## Tab Categories

### Core CRM Operations
| Tab | File | Description |
|-----|------|-------------|
| [Dashboard](./dashboard.md) | dashboard.md | KPI overview and activity feed |
| [Contacts](./contacts.md) | contacts.md | Customer management with AI signals |
| [Jobs](./jobs.md) | jobs.md | Project tracking and management |
| [Pipeline](./pipeline.md) | pipeline.md | Kanban deal flow with forecasting |
| [Calendar](./calendar.md) | calendar.md | Scheduling and appointments |
| [Estimates](./estimates.md) | estimates.md | Quotes and proposals |
| [Payments](./payments.md) | payments.md | Invoices and transactions |
| [Pricebook](./pricebook.md) | pricebook.md | Service/product catalog |

### Lead Management
| Tab | File | Description |
|-----|------|-------------|
| [Intake Hub](./intake.md) | intake.md | Lead capture and triage |
| [Funnels](./funnels.md) | funnels.md | Marketing funnel tracking |

### AI & Automation
| Tab | File | Description |
|-----|------|-------------|
| [Read Chat](./read-chat.md) | read-chat.md | Observation-only AI logs |
| [Action Console](./action-console.md) | action-console.md | Interactive AI execution |
| [Review Queue](./review-queue.md) | review-queue.md | Approval hub for AI actions |
| [Ready Execution](./ready-execution.md) | ready-execution.md | Final human authorization gate |
| [Automation Ledger](./automation-ledger.md) | automation-ledger.md | Immutable event log |
| [AI Voice](./ai-voice.md) | ai-voice.md | AI Receptionist configuration |
| [ChatGPT Actions](./chatgpt-actions.md) | chatgpt-actions.md | GPT integration management |
| [AI Settings](./ai-settings.md) | ai-settings.md | Global AI configuration |

### Communication
| Tab | File | Description |
|-----|------|-------------|
| [Email](./email.md) | email.md | IMAP/SMTP email management |
| [WhatsApp](./whatsapp.md) | whatsapp.md | WhatsApp Business messaging |
| [Google Workspace](./workspace.md) | workspace.md | Gmail, Calendar, Sheets, Docs |
| [Social Planner](./social-planner.md) | social-planner.md | Social media scheduling |

### Extensions
| Tab | File | Description |
|-----|------|-------------|
| [Marketplace](./marketplace.md) | marketplace.md | Integration discovery and installation |

## Architecture Principles

### Read vs Execute Separation
- **Read Chat**: Observation only, no execution authority
- **Action Console**: Interactive execution with mode controls
- **Review Queue**: Approval gate for queued actions
- **Ready Execution**: Final human confirmation for critical operations

### AI Mode Hierarchy
| Mode | Behavior | Approval Required |
|------|----------|-------------------|
| Draft | AI proposes, no action | N/A |
| Assist | AI queues for approval | Yes, in Review Queue |
| Auto | AI executes approved types | Pre-configured |

### Automation Ledger
All actions are logged immutably with cryptographic hash chaining for compliance and audit.

## Design System

### Glassmorphic Tokens
- `bg-glass-surface`: Translucent card backgrounds
- `bg-glass-surface-opaque`: Solid sidebar/panel backgrounds
- `border-glass-border`: Subtle borders
- `--glass-blur`: Backdrop blur amount

### Theme Modes
- **Dark Mode** (default): Deep charcoal/navy base (220 hue) with amber accents
- **Light Mode**: Cool blue-white tinted surfaces (210 hue)

## Neo8 Integration Summary

All workflow automation routes through Neo8 (n8n):

| Webhook | Purpose |
|---------|---------|
| `/webhook/lead-intake` | Lead capture processing |
| `/webhook/followup` | Automated follow-up sequences |
| `/webhook/voice/receptionist` | AI Voice economy tier |
| `/webhook/stripe/payment` | Payment processing |
| `/webhook/stripe/events` | Stripe webhook events |
| `/webhook/google/*` | Google Workspace operations |
| `/webhook/master-architect/review` | AI action approval callbacks |
| `/webhook/whatsapp/send` | WhatsApp messaging |
