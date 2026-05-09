# SmartKlix CRM REST API Specification

**Version**: 1.0  
**Date**: November 15, 2025  
**Author**: SmartKlix CRM Development Team  
**Base URL**: `https://5111a1a7-2f59-4ad2-9b99-d56328fad3c6-00-3byo21gezjnvn.worf.replit.dev`

---

## Authentication

All N8N integration endpoints require Bearer token authentication.

**Header Format**:
```
Authorization: Bearer {N8N_INTERNAL_TOKEN}
```

**Environment Variable**: `N8N_INTERNAL_TOKEN`  
**Current Value**: `f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1`

**Authentication Middleware**: `requireInternalToken` (server/auth-middleware.ts)

**Error Responses**:
- `401 Unauthorized`: Missing or invalid authorization header
- `403 Forbidden`: Invalid token
- `503 Service Unavailable`: Token not configured on server

---

## API Endpoints

### 1. Contact Lookup by Phone

**Endpoint**: `GET /api/contacts/lookup`

**Query Parameters**:
- `phone` (required): Phone number to search for

**Request Example**:
```bash
curl -X GET "https://.../api/contacts/lookup?phone=%2B15551234567" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1"
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "company": "ABC Corp",
  "status": "new",
  "avatar": null,
  "createdAt": "2025-11-15T10:00:00.000Z",
  "updatedAt": "2025-11-15T10:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: `{ "error": "Phone number is required" }`
- `404 Not Found`: `{ "error": "Contact not found" }`
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1050-1078

---

### 2. Contact Create/Upsert

**Endpoint**: `POST /api/contacts/create`

**Behavior**: 
- If `phone` is provided and matches existing contact → **UPDATE** existing contact
- Otherwise → **CREATE** new contact

**Request Schema** (Zod validation):
```typescript
{
  phone?: string,      // Optional
  name?: string,       // Optional
  email?: string,      // Optional (validated as email if provided)
  company?: string     // Optional
}
```

**Validation Rule**: At least ONE of `phone`, `email`, or `name` MUST be provided

**Deduplication Logic**: Matches by `phone` if provided. Updates only fields that are present in request.

**Request Example (Create)**:
```bash
curl -X POST "https://.../api/contacts/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "phone": "+15551234567",
    "name": "John Smith",
    "email": "john@example.com",
    "company": "ABC Plumbing"
  }'
```

**Request Example (Upsert - Updates Existing)**:
```bash
curl -X POST "https://.../api/contacts/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "phone": "+15551234567",
    "name": "John Smith Updated"
  }'
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+15551234567",
  "company": "ABC Plumbing",
  "status": "new",
  "avatar": null,
  "createdAt": "2025-11-15T10:00:00.000Z",
  "updatedAt": "2025-11-15T10:05:00.000Z"
}
```

**Debug Field** (not persisted, returned for logging only):
- `_action: "created"` when new contact is created
- `_action: "updated"` when existing contact is updated

**Error Responses**:
- `400 Bad Request`: `{ "error": "At least one of phone, email, or name must be provided" }`
- `400 Bad Request`: `{ "error": "No fields provided for update" }` (when upserting without new data)
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1089-1148

**Audit Log**: Creates `contact_upsert_create` or `contact_upsert_update` audit entry

---

### 3. Contact Update

**Endpoint**: `POST /api/contacts/update`

**Behavior**: Updates specific fields on existing contact by ID

**Request Schema**:
```typescript
{
  id: string,          // Required - Contact UUID
  name?: string,       // Optional
  email?: string,      // Optional (validated as email if provided)
  company?: string,    // Optional
  status?: string      // Optional
}
```

**Validation Rule**: At least ONE update field must be provided

**Request Example**:
```bash
curl -X POST "https://.../api/contacts/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "id": "uuid-string",
    "name": "Jane Doe",
    "status": "active"
  }'
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+15551234567",
  "company": "XYZ Corp",
  "status": "active",
  "avatar": null,
  "createdAt": "2025-11-15T10:00:00.000Z",
  "updatedAt": "2025-11-15T10:10:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: `{ "error": "No fields provided for update" }`
- `404 Not Found`: `{ "error": "Contact not found" }`
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1158-1200

---

