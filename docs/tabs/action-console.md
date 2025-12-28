# Action Console (Direct Brain Interface)

## Purpose

The Action Console is the **interactive interface to ActionAI CRM** - the system's operational brain. Operators use natural language to instruct the AI to propose CRM actions like creating leads, drafting communications, or scheduling tasks.

**Critical Rule:** All outputs are **proposals**, not executions. Every action goes to the Review Queue for governance approval.

## Who Uses This

- **Operators**: Issue natural language commands to the AI
- **Sales Staff**: Request draft emails, lead creation, follow-ups
- **Dispatchers**: Request job creation, task assignments

## What Problem It Solves

- Enables rapid CRM operations without navigating multiple screens
- Captures operator intent and translates to structured proposals
- Maintains governance by routing everything through approval flow

## Core Authority Rules

| Rule | Description |
|------|-------------|
| **Proposal-Only Output** | AI cannot directly mutate CRM records |
| **Governance Gate** | All proposals route to Review Queue / Approval Hub |
| **3-Strike Rule** | After 3 rejections on same task, AI is blocked and task reverts to manual |

## UI Layout

### Header
| Element | Description |
|---------|-------------|
| Lightning Icon | Primary-colored container with Zap icon |
| Title | "Action Console" in uppercase |
| Subtitle | "Direct Brain Interface" in primary color |
| Status Badge | "System Active" with green pulse indicator |

### Chat Area
| Element | Description |
|---------|-------------|
| Message Bubbles | Rounded containers with role indicator (Operator/System/ActionAI Engine) |
| Timestamp | Mono font time display on each message |
| Proposal Cards | Embedded in AI responses with pending status and "View P-XXX" button |
| Typing Indicator | Three bouncing dots when AI is processing |

### Input Area
| Element | Description |
|---------|-------------|
| Input Field | Pill-shaped with glow effect on focus |
| Send Button | Rounded button with arrow icon |
| Governance Notice | Centered text below: "All instructions are drafted as proposals for review" |

## Message Types

| Role | Styling | Purpose |
|------|---------|---------|
| **System** | Muted background, border | Welcome message, status updates |
| **Operator** | Glass surface, right-aligned | User input |
| **ActionAI Engine** | Muted background, left-aligned | AI responses with optional proposal |

## Proposal Flow

```
Operator Input → ActionAI Processing → Proposal Created → Review Queue
                                                              ↓
                                                    Approval Hub (Architect review)
                                                              ↓
                                                    Approved → Execution
                                                    Rejected → Feedback to AI (or 3-strike block)
```

## Capability Contract (What AI Can Propose)

| Action | Limit |
|--------|-------|
| Create Lead | From normalized intake data |
| Create Contact | Max 5 per proposal |
| Create Task | Follow-up tasks for operators |
| Draft Communication | Email, SMS, WhatsApp drafts |
| Create Note | Internal context logging |
| Create Job | Only if allowed by Master Architect policy |

## Hard Constraints (Prohibited)

| Constraint | Description |
|------------|-------------|
| No Direct Mutation | Cannot update existing records autonomously |
| No Overwrite | Cannot change data without human approval |
| No Direct Execution | Cannot send emails or payments |
| No Bypass | Cannot skip Review Queue or Master Architect |

## Backend Connection

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/action-console/send` | POST | Send operator message, receive AI response + proposal ID |

## Neo8 / Automation

| Question | Answer |
|----------|--------|
| Triggers automations? | **YES** - Proposals may trigger n8n workflows upon approval |
| Reads automation results? | **NO** - This is an input interface |
| Writes to Automation Ledger? | **YES** - `AI_PROPOSAL_CREATED` event logged on each proposal |

## Failure Policy (3-Strike Rule)

1. **First Failure**: Architect rejects proposal. AI requests redraft.
2. **Second Failure**: Architect rejects proposal. AI requests redraft.
3. **Third Failure**: **BLOCK** - AI suspended for this task, reverts to manual handling.

## What This Tab Is NOT

- **A Read-Only View**: This is an execution interface (proposals)
- **Direct CRM Mutation**: Nothing happens without approval
- **Background Service**: This is the interactive path (vs Intake Hub's automated path)

## Test IDs

| Element | Test ID |
|---------|---------|
| Page Container | `page-action-console` |
| Page Title | `text-page-title` |
| Message Input | `input-action-message` |
| Send Button | `button-send-action` |
| Message Bubbles | `message-{id}` |
| View Proposal | `button-view-proposal-{proposalId}` |

## Design Tokens

| Element | Token |
|---------|-------|
| Header | `bg-glass-surface`, `border-glass-border` |
| Message Bubbles | `rounded-[1.5rem]`, `bg-glass-surface` or `bg-muted/50` |
| Input Container | `rounded-[2rem]`, glow effect on focus |
| Primary Icon Container | `bg-primary`, `shadow-primary/20` |
