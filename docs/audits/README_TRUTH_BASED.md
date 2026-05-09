# Smart Klix CRM - Truth-Based Architecture Documentation

**Version:** 2.1.0  
**Last Updated:** April 18, 2026  
**Status:** Production-Ready  
**Principle:** Single source of truth for what is IMPLEMENTED, not what was intended

---

## 1. PROPOSAL SYSTEM (What Actually Exists)

### Flow: Admin Chat → Proposal → External Execution

```
User types in Admin Chat
  ↓
POST /api/admin-chat/message
  ↓
admin-chat-service.ts → OpenAI chat.completions.create()
  ↓
OpenAI returns tool_calls (create_contact, create_job, etc.)
  ↓
For each tool_call:
  1. validator.ts → reviewProposal() [VALIDATION GATE]
  2. If approved + requiresHumanApproval:
     → queueToolForApproval()
     → storage.createStagedProposal()
     → DB WRITE to staged_proposals table
  3. If approved + NO requiresHumanApproval:
     → executeTool() immediately
  4. If rejected:
     → Skip, log rejection
  ↓
Response to frontend: { actions: [{ status: "queued", proposalId: "abc-123" }] }
  ↓
Frontend shows toast notification with "View Queue" button
  ↓
User navigates to /review-queue
  ↓
User approves proposal → POST /api/proposals/:id/approve
  ↓
User executes proposal → POST /api/proposals/:id/execute
  ↓
agent-dispatcher.ts → dispatchToAgent() → POST to AGENT_WEBHOOK_URL
  ↓
External agent processes and reports back via /api/agent/callback
```

### Files Involved

| File | Purpose | Lines |
|------|---------|-------|
| `server/admin-chat-service.ts` | Admin chat + proposal creation | 631 |
| `server/validator.ts` | Simple validation function (NOT AI) | 309 |
| `server/agent-dispatcher.ts` | External webhook dispatch | 70 |
| `server/ai-tools.ts` | AI tool definitions + execution | 2283 |
| `server/routes.ts` | API endpoints | 8404 |
| `server/storage.ts` | Database operations | 3491 |
| `client/src/components/AdminChatPanel.tsx` | Admin chat UI | 350 |
| `client/src/pages/ReviewQueue.tsx` | Proposal review UI | 370 |

### Database Tables

**staged_proposals** - Canonical proposal queue
```sql
CREATE TABLE staged_proposals (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, dispatched
  actions JSONB NOT NULL,                   -- [{ tool: "create_contact", args: {...} }]
  reasoning TEXT,
  risk_level TEXT,                          -- low, medium, high
  summary TEXT,
  related_entity JSONB,
  approved_by TEXT,
  approved_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  user_id TEXT,
  origin TEXT DEFAULT 'ai_chat',            -- admin_chat, ai_chat, intake
  user_request TEXT,
  validator_decision TEXT,                  -- approve, reject
  validator_reason TEXT,
  requires_approval BOOLEAN DEFAULT TRUE,
  mode TEXT                                 -- draft, assist, auto
);
```

**audit_log** - Event logging (simplified schema)
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,                     -- e.g., "ai_action_queued"
  entity_type TEXT,                         -- e.g., "admin_chat", "proposals"
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### Key Implementation Details

**1. Validator runs BEFORE DB write**
- File: `server/admin-chat-service.ts:517`
- Function: `reviewProposal(proposal)` from `validator.ts`
- Returns: `{ decision: "approve"|"reject", riskLevel, requiresHumanApproval }`

**2. Proposal creation conditional**
- File: `server/admin-chat-service.ts:539-571`
- Creates proposal ONLY when:
  - ✅ Validator decision = "approve"
  - ✅ AND `requiresHumanApproval = true`
  - ✅ AND tool is NOT read-only

**3. Frontend response handling** (Fixed April 18, 2026)
- File: `client/src/components/AdminChatPanel.tsx:91-120`
- Captures `response.actions` array
- Shows toast notification for queued proposals
- Provides "View Queue" button → navigates to `/review-queue`
- Invalidates `/api/proposals` cache

### API Endpoints