### 4. Lead Creation

**Endpoint**: `POST /api/leads/create`

**Behavior**: Creates a lead (job record with `jobType: "lead"`) for an existing contact

**Request Schema**:
```typescript
{
  contactId: string,      // Required - Must be existing contact UUID
  reason?: string,        // Optional - Lead reason
  summary?: string,       // Optional - Lead summary/details
  status?: string         // Optional - Default: "lead_intake"
}
```

**Request Example**:
```bash
curl -X POST "https://.../api/leads/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "contactId": "uuid-string",
    "reason": "Interested in HVAC installation",
    "summary": "Customer called about replacing old AC unit. Budget: $5000-$8000"
  }'
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "title": "New Lead",
  "clientId": "contact-uuid",
  "status": "lead_intake",
  "jobType": "lead",
  "value": null,
  "deadline": null,
  "description": null,
  "jobNumber": null,
  "scheduledStart": null,
  "scheduledEnd": null,
  "closedAt": null,
  "assignedTechs": [],
  "sourceLeadId": null,
  "sourceEstimateId": null,
  "createdAt": "2025-11-15T10:00:00.000Z",
  "updatedAt": "2025-11-15T10:00:00.000Z"
}
```

**Side Effects**:
- Creates a Note if `reason` or `summary` is provided
- Creates audit log entry

**Error Responses**:
- `404 Not Found`: `{ "error": "Contact not found" }`
- `400 Bad Request`: Validation errors
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1209-1254

---

### 5. Job Creation

**Endpoint**: `POST /api/jobs/create`

**Behavior**: Creates a full job record with detailed metadata

**Request Schema**:
```typescript
{
  contactId: string,        // Required - Must be existing contact UUID
  jobType?: string,         // Optional - Default: "general"
  propertyType?: string,    // Optional
  address?: string,         // Optional
  city?: string,            // Optional
  budget?: string,          // Optional
  preferredTime?: string,   // Optional
  notes?: string,           // Optional
  status?: string           // Optional - Default: "lead_intake"
}
```

**Request Example**:
```bash
curl -X POST "https://.../api/jobs/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "contactId": "uuid-string",
    "jobType": "HVAC Repair",
    "propertyType": "Residential",
    "address": "123 Main St",
    "city": "Austin",
    "budget": "$500-$1000",
    "preferredTime": "Morning",
    "notes": "AC not cooling properly"
  }'
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "title": "HVAC Repair",
  "clientId": "contact-uuid",
  "status": "lead_intake",
  "jobType": "HVAC Repair",
  "description": "AC not cooling properly",
  "value": null,
  "deadline": null,
  "jobNumber": null,
  "scheduledStart": null,
  "scheduledEnd": null,
  "closedAt": null,
  "assignedTechs": [],
  "sourceLeadId": null,
  "sourceEstimateId": null,
  "createdAt": "2025-11-15T10:00:00.000Z",
  "updatedAt": "2025-11-15T10:00:00.000Z"
}
```

**Side Effects**:
- Creates a detailed Note with all metadata fields
- Creates audit log entry

**Error Responses**:
- `404 Not Found`: `{ "error": "Contact not found" }`
- `400 Bad Request`: Validation errors
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1268-1324

---

### 6. Activity Log Write

**Endpoint**: `POST /api/activity-log/write`

**Behavior**: Logs communication or activity for a contact

**Request Schema**:
```typescript
{
  contactId: string,              // Required - Must be existing contact UUID
  type: string,                   // Required - Activity type (e.g., "sms", "call", "email")
  direction?: string,             // Optional - "inbound" or "outbound"
  summary: string,                // Required - Activity description
  metadata?: Record<string, any>, // Optional - Additional data
  timestamp?: string              // Optional - ISO 8601 timestamp
}
```

**Request Example (SMS)**:
```bash
curl -X POST "https://.../api/activity-log/write" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "contactId": "uuid-string",
    "type": "sms",
    "direction": "outbound",
    "summary": "Sent appointment confirmation: Tomorrow at 10am",
    "metadata": {
      "from": "+15551234567",
      "to": "+15559876543",
      "messageId": "SM123456"
    }
  }'
```

