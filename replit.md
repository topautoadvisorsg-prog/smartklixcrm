## Overview
Smart Klix CRM is a production-grade, single-tenant, white-label AI CRM automation platform designed for field service management. It automates the entire Lead → Estimate → Job → Invoice → Payment pipeline with integrated AI. Each deployment is an isolated SaaS instance with dedicated resources, ensuring data security and compliance. The project aims to deliver a robust, customizable CRM with advanced AI capabilities to enhance business efficiency and customer relationship management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Single-Tenant Isolation Model
Each customer deployment is independent, featuring a dedicated PostgreSQL database, isolated secrets, a separate N8N workflow runtime, and individual branding for data security and compliance.

### Frontend Architecture
The frontend is a React 18 SPA with TypeScript, using Wouter for routing, TanStack Query for server state, and Shadcn UI (Radix primitives + TailwindCSS) for components. Form handling uses React Hook Form with Zod validation. The UI employs a dual-theme glassmorphic design system (dark mode default with amber accents; light mode). Typography uses Inter for UI and JetBrains Mono for system/code data.

Key frontend features include:
-   **Public Chat Widget**: Embeddable for lead capture with AI messaging.
-   **CRM Agent Chat**: Internal live chat for AI communication and action logging.
-   **Admin AI Assistant**: Full-featured chat UI for AI interaction, supporting threading, mode switching (Draft/Assist/Auto), and contact context selection.
-   **Approval Hub**: Centralized dashboard for approving/rejecting AI-suggested actions.
-   **ActionGPT (External Integration Wizard)**: Configuration wizard for connecting external OpenAI Custom GPTs to the CRM Intake Hub. This is a setup tool only.
-   **Streamlined Navigation**: Core CRM functionalities and dedicated sections for AI Brains and Tools.
-   **Google Workspace Page**: Unified interface for Google services (Gmail, Calendar, Sheets, Docs) via n8n webhooks.
-   **Command Center Pages**: Detailed views for Contacts and Jobs with AI recommendations.
-   **Emails Page**: Tabbed interface for managing email accounts and viewing emails.
-   **Intake Builder Page**: Custom lead capture form builder with field management and webhook generation.
-   **Pipeline Tab**: Revenue forecasting and booking state machine with 5 fixed stages, role-based permissions, and conversion wizard gate.

### Pipeline Tab (Booking-First State Machine)
The Pipeline governs the lifecycle of revenue opportunities from "New Request" to "Booked Job" with strict governance gates.

**Fixed 5 Stages (Non-Configurable):**
1. New Request (0% weight)
2. Qualification (25% weight)
3. Negotiation (50% weight)
4. Approved (90% weight - Gate)
5. Booked (100% weight - Locked)

**Key Rules:**
- No skipping stages; forward movement is linear
- Booked is locked; no movement out once committed
- Cards require `hasActiveEstimate: true` to move from Negotiation → Approved
- Approved → Booked requires 4-step Conversion Wizard (non-optimistic)

**Role Enforcement:**
- **Sales/Estimator**: Can move cards up to Approved only
- **Operator**: Full authority including Booked transitions

**What Pipeline Is NOT:**
- ❌ A billing system (use Payments)
- ❌ A job scheduler (use Jobs)
- ❌ A place to edit Estimate line items (use Estimates)

**Backend Integration Status:** UI complete with mock data; backend API integration pending.

### Backend Architecture
The backend is built with Express.js, featuring a storage layer, pipeline operations for field service workflows, a Master Architect AI agent, and AI tools for OpenAI function calling.

### Database Schema
Utilizes PostgreSQL with Drizzle ORM. Core entities include `users`, `contacts`, `jobs`, `appointments`, `estimates`, `invoices`, `payments`, `notes`, `files`, `auditLog`, and AI-related tables for reflection, tasks, and configuration. JSONB fields are used for flexible data structures.

**AI Configuration Tables (December 2025 Refactor):**
- `ai_settings`: Unified configuration table with per-entity prompt columns (edgeAgentPrompt, discoveryAiPrompt, actionAiPrompt, masterArchitectPrompt), plus shared companyKnowledge and behaviorRules
- `ai_voice_dispatch_config`: Dispatch metadata only (voiceServerUrl, webhookSecret, storeTranscript, autoCreateContact, autoCreateNote) - AI behavior lives on external voice server

**HARDCODED ActionAI Prompt Architecture (December 2025):**
- **Base Prompt**: `server/ai-prompts.ts` contains the hardcoded foundation prompt (ACTION_AI_BASE_PROMPT) that ALL clients use
- **Layering**: Database `ai_settings.actionAiPrompt` is ADDITIVE - it layers on top as "Additional Instructions"
- **Structure**: Base prompt includes all tool capabilities, multi-step workflow guidance, contact safety rules, and anti-patterns
- **Client Customization**: Clients can add companyKnowledge, behaviorRules, and custom actionAiPrompt in database
- **Conversation Memory**: Action Console now includes [TOOL RESULT] and [STAGED] markers in conversation history so AI remembers prior searches and pending actions

**API Endpoints:**
- `GET/POST /api/ai/settings`: Unified AI configuration for all 4 entities
- `GET/POST /api/ai/voice-dispatch/config`: Voice dispatch metadata
- `POST /api/voice/context`: Provides caller context to external voice server
- `GET /api/voice/dispatch/config`: CRM integration flags for external voice server

### AI Agent System (Master Architect)
The Master Architect provides a unified execution pipeline for AI interactions. It operates in Draft, Assist, and Auto modes, using OpenAI function calling for CRM operations. The Approval Hub manages AI and automation workflows, facilitating continuous AI improvement.

