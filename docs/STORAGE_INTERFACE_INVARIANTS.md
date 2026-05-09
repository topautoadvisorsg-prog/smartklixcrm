# Storage Layer Interface Invariants

This document defines the **behavioral contracts** that ALL storage implementations (MemStorage, PostgresStorage) MUST follow to ensure consistency between development and production.

---

## 1. General Invariants

### 1.1 ID Generation
- **All entities** MUST use UUID v4 for primary keys
- **Implementation**: Use `crypto.randomUUID()` or database UUID generation
- **Invariant**: `id` is always present in returned objects, never null

### 1.2 Timestamps
- **createdAt** MUST be set on ALL entities at creation time
- **updatedAt** MUST be updated on ALL update operations
- **Format**: ISO 8601 (`Date.toISOString()`)
- **Invariant**: Timestamps are never null after creation

### 1.3 Null Handling
- **Optional fields** MUST return `null` if not set, NOT undefined
- **Required fields** MUST throw validation error if missing
- **Invariant**: `entity.field === null` or `entity.field === "value"`, never `undefined`

### 1.4 Error Handling
- **Not found** operations MUST return `undefined`, NOT throw
- **Validation errors** MUST throw with descriptive message
- **Database errors** MUST be caught and logged, then re-thrown
- **Invariant**: Get operations never throw for missing data

---

## 2. Entity-Specific Invariants

### 2.1 Contacts

#### Duplicate Detection
```typescript
// BOTH implementations MUST check email AND phone for duplicates
getContactByEmail(email: string): Promise<Contact | undefined>
getContactByPhone(phone: string): Promise<Contact | undefined>
```

**Invariant**: Creating a contact with duplicate email/phone MUST NOT fail silently - caller is responsible for duplicate check

#### Required Fields
- `name` OR `email` MUST be present
- At least ONE identifier required: `email`, `phone`, or `name`

### 2.2 Jobs

#### Foreign Key Enforcement
- `clientId` MUST reference an existing contact
- **MemStorage**: MUST check contact exists before creating job
- **PostgresStorage**: Database foreign key constraint enforces this

```typescript
// Invariant: This MUST throw if contact doesn't exist
createJob({ clientId: "non-existent-id" }) // THROWS
```

#### Default Values
- `status` defaults to `"lead_intake"` if not provided
- `title` defaults to `"New Lead"` if not provided
- `jobType` defaults to `"lead"` if not provided

### 2.3 Staged Proposals

#### Expiration
- Proposals with `expiresAt < NOW()` are considered expired
- `cleanupExpiredProposals()` MUST be called periodically (every 5 minutes)
- **Invariant**: Expired proposals MUST NOT be returned in `listStagedProposals()` unless `includeExpired: true`

#### Status Transitions
Valid state machine:
```
pending → approved → dispatched → completed
pending → approved → dispatched → failed
pending → rejected
pending → expired
```

**Invariant**: Invalid transitions MUST be rejected

#### Correlation ID
- `correlationId` MUST be set at creation time
- **Invariant**: `correlationId` is never null for new proposals

### 2.4 Automation Ledger

#### Idempotency
- `idempotencyKey` MUST be checked before creating entry
- If key exists, return existing entry, NOT create duplicate
- **Invariant**: `createAutomationLedgerEntry()` with same idempotencyKey is idempotent

```typescript
// First call - creates entry
await createAutomationLedgerEntry({ idempotencyKey: "key-1", ... })

// Second call with same key - returns existing entry
await createAutomationLedgerEntry({ idempotencyKey: "key-1", ... })
// Returns same entry, does NOT create duplicate
```

#### Required Fields
- `agentName` - Who performed the action
- `actionType` - What action was performed
- `entityType` - What entity was affected
- `entityId` - Which instance was affected
- `mode` - How it was performed (manual, auto, intake, executed)
- `status` - Result (pending, received, processed, dispatched, completed, failed)

### 2.5 Events Outbox

#### Idempotency
- `idempotencyKey` + `tenantId` combination MUST be unique
- **Invariant**: Duplicate submissions return existing entry

#### Status Transitions
```
pending → synced
pending → failed → pending (retry)
```

**Invariant**: Max retry count is 3

---

## 3. Transaction Support

### 3.1 PostgresStorage
- MUST support transactions via `db.transaction()`
- Operations with `tx?` parameter MUST use transaction context if provided
- **Invariant**: If transaction fails, ALL operations roll back

### 3.2 MemStorage
- MUST provide transaction stub for API compatibility
- MUST log warning: `[MemStorage] Transactions not supported in development mode`
- **Invariant**: MemStorage operations are atomic but NOT transactional

