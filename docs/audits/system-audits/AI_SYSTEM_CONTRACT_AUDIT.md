# 🔍 AI + SYSTEM CONTRACT AUDIT

## 🎯 OBJECTIVE

Verify that ALL AI-approved actions output a strict, executable structure before execution.

---

## 📊 PART 1: CURRENT STATE

### What EXACT structure does AI currently output before entering assist_queue?

**Answer**: **INCONSISTENT** - There are 3 different structures depending on source.

### Structure by Source:

#### 1. Voice Receptionist (Appointment Booking)
**Location**: routes.ts line 2983-3029

**Validator Input**:
```typescript
{
  action: "schedule_appointment",
  payload: {
    contactId: "uuid-string",
    preferredTime: "2024-02-10T14:00:00Z",
    reason: "Customer needs HVAC repair",
  },
  context: {
    mode: "assist",
    source: "voice_receptionist",
    callerPhone: "+1234567890",
  },
  reasoning: "AI receptionist scheduled appointment for caller",
}
```

**Assist Queue Entry** (toolsCalled):
```typescript
{
  toolsCalled: [{
    name: "schedule_appointment",
    args: {
      contactId: "uuid-string",
      preferredTime: "2024-02-10T14:00:00Z",
      reason: "Customer needs HVAC repair",
      notes: "Urgent repair needed",
      callId: "call-uuid",
    },
  }],
  gatedActionType: null,           // ❌ NOT SET
  finalizationPayload: null,       // ❌ NOT SET
}
```

**Problem**: `gatedActionType` and `finalizationPayload` are NOT set, so this entry CANNOT be finalized.

---

#### 2. Voice Receptionist (Missed Call Follow-up)
**Location**: routes.ts line 3099-3145

**Validator Input**:
```typescript
{
  action: "follow_up",
  payload: {
    callerPhone: "+1234567890",
    contactId: "uuid-string",
    reason: "Missed call - follow-up required",
  },
  context: {
    mode: "assist",
    source: "voice_receptionist_missed_call",
    callerPhone: "+1234567890",
  },
  reasoning: "AI receptionist flagged missed call for follow-up",
}
```

**Assist Queue Entry** (toolsCalled):
```typescript
{
  toolsCalled: [{
    name: "follow_up",
    args: {
      callerPhone: "+1234567890",
      contactId: "uuid-string",
      reason: "Missed call - follow-up required",
    },
  }],
  gatedActionType: null,           // ❌ NOT SET
  finalizationPayload: null,       // ❌ NOT SET
}
```

**Problem**: Same as above - cannot be finalized.

---

#### 3. Staged Accept (AI Proposals from Action Console)
**Location**: routes.ts line 3450-3512

**Validator Input**:
```typescript
{
  action: "create_contact",  // First tool in bundle
  payload: {
    actions: [
      { tool: "create_contact", args: { name: "John Doe", email: "john@example.com" } },
      { tool: "create_job", args: { contactId: "{contactId}", title: "HVAC Repair" } },
    ],
    userRequest: "Create new customer and job",
  },
  context: {
    mode: "assist",
    source: "staged_accept",
    stagedBundleId: "bundle-uuid",
  },
  reasoning: "AI proposed 2 action(s): create_contact, create_job",
}
```

**Assist Queue Entry** (toolsCalled):
```typescript
{
  toolsCalled: [
    { tool: "create_contact", args: { name: "John Doe", email: "john@example.com" } },
    { tool: "create_job", args: { contactId: "{contactId}", title: "HVAC Repair" } },
  ],
  gatedActionType: null,           // ❌ NOT SET
  finalizationPayload: null,       // ❌ NOT SET
}
```

**Problem**: Same - cannot be finalized.

---

### Summary: Structure Consistency

| Source | Validator Input | toolsCalled | gatedActionType | finalizationPayload | Executable? |
|--------|----------------|-------------|-----------------|---------------------|-------------|
| Voice (Appointment) | ✅ Consistent | ✅ Set | ❌ NULL | ❌ NULL | ❌ NO |
| Voice (Missed Call) | ✅ Consistent | ✅ Set | ❌ NULL | ❌ NULL | ❌ NO |
| Staged Accept | ✅ Consistent | ✅ Set | ❌ NULL | ❌ NULL | ❌ NO |

