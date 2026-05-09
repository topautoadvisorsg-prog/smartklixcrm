# Smart Klix CRM - 3-Phase System Transition Plan

## PHASE 1 — "CLOSE THE LOOP" (CRITICAL FIXES - NON-NEGOTIABLE)

**These must be completed before ANY other work:**

### 1.1 Fix External Execution Contract

**Problem**: Fragmented integration system with N8N, partial webhooks, scattered dispatch logic

**Solution**: Create ONE unified Agent Execution Gateway

**Replace**:
- N8N webhook calls
- Partial email/WhatsApp/payment dispatch
- Scattered integration code

**With**: Agent Execution Gateway with unified contract

**Required Endpoints**:
```
POST {AGENT_WEBHOOK_URL}/execute/whatsapp
POST {AGENT_WEBHOOK_URL}/execute/email
POST {AGENT_WEBHOOK_URL}/execute/payment
POST {AGENT_WEBHOOK_URL}/execute/task
```

**Contract Requirements**:
- ✔ `correlationId` REQUIRED in all payloads
- ✔ Ledger write REQUIRED before dispatch
- ✔ Callback handler REQUIRED for completion
- ✔ Standardized error handling

**Files to Modify**:
- `server/agent-dispatcher.ts` - Add routing to specific endpoints
- `server/routes.ts` - Migrate email/WhatsApp from N8N to agent dispatcher
- Create `server/agent-contracts.ts` - Define payload schemas

### 1.2 Close Ledger Loop (CRITICAL)

**Missing Events**:
- `PROPOSAL_EXECUTED` - When proposal successfully dispatched
- `PROPOSAL_DISPATCHED` - When sent to external agent
- `PROPOSAL_FAILED` - When external execution fails
- `INTAKE_PROCESSED` - When intake submission processed
- `EXTERNAL_CALLBACK_RECEIVED` - When agent callback received

**Files to Modify**:
- `server/routes.ts` line 4107-4158 (proposal execution) - Add ledger write
- `server/routes.ts` line 429 (agent callback) - Add `EXTERNAL_CALLBACK_RECEIVED`
- `server/routes.ts` intake handler - Add `INTAKE_PROCESSED`
- `server/pipeline.ts` `finalizeAction()` - Add execution events

**Impact**: Without these, ledger is incomplete history, not system truth

### 1.3 Add Correlation Spine (VERY IMPORTANT)

**Requirement**: Every system component MUST share `correlationId: uuid`

**Used Across**:
1. AI proposal creation
2. Ledger entries
3. External dispatch payloads
4. Callback responses
5. UI tracking (for debugging)

**Implementation**:
```typescript
// Generate at proposal creation
const correlationId = crypto.randomUUID();

// Pass through entire chain:
proposal.correlationId = correlationId;
ledgerEntry.correlationId = correlationId;
dispatchPayload.correlationId = correlationId;
callbackPayload.correlationId = correlationId;
```

**Files to Modify**:
- `shared/schema.ts` - Add `correlationId` to `staged_proposals`, `automation_ledger`
- `server/admin-chat-service.ts` - Generate on proposal creation
- `server/agent-dispatcher.ts` - Include in dispatch payload
- `server/routes.ts` - Propagate through all flows

---

## PHASE 2 — STRUCTURE REBUILD (CODE HEALTH)

**Only after Phase 1 is complete:**

### 2.1 Split routes.ts (URGENT)

**Current**: 8,404 lines in single file (unmaintainable)

**Target Structure**:
```
server/
  routes/
    contacts.routes.ts      (~500 lines)
    jobs.routes.ts          (~400 lines)
    estimates.routes.ts     (~300 lines)
    invoices.routes.ts      (~300 lines)
    payments.routes.ts      (~300 lines)
    ai.routes.ts            (~800 lines)  # Admin chat, AI settings
    proposals.routes.ts     (~600 lines)  # Review queue, execution
    webhooks.routes.ts      (~500 lines)  # Agent callbacks, intake
    communications.routes.ts (~400 lines) # Email, WhatsApp
    dashboard.routes.ts     (~200 lines)
    auth.routes.ts          (~200 lines)
    settings.routes.ts      (~200 lines)
  index.ts                 # Main app setup
```

**Migration Strategy**:
1. Create `server/routes/` directory
2. Extract one module at a time
3. Maintain backward compatibility
4. Test after each extraction
5. Remove old code from `routes.ts` incrementally

### 2.2 Normalize Storage Layer

**Current Risk**: MemStorage ≠ PostgresStorage behavior

**Issues**:
- MemStorage doesn't enforce foreign keys
- No transaction support in MemStorage
- Dev/Prod behavior differences

**Fix**:
1. Create shared interface invariants in `server/storage-interface.ts`
2. Enforce same validation in both implementations
3. Add transaction stub to MemStorage (logs warning)
4. Add integration tests that run against both

### 2.3 Remove N8N Dependency Entirely

**Current State**: Halfway migrated, confusing dual system