| Endpoint | Method | Purpose | File:Line |
|----------|--------|---------|-----------|
| `/api/admin-chat/message` | POST | Send message to admin chat (creates proposals) | routes.ts:6298 |
| `/api/proposals` | GET | List all proposals | routes.ts:4032 |
| `/api/proposals/:id/approve` | POST | Approve proposal | routes.ts:4044 |
| `/api/proposals/:id/reject` | POST | Reject proposal | routes.ts:4080 |
| `/api/proposals/:id/execute` | POST | Execute proposal (dispatch to agent) | routes.ts:4110 |
| `/api/agent/callback` | POST | Receive agent execution report | routes.ts:429 |

---

## 2. AI VALIDATION (Simple Function - NOT AI)

### What It Is

**File**: `server/validator.ts` (309 lines)  
**Type**: Pure function, stateless, rule-based  
**NOT**: AI, LLM, or complex system

### How It Works

```typescript
export function reviewProposal(proposal: ValidationProposal): ValidationDecision {
  // 1. Validate schema with Zod
  const validated = validationProposalSchema.parse(proposal);
  
  // 2. Assess risk level (low/medium/high)
  const riskLevel = assessRiskLevel(validated.action);
  
  // 3. Check if human approval required
  const requiresHumanApproval = requiresHumanApprovalCheck(validated.action, riskLevel);
  
  // 4. Validate required fields
  const fieldValidation = validateRequiredFields(validated);
  if (!fieldValidation.valid) return { decision: "reject", ... };
  
  // 5. Apply business rules
  const businessRuleCheck = applyBusinessRules(validated);
  if (!businessRuleCheck.approved) return { decision: "reject", ... };
  
  // 6. Return decision
  return { decision: "approve", reason: "...", riskLevel, requiresHumanApproval };
}
```

### Validation Rules

**High-risk actions** (always require human approval):
- delete_contact, delete_job, delete_invoice
- refund_payment, update_payment_amount

**Medium-risk actions** (require human approval):
- create_job, update_job, create_estimate
- create_invoice, send_invoice, record_payment

**Low-risk actions** (can execute immediately):
- create_contact, search_contacts, get_contact_details
- create_note, update_note

---

## 3. EXTERNAL AGENT INTEGRATION (What Actually Exists)

### Outbound: Proposal Dispatch

**File**: `server/agent-dispatcher.ts` (70 lines)

**Function**: `dispatchToAgent(proposal)`

**When called**: Only from `/api/proposals/:id/execute` route

**Payload structure**:
```json
{
  "proposalId": "uuid",
  "summary": "Create contact and job",
  "actions": [
    { "tool": "create_contact", "args": { "name": "John" } },
    { "tool": "create_job", "args": { "title": "House Cleaning" } }
  ],
  "reasoning": "User requested via admin chat",
  "approvedBy": "admin-user",
  "approvedAt": "2026-04-18T10:30:00.000Z",
  "relatedEntity": { "type": "contact", "id": "uuid" },
  "timestamp": "2026-04-18T10:35:00.000Z"
}
```

**Configuration required**:
```bash
AGENT_WEBHOOK_URL=https://your-agent-system.com/webhook
AGENT_WEBHOOK_SECRET=your-secret-key
```

### Inbound: Agent Callback

**Endpoint**: `POST /api/agent/callback`  
**File**: `server/routes.ts:429-471`

**Purpose**: External agent reports execution results back to CRM

**Payload expected**:
```json
{
  "proposalId": "uuid",
  "status": "completed",
  "result": { "messageId": "twilio_msg_123" },
  "timestamp": "2026-04-18T10:40:00.000Z"
}
```

### What Does NOT Exist (Not Implemented)

❌ **Event-based webhooks** - No automatic webhooks on lead_created, pipeline_changed, etc.  
❌ **11 event types** - README previously listed these, but they don't exist  
❌ **`/api/agents/report`** - Endpoint doesn't exist (callback is `/api/agent/callback`)  
❌ **N8N integration** - Removed, replaced with agent webhook system  
❌ **Neo8 engine** - Conceptual only, not implemented  

---

## 4. ADMIN CHAT & OPERATIONAL MODES

### What It Is

