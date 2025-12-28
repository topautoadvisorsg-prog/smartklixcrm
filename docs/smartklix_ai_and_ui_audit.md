# Smart Klix CRM - AI & UI Audit Report

**Date:** November 26, 2025  
**Auditor:** AI Agent  
**Purpose:** Pre-integration review before n8n and Twilio wiring

---

## Executive Summary

This audit evaluates the Smart Klix CRM from navigation structure, AI architecture, configuration completeness, and code quality perspectives. The goal is to identify issues that should be fixed before moving into n8n and Twilio integration.

**Key Findings:**
1. Navigation has redundancy and naming confusion
2. PublicChatService bypasses Master Architect (architecture violation)
3. Tool permissions exist in 3 separate locations (duplication risk)
4. ActionGPT Config and GPT Actions should be merged
5. AI Receptionist is ready for n8n integration

---

## 1. Navigation and Tab Structure

### Current Navigation Map

**Main Section:**
- Dashboard
- Contacts
- Jobs
- Estimates
- Invoices
- Payments
- Calendar
- Pipeline

**AI Brains Section:**
- CRM Agent Chat
- CRM Agent Config
- ActionGPT Config
- AI Receptionist
- Master Architect

**Tools Section:**
- GPT Actions
- Settings

### Hidden/Orphaned Pages (exist but not in sidebar)

| Page | Route | Purpose | Verdict |
|------|-------|---------|---------|
| AdminChat | /ai-assistant | Legacy chat page | **Should be removed or redirected** |
| ChatWidget | /chat-widget | Widget appearance config | **Should be in Settings or merged with CRM Agent Config** |
| MasterArchitectHub | Not routed | Approval hub | **Should replace current Master Architect page or be a tab within it** |
| SystemWatcher | /system-watcher | Debug tool | **Development only, keep hidden** |
| PublicContact | /public-contact | Lead form | **Public endpoint, keep unlinked** |
| widget-demo | /widget-demo | Widget testing | **Development only, keep hidden** |

### Problems Identified

**1. Confusing AI Naming**
- "CRM Agent Chat" and "CRM Agent Config" are clear
- "ActionGPT Config" is unclear - what is ActionGPT?
- "GPT Actions" sounds like the same thing as ActionGPT
- Non-technical users will be confused about the difference

**2. GPT Actions vs ActionGPT Config Redundancy**
- ActionGPT Config: Setup guide, workflows, settings, n8n health
- GPT Actions: Execution logs and action history

These are logically the same feature area split across two pages.

**3. Master Architect Role Unclear**
- The page shows settings AND a task queue feed
- MasterArchitectHub exists but is not in navigation
- Users won't understand "Master Architect" is the brain behind everything

**4. ChatWidget is Orphaned**
Widget appearance settings are not accessible from navigation. This is a config page that belongs with other configs.

### Recommended Navigation Structure

```
Main
├── Dashboard
├── Contacts
├── Jobs
├── Estimates
├── Invoices
├── Payments
├── Calendar
└── Pipeline

AI & Automation
├── AI Chat                  (was: CRM Agent Chat)
├── AI Configuration         (was: CRM Agent Config, absorbs ChatWidget)
├── Voice Receptionist       (was: AI Receptionist)
├── ChatGPT Actions          (merged: ActionGPT Config + GPT Actions)
│   ├── Tab: Setup Guide
│   ├── Tab: Workflows
│   ├── Tab: Action Logs     (was: GPT Actions page)
│   └── Tab: Settings
└── Master Architect         (kept as approval hub + brain settings)

Settings
├── System Settings
├── Users & Security
```

---

## 2. AI Architecture Analysis

### Current Channel Routing

| Channel | Entry Point | Routes Through Master Architect? |
|---------|-------------|----------------------------------|
| CRM Agent Chat | `/api/ai/chat/internal` | Yes (via AdminChatService) |
| Widget Chat | `/api/widget/message` | **NO - Uses PublicChatService directly** |
| ChatGPT Actions | `/api/ai/gpt-actions/*` | Yes |
| Voice Receptionist | `/api/voice/receptionist/turn` | Yes (with channel="voice") |

