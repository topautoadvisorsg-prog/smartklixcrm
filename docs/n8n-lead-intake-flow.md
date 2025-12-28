# Neo8Flow Lead Intake Workflow - n8n Implementation Guide

This document describes how to build an n8n workflow that integrates with the Smart Klix CRM Lead Intake system.

## Overview

The Lead Intake flow enables automated lead capture from multiple channels (widget, voice, web forms, API, import) with processing through Neo8Flow and synchronization back to the CRM.

### Architecture Flow

```
[Lead Source] → [CRM /api/intake/lead] → [events_outbox] → [Neo8Flow]
                                                               ↓
[CRM Updated] ← [/api/intake/sync] ← [Neo8Flow Processing] ← [Lead Processing]
```

## Phase 1: Receiving Lead Intake Events

### Webhook Trigger Configuration

Create an n8n Webhook node to receive lead intake events from the CRM.

**Endpoint:** `POST {NEO8FLOW_URL}/events/intake`

**Expected Request Headers:**
```
Content-Type: application/json
x-internal-token: {TENANT_TOKEN}
```

**Request Payload Structure:**

Note: The CRM only forwards `outbox_id`, `tenant_id`, and `payload` (with timestamp) to Neo8Flow. Other envelope fields like `channel`, `recording_url`, and `lead_score` remain in the CRM's events_outbox table. If you need these values in n8n, you must retrieve them via a separate API call or store them in the payload.

```json
{
  "outbox_id": "uuid-string",
  "tenant_id": "tenant-uuid",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Acme Inc",
    "message": "Interested in your services",
    "source": "widget",
    "tags": ["hvac", "residential"],
    "custom_fields": {},
    "contact_id": "optional-existing-contact-id",
    "timestamp": "2025-12-06T10:30:00.000Z"
  }
}
```

### Required Fields Validation

At least ONE of these identifiers must be present in the original lead intake request payload:
- `email` (valid email format)
- `phone` (any non-empty string)
- `contact_id` (reference to existing CRM contact)

The original envelope may also have `recording_url` which counts as an identifier (for voice channel). This validation happens at the CRM before dispatch to Neo8Flow.

## Phase 2: Lead Processing Logic

### n8n Workflow Steps

1. **Validate Token** - Check `x-internal-token` header matches expected value
2. **Parse Payload** - Extract lead data from request body
3. **Enrich Lead** (optional) - Add additional data, scoring, etc.
4. **Determine Tags** - Apply business rules for tag assignment
5. **Calculate Lead Score** (optional) - 0-100 integer score based on lead quality
6. **Prepare Sync Payload** - Format data for CRM callback

### Sample n8n Flow Structure

```
[Webhook Trigger]
       ↓
[Header Validation]
       ↓
[IF: Valid Token?]
    ├── Yes → [Parse Lead Data]
    │              ↓
    │         [Business Logic / Enrichment]
    │              ↓
    │         [HTTP Request: POST /api/intake/sync]
    │              ↓
    │         [Respond: Success]
    │
    └── No → [Respond: 401 Unauthorized]
```

## Phase 3: CRM Sync Callback

After processing the lead, n8n must call back to the CRM to sync the data.

### Sync Endpoint

**URL:** `POST {CRM_BASE_URL}/api/intake/sync`

**Required Headers:**
```
Content-Type: application/json
Authorization: Bearer {N8N_INTERNAL_TOKEN}
```

**Important:** The CRM uses `Authorization: Bearer <token>` format, not `x-internal-token` header.

### Success Callback Payload

```json
{
  "outbox_id": "original-outbox-uuid",
  "tenant_id": "tenant-uuid",
  "status": "success",
  "payload": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "Acme Inc",
    "message": "Interested in your services",
    "source": "widget",
    "tags": ["hvac", "residential", "high-priority"],
    "custom_fields": {},
    "contact_id": "optional-existing-contact-id",
    "timestamp": "2025-12-06T10:30:00.000Z"
  },
  "channel": "widget",
  "recording_url": "https://storage.example.com/recordings/abc123.mp3",
  "lead_score": 85
}
```

### Error Callback Payload

If processing fails, report the error. Note: the `payload` object is still required by the schema:

```json
{
  "outbox_id": "original-outbox-uuid",
  "tenant_id": "tenant-uuid",
  "status": "error",
  "error_message": "Failed to validate email domain",
  "payload": {}
}
```

### Sync Response (from CRM)

**Success Response (200):**
```json
{
  "success": true,
  "outbox_id": "original-outbox-uuid",
  "synced": {
    "contact_id": "new-or-existing-contact-id",
    "conversation_id": "conversation-uuid",
    "file_id": "file-uuid-if-recording",
    "lead_score": 85
  }
}
```

**Validation Error (400):**
```json
{
  "error": "Validation failed",
  "details": {
    "outbox_id": ["Required"],
    "status": ["Invalid enum value"]
  }
}
```

**Auth Error (401):**
```json
{
  "error": "Missing or invalid authorization header"
}
```

## CRM Sync Behavior

When the CRM receives the sync callback, it performs the following operations:

### 1. Contact Upsert
- **Priority:** `contact_id` > `email` > `phone`
- If contact exists: Updates empty fields only, merges tags (deduplicates)
- If new: Creates contact with `customerType: "lead"`

### 2. Conversation/Agent Chat
- Links to contact if found/created
- Creates new conversation if none exists
- Updates existing conversation with lead_score if provided
- Adds initial message from `payload.message` if present