**Request Example (Phone Call)**:
```bash
curl -X POST "https://.../api/activity-log/write" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1" \
  -d '{
    "contactId": "uuid-string",
    "type": "call",
    "direction": "inbound",
    "summary": "Customer called to reschedule appointment",
    "metadata": {
      "duration": 180,
      "callSid": "CA987654"
    }
  }'
```

**Success Response** (200):
```json
{
  "id": "uuid-string",
  "contactId": "contact-uuid",
  "type": "sms",
  "summary": "Sent appointment confirmation: Tomorrow at 10am",
  "timestamp": "2025-11-15T10:00:00.000Z"
}
```

**Side Effects**:
- Creates a Note associated with the contact
- Creates audit log entry

**Error Responses**:
- `404 Not Found`: `{ "error": "Contact not found" }`
- `400 Bad Request`: Validation errors
- `401/403`: Authentication errors

**Implementation**: server/routes.ts line 1335-1383

---

## Request/Response Logging

All N8N API endpoints include comprehensive logging:

**Log Format**:
```
[N8N API] {METHOD} {ENDPOINT}
[N8N API] Request: {JSON payload}
[N8N API] {ENDPOINT} - Response {STATUS}: {JSON response}
[N8N API] ERROR {ENDPOINT}: {error details}
```

**Example**:
```
[N8N API] POST /api/contacts/create
[N8N API] Request: {
  "phone": "+15551234567",
  "name": "John Smith",
  "email": "john@example.com"
}
[N8N API] /api/contacts/create - Response 200: {
  "id": "abc-123",
  "phone": "+15551234567",
  "name": "John Smith",
  "_action": "created"
}
```

This logging is implemented in helper functions (server/routes.ts lines 32-43):
- `logN8NRequest(endpoint, method, data)`
- `logN8NResponse(endpoint, status, data)`
- `logN8NError(endpoint, error)`

---

## Data Model Notes

### Contact Fields
All fields are **nullable** except `status`:

```typescript
{
  id: string (UUID, auto-generated)
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  status: string (default: "new")
  avatar: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Status Values**: "new", "active", "inactive", "qualified", "unqualified" (or any custom value)

### Job Fields
```typescript
{
  id: string (UUID, auto-generated)
  title: string
  clientId: string (references contacts.id)
  status: string (default: "lead_intake")
  jobType: string (default: "lead")
  description: string | null
  value: numeric | null
  deadline: timestamp | null
  jobNumber: string | null
  scheduledStart: timestamp | null
  scheduledEnd: timestamp | null
  closedAt: timestamp | null
  assignedTechs: jsonb[] (default: [])
  sourceLeadId: string | null
  sourceEstimateId: string | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## Error Handling Standards

**All errors return JSON with**:
```json
{
  "error": "Human-readable error message"
}
```

**HTTP Status Codes**:
- `200 OK`: Success
- `400 Bad Request`: Validation error or missing required fields
- `401 Unauthorized`: Missing or malformed Authorization header
- `403 Forbidden`: Invalid token
- `404 Not Found`: Resource not found (contact, job, etc.)
- `500 Internal Server Error`: Server-side error
- `503 Service Unavailable`: Service not configured

---

## Integration Testing Checklist

1. ✅ Test authentication with valid token
2. ✅ Test authentication with invalid/missing token
3. ✅ Contact lookup (existing and non-existing)
4. ✅ Contact create (new contact)
5. ✅ Contact create (upsert existing by phone)
6. ✅ Contact update (partial updates)
7. ✅ Lead creation
8. ✅ Job creation with full metadata
9. ✅ Activity log writing (various types)
10. ✅ Verify audit logs are created
11. ✅ Verify Notes are created when appropriate
12. ✅ Check server logs for [N8N API] entries

---

## Production Deployment Notes

**Environment Variables Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `N8N_INTERNAL_TOKEN`: Secret token for N8N ↔ CRM communication
- `N8N_WEBHOOK_URL`: N8N webhook base URL (currently: `https://smartklix.app.n8n.cloud/webhook/smartklix-event`)

**Database**: PostgreSQL via Drizzle ORM
**Schema**: shared/schema.ts
**Storage Layer**: server/storage.ts (abstraction over DB)

---

**End of SmartKlix CRM API Specification v1.0**
