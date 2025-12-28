# Neo8/n8n Architecture Audit Report

**Date**: December 17, 2025  
**Objective**: Audit all Neo8/n8n workflows against source-of-truth architecture  
**Status**: AUDIT ONLY - No changes made

---

## Executive Summary

The current architecture has **significant overlap** between CRM and Neo8 responsibilities. Several components in the CRM codebase contain review, approval, and decision logic that should remain in CRM according to the new architecture, but the separation isn't clean.

---

## 1. Workflow Inventory Table

### CRM → Neo8 (Outbound Webhooks)

| # | Webhook Path | Trigger Location | System | Status |
|---|--------------|------------------|--------|--------|
| 1 | `/payment/create` | `server/pipeline.ts:recordPayment()` | CRM → n8n | Active |
| 2 | `/events/payment` | `server/pipeline.ts:recordPayment()` | CRM → n8n | Active |
| 3 | `/outreach/trigger` | `server/routes.ts:POST /api/contacts/:id/outreach` | CRM → n8n | Active |
| 4 | `/google/gmail` | `client/GoogleWorkspace.tsx` (frontend direct) | Frontend → n8n | Active |
| 5 | `/google/calendar` | `client/GoogleWorkspace.tsx` (frontend direct) | Frontend → n8n | Active |
| 6 | `/google/sheets` | `client/GoogleWorkspace.tsx` (frontend direct) | Frontend → n8n | Active |
| 7 | `/google/docs` | `client/GoogleWorkspace.tsx` (frontend direct) | Frontend → n8n | Active |

### Neo8 → CRM (Callback Endpoints)

| # | Endpoint | Purpose | Middleware | Status |
|---|----------|---------|------------|--------|
| 1 | `GET /api/contacts/lookup` | Lookup contact by phone | n8nVerification + InternalToken | Active |
| 2 | `POST /api/contacts/create` | Create new contact | n8nVerification + InternalToken | Active |
| 3 | `POST /api/contacts/update` | Update existing contact | n8nVerification + InternalToken | Active |
| 4 | `POST /api/leads/create` | Create lead/contact | n8nVerification + InternalToken | Active |
| 5 | `POST /api/jobs/create` | Create job | n8nVerification + InternalToken | Active |
| 6 | `POST /api/activity-log/write` | Log activity to contact | n8nVerification + InternalToken | Active |
| 7 | `POST /api/calendar/log` | Log calendar activity | n8nVerification + InternalToken | Active |
| 8 | `POST /api/email/log` | Log email activity | n8nVerification + InternalToken | Active |
| 9 | `POST /api/voice/receptionist/turn` | Voice call processing | n8nVerification + InternalToken | Active |
| 10 | `POST /api/voice/receptionist/premium/result` | Premium voice results | InternalToken | Active |
| 11 | `POST /api/voice/events` | Voice event logging | InternalToken | Active |
| 12 | `POST /api/events/update` | Neo8 event results | None visible | Active |
| 13 | `POST /api/intake/sync` | Lead intake sync | n8nVerification + InternalToken | Active |
| 14 | `POST /api/whatsapp/inbound` | WhatsApp messages | n8nVerification + InternalToken | Active |

### Legacy/Generic Dispatchers

| # | Function | Location | Purpose |
|---|----------|----------|---------|
| 1 | `dispatchNeo8Event()` | `server/neo8-events.ts` | Generic event dispatch to N8N_WEBHOOK_URL |
| 2 | `dispatchToN8nWebhook()` | `server/neo8-events.ts` | Path-based webhook dispatch |
| 3 | `dispatchIntakeToNeo8Flow()` | `server/neo8-events.ts` | Intake-specific dispatch to NEO8FLOW_URL |

---

## 2. Per-Workflow Analysis

### A. Payment Webhooks (EXECUTION-ONLY)

**Location**: `server/pipeline.ts` lines 336-380

**What it does**:
- Dispatches payment data to `/payment/create`
- Dispatches payment lifecycle event to `/events/payment`
- Includes: paymentId, invoiceId, jobId, contact info, amount, method, status

**Architecture Fit**: ✅ **FITS** - Pure execution, no decision logic

---

### B. Outreach Trigger

**Location**: `server/routes.ts` line 400

**What it does**:
- Dispatches to `/outreach/trigger` with lead/contact info
- Logs audit entry

**Architecture Fit**: ✅ **FITS** - CRM triggers, Neo8 executes

---

### C. Google Workspace (Gmail, Calendar, Sheets, Docs)

**Location**: `client/src/pages/GoogleWorkspace.tsx` lines 19-24

**What it does**:
- Frontend directly calls n8n webhooks
- After success, logs to CRM audit

**Architecture Fit**: ⚠️ **PARTIAL OVERLAP**
- Frontend bypasses backend entirely
- No CRM-side approval before execution
- Audit logging happens after n8n execution