**Verdict**: ❌ **NONE of the current assist_queue entries are executable** because `gatedActionType` and `finalizationPayload` are not set.

---

## 🔧 PART 2: VALIDATOR / MASTER ARCHITECT

### Is the validator expecting a different schema than what AI produces?

**YES - CRITICAL MISMATCH**

**Validator Schema** (validator.ts line 16-24):
```typescript
export const validationProposalSchema = z.object({
  action: z.string(),              // ✅ Provided
  target: z.string(),              // ❌ NOT PROVIDED
  targetId: z.string().optional(), // ✅ Optional
  summary: z.string(),             // ❌ NOT PROVIDED
  payload: z.record(z.unknown()),  // ✅ Provided
  reasoning: z.string().optional(),// ✅ Provided
  requestedBy: z.string(),         // ❌ NOT PROVIDED
});
```

**What Routes.ts Actually Provides**:
```typescript
{
  action: "schedule_appointment",  // ✅
  payload: { ... },                // ✅
  context: { ... },                // ❌ Not in schema
  reasoning: "...",                // ✅
  // ❌ Missing: target, summary, requestedBy
}
```

**Result**: Validator WILL reject all proposals due to schema mismatch.

---

### Is validator enforcing structure OR just reviewing loosely?

**Answer**: **Enforcing structure TOO STRICTLY** - Rejecting valid proposals due to schema mismatch.

**Current Behavior**:
1. Validator receives proposal
2. Zod schema validation fails (missing `target`, `summary`, `requestedBy`)
3. Returns: `{ decision: "reject", reason: "Invalid proposal format..." }`
4. Proposal is logged as rejected
5. **BUT** - Routes.ts continues anyway for voice receptionist (time-sensitive)

**This is broken** - Validator should accept the actual structure being provided.

---

## ⚙️ PART 3: EXECUTION REQUIREMENTS

### For each major action, what are the required fields?

#### 1. schedule_appointment
**Execution Function**: `storage.createAppointment()`
**Required Fields**:
```typescript
{
  contactId: string,        // ✅ UUID of contact
  scheduledAt: Date,        // ✅ ISO timestamp
  title: string,            // ❌ Missing (should be "Appointment")
  status: string,           // ❌ Missing (should default to "scheduled")
  notes: string,            // ✅ Optional
}
```

**Current AI Output**:
```typescript
{
  contactId: "uuid",        // ✅
  preferredTime: "...",     // ⚠️ Wrong field name (should be scheduledAt)
  reason: "...",            // ⚠️ Wrong field name (should be notes)
  notes: "...",             // ✅
  callId: "...",            // ⚠️ Extra field (not needed)
}
```

**Gap**: Field names don't match execution requirements.

---

#### 2. create_contact
**Execution Function**: `storage.createContact()`
**Required Fields** (from schema.ts):
```typescript
{
  name: string,             // ✅ Required
  email: string,            // ✅ Required (or phone)
  phone: string,            // ✅ Optional
  company: string,          // ✅ Optional
  status: string,           // ❌ Missing (should default to "lead")
  customerType: string,     // ❌ Missing (should default to "new")
}
```

**Current AI Output**:
```typescript
{
  name: "John Doe",         // ✅
  email: "john@example.com",// ✅
}
```

**Gap**: Missing default values for `status` and `customerType`.

---

#### 3. send_invoice
**Execution Function**: `pipeline.sendInvoice()`
**Required Fields**:
```typescript
{
  invoiceId: string,        // ✅ UUID of invoice
}
```

**Current AI Output**: Unknown (not implemented in current flow)

---

#### 4. create_job
**Execution Function**: `storage.createJob()`
**Required Fields**:
```typescript
{
  contactId: string,        // ✅ UUID
  title: string,            // ✅ Job title
  status: string,           // ❌ Missing (should default to "pending")
  description: string,      // ✅ Optional
}
```

