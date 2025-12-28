# Smart Klix CRM - API Reference

Complete API documentation for all backend endpoints.

## Base URL

```
Development: http://localhost:5000/api
Production:  https://your-domain.com/api
```

## Authentication

⚠️ **Current Status**: Authentication not yet implemented (placeholder mode)

Future: All authenticated endpoints will require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Common Response Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Validation error or invalid input
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

For validation errors (Zod):

```json
{
  "error": "Field name is required"
}
```

---

## Health Check

### GET /api/health

Check system status and service availability.

**Response:**

```json
{
  "status": "healthy",
  "database": "connected",
  "ai_agent": "ready",
  "storage": "database",
  "timestamp": "2025-01-21T12:00:00.000Z"
}
```

**Fields:**

- `status`: `healthy` | `degraded`
- `database`: `connected` | `disconnected`
- `ai_agent`: `ready` | `not_configured`
- `storage`: `database` | `memory`
- `timestamp`: ISO 8601 datetime

---

## Contacts

### GET /api/contacts

List all contacts with optional filtering.

**Query Parameters:**

- `status` (optional): Filter by status
- `source` (optional): Filter by acquisition source

**Response:**

```json
[
  {
    "id": "uuid-123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Acme Corp",
    "status": "active",
    "source": "website",
    "address": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701",
    "avatar": null,
    "tags": ["vip", "priority"],
    "customFields": {},
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
]
```

### POST /api/contacts