### AI Voice System (Authority Boundary)
The CRM's AI Voice system acts as a **dispatch and observability surface only**. All AI intelligence, behavior, and processing logic reside on an external AI Voice Server. The CRM's "Dispatch Tab" issues voice missions, while the "Logs Tab" provides read-only observability of call status and transcripts. The CRM does not configure assistant personality, language processing, call handling, or prompt engineering.

### ActionGPT System (External Integration Wizard)
ActionGPT is a **non-operational setup wizard** for configuring external OpenAI Custom GPTs to send data securely to the CRM Intake Hub. It provides the OpenAPI schema and authentication credentials for ingress, along with a connectivity debugger. It explicitly does not accept manual instructions, draft proposals, or execute CRM actions. External GPT payloads are considered "untrusted" until summarized, normalized, and staged by the Intake Hub.

### AI Settings (Constitution & Configuration Console)
AI Settings serves as the **System Constitution**, allowing architects to define the purpose, behavior, and constraints of each AI entity. It's an active configuration console for tuning AI "Brains."

The architecture includes four AI entities:
1.  **Edge Agent**: Captures and normalizes inbound signals from public channels.
2.  **Discovery AI**: Read-only, answers queries about business state.
3.  **ActionAI CRM**: The operational brain that proposes actions, drafts, and updates, requiring governance approval.
4.  **Master Architect**: Validates ActionAI proposals against business logic and safety schemas.

Per-entity configuration includes Core Mandate, System Instructions, Hard Constraints, and Autonomy Level. This section also configures widget behavior for the Edge Agent and API Key Authority for the Master Architect. AI Settings defines behavior but does not control runtime, execute workflows, or manage voice engine settings.

### Information AI Chat (Official Definition)
Information AI Chat is a **read-only conversational interface** for retrieving and reasoning over existing system data (CRM, ledger summaries, queue status) using natural language. It can answer CRM and queue-related questions but **cannot** create proposals, execute actions, modify data, change its own settings, or write to the automation ledger.

### Governance Flow (Authority Boundary)
The CRM enforces a strict governance flow for all AI actions:

**Read Operations**: Execute immediately with results shown (no review needed).

**Write Operations** (full governance pipeline):
1.  **Action Console Chat**: User submits request, AI proposes actions with staged Accept/Reject buttons.
2.  **Send to Review Queue**: User clicks "Send to Review Queue" → creates AssistQueue entry (pending) + Ledger entry (proposed).
3.  **MA Validation**: Master Architect auto-validates proposal via `/api/assist-queue/:id/ma-validate`:
    - Approved: AssistQueue → approved, Ledger → ai_validated
    - Rejected: AssistQueue → rejected, Ledger → rejected
4.  **Ready Execution**: Approved entries appear in Ready Execution for operator authorization.
5.  **Operator Approval**: Operator clicks Execute → CRM tools run → final Ledger entry (executed).

**Ledger Write Points** (dual-write architecture):
- First write: When proposal is created (status: proposed)
- Second write: When execution completes (status: executed)

**Key API Endpoints**:
- `POST /api/ai/staged/accept`: Send staged actions to Review Queue
- `POST /api/assist-queue/:id/ma-validate`: MA validates pending entry
- `POST /api/ready-execution/:id/execute`: Operator executes approved entry
- `GET /api/automation-ledger`: View all ledger entries

This flow ensures no AI action bypasses review, and all write steps are logged.

### Multi-Company Support
The `companyInstructions` table enables per-company AI configuration, custom behavior, channel settings, pipeline stages, and tool permission overrides.

### Email and Intake Builder
Includes database tables for `email_accounts` (IMAP/SMTP config), `emails` (storage with threading), `intakes` (custom form builder), `intake_fields` (field types, validation, entity mapping), and `intake_submissions` (webhook payload storage), supporting CRUD operations and public webhook endpoints.

### Audit System
Critical operations (user, AI, and pipeline triggered) are logged to the `auditLog` table for compliance and debugging.

### N8N Workflow Automation Flows
Eight core N8N flows manage functionalities such as Lead Intake, Follow-Up, AI Receptionist, Stripe Payment/Events, Google Workspace integration, Master Architect Review, and WhatsApp Messaging.

### Neo8 Integration Contracts
The CRM manages intent, retries, approvals, memory, and escalation, while Neo8 (n8n) focuses on execution and callbacks. This separation ensures the Master Architect and Approval system remain within the CRM, enforcing gated tools and requiring approval.

### Action Classification (INTERNAL vs EXTERNAL)
All actions are classified as either INTERNAL (direct CRM state mutations) or EXTERNAL (touching the outside world via Neo-8). INTERNAL actions are executed directly by the CRM and never sent to Neo-8. EXTERNAL actions are dispatched to Neo-8 for execution, which handles retries and callbacks, and the CRM never executes them directly. A `GOVERNANCE VIOLATION` error is thrown if an EXTERNAL tool is called without Neo-8 dispatch.

## External Dependencies

-   **PostgreSQL Database**: Configured via `DATABASE_URL`, managed by Drizzle ORM.
-   **OpenAI API**: Used for the Master Architect agent and function calling.
-   **N8N Workflow Automation**: External service for workflow orchestration via webhooks.
-   **Stripe**: For payment processing.
-   **Twilio**: For SMS communication and voice (STT/TTS).
-   **SendGrid**: For email communication.
-   **Radix UI Primitives**: For unstyled, accessible UI components.
-   **TanStack Query**: For server state management and caching.
-   **React Hook Form**: For form state and validation with Zod schemas.