**Recommendation**: Consider routing through backend for audit consistency

---

### D. Voice Receptionist Turn

**Location**: `server/routes.ts` line 1347

**What it does**:
- Receives voice turn from Twilio via n8n
- **Invokes Master Architect AI to process**
- Returns response for TTS

**Architecture Fit**: ⚠️ **PARTIAL OVERLAP**
- AI decision-making happens IN this endpoint
- Neo8 is just routing, CRM is making decisions
- This is correct per new architecture

---

### E. Intake Sync (Neo8Flow Callback)

**Location**: `server/routes.ts` lines 5030+

**What it does**:
- Receives processed intake from Neo8Flow
- Creates contact/job in CRM
- Handles error status from Neo8Flow

**Architecture Fit**: ✅ **FITS** - Neo8 executes intake processing, CRM stores result

---

## 3. Misalignment Findings

### FINDING 1: Master Architect Review Logic IN CRM (Correct)

**Location**: `server/master-architect.ts`

The Master Architect has three modes:
- **DRAFT**: Suggests actions, asks for approval
- **ASSIST**: Queues actions for approval
- **AUTO**: Executes immediately

This is **CORRECTLY** in CRM. No action needed.

---

### FINDING 2: AssistQueue Approval System IN CRM (Correct)

**Location**: `server/routes.ts` lines 3272-3628, `server/storage.ts`

The approval queue system:
- Creates queue entries for pending actions
- Tracks approval status
- Executes after approval

This is **CORRECTLY** in CRM. No action needed.

---

### FINDING 3: Gated Tools Require Approval IN CRM (Correct)

**Location**: `server/ai-tools.ts` lines 380, 458, 569, 854-879

Certain tools (send_estimate, record_payment, send_invoice) are marked as "gated" and require approval.

This is **CORRECTLY** in CRM. No action needed.

---

### FINDING 4: Google Workspace Frontend Direct Calls (Minor Issue)

**Location**: `client/src/pages/GoogleWorkspace.tsx`

Frontend calls n8n directly without backend approval.

**Impact**: Low - these are user-initiated manual actions
**Recommendation**: Consider routing through backend for audit trail consistency

---

### FINDING 5: Neo8 Event Result Processing Has Logic

**Location**: `server/routes.ts` lines 3077-3214

The `/api/events/update` endpoint processes Neo8 event results and:
- Updates job status based on event type
- Handles payment link results
- Creates reflection entries

**Assessment**: This is CRM processing RESULTS from Neo8, which is correct. Neo8 doesn't make decisions here - CRM interprets the results.

---

## 4. What Neo8/n8n Currently Does (Based on CRM Integration Points)

| Workflow | Neo8 Responsibility | CRM Responsibility |
|----------|---------------------|-------------------|
| Payment Create | Execute webhook, log | Trigger, store result |
| Payment Events | Route to actions | Trigger, handle lifecycle |
| Outreach | Execute outreach sequence | Trigger, log |
| Gmail/Calendar/Sheets/Docs | Execute Google API calls | Trigger, log results |
| Voice Receptionist | Route Twilio STT/TTS | AI processing, decisions |
| Lead Intake | Process form, call CRM sync | Store contact/job |
| WhatsApp | Route messages | Store, AI processing |

---

## 5. Open Questions

1. **What review/approval logic exists in actual n8n workflows?**
   - This audit covers CRM code only
   - Need access to n8n workflow definitions to audit Neo8 side

2. **Is Neo8Flow a separate service from n8n?**
   - Code references both `N8N_WEBHOOK_URL` and `NEO8FLOW_URL`
   - Need clarification on architecture

3. **Should Google Workspace actions route through backend?**
   - Currently frontend → n8n direct
   - Audit trail is inconsistent

---

## 6. Recommendations (NO ACTION TAKEN)

### A. CRM Side (This Codebase)

1. **NO CHANGES NEEDED** to Master Architect, AssistQueue, or approval logic - these correctly live in CRM

2. **CONSIDER** routing Google Workspace calls through backend for consistent audit trail

3. **DOCUMENT** the clear boundary: CRM owns decisions, Neo8 owns execution

### B. Neo8 Side (n8n Workflows)

**Requires separate audit of actual n8n workflow definitions to identify:**
- Any "Master Architect Review" nodes
- Any approval/escalation logic
- Any decision trees that should be in CRM
- Any quality review steps

---

## Summary

The CRM codebase is **correctly structured** with review/approval logic in the right place. The main concern is whether the **n8n workflows themselves** contain duplicate decision logic that should be removed.

**Next Step**: Audit the actual n8n workflow definitions in the n8n instance at `https://ai3smartklix.app.n8n.cloud`