**File**: `client/src/components/AdminChatPanel.tsx` (350 lines)  
**Purpose**: Interactive AI chat for CRM operations  
**NOT**: Headless engine, not automated intake processing

### Three Modes

| Mode | Behavior | Implementation |
|------|----------|----------------|
| **draft** | AI suggests actions, user manually creates | NOT FULLY IMPLEMENTED |
| **assist** | AI creates proposals, user approves | ✅ WORKING (default) |
| **auto** | AI executes low-risk immediately, proposes high-risk | ✅ WORKING |

### How It Works

1. User types message in Admin Chat UI
2. Frontend sends to `POST /api/admin-chat/message`
3. Backend calls OpenAI with:
   - System prompt (CRM agent instructions)
   - Conversation history (last 20 messages)
   - Available tools (26 AI tools from ai-tools.ts)
4. OpenAI returns response with optional tool_calls
5. For each tool_call:
   - Run validator
   - If approved + requires approval → Create proposal
   - If approved + no approval needed → Execute immediately
   - If rejected → Skip
6. Return response to frontend with actions array
7. Frontend shows toast if proposals created

### What Does NOT Exist

❌ **Headless Engine** - Automated proposal generation from intake forms  
❌ **Dual input paths** - Only admin chat creates proposals, not automated triggers  
❌ **3-Strike Rule** - No failure tracking or suspension  

---

## 5. KNOWN LIMITATIONS & MISSING FEATURES

### Not Implemented (Documented for Clarity)

1. **Event-based webhook system**
   - README previously listed 11 event types
   - NOT implemented - only proposal dispatch exists
   - Planned: Future enhancement

2. **Headless proposal engine**
   - Intake forms collect data but DON'T trigger proposals
   - Only admin chat creates proposals
   - Planned: Connect intake forms to proposal generation

3. **4-Entity Architecture**
   - README mentioned: Edge Agent, Discovery AI, ActionAI CRM, Master Architect
   - NOT implemented - single AI config only
   - Conceptual framework only

4. **Master Architect AI**
   - Removed during simplification
   - Replaced with `validator.ts` simple function
   - No AI involved in validation

5. **Ready Execution page**
   - Exists at `/ready-execution`
   - NOT connected to proposal workflow
   - Proposals approved/executed from Review Queue page

6. **Ledger schema mismatch**
   - README describes 6 required fields (ledgerAnchorType, eventType, etc.)
   - Actual schema has different fields (action, entityType, entityId)
   - Planned: Align schema with README contract

7. **3-Strike Rule for AI failures**
   - Not implemented
   - No failure tracking or suspension
   - Planned: Future safety feature

### Known Bugs

1. **Frontend proposal visibility** (Fixed April 18, 2026)
   - **Issue**: Admin Chat ignored response.actions array
   - **Impact**: Users couldn't see created proposals
   - **Fix**: Updated AdminChatPanel.tsx onSuccess handler
   - **Status**: ✅ Fixed

---

## 6. PROJECT STRUCTURE (What Actually Exists)

```
smart-klix-crm/
├── client/src/
│   ├── components/
│   │   ├── AdminChatPanel.tsx        # Admin chat UI (proposal creation)
│   │   └── ui/                        # Shadcn UI primitives
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Contacts.tsx
│       ├── Jobs.tsx
│       ├── Pipeline.tsx
│       ├── ReviewQueue.tsx           # Proposal approval UI
│       ├── ReadyExecution.tsx        # NOT connected to proposal flow
│       ├── AISettings.tsx            # AI configuration
│       └── InformationAIChat.tsx     # Read-only chat (no proposals)
│
├── server/
│   ├── routes.ts                     # All API endpoints (8404 lines)
│   ├── admin-chat-service.ts         # Admin chat + proposal creation (631 lines)
│   ├── validator.ts                  # Simple validation function (309 lines)
│   ├── agent-dispatcher.ts           # External webhook dispatch (70 lines)
│   ├── ai-tools.ts                   # AI tool definitions (2283 lines)
│   ├── storage.ts                    # Database operations (3491 lines)
│   └── db.ts                         # Database connection
│
├── shared/
│   └── schema.ts                     # Drizzle ORM schemas + Zod validation
│
└── drizzle/
    ├── 006_hardening_sprint.sql      # staged_proposals table creation
    └── 007_unify_approval_queues.sql # Governance columns
```