```typescript
// Both implementations accept tx parameter
createJob(job: InsertJob, tx?: Tx): Promise<Job>

// PostgresStorage: Uses transaction
await db.transaction(async (tx) => {
  await storage.createJob(job, tx);
  await storage.createAuditLogEntry(entry, tx);
});

// MemStorage: Ignores tx, logs warning
createJob(job: InsertJob, tx?: Tx): Promise<Job> {
  if (tx) {
    console.warn('[MemStorage] Transactions not supported in development mode');
  }
  // Proceed without transaction
}
```

---

## 4. Query Behavior

### 4.1 Filtering
- **Empty filters** MUST return all records
- **Multiple filters** MUST be ANDed together
- **Null values** in filters MUST be ignored, NOT matched

```typescript
// Invariant: These MUST behave consistently
getEmails({}) // Returns ALL emails
getEmails({ status: "sent" }) // Returns only sent emails
getEmails({ status: null }) // Returns ALL emails (ignores null filter)
```

### 4.2 Sorting
- Default sort: `createdAt DESC` (newest first)
- **Invariant**: Consistent sort order across both implementations

### 4.3 Pagination
- `limit` parameter MUST be respected
- Default limit: 100 if not specified
- Max limit: 1000 (prevent unbounded queries)

```typescript
// Invariant: Both implementations respect limits
getContacts() // Returns max 100 contacts
getContacts() // Postgres MUST NOT return all 10,000 contacts
```

---

## 5. Validation Rules

### 5.1 Input Validation
- **Zod schemas** MUST be used for input validation in routes
- **Storage layer** assumes validated input
- **Invariant**: Storage methods do NOT re-validate input

### 5.2 Output Validation
- Returned entities MUST conform to TypeScript types
- **Invariant**: No extra fields, no missing required fields

### 5.3 Foreign Key Validation
```typescript
// Invariant: This MUST be checked in BOTH implementations
createJob({ clientId: "xyz" }) // MUST verify contact "xyz" exists
```

---

## 6. Audit Trail Requirements

### 6.1 Mandatory Audit Logging
The following operations MUST create audit log entries:
- Contact create/update/delete
- Job create/update
- Proposal create/approve/reject/dispatch
- Payment create
- Email dispatch
- WhatsApp dispatch

**Invariant**: If audit log creation fails, operation still succeeds but error is logged

### 6.2 Audit Log Format
```typescript
{
  userId: string | null,        // null for system actions
  action: string,               // "contact_created", "job_updated", etc.
  entityType: string,           // "contact", "job", etc.
  entityId: string,             // UUID of affected entity
  details: Record<string, unknown>  // Contextual data
}
```

---

## 7. Performance Guarantees

### 7.1 MemStorage (Development)
- All operations < 10ms
- No connection pooling
- In-memory data structures

### 7.2 PostgresStorage (Production)
- Simple queries < 100ms
- Complex queries < 500ms
- Connection pooling via Drizzle
- Index usage required for:
  - Email lookups
  - Phone lookups
  - Foreign key joins
  - Status filters

---

## 8. Migration Path

### 8.1 Adding New Entity
When adding a new entity to storage:

1. **Define schema** in `shared/schema.ts`
2. **Add to IStorage interface** with full type signatures
3. **Implement in MemStorage** with in-memory Map
4. **Implement in PostgresStorage** with Drizzle queries
5. **Add tests** that run against BOTH implementations
6. **Update this document** with entity-specific invariants

### 8.2 Breaking Changes
- **Interface changes** MUST be backward compatible for one version
- **Deprecated methods** MUST be marked with `@deprecated` JSDoc
- **Removal** requires migration guide

---

## 9. Testing Requirements

### 9.1 Dual Implementation Tests
```typescript
// Tests MUST run against BOTH implementations
describe('Storage: Contacts', () => {
  runAgainstBothStorages((storage) => {
    it('creates contact', async () => {
      const contact = await storage.createContact({ name: "Test" });
      expect(contact.id).toBeDefined();
    });
  });
});
```

### 9.2 Invariant Tests
- Test idempotency guarantees
- Test foreign key enforcement
- Test null handling
- Test error handling
- Test timestamp consistency

---

## 10. Known Dev/Prod Differences

| Feature | MemStorage (Dev) | PostgresStorage (Prod) | Mitigation |
|---------|------------------|------------------------|------------|
| Transactions | No (logs warning) | Yes | Pass `tx?` parameter |
| Foreign Keys | Manual check | Database constraint | Both check before insert |
| Concurrency | Single-threaded | Multi-threaded | Use optimistic locking |
| Persistence | In-memory (lost on restart) | Persistent | N/A - dev only |
| Query Performance | < 10ms | < 100ms | Use indexes in prod |

---

## Summary

These invariants ensure that:
1. **Development matches production** behavior
2. **No silent failures** in either implementation
3. **Data integrity** is maintained across both
4. **Testing** catches inconsistencies early
5. **Migration** from dev to prod is seamless

**Violations of these invariants are bugs and MUST be fixed.**