### Critical Architecture Issue

**PublicChatService does NOT route through Master Architect.**

In `server/public-chat-service.ts`, the widget chat calls OpenAI directly:

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: chatMessages,
  temperature: 0.7,
  max_tokens: 500,
});
```

This violates the single-brain architecture. Widget chats:
- Do not use the configured model (uses hardcoded gpt-4-turbo-preview)
- Do not apply tool permissions
- Do not log to aiTasks or assistQueue
- Do not benefit from reflection or audit logging

**Resolution:** Refactored PublicChatService to route through MasterArchitect with channel="widget" and appropriate tool restrictions.

### What Works Well

1. **Channel Parameter**: Master Architect accepts a `channel` parameter (crm_chat, gpt_actions, voice)
2. **Tool Permission Filtering**: `getFilteredTools()` applies channel-specific permissions correctly
3. **Mode System**: Draft/Assist/Auto modes work as designed
4. **Reflection Loop**: Self-reflection and revision works for complex requests

---

## 3. Per-Tab AI Configuration Evaluation

### CRM Agent Chat
**Purpose:** Internal chat interface for testing AI actions

**What Works:**
- Clean chat UI with message threading
- Shows AI thinking state
- Displays action badges when tools are called
- Links to GPT Actions for logs

### CRM Agent Config
**Purpose:** Configure AI instructions and knowledge base

**What Works:**
- Clear separation: Widget vs Internal instructions
- Company knowledge base section
- Behavior rules section

### ActionGPT Config (Now merged into ChatGPT Actions)
**Purpose:** ChatGPT integration setup and workflow management

**What Works:**
- ChatGPT setup guide with base URL and OpenAPI schema
- Workflow enable/disable toggles
- Execution history tab
- N8N health panel

### AI Receptionist
**Purpose:** Configure voice AI for phone calls

**What Works:**
- 5 clear sections: Mode/Provider, Behavior, Tools, Call Handling, Logging
- Economy tier flow documented
- Per-channel tool permissions with mode restrictions
- n8n integration notes field

### Master Architect
**Purpose:** Core AI brain settings and approval queue

**What Works:**
- Model selection and generation parameters
- Tool permissions with Draft/Assist/Auto mode controls
- Pending approvals list (via assistQueue)

---

## 4. Readiness for n8n and Twilio

### ActionGPT / GPT Actions - n8n Readiness

| Aspect | Status | Notes |
|--------|--------|-------|
| Base URL endpoint | Ready | Documented in ChatGPT Setup tab |
| OpenAPI schema | Ready | Available for n8n HTTP Request nodes |
| Webhook receiver | Ready | `/api/ai/gpt-actions/execute` accepts POST |
| N8N Health Panel | Ready | Shows webhook status and connection |
| Webhook signature verification | **Added** | Verifies HMAC signatures on incoming webhooks |
| Action logging | Ready | All executions logged to aiTasks |

### AI Receptionist - Twilio Readiness

| Aspect | Status | Notes |
|--------|--------|-------|
| Turn endpoint | Ready | `/api/voice/receptionist/turn` working |
| Response format | Ready | Returns reply_text, actions_taken, metadata |
| Channel routing | Ready | Uses channel="voice" through Master Architect |
| Tool permissions | Ready | Per-channel permissions configured |
| Transcript storage | Configurable | Toggle in config page |

---

## 5. Changes Made in This Audit

### High Priority Fixes Implemented

1. **PublicChatService now routes through Master Architect**
   - Uses channel="widget" 
   - Respects configured model and tool permissions
   - Logs to audit trail

2. **Unified ChatGPT Actions page**
   - Merged ActionGPT Config and GPT Actions
   - Tabs: Config, Tools, Logs
   - Single source of truth for ChatGPT integration

3. **Tool permissions unified**
   - Master Architect config is the single source
   - Channel configs can override but inherit from global

4. **Webhook signature verification added**
   - HMAC-SHA256 verification for n8n webhooks
   - Configurable secret key
   - Signature failures logged

5. **Navigation improvements**
   - Clearer naming in AI section
   - Channel filter in approval views

---

*End of Audit Report*
