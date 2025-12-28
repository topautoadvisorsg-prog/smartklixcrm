# Smart Klix CRM Documentation

## Overview
Smart Klix CRM is a production-grade, single-tenant, white-label AI CRM automation platform for field service management. It orchestrates the entire Lead → Estimate → Job → Invoice → Payment pipeline with integrated AI automation.

## Navigation Structure

### Core Operations
| Tab | Purpose | Mutation Level |
|-----|---------|----------------|
| Dashboard | Operational snapshot | Read-only |
| Contacts | Customer management | Full CRUD |
| Intake | Lead capture forms | Full CRUD |
| Pipeline | Deal stage management | Full CRUD |
| Jobs | Work order management | Full CRUD |
| Calendar | Scheduling | Full CRUD |
| Estimates | Quote generation | Full CRUD |
| Payments | Payment tracking | Read + Process |
| Pricebook | Service catalog | Full CRUD |

### AI Brains
| Tab | Purpose | Mutation Level |
|-----|---------|----------------|
| Read Chat | AI discovery interface | Read-only |
| Action Console | Action proposal drafting | Proposal only |
| Review Queue | AI-only observability | Read-only |
| Ready Execution | Human approval + execution | Execute |
| Automation Ledger | Immutable event log | Append-only |
| AI Voice | Voice receptionist config | Full CRUD |
| ChatGPT Actions | External AI integration | Full CRUD |
| AI Settings | Agent configuration | Full CRUD |

### Marketing & Tools
| Tab | Purpose | Mutation Level |
|-----|---------|----------------|
| Funnels | Lead funnels | Full CRUD |
| Social Planner | Social media scheduling | Full CRUD |
| Email | Email management | Full CRUD |
| WhatsApp | WhatsApp messaging | Full CRUD |
| Google Workspace | Google integrations | Full CRUD |
| Marketplace | Integration marketplace | Read + Install |

## Architecture Principles

### Separation of Concerns
1. **Read Chat** (0% mutation): Pure discovery, AI answers questions
2. **Action Console** (proposal only): AI drafts actions, never executes
3. **Review Queue** (AI observability): See what AI is doing/thinking
4. **Ready Execution** (human authority): Human approves and executes

### Automation Ledger
- Immutable append-only log
- Cryptographic hash chaining for audit integrity
- Trace IDs link related events
- 4-state lifecycle: pending → approved → executed → rejected

## Tab Documentation
See individual tab documentation in `/docs/tabs/`:
- [dashboard.md](./tabs/dashboard.md)
- Additional tabs documented as implemented

## Design System
- Glassmorphic aesthetic with `bg-glass-surface` and `border-glass-border` tokens
- Dark mode default with cool blue-white light mode
- Inter for UI typography, JetBrains Mono for system data
- Minimal shadows, subtle 1px borders for depth
