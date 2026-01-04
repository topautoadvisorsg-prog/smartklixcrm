## Overview
Smart Klix CRM is a production-grade, single-tenant, white-label AI CRM automation platform designed for field service management. It automates the entire Lead → Estimate → Job → Invoice → Payment pipeline with integrated AI, enhancing business efficiency and customer relationship management. Each deployment is an isolated SaaS instance with dedicated resources, ensuring data security and compliance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Single-Tenant Isolation Model
Each customer deployment is independent, with a dedicated PostgreSQL database, isolated secrets, a separate N8N workflow runtime, and individual branding for data security and compliance.

### Frontend Architecture
The frontend is a React 18 SPA with TypeScript, utilizing Wouter for routing, TanStack Query for server state, and Shadcn UI (Radix primitives + TailwindCSS) for components. Forms are managed with React Hook Form and Zod validation. The UI features a dual-theme glassmorphic design system (dark mode default with amber accents; light mode).

Key frontend features include:
-   **Public Chat Widget**: Embeddable for lead capture with AI messaging.
-   **CRM Agent Chat**: Internal live chat for AI communication and action logging.
-   **Admin AI Assistant**: Full-featured chat UI with threading, mode switching (Draft/Assist/Auto), and context selection.
-   **Approval Hub**: Centralized dashboard for approving/rejecting AI-suggested actions.
-   **ActionGPT (External Integration Wizard)**: Configuration wizard for connecting external OpenAI Custom GPTs to the CRM Intake Hub.
-   **Streamlined Navigation**: Core CRM functionalities and dedicated sections for AI Brains and Tools.
-   **Google Workspace Page**: Unified interface for Google services (Gmail, Calendar, Sheets, Docs) via n8n webhooks.
-   **Command Center Pages**: Detailed views for Contacts and Jobs with AI recommendations.
-   **Emails Page**: Tabbed interface for managing email accounts and viewing emails.
-   **Intake Builder Page**: Custom lead capture form builder with field management and webhook generation.
-   **Pipeline Tab**: Revenue forecasting and booking state machine with 5 fixed stages, role-based permissions, and a conversion wizard.

### Pipeline Tab (Booking-First State Machine)
The Pipeline governs the lifecycle of revenue opportunities through 5 fixed stages: New Request, Qualification, Negotiation, Approved (Gate), and Booked (Locked). Strict rules enforce linear progression, and specific conditions must be met for stage transitions. Role-based permissions control access and actions within the pipeline.

### Backend Architecture
The backend is built with Express.js, featuring a storage layer, pipeline operations for field service workflows, a Master Architect AI agent, and AI tools for OpenAI function calling.

### Database Schema
Utilizes PostgreSQL with Drizzle ORM. Core entities include `users`, `contacts`, `jobs`, `appointments`, `estimates`, `invoices`, `payments`, `notes`, `files`, `auditLog`, and AI-related tables for reflection, tasks, and configuration. JSONB fields are used for flexible data structures.

**AI Configuration:**
-   `ai_settings`: Unified configuration with per-entity prompt columns and shared company knowledge/behavior rules.
-   `ai_voice_dispatch_config`: Dispatch metadata for the external AI Voice Server.

**HARDCODED ActionAI Prompt Architecture:**
-   **Base Prompt**: A hardcoded foundation prompt (ACTION_AI_BASE_PROMPT) used by all clients.
-   **Layering**: Database `ai_settings.actionAiPrompt` adds "Additional Instructions" on top of the base.
-   **Structure**: Base prompt includes tool capabilities, multi-step workflow guidance, contact safety rules, and anti-patterns.
-   **Client Customization**: Clients can add `companyKnowledge`, `behaviorRules`, and custom `actionAiPrompt` in the database.

### AI Agent System (Master Architect)
The Master Architect provides a unified execution pipeline for AI interactions, operating in Draft, Assist, and Auto modes. It uses OpenAI function calling for CRM operations, and the Approval Hub manages AI and automation workflows.

