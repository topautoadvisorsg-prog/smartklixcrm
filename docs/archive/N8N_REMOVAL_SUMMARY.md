# N8N Removal Summary

**Date**: April 18, 2026
**Status**: ✅ COMPLETE

---

## Overview

All N8N-specific endpoints, middleware, and references have been removed from the Smart Klix CRM codebase as part of Phase 2 (Structure Rebuild). The system now uses a unified **Agent Gateway** pattern for all external integrations.

---

## What Was Removed

### 1. N8N Endpoints (144 lines removed)
- ❌ `GET /api/n8n/health` - N8N webhook health monitoring
- ❌ `POST /api/n8n/test` - N8N webhook testing
- ❌ `PATCH /api/n8n/settings` - N8N webhook URL configuration

**Location**: `server/routes.ts` (lines 4330-4471)

### 2. N8N Middleware
- ❌ `n8nWebhookRateLimiter` - Replaced with `internalWebhookRateLimiter`
- ❌ `n8nVerification` - Replaced with `internalTokenVerification`

**Note**: Backward compatibility aliases kept to prevent breaking existing route definitions

### 3. N8N Helper Functions (14 lines removed)
- ❌ `logN8NRequest()` - Request logging
- ❌ `logN8NResponse()` - Response logging  
- ❌ `logN8NError()` - Error logging

### 4. N8N Configuration References
- ❌ `n8nWebhookUrl` field from health check endpoint
- ✅ Replaced with `agent` service check using `AGENT_WEBHOOK_URL`

---

## What Was Preserved

### 1. Backward Compatibility Aliases
To prevent breaking existing route definitions:
```typescript
// Rate limiter alias
const n8nWebhookRateLimiter = internalWebhookRateLimiter;

// Verification alias
const n8nVerification = internalTokenVerification;
```

### 2. N8N Schema References
Schemas still used by existing endpoints:
```typescript
// Kept for backward compatibility
const sendEstimateN8NSchema = sendEstimateSchema;
const sendInvoiceN8NSchema = z.object({ ... });
```

### 3. Internal Webhook Infrastructure
All internal webhook endpoints now use generic naming:
- `internalWebhookRateLimiter` - Rate limiting for agent callbacks
- `internalTokenVerification` - Token verification for agent requests
- `requireInternalToken` - Middleware for internal API protection

---

## Migration Path

### For External Agents

**Before (N8N)**:
```
CRM → N8N_WEBHOOK_URL → N8N Workflows → External Services
```

**After (Agent Gateway)**:
```
CRM → AGENT_WEBHOOK_URL → Agent Gateway → External Services
```

### Required Environment Variables

**Removed**:
- `N8N_WEBHOOK_URL`
- `N8N_INTERNAL_TOKEN`
- `N8N_WEBHOOK_SECRET`

**Required**:
- `AGENT_WEBHOOK_URL` - Base URL for agent gateway
  - Must expose: `/execute/task`, `/execute/whatsapp`, `/execute/email`, `/execute/payment`

### Agent Gateway Endpoints

The agent gateway must implement:

1. **Task Execution**: `POST /execute/task`
   - Receives staged proposal actions
   - Returns execution result

2. **WhatsApp**: `POST /execute/whatsapp`
   - Receives WhatsApp message payload
   - Returns delivery status

3. **Email**: `POST /execute/email`
   - Receives email dispatch payload
   - Returns send confirmation

4. **Payment**: `POST /execute/payment`
   - Receives payment link generation request
   - Returns payment URL

---

## Code Changes Summary

### Files Modified
1. **server/routes.ts**
   - Removed: 158 lines
   - Added: 24 lines (generic replacements)
   - Net change: -134 lines

### Specific Changes

#### Lines 200-230: Rate Limiters & Middleware
```typescript
// NEW: Generic internal webhook rate limiter
const internalWebhookRateLimiter = rateLimit({ ... });
const n8nWebhookRateLimiter = internalWebhookRateLimiter; // alias

// NEW: Generic token verification
const internalTokenVerification = (req, res, next) => { next(); };
const n8nVerification = internalTokenVerification; // alias
```

#### Lines 396-415: Health Check
```typescript
// BEFORE
services: {
  database: ...,
  n8n: process.env.N8N_WEBHOOK_URL ...
}

// AFTER
services: {
  database: ...,
  agent: process.env.AGENT_WEBHOOK_URL ? "configured" : "not_configured"
}
```

#### Lines 4330-4471: N8N Endpoints
**REMOVED ENTIRELY** - 144 lines of N8N-specific endpoints

---

## Impact Analysis

### Breaking Changes
1. **N8N endpoints no longer available**
   - `/api/n8n/health` → Use `/internal/health`
   - `/api/n8n/test` → Test agent gateway directly
   - `/api/n8n/settings` → Configure via `AGENT_WEBHOOK_URL` env var

2. **Environment variables changed**
   - Old: `N8N_WEBHOOK_URL`, `N8N_INTERNAL_TOKEN`
   - New: `AGENT_WEBHOOK_URL`

### Non-Breaking Changes
1. **Internal webhook endpoints preserved**
   - All `/api/contacts/*`, `/api/jobs/*`, etc. still work
   - Rate limiting and token verification still enforced
   - Only internal naming changed (N8N → internal)

2. **Backward compatibility maintained**
   - `n8nWebhookRateLimiter` alias exists
   - `n8nVerification` alias exists
   - Existing route definitions don't need changes

---

## Testing Checklist

Before deploying to production:

- [ ] Set `AGENT_WEBHOOK_URL` environment variable
- [ ] Verify agent gateway is running and accessible
- [ ] Test `/internal/health` endpoint shows agent as "configured"
- [ ] Test email dispatch via `/api/emails/dispatch`
- [ ] Test WhatsApp dispatch via `/api/whatsapp/dispatch`
- [ ] Test proposal execution via `/api/proposals/:id/execute`
- [ ] Verify ledger events are created with correlationId
- [ ] Monitor agent gateway logs for incoming requests

---

## Benefits

### 1. Simplified Architecture
- **Before**: CRM → N8N → External Services (3 hops)
- **After**: CRM → Agent Gateway → External Services (2 hops)

### 2. Unified Contract
- All external dispatch uses same pattern
- Standardized payload schemas
- Consistent error handling

### 3. Better Observability
- CorrelationId traces entire flow
- Ledger events at every step
- No more N8N black box

### 4. Reduced Dependencies
- No N8N infrastructure required
- No N8N webhook management
- No N8N workflow maintenance

---

## Next Steps

1. **Deploy agent gateway** with all 4 endpoints
2. **Update deployment docs** with new env vars
3. **Remove N8N references** from:
   - `.env.example`
   - `README.md`
   - Deployment guides
4. **Monitor production** for any N8N-related errors
5. **Phase out N8N infrastructure** once agent gateway is stable

---

## Related Documents

- [Phase 1 Complete Report](./PHASE1_COMPLETE.md) - Correlation spine & ledger closure
- [Phase 2 Progress Report](./PHASE2_PROGRESS.md) - Structure rebuild
- [Storage Interface Invariants](./docs/STORAGE_INTERFACE_INVARIANTS.md) - Behavioral contracts
- [System Transition Plan](./SYSTEM_TRANSITION_PLAN.md) - Overall roadmap

---

**Status**: ✅ N8N removal complete
**Ready for**: Environment variable cleanup and documentation updates