Create a new contact.

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+0987654321",
  "company": "Tech Inc",
  "status": "lead",
  "source": "referral",
  "address": "456 Oak Ave",
  "city": "Chicago",
  "state": "IL",
  "zip": "60601",
  "tags": ["new"],
  "customFields": {}
}
```

**Validation:**

- `name` or `email` or `phone` required (at least one)
- `status`: `lead` | `active` | `inactive`
- `source`: Optional string
- `tags`: Optional array of strings
- `customFields`: Optional JSON object

**Response:** Created contact object (201 Created)

### PATCH /api/contacts/:id

Update an existing contact.

**Request Body:** Partial contact object (any fields to update)

```json
{
  "status": "active",
  "tags": ["vip", "priority", "high-value"]
}
```

**Response:** Updated contact object

### DELETE /api/contacts/:id

Delete a contact.

**Response:** Success message

```json
{
  "success": true
}
```

---

## Jobs

### GET /api/jobs

List all jobs with optional filtering.

**Query Parameters:**

- `status` (optional): Filter by status
- `contactId` (optional): Filter by contact

**Response:**

```json
[
  {
    "id": "uuid-456",
    "contactId": "uuid-123",
    "title": "Kitchen Renovation",
    "description": "Complete kitchen remodel",
    "status": "in_progress",
    "priority": "high",
    "estimatedValue": "15000.00",
    "assignedTechs": ["tech-1", "tech-2"],
    "scheduledAt": "2025-01-25T09:00:00.000Z",
    "completedAt": null,
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-21T14:00:00.000Z"
  }
]
```

### POST /api/jobs

Create a new job.

**Request Body:**

```json
{
  "contactId": "uuid-123",
  "title": "Bathroom Repair",
  "description": "Fix leaking faucet",
  "status": "lead_intake",
  "priority": "medium",
  "estimatedValue": "500.00",
  "scheduledAt": "2025-01-26T10:00:00.000Z"
}
```

**Validation:**

- `contactId` (required): Valid contact UUID
- `title` (required): String, min 1 character
- `status` (required): `lead_intake` | `estimate_sent` | `scheduled` | `in_progress` | `completed` | `invoiced` | `paid`
- `priority`: `low` | `medium` | `high`
- `estimatedValue`: String (numeric)

**Response:** Created job object (201 Created)

### PATCH /api/jobs/:id

Update a job.

**Request Body:** Partial job object

```json
{
  "status": "completed",
  "completedAt": "2025-01-21T16:00:00.000Z"
}
```

**Response:** Updated job object

### POST /api/jobs/:id/assign-technician

Assign a technician to a job.

**Request Body:**

```json
{
  "technicianId": "tech-3"
}
```

**Validation:**

- `technicianId` (required): String

**Response:** Updated job object with new technician in `assignedTechs` array

**Audit:** Logs to `auditLog` table

### POST /api/jobs/:id/update-status

Update job status (pipeline transition).

**Request Body:**

```json
{
  "status": "in_progress",
  "notes": "Started work on site"
}
```

**Validation:**

- `status` (required): Valid job status
- `notes` (optional): String

**Response:** Updated job object

**Audit:** Logs to `auditLog` table

### POST /api/jobs/:id/record-payment

Record a payment for a job.

**Request Body:**

```json
{
  "amount": "500.00",
  "method": "card",
  "transactionId": "tx-789"
}
```

**Validation:**

- `amount` (required): String (numeric)
- `method` (required): String (e.g., "card", "cash", "check")
- `transactionId` (optional): String

**Response:**

```json
{
  "job": { /* updated job */ },
  "payment": { /* created payment record */ }
}
```

**Audit:** Logs to `auditLog` table

---

## Estimates

### GET /api/estimates

List all estimates.

**Response:**

```json
[
  {
    "id": "uuid-789",
    "jobId": "uuid-456",
    "amount": "15000.00",
    "description": "Kitchen renovation estimate",
    "status": "sent",
    "validUntil": "2025-02-20T00:00:00.000Z",
    "lineItems": [
      {
        "description": "Labor",
        "quantity": 80,
        "rate": "100.00",
        "total": "8000.00"
      }
    ],
    "createdAt": "2025-01-20T10:00:00.000Z",
    "sentAt": "2025-01-20T11:00:00.000Z",
    "acceptedAt": null
  }
]
```

### POST /api/estimates

Create a new estimate.

**Request Body:**

```json
{
  "jobId": "uuid-456",
  "amount": "15000.00",
  "description": "Detailed estimate for kitchen remodel",
  "validUntil": "2025-02-20",
  "lineItems": [
    {
      "description": "Labor",
      "quantity": 80,
      "rate": "100.00",
      "total": "8000.00"
    },
    {
      "description": "Materials",
      "quantity": 1,
      "rate": "7000.00",
      "total": "7000.00"
    }
  ]
}
```

**Validation:**

- `jobId` (required): Valid job UUID
- `amount` (required): String (numeric)
- `lineItems` (optional): Array of line item objects

**Response:** Created estimate object (201 Created)

### PATCH /api/estimates/:id

Update an estimate.

**Request Body:** Partial estimate object

**Response:** Updated estimate object

### POST /api/estimates/:id/accept

Mark estimate as accepted by customer.

**Response:** Updated estimate with `status: "accepted"` and `acceptedAt` timestamp

**Audit:** Logs to `auditLog` table

### POST /api/estimates/:id/reject

Mark estimate as rejected.

**Response:** Updated estimate with `status: "rejected"`

### POST /api/estimates/:id/send

Send estimate to customer (triggers N8N workflow).

**Response:** Success message

**Note:** If N8N_WEBHOOK_URL not configured, returns placeholder response.

---

## Invoices

### GET /api/invoices

List all invoices.

**Response:**

```json
[
  {
    "id": "uuid-101",
    "jobId": "uuid-456",
    "invoiceNumber": "INV-2025-001",
    "amount": "15000.00",
    "status": "paid",
    "dueDate": "2025-02-01T00:00:00.000Z",
    "lineItems": [/* ... */],
    "createdAt": "2025-01-21T10:00:00.000Z",
    "sentAt": "2025-01-21T11:00:00.000Z",
    "paidAt": "2025-01-22T09:00:00.000Z"
  }
]
```

### POST /api/invoices

Create a new invoice.

**Request Body:**

```json
{
  "jobId": "uuid-456",
  "invoiceNumber": "INV-2025-001",
  "amount": "15000.00",
  "dueDate": "2025-02-01",
  "lineItems": [/* ... */]
}
```

**Validation:**

- `jobId` (required): Valid job UUID
- `amount` (required): String (numeric)
- `invoiceNumber` (required): Unique string

**Response:** Created invoice object (201 Created)

### PATCH /api/invoices/:id

Update an invoice.

**Request Body:** Partial invoice object

**Response:** Updated invoice object

### POST /api/invoices/:id/send

Send invoice to customer (triggers N8N workflow).

**Response:** Success message

---

## Payments

### GET /api/payments

List all payment transactions.

**Response:**

```json
[
  {
    "id": "uuid-202",
    "invoiceId": "uuid-101",
    "amount": "15000.00",
    "method": "card",
    "status": "completed",
    "transactionId": "tx-stripe-123",
    "paidAt": "2025-01-22T09:00:00.000Z",
    "createdAt": "2025-01-22T09:00:00.000Z"
  }
]
```

### POST /api/payments

Record a new payment.

**Request Body:**

```json
{
  "invoiceId": "uuid-101",
  "amount": "15000.00",
  "method": "card",
  "transactionId": "tx-stripe-123",
  "status": "completed",
  "paidAt": "2025-01-22T09:00:00.000Z"
}
```

**Validation:**

- `invoiceId` (required): Valid invoice UUID
- `amount` (required): String (numeric)
- `method` (required): String (e.g., "card", "cash", "check", "wire")
- `status` (required): `pending` | `completed` | `failed` | `refunded`

**Response:** Created payment object (201 Created)

### PATCH /api/payments/:id

Update a payment record.

**Request Body:** Partial payment object

**Response:** Updated payment object

---

## Appointments

### GET /api/appointments

List all appointments.

**Response:**

```json
[
  {
    "id": "uuid-303",
    "contactId": "uuid-123",
    "title": "Site Visit - Kitchen Assessment",
    "scheduledAt": "2025-01-25T14:00:00.000Z",
    "duration": 60,
    "status": "pending",
    "notes": "Bring measuring tape",
    "createdAt": "2025-01-20T10:00:00.000Z"
  }
]
```

**Fields:**

- `duration`: Integer (minutes)
- `status`: `pending` | `approved` | `cancelled` | `completed`

⚠️ **Note:** POST /api/appointments not yet implemented. Create functionality will fail.

---

## Notes

### GET /api/notes

List all notes.

**Response:**

```json
[
  {
    "id": "uuid-404",
    "title": "Follow-up Required",
    "content": "Customer requested callback next week",
    "tags": ["follow-up", "priority"],
    "pinned": false,
    "createdAt": "2025-01-21T10:00:00.000Z",
    "updatedAt": "2025-01-21T10:00:00.000Z"
  }
]
```

### POST /api/notes

Create a new note.

**Request Body:**

```json
{
  "title": "Meeting Notes",
  "content": "Discussed project timeline and budget",
  "tags": ["meeting", "planning"]
}
```

**Validation:**

- `title` (required): String, min 1 character
- `content` (required): String
- `tags` (optional): Array of strings
- `pinned` (optional): Boolean

**Response:** Created note object (201 Created)

### PATCH /api/notes/:id

Update a note.

**Request Body:** Partial note object

```json
{
  "pinned": true
}
```

**Response:** Updated note object

### DELETE /api/notes/:id

Delete a note.

**Response:** Success message

---

## Files

### GET /api/files

List all files.

**Response:**

```json
[
  {
    "id": "uuid-505",
    "name": "contract.pdf",
    "type": "application/pdf",
    "size": 245760,
    "url": "https://storage.example.com/files/contract.pdf",
    "uploadedBy": null,
    "createdAt": "2025-01-21T10:00:00.000Z"
  }
]
```

⚠️ **Note:** POST /api/files not implemented. File upload disabled.

### DELETE /api/files/:id

Delete a file.

**Response:** Success message

---

## AI Agent

### POST /api/ai/chat

Send a message to the AI agent.

**Request Body:**

```json
{
  "conversationId": "uuid-606",
  "message": "Create a new job for John Doe - bathroom repair",
  "contactId": "uuid-123",
  "mode": "assist"
}
```

**Validation:**

- `conversationId` (required): Valid conversation UUID
- `message` (required): String
- `contactId` (optional): UUID for context
- `mode` (required): `draft` | `assist` | `auto`

**Response:**

```json
{
  "response": "I'll create a job for John Doe's bathroom repair...",
  "toolCalls": [
    {
      "tool": "create_job",
      "result": { /* job object */ }
    }
  ],
  "mode": "assist",
  "conversationId": "uuid-606"
}
```

**Modes:**

- `draft`: AI suggests but doesn't execute
- `assist`: AI queues actions for approval
- `auto`: AI executes immediately

**Audit:** All tool calls logged to `aiTasks` table

### POST /api/ai/execute-tool

Directly execute an AI tool (used by chat interface).

**Request Body:**

```json
{
  "tool": "create_contact",
  "args": {
    "name": "New Customer",
    "phone": "+1234567890",
    "source": "website"
  }
}
```

**Validation:**

- `tool` (required): Valid tool name
- `args` (required): Tool-specific arguments object

**Response:** Tool execution result

---

## AI Assist Queue

### GET /api/ai/assist-queue

Get pending AI actions awaiting approval.

**Response:**

```json
[
  {
    "id": "uuid-707",
    "action": "create_job",
    "payload": {
      "contactId": "uuid-123",
      "title": "Bathroom Repair",
      "description": "Fix leaking faucet"
    },
    "reasoning": "Customer reported urgent plumbing issue",
    "status": "pending",
    "createdAt": "2025-01-21T10:00:00.000Z"
  }
]
```

### POST /api/ai/assist-queue/:id/approve

Approve and execute a pending action.

**Request Body:**

```json
{
  "notes": "Approved - customer confirmed"
}
```

**Validation:**

- `notes` (optional): String

**Response:** Updated queue item with `status: "approved"` and execution result

**Audit:** Logs to `auditLog` table

### POST /api/ai/assist-queue/:id/reject

Reject a pending action.

**Request Body:**

```json
{
  "reason": "Duplicate job already exists"
}
```

**Validation:**

- `reason` (optional): String

**Response:** Updated queue item with `status: "rejected"`

**Audit:** Logs to `auditLog` table

---

## Conversations (Chat)

### GET /api/conversations

List all chat conversations.

**Response:**

```json
[
  {
    "id": "uuid-808",
    "type": "admin",
    "title": "Admin Chat Session",
    "contactId": null,
    "createdAt": "2025-01-21T10:00:00.000Z",
    "updatedAt": "2025-01-21T14:00:00.000Z"
  }
]
```

**Types:**

- `admin`: Internal admin chat
- `public`: Public widget conversations

### POST /api/conversations

Create a new conversation.

**Request Body:**

```json
{
  "type": "admin",
  "title": "New Chat Session",
  "contactId": null
}
```

**Validation:**

- `type` (required): `admin` | `public`
- `title` (optional): String
- `contactId` (optional): UUID

**Response:** Created conversation object (201 Created)

### GET /api/conversations/:id/messages

Get all messages in a conversation.

**Response:**

```json
[
  {
    "id": "uuid-909",
    "conversationId": "uuid-808",
    "role": "user",
    "content": "Create a new job",
    "timestamp": "2025-01-21T10:00:00.000Z"
  },
  {
    "id": "uuid-910",
    "conversationId": "uuid-808",
    "role": "assistant",
    "content": "I'll create a new job for you...",
    "timestamp": "2025-01-21T10:00:05.000Z"
  }
]
```

**Roles:**

- `user`: User messages
- `assistant`: AI responses
- `system`: System notifications

### POST /api/conversations/:id/messages

Send a message in a conversation.

**Request Body:**

```json
{
  "content": "Create a new contact for Jane Smith",
  "mode": "assist"
}
```

**Validation:**

- `content` (required): String
- `mode` (optional): `draft` | `assist` | `auto`

**Response:** AI response with tool execution results

---

## Public Contact Widget

### POST /api/public/chat

Public endpoint for lead capture widget (no auth required).

**Request Body:**

```json
{
  "message": "I need a quote for kitchen renovation",
  "contact": {
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "phone": "+1555123456"
  },
  "sessionId": "session-abc-123"
}
```

**Validation:**

- `message` (required): String
- `contact` (optional): Contact information object
- `sessionId` (required): Session identifier

**Response:**

```json
{
  "response": "Thank you for reaching out! I'd be happy to help with your kitchen renovation...",
  "conversationId": "uuid-new-conversation"
}
```

**Rate Limiting:** Applied per IP/session

### POST /api/public/identify

Identify a contact in public chat session.

**Request Body:**

```json
{
  "sessionId": "session-abc-123",
  "name": "Sarah Johnson",
  "email": "sarah@example.com",
  "phone": "+1555123456"
}
```

**Response:** Created/updated contact object

---

## Audit Log

### GET /api/audit-log

Get system activity audit trail.

**Query Parameters:**

- `userId` (optional): Filter by user
- `action` (optional): Filter by action type
- `startDate` (optional): ISO date
- `endDate` (optional): ISO date
- `limit` (optional): Max results (default: 100)

**Response:**

```json
[
  {
    "id": "uuid-1010",
    "userId": null,
    "action": "create_job",
    "entityType": "job",
    "entityId": "uuid-456",
    "details": { /* action-specific data */ },
    "timestamp": "2025-01-21T10:00:00.000Z"
  }
]
```

**Common Actions:**

- `create_contact`, `update_contact`, `delete_contact`
- `create_job`, `update_job`, `assign_technician`
- `create_estimate`, `send_estimate`, `accept_estimate`
- `ai_tool_execution`, `approve_ai_action`, `reject_ai_action`

---

## Settings

### GET /api/settings

Get current system settings.

**Response:**

```json
{
  "id": "settings-1",
  "companyName": "Smart Klix",
  "companyLogo": null,
  "primaryColor": "#FDB913",
  "secondaryColor": "#1E40AF",
  "aiAgentMode": "assist",
  "n8nWebhookUrl": "https://n8n.example.com/webhook",
  "updatedAt": "2025-01-20T10:00:00.000Z"
}
```

**Fields:**

- `aiAgentMode`: `draft` | `assist` | `auto`

### PATCH /api/settings

Update system settings.

**Request Body:** Partial settings object

```json
{
  "companyName": "My Company CRM",
  "primaryColor": "#FF0000",
  "aiAgentMode": "auto"
}
```

**Validation:**

- `companyName` (optional): String
- `primaryColor` (optional): Hex color string
- `secondaryColor` (optional): Hex color string
- `aiAgentMode` (optional): `draft` | `assist` | `auto`

**Response:** Updated settings object

**Audit:** Logs to `auditLog` table

---

## N8N Integration Endpoints

### POST /api/n8n/create-contact

N8N webhook endpoint to create contacts from external sources.

**Request Body:**

```json
{
  "name": "Lead from Website",
  "email": "lead@example.com",
  "phone": "+1555999000",
  "source": "website_form"
}
```

**Authentication:** Requires X-N8N-Signature header (production)

**Response:** Created contact object

### POST /api/n8n/update-contact

Update contact from N8N workflow.

**Request Body:**

```json
{
  "contactId": "uuid-123",
  "status": "active",
  "tags": ["qualified", "hot-lead"]
}
```

**Response:** Updated contact object

### POST /api/n8n/create-lead

Create lead and job from N8N workflow.

**Request Body:**

```json
{
  "contact": {
    "name": "New Lead",
    "phone": "+1555888777"
  },
  "job": {
    "title": "Service Request",
    "description": "Customer inquiry from phone call"
  }
}
```

**Response:**

```json
{
  "contact": { /* created contact */ },
  "job": { /* created job */ }
}
```

### POST /api/n8n/create-job

Create job from N8N workflow.

**Request Body:**

```json
{
  "contactId": "uuid-123",
  "title": "Emergency Repair",
  "priority": "high",
  "estimatedValue": "1500.00"
}
```

**Response:** Created job object

### POST /api/n8n/write-activity-log

Log activity from N8N workflows.

**Request Body:**

```json
{
  "action": "sms_sent",
  "entityType": "contact",
  "entityId": "uuid-123",
  "details": {
    "to": "+1234567890",
    "message": "Your appointment is confirmed"
  }
}
```

**Response:** Created audit log entry

### POST /api/events/update

N8N callback endpoint for workflow status updates.

**Request Body:**

```json
{
  "eventType": "estimate_sent",
  "entityId": "uuid-estimate-123",
  "status": "success",
  "details": {
    "sentAt": "2025-01-21T10:00:00.000Z",
    "recipient": "customer@example.com"
  }
}
```

**Response:** Success message

---

## Rate Limiting

Public endpoints (`/api/public/*`) are rate-limited:

- **Per IP**: 100 requests / 15 minutes
- **Per Session**: 20 requests / minute

Authenticated endpoints (future): 1000 requests / hour per user

**Rate Limit Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642780800
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:5000');
```

### Chat Streaming

Subscribe to AI chat responses:

```javascript
ws.send(JSON.stringify({
  type: 'chat',
  conversationId: 'uuid-123',
  message: 'Create a new job'
}));
```

**Server Response (streaming):**

```json
{
  "type": "chunk",
  "content": "I'll create a new job for you..."
}
```

**Final Message:**

```json
{
  "type": "complete",
  "conversationId": "uuid-123",
  "toolCalls": [/* ... */]
}
```

---

## Pagination (Future)

Large list endpoints will support pagination:

```
GET /api/contacts?page=2&limit=50
```

**Response:**

```json
{
  "data": [/* ... */],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 500,
    "totalPages": 10
  }
}
```

---

## Common Patterns

### Creating Related Resources

1. Create contact: `POST /api/contacts`
2. Create job: `POST /api/jobs` with `contactId`
3. Create estimate: `POST /api/estimates` with `jobId`
4. Create invoice: `POST /api/invoices` with `jobId`
5. Record payment: `POST /api/payments` with `invoiceId`

### Status Workflows

**Job Pipeline:**

```
lead_intake → estimate_sent → scheduled → in_progress → completed → invoiced → paid
```

**Estimate States:**

```
draft → sent → accepted/rejected
```

**Payment States:**

```
pending → completed/failed/refunded
```

### AI Agent Workflow

1. User sends message: `POST /api/ai/chat`
2. AI analyzes and suggests tools
3. Mode-specific behavior:
   - **Draft**: Returns suggestions only
   - **Assist**: Queues in `assistQueue` for approval
   - **Auto**: Executes immediately
4. Results returned in response
5. All logged to `aiTasks` and `auditLog`

---

## Error Handling

### Validation Errors

```json
{
  "error": "Invalid email address"
}
```

### Not Found

```json
{
  "error": "Contact not found"
}
```

### Server Errors

```json
{
  "error": "An unexpected error occurred"
}
```

---

## Testing Endpoints

Use curl or Postman:

```bash
# Health check
curl http://localhost:5000/api/health

# Create contact
curl -X POST http://localhost:5000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# List contacts
curl http://localhost:5000/api/contacts

# AI chat
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"test-123","message":"Hello","mode":"draft"}'
```

---

## API Versioning (Future)

Future versions will use URL versioning:

```
/api/v2/contacts
```

Current API is considered v1 (no version in URL).

---

**Smart Klix CRM API** - Complete backend API for field service CRM automation.

For questions or issues, refer to the main [README](../README.md) or contact support.