### AI Voice System (Authority Boundary)
The CRM's AI Voice system acts solely as a **dispatch and observability surface**. All AI intelligence, behavior, and processing logic reside on an external AI Voice Server. The CRM's "Dispatch Tab" issues voice missions, and the "Logs Tab" provides read-only observability.

### ActionGPT System (External Integration Wizard)
ActionGPT is a **non-operational setup wizard** for configuring external OpenAI Custom GPTs to send data securely to the CRM Intake Hub. It provides OpenAPI schema and authentication credentials for ingress, along with a connectivity debugger. It does not accept manual instructions, draft proposals, or execute CRM actions.

### AI Settings (Constitution & Configuration Console)
AI Settings serves as the **System Constitution**, defining the purpose, behavior, and constraints of each AI entity. It's an active configuration console for tuning AI "Brains."

The architecture includes four AI entities:
1.  **Edge Agent**: Captures and normalizes inbound signals from public channels.
2.  **Discovery AI**: Read-only, answers queries about business state.
3.  **ActionAI CRM**: The operational brain that proposes actions, drafts, and updates, requiring governance approval.
4.  **Master Architect**: Validates ActionAI proposals against business logic and safety schemas.

### Information AI Chat (Official Definition)
Information AI Chat is a **read-only conversational interface** for retrieving and reasoning over existing system data (CRM, ledger summaries, queue status) using natural language. It cannot create proposals, execute actions, modify data, change its own settings, or write to the automation ledger.

### Governance Flow (Authority Boundary)
The CRM enforces a strict governance flow for all AI actions. Read operations execute immediately. Write operations follow a full governance pipeline: AI proposes actions in the Action Console Chat, which are sent to a Review Queue. The Master Architect auto-validates proposals. Approved entries appear in Ready Execution for operator authorization and execution. All steps are logged to an automation ledger.

### Neo8 Governance Hardening
Production-grade safety features include:
-   **Idempotency Keys**: Prevent duplicate executions.
-   **Global Kill Switch**: An `ai_settings` flag and API endpoints to emergency stop/resume all AI executions.
-   **Reasoning Traces**: Capture AI decision rationale for a full audit trail.
-   **Rejection Escalation**: After multiple rejections, entries are escalated for human review.
-   **Handle Manually**: Allows operators to resolve entries outside the AI system.
-   **Soft-Delete Only**: Prevents hard-delete operations via a `BLOCKED_TOOLS` list.

### Multi-Company Support
The `companyInstructions` table enables per-company AI configuration, custom behavior, channel settings, pipeline stages, and tool permission overrides.

### Email and Intake Builder
Includes database tables for `email_accounts`, `emails`, `intakes` (custom form builder), `intake_fields`, and `intake_submissions`, supporting CRUD operations and public webhook endpoints.

### Audit System
Critical operations are logged to the `auditLog` table for compliance and debugging.

### N8N Workflow Automation Flows
Eight core N8N flows manage functionalities such as Lead Intake, Follow-Up, AI Receptionist, Stripe Payment/Events, Google Workspace integration, Master Architect Review, and WhatsApp Messaging.

### Neo8 Integration Contracts
The CRM manages intent, retries, approvals, memory, and escalation, while Neo8 (n8n) focuses on execution and callbacks. This separation ensures the Master Architect and Approval system remain within the CRM.

**Neo8 Callback Endpoint:**
-   `POST /api/neo8/callback`: n8n calls this after completing external actions, updating the `automation_ledger` with results and persisting document artifacts.

### Document Artifacts System
The `document_artifacts` table stores external document IDs (Google Docs, Sheets) created via n8n, enabling ActionAI to automatically resolve document handles for subsequent operations. A `resolve_document` tool allows read-only lookup of existing documents by context.

### Action Classification (INTERNAL vs EXTERNAL)
Actions are classified as INTERNAL (direct CRM state mutations, executed directly by CRM) or EXTERNAL (touching the outside world via Neo-8, dispatched to Neo-8 for execution).

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