---

## 7. API REFERENCE (Core Endpoints)

### Health Check
```
GET /api/health
Response: { status: "healthy", database: "connected", ai_agent: "ready" }
```

### Admin Chat (Proposal Creation)
```
POST /api/admin-chat/message
Body: { conversationId: "uuid", message: "Create contact John", contactId?: "uuid" }
Response: { message: {...}, actions: [{ tool: "create_contact", status: "queued", reason: "..." }] }
```

### Proposal Management
```
GET /api/proposals?status=pending|approved|all
Response: Array of proposals

POST /api/proposals/:id/approve
Response: Updated proposal (status: "approved")

POST /api/proposals/:id/reject
Body: { reason?: "string" }
Response: Updated proposal (status: "rejected")

POST /api/proposals/:id/execute
Response: { success: true, message: "Proposal dispatched" }
```

### Agent Callback
```
POST /api/agent/callback
Headers: { X-Webhook-Secret: "your-secret" }
Body: { proposalId: "uuid", status: "completed", result: {...} }
Response: { success: true }
```

---

## 8. ENVIRONMENT VARIABLES

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### AI Integration
```bash
OPENAI_API_KEY=sk-proj-...  # OpenAI API key
```

### External Agent (Optional)
```bash
AGENT_WEBHOOK_URL=https://your-agent-system.com/webhook
AGENT_WEBHOOK_SECRET=your-secret-key
```

### Branding (Optional)
```bash
TENANT_NAME="Your Company"
TENANT_LOGO_URL=https://example.com/logo.png
```

---

## 9. WHAT WAS SIMPLIFIED (Removed Features)

The following were removed to simplify architecture:

❌ Master Architect AI orchestration  
❌ N8N internal integration  
❌ Automation Ledger complex state tracking  
❌ AI Memory systems (embeddings, importance scores)  
❌ Internal messaging execution (email, SMS, WhatsApp)  
❌ Outbox dispatcher  
❌ Neo8 event system  
❌ 4-Entity Architecture (Edge Agent, Discovery AI, etc.)  
❌ Event-based webhook system (11 event types)  
❌ Headless proposal engine  

**Total removed:** ~9,500 lines across 32 files  
**Replacement:** Simple validator function + proposal system + external agent webhook

---

## 10. QUICK START

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key

### Setup
```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Verify
```bash
curl http://localhost:5000/api/health
# Expected: { status: "healthy", database: "connected", ai_agent: "ready" }
```

### Test Proposal System
1. Open http://localhost:5000/admin-chat
2. Send message: "Create job for house cleaning"
3. Toast notification should appear: "1 proposal(s) created"
4. Click "View Queue" button
5. Proposal should be visible in Review Queue
6. Approve and execute proposal

---

## 11. TROUBLESHOOTING

### Proposals Not Appearing
- Check browser console for errors
- Verify `POST /api/admin-chat/message` returns actions array
- Check Review Queue page directly at `/review-queue`
- Verify database: `SELECT * FROM staged_proposals WHERE status = 'pending';`

### External Dispatch Failing
- Check `AGENT_WEBHOOK_URL` is set in .env
- Verify webhook endpoint is accessible
- Check server logs: `Failed to execute proposal: AGENT_WEBHOOK_URL not configured`

### OpenAI Not Working
- Check `OPENAI_API_KEY` is set in .env
- Verify key is valid: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`
- Check kill switch is not active in AI Settings

---

## 12. KNOWN ISSUES

| Issue | Status | Workaround |
|-------|--------|------------|
| Ready Execution page not connected to proposal flow | Known | Use Review Queue page instead |
| Ledger schema doesn't match README contract | Planned | Manual alignment needed |
| No event-based webhooks | Planned | Only proposal dispatch works |
| No Headless Engine for intake forms | Planned | Use admin chat manually |
| No 3-Strike Rule for AI failures | Planned | Manual monitoring required |

---

**Last Verified:** April 18, 2026  
**Next Review:** When major features added  
**Maintenance Rule:** Update this document BEFORE merging any architectural changes