**Actions**:
1. Remove all N8N webhook references:
   - `POST /api/n8n/dispatch` (already 501)
   - `GET/POST /api/n8n/health`
   - `POST /api/n8n/test`
   - Email dispatch N8N calls
   - WhatsApp dispatch N8N calls

2. Replace with agent dispatcher:
   - Update email dispatch to use `dispatchToAgent()`
   - Update WhatsApp dispatch to use `dispatchToAgent()`
   - Update payment links to use `dispatchToAgent()`

3. Clean up environment variables:
   - Remove `N8N_WEBHOOK_URL` references
   - Remove `N8N_INTERNAL_TOKEN` references
   - Keep only `AGENT_WEBHOOK_URL`

**Files to Modify**:
- `server/routes.ts` - Remove N8N endpoints, migrate to agent
- `server/agent-dispatcher.ts` - Add email/WhatsApp/payment routing
- `.env.example` - Update documentation

---

## PHASE 3 — SYSTEM MATURITY (OPTIMIZATION)

**Only after Phase 1-2 complete:**

### 3.1 Event Outbox Pattern

**Purpose**: Reliable async dispatch with retry

**Implementation**:
```sql
CREATE TABLE events_outbox (
  id UUID PRIMARY KEY,
  correlation_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Worker**: Background job processes pending events with exponential backoff

### 3.2 Retry + Circuit Breaker

**Add to `server/agent-dispatcher.ts`**:
- Exponential backoff retry (3 attempts)
- Circuit breaker (fail fast after 5 consecutive failures)
- Dead letter queue for permanently failed events

### 3.3 Caching Layer

**Add Redis caching for**:
- Dashboard stats (60s TTL)
- Contact lookups (5min TTL)
- Settings (10min TTL)

### 3.4 Job State Machine Enforcement

**Current**: Any status → any status allowed

**Add validation**:
```typescript
const VALID_TRANSITIONS = {
  lead_intake: ['contacted', 'estimated'],
  contacted: ['estimated', 'scheduled'],
  estimated: ['approved', 'rejected'],
  approved: ['in_progress'],
  in_progress: ['completed'],
  // ... etc
};
```

### 3.5 Integration Test Suite

**Critical flows to test**:
1. AI proposal → validator → staged → approved → executed → callback
2. Intake submission → contact creation → job creation
3. Email dispatch → callback → ledger update
4. Kill switch enforcement at all entry points

---

## IMPLEMENTATION ORDER (STRICT)

```
PHASE 1 (Week 1-2):
  Week 1:
    - Day 1-2: Add correlationId to schema + propagate through flows
    - Day 3-4: Close ledger loop (add missing events)
    - Day 5: Define agent execution contract schemas
  
  Week 2:
    - Day 1-3: Implement agent gateway endpoints
    - Day 4-5: Migrate email/WhatsApp from N8N to agent

PHASE 2 (Week 3-4):
  Week 3:
    - Day 1-2: Split routes.ts (contacts, jobs, estimates)
    - Day 3-4: Split routes.ts (invoices, payments, proposals)
    - Day 5: Split routes.ts (ai, webhooks, communications)
  
  Week 4:
    - Day 1-2: Normalize storage layer
    - Day 3-4: Remove N8N references completely
    - Day 5: Test and verify all routes work

PHASE 3 (Week 5-6):
  Week 5:
    - Day 1-2: Event outbox pattern
    - Day 3-4: Retry + circuit breaker
    - Day 5: Caching layer
  
  Week 6:
    - Day 1-2: Job state machine
    - Day 3-5: Integration test suite
```

---

## PRODUCTION READINESS TRAJECTORY

| Stage | Score | Status |
|-------|-------|--------|
| Current | 5.3/10 | NOT PRODUCTION READY |
| After Phase 1 | 7.5/10 | Functionally complete, needs refactoring |
| After Phase 2 | 8.5/10 | Well-structured, maintainable |
| After Phase 3 | 9.5/10 | Production-ready, enterprise-grade |

---

## SUCCESS CRITERIA

### Phase 1 Completion:
- [ ] All external dispatches use unified agent gateway
- [ ] Ledger contains PROPOSAL_EXECUTED, PROPOSAL_DISPATCHED, PROPOSAL_FAILED events
- [ ] correlationId present in all proposals, ledger entries, and dispatch payloads
- [ ] Email/WhatsApp no longer use N8N endpoints

### Phase 2 Completion:
- [ ] routes.ts split into 12+ module files (<1000 lines each)
- [ ] MemStorage and PostgresStorage pass same test suite
- [ ] Zero references to N8N in codebase
- [ ] All routes have consistent authentication patterns

### Phase 3 Completion:
- [ ] Event outbox table created and worker running
- [ ] Retry logic with exponential backoff implemented
- [ ] Circuit breaker prevents cascade failures
- [ ] Redis caching reduces DB load by 60%+
- [ ] Job status transitions validated by state machine
- [ ] Integration test suite covers all critical flows