### 3. Tags
- Applied to contact record
- Merged with existing tags (no duplicates)

### 4. Lead Score
- Stored on conversation record
- Integer value 0-100

### 5. Recording Attachment
- If `recording_url` provided, creates file record linked to contact
- Type: `audio/recording`

## Environment Variables

### CRM Side
| Variable | Description |
|----------|-------------|
| `NEO8FLOW_URL` | Base URL of n8n/Neo8Flow instance |
| `N8N_INTERNAL_TOKEN` | Shared secret for sync callback authentication |
| `TENANT_TOKEN` | Token sent to Neo8Flow in `x-internal-token` header |

### n8n Side
| Variable | Description |
|----------|-------------|
| `CRM_BASE_URL` | Base URL of CRM instance |
| `INTERNAL_TOKEN` | Expected token in incoming `x-internal-token` header |
| `CRM_AUTH_TOKEN` | Token to use in `Authorization: Bearer` header for sync callback |

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| `/api/intake/lead` | 50 requests/minute/IP |
| `/api/intake/sync` | 100 requests/minute/IP |

## Idempotency

The CRM handles idempotency via `idempotency_key` in the original lead intake request.

If a duplicate lead is submitted (same `tenant_id` + `idempotency_key`):
```json
{
  "status": "duplicate",
  "outbox_id": "existing-outbox-uuid",
  "message": "Existing lead"
}
```

## Error Handling & Retry

### CRM Outbox Dispatcher
- **Max Retries:** 5
- **Backoff:** Exponential (base 2 seconds)
- **Dead Letter:** After 5 failures, status set to `dead_letter`

### n8n Recommendations
- Implement retry logic in HTTP Request nodes
- Log failures to external monitoring
- Store failed payloads for manual review

## Complete n8n Workflow JSON Template

Note: This template uses n8n expression syntax. Environment variables are accessed via `$env.VARIABLE_NAME`. The HTTP Request node is configured to send JSON body directly.

```json
{
  "name": "Lead Intake Processor",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "path": "/events/intake",
        "httpMethod": "POST",
        "responseMode": "responseNode"
      }
    },
    {
      "name": "Validate Token",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [450, 300],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.headers['x-internal-token'] }}",
              "operation": "equals",
              "value2": "={{ $env.INTERNAL_TOKEN }}"
            }
          ]
        }
      }
    },
    {
      "name": "Process Lead",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [650, 200],
      "parameters": {
        "jsCode": "// Extract and process lead data\nconst { outbox_id, tenant_id, payload } = $input.first().json.body;\n\n// Add your business logic here\n// - Lead scoring\n// - Tag assignment\n// - Data enrichment\n\nconst lead_score = 50; // Calculate based on your rules\nconst enriched_tags = [...(payload.tags || []), 'neo8flow-processed'];\n\nreturn [{\n  json: {\n    outbox_id,\n    tenant_id,\n    status: 'success',\n    payload: {\n      ...payload,\n      tags: enriched_tags\n    },\n    channel: 'widget',\n    lead_score\n  }\n}];"
      }
    },
    {
      "name": "CRM Sync Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 200],
      "parameters": {
        "url": "={{ $env.CRM_BASE_URL + '/api/intake/sync' }}",
        "method": "POST",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "={{ 'Bearer ' + $env.CRM_AUTH_TOKEN }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json }}"
      }
    },
    {
      "name": "Success Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1050, 200],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { success: true, synced: $json } }}",
        "options": {
          "responseCode": 200
        }
      }
    },
    {
      "name": "Unauthorized Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [650, 400],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { error: 'Unauthorized' } }}",
        "options": {
          "responseCode": 401
        }
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [[{ "node": "Validate Token", "type": "main", "index": 0 }]]
    },
    "Validate Token": {
      "main": [
        [{ "node": "Process Lead", "type": "main", "index": 0 }],
        [{ "node": "Unauthorized Response", "type": "main", "index": 0 }]
      ]
    },
    "Process Lead": {
      "main": [[{ "node": "CRM Sync Callback", "type": "main", "index": 0 }]]
    },
    "CRM Sync Callback": {
      "main": [[{ "node": "Success Response", "type": "main", "index": 0 }]]
    }
  }
}
```

## Testing the Integration

### 1. Test Lead Intake Endpoint

```bash
curl -X POST http://localhost:5000/api/intake/lead \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "idempotency_key": "test-123",
    "event_type": "lead.created",
    "channel": "api",
    "payload": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "+1234567890",
      "message": "Test lead"
    }
  }'
```

### 2. Test CRM Sync Callback

```bash
curl -X POST http://localhost:5000/api/intake/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_N8N_INTERNAL_TOKEN" \
  -d '{
    "outbox_id": "outbox-uuid",
    "tenant_id": "test-tenant",
    "status": "success",
    "payload": {
      "name": "Test User",
      "email": "test@example.com",
      "tags": ["test", "api"]
    },
    "channel": "api",
    "lead_score": 75
  }'
```

## Monitoring & Debugging

### CRM Logs
- Check server console for `[Neo8Flow]` prefixed messages
- Audit log entries: `lead.intake.received`, `lead.sync.completed`, `lead.sync.failed`

### n8n Logs
- Enable execution logging in n8n settings
- Monitor workflow executions for failures
- Check HTTP Request node responses

### Database Tables
- `events_outbox` - Track intake event status (pending, synced, failed, dead_letter)
- `audit_log` - Full audit trail of all operations
- `contacts` - Verify contact creation/updates
- `conversations` - Check conversation linking