**Current AI Output**:
```typescript
{
  contactId: "uuid",        // ✅
  title: "HVAC Repair",     // ✅
}
```

**Gap**: Missing `status` default.

---

### Summary: Required Fields Per Action

| Action | Required Fields | AI Provides | Gap |
|--------|----------------|-------------|-----|
| schedule_appointment | contactId, scheduledAt, title | contactId, preferredTime, reason | ❌ Field names wrong |
| create_contact | name, email | name, email | ⚠️ Missing defaults |
| create_job | contactId, title | contactId, title | ⚠️ Missing defaults |
| send_invoice | invoiceId | Not implemented | ❌ Not available |
| follow_up | callerPhone, contactId | callerPhone, contactId | ✅ Complete |

---

## 🔍 PART 4: GAP ANALYSIS

### Where AI output ≠ execution requirements

**Gap #1: Field Name Mismatch**
- **Location**: Voice receptionist appointment booking
- **Issue**: AI outputs `preferredTime`, execution expects `scheduledAt`
- **Impact**: Appointment creation will fail or create incorrect data
- **Fix**: Map field names before execution

**Gap #2: Missing gatedActionType**
- **Location**: ALL assist_queue entries
- **Issue**: `gatedActionType` is NULL, but `finalizeAction()` requires it
- **Impact**: Cannot finalize ANY assist_queue entry
- **Fix**: Set `gatedActionType` when creating assist_queue entries

**Gap #3: Missing finalizationPayload**
- **Location**: ALL assist_queue entries
- **Issue**: `finalizationPayload` is NULL, but `finalizeAction()` requires it
- **Impact**: Cannot execute ANY assist_queue entry
- **Fix**: Set `finalizationPayload` to the tool args

**Gap #4: Validator Schema Mismatch**
- **Location**: validator.ts line 16-24
- **Issue**: Schema expects `target`, `summary`, `requestedBy` but routes.ts doesn't provide them
- **Impact**: All proposals rejected by validator
- **Fix**: Update schema to match actual usage

---

### Where structure is missing or inconsistent

**Issue #1: toolsCalled vs gatedActionType**
- **Current**: `toolsCalled` is an ARRAY of tools
- **Expected**: `gatedActionType` is a SINGLE tool name
- **Confusion**: Which one does execution use?

**Answer**: `finalizeAction()` uses `gatedActionType` + `finalizationPayload`, NOT `toolsCalled`.

**Problem**: Voice receptionist sets `toolsCalled` but NOT `gatedActionType`/`finalizationPayload`, so entries are NOT executable.

---

### Cases where execution might fail due to bad formatting

**Case #1: Voice Receptionist Appointment**
```typescript
// Current output:
{
  preferredTime: "2024-02-10T14:00:00Z",  // ❌ Wrong field name
  reason: "HVAC repair",                   // ❌ Wrong field name
}

// Execution expects:
{
  scheduledAt: Date,                       // ✅ Correct field name
  notes: "HVAC repair",                    // ✅ Correct field name
}
```
**Result**: Appointment created with wrong fields or fails.

**Case #2: Multi-Action Bundles**
```typescript
// Current output:
{
  toolsCalled: [
    { tool: "create_contact", args: { name: "John", email: "john@example.com" } },
    { tool: "create_job", args: { contactId: "{contactId}", title: "Repair" } },
  ],
}

// Problem: {contactId} is a placeholder, not actual UUID
```
**Result**: Job creation fails because contactId is invalid.

---

## 🛠️ PART 5: IMPLEMENTATION PLAN

### OPTION A: Enforce structure inside Master Architect (AI validator)

**How it works**:
1. AI receives natural language input
2. AI normalizes output to strict schema
3. Validator checks normalized output
4. Only clean data enters assist_queue

**Pros**:
- ✅ Guarantees schema before approval
- ✅ System only executes clean data
- ✅ AI handles complexity

**Cons**:
- ⚠️ Requires AI prompt engineering
- ⚠️ Hard to debug AI normalization errors
- ⚠️ Slower development

**Current closeness**: 20% (AI doesn't normalize currently)

---

### OPTION B: Add final normalization layer before execution

**How it works**:
```
AI Output → Normalization Layer → Strict Schema → Execution
```

**Example**:
```typescript
function normalizeAppointment(args: any) {
  return {
    contactId: args.contactId,
    scheduledAt: new Date(args.preferredTime || args.scheduledAt),
    title: args.title || "Appointment",
    notes: args.reason || args.notes || "",
    status: "scheduled",
  };
}
```

**Pros**:
- ✅ Deterministic (no AI ambiguity)
- ✅ Easy to test and debug
- ✅ Fast development
- ✅ Acts as safety layer

**Cons**:
- ⚠️ Additional code to maintain
- ⚠️ Must write normalizer for each action type

**Current closeness**: 80% (already have some normalization in pipeline.ts)

---

### Recommendation: **OPTION B** (Normalization Layer)

**Why**:
1. **Closer to current system** - Already have partial normalization
2. **More reliable** - Deterministic transformations, not AI-dependent
3. **Faster to implement** - 1-2 days vs 1-2 weeks
4. **Easier to test** - Unit tests for normalizers
5. **Better separation** - AI interprets, normalizer structures, validator approves

**Implementation**:
```typescript
// New file: server/normalizers.ts

export function normalizeAction(action: string, args: any): any {
  switch (action) {
    case "schedule_appointment":
      return normalizeAppointment(args);
    case "create_contact":
      return normalizeContact(args);
    case "create_job":
      return normalizeJob(args);
    // ... etc
  }
}

function normalizeAppointment(args: any) {
  return {
    contactId: args.contactId,
    scheduledAt: new Date(args.preferredTime || args.scheduledAt),
    title: args.title || "Appointment",
    notes: args.reason || args.notes || "",
    status: "scheduled",
  };
}
```

---

## 🧪 PART 6: VERIFICATION

### Can ANY approved assist_queue item fail execution due to bad structure?

**Answer**: **YES - ALL of them will fail**

**Why**:
1. `gatedActionType` is NULL → `finalizeAction()` returns error at line 495
2. `finalizationPayload` is NULL → `finalizeAction()` returns error at line 495
3. Field names don't match → Execution functions receive wrong fields

**Example Failure**:
```typescript
// Current assist_queue entry:
{
  toolsCalled: [{ name: "schedule_appointment", args: { contactId: "...", preferredTime: "..." } }],
  gatedActionType: null,           // ❌ NULL
  finalizationPayload: null,       // ❌ NULL
}

// finalizeAction() execution:
const toolName = queueEntry.gatedActionType;  // ❌ NULL
const payload = queueEntry.finalizationPayload; // ❌ NULL

if (!queueEntry.gatedActionType || !queueEntry.finalizationPayload) {
  return { success: false, error: "Queue entry missing gated action type or payload" };
}
// ❌ Returns error immediately
```

---

## ⚡ PART 7: FINAL REQUIREMENT

### Guarantee that ANY approved action = executable without failure

**Current Status**: ❌ **NO GUARANTEE** - All entries will fail execution

**What's Needed**:

#### Fix #1: Set gatedActionType and finalizationPayload (CRITICAL)
**Location**: routes.ts line 3014-3029 (voice receptionist appointment)

**Change**:
```typescript
await storage.createAssistQueueEntry({
  mode: "assist",
  userRequest: `Premium AI Receptionist: Caller requested appointment`,
  status: "pending",
  requiresApproval: true,
  toolsCalled: [{
    name: "schedule_appointment",
    args: {
      contactId,
      preferredTime: validated.extractedData.preferredTime,
      reason: validated.extractedData.reason,
      notes: validated.extractedData.notes,
      callId: validated.callId,
    },
  }],
  // ✅ ADD THESE:
  gatedActionType: "schedule_appointment",
  finalizationPayload: {
    contactId,
    scheduledAt: validated.extractedData.preferredTime,
    title: "Appointment",
    notes: validated.extractedData.reason || validated.extractedData.notes || "",
    status: "scheduled",
  },
});
```

**Same fix needed for**:
- Voice receptionist missed call (line 3099)
- Staged accept (line 3467)

---

#### Fix #2: Update validator schema (CRITICAL)
**Location**: validator.ts line 16-24

**Change**:
```typescript
export const validationProposalSchema = z.object({
  action: z.string(),
  target: z.string().optional(),              // Make optional
  targetId: z.string().optional(),
  summary: z.string().optional(),             // Make optional
  payload: z.record(z.unknown()),
  reasoning: z.string().optional(),
  requestedBy: z.string().optional(),         // Make optional
  context: z.record(z.unknown()).optional(),  // Add context field
});
```

---

#### Fix #3: Add normalization layer (IMPORTANT)
**Location**: New file `server/normalizers.ts`

**Implement normalizers for**:
- schedule_appointment
- create_contact
- create_job
- create_invoice
- follow_up
- All actions in ai-tools.ts

---

## 📋 DELIVERABLE SUMMARY

### 1. Current Structure (Real Examples)

**Voice Receptionist Appointment**:
```typescript
{
  action: "schedule_appointment",
  payload: { contactId, preferredTime, reason },
  context: { mode: "assist", source: "voice_receptionist" },
  reasoning: "...",
}
```
**Missing**: `target`, `summary`, `requestedBy` (validator expects these)

---

### 2. Execution Requirements Per Action

| Action | Required Fields | Current Status |
|--------|----------------|----------------|
| schedule_appointment | contactId, scheduledAt, title | ❌ Wrong field names |
| create_contact | name, email, status, customerType | ⚠️ Missing defaults |
| create_job | contactId, title, status | ⚠️ Missing defaults |
| follow_up | callerPhone, contactId | ✅ Complete |

---

### 3. Identified Gaps

| Gap | Severity | Impact | Fix |
|-----|----------|--------|-----|
| gatedActionType = NULL | 🔴 CRITICAL | Cannot finalize ANY entry | Set when creating assist_queue |
| finalizationPayload = NULL | 🔴 CRITICAL | Cannot execute ANY entry | Set when creating assist_queue |
| Validator schema mismatch | 🔴 CRITICAL | All proposals rejected | Update schema to optional |
| Field name mismatch | 🟡 HIGH | Execution fails | Add normalization layer |
| Missing default values | 🟡 MEDIUM | Incomplete data | Add defaults in normalizers |

---

### 4. Recommended Fix

**Approach**: **OPTION B** (Normalization Layer)

**Why**:
- Closer to current system (80% vs 20%)
- More reliable (deterministic)
- Faster to implement (1-2 days)
- Easier to test

**Implementation Order**:
1. Fix validator schema (2 hours) - CRITICAL
2. Set gatedActionType/finalizationPayload (2 hours) - CRITICAL
3. Create normalizers.ts (1 day) - IMPORTANT
4. Update all assist_queue creation points (2 hours) - CRITICAL
5. Test end-to-end (2 hours) - CRITICAL

**Total Time**: 2 days

---

### 5. Confirmation of Execution Safety

**Current Status**: ❌ **NOT SAFE** - All entries will fail execution

**After Fixes**: ✅ **SAFE** - All entries executable

**Guarantee After Fixes**:
- ✅ All required fields present (normalizers ensure this)
- ✅ No ambiguous values (normalizers map to strict schema)
- ✅ No formatting inconsistencies (normalizers standardize format)
- ✅ Validator accepts proposals (schema matches actual usage)
- ✅ finalizeAction() succeeds (gatedActionType + finalizationPayload set)

---

## 🔥 FINAL RULE

**AI can think freely** - Intake AI interprets natural language, understands context, makes decisions

**BUT must output in a strict contract before execution** - Normalization layer ensures ALL outputs match execution requirements

**Contract**:
```typescript
{
  action: string,              // Action type
  payload: {                   // Normalized to execution schema
    // All required fields present
    // No ambiguous values
    // Consistent formatting
  },
  context?: object,            // Optional metadata
  reasoning?: string,          // Optional explanation
}
```

**This contract is enforced by**:
1. Validator (checks proposal structure)
2. Normalizer (transforms to execution schema)
3. finalizeAction() (validates gatedActionType + finalizationPayload)

**Result**: ANY approved action = executable without failure ✅
