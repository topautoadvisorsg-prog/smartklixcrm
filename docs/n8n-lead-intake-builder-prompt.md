# Neo8Flow Lead Intake Workflow - Builder Prompt

**Send this complete prompt to Neo8Flow (n8n) to build the Lead Intake workflow.**

---

## BUILDER PROMPT

We need a complete n8n workflow that integrates with Smart Klix CRM for lead intake processing. Build all nodes, connections, validation logic, normalization, and response handling as specified below.

### Flow Name

**Lead Intake Flow**

### Purpose

Smart Klix CRM sends lead intake events to Neo8Flow. The workflow:

1. Receives the webhook from CRM
2. Validates the authentication token
3. Processes and optionally enriches the lead data
4. Normalizes specified fields
5. Calculates a lead score
6. Calls back to CRM to sync the processed data
7. Returns appropriate responses

**IMPORTANT: There IS a callback to CRM. After processing, you MUST call `/api/intake/sync` to sync data back.**

---

## INCOMING EVENT SPECIFICATION

### Webhook Endpoint

**POST** `{NEO8FLOW_BASE_URL}/events/intake`

### Required Headers

```
Content-Type: application/json
x-internal-token: {TENANT_TOKEN}
```

### Request Payload Structure

The CRM sends this EXACT structure via `dispatchIntakeToNeo8Flow`:

```json
{
  "outbox_id": "uuid-string",
  "tenant_id": "tenant-uuid-string",
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

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outbox_id` | string (UUID) | Yes | Unique identifier for this intake event (CRM's events_outbox.id) |
| `tenant_id` | string | Yes | Tenant/company identifier |
| `payload` | object | Yes | Lead data container |
| `payload.name` | string | No | Lead's full name |
| `payload.email` | string | No | Email address (must be valid format if provided) |
| `payload.phone` | string | No | Phone number |
| `payload.company` | string | No | Company name |
| `payload.message` | string | No | Initial message or inquiry |
| `payload.source` | string | No | Where the lead came from |
| `payload.tags` | string[] | No | Tags to apply to the contact |
| `payload.custom_fields` | object | No | Additional custom data |
| `payload.contact_id` | string | No | Reference to existing CRM contact |
| `payload.timestamp` | string (ISO-8601) | Yes | Server-generated timestamp from CRM |

### What is NOT Sent to Neo8Flow

The CRM stores additional envelope fields in its `events_outbox` table but does NOT send them to Neo8Flow:
- `channel` - Stored in CRM, not sent
- `recording_url` - Stored in CRM, not sent
- `lead_score` - Stored in CRM, not sent
- `schema_version` - Stored in CRM, not sent
- `event_type` - Stored in CRM, not sent
- `idempotency_key` - Stored in CRM, not sent

Neo8Flow should generate its own `channel` and `lead_score` values to send back in the sync callback based on the `payload.source` field or other business logic.

---

## VALIDATION RULES

### 1. Token Validation

Check the `x-internal-token` header matches the expected `INTERNAL_TOKEN` environment variable.

**If invalid:** Return HTTP 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "timestamp": "<ISO8601>"
}
```

### 2. Required Fields

The following fields are REQUIRED and must be present:

- `outbox_id` (non-empty string)
- `tenant_id` (non-empty string)
- `payload` (object)

**If missing:** Return HTTP 400 Bad Request

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Missing required fields",
  "details": {
    "missing": ["outbox_id", "tenant_id"]
  },
  "timestamp": "<ISO8601>"
}
```

### 3. Identifier Validation (Defensive Check)

The CRM validates identifiers BEFORE sending to n8n, so at least one identifier should exist. For defensive programming, you may verify that the payload contains at least one of:

- `payload.email` (valid email format)
- `payload.phone` (non-empty string)
- `payload.contact_id` (non-empty string)

**Note:** Voice leads may only have a `recording_url` as identifier, which is stored at the CRM level and not sent to n8n. Trust that CRM has validated this.

---

## NORMALIZATION RULES

Apply these normalizations to the payload before sync callback:

### 1. Email Normalization
- Convert to lowercase
- Trim whitespace

```javascript
if (payload.email) {
  payload.email = payload.email.toLowerCase().trim();
}
```

### 2. Phone Normalization (Optional)
- Convert to E.164 format if possible
- Remove non-numeric characters except leading +

```javascript
if (payload.phone) {
  let cleaned = payload.phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = '+1' + cleaned; // Assume US if 10 digits
  }
  payload.phone = cleaned;
}
```

### 3. Tag Deduplication
- Remove duplicate tags
- Convert to lowercase for consistency

```javascript
if (payload.tags && Array.isArray(payload.tags)) {
  payload.tags = [...new Set(payload.tags.map(t => t.toLowerCase().trim()))];
}
```

### 4. Add Processing Tag
- Add a tag to indicate the lead was processed by Neo8Flow

```javascript
payload.tags = [...(payload.tags || []), 'neo8flow-processed'];
```

---

## LEAD PROCESSING LOGIC

### Determine Channel

Map `payload.source` to a valid CRM channel value:

```javascript
// Map source to CRM channel enum
const channelMap = {
  'widget': 'widget',
  'chat_widget': 'widget',
  'voice': 'voice',
  'twilio_voice': 'voice',
  'web_form': 'web_form',
  'contact_form': 'web_form',
  'extended_form': 'web_form',
  'form': 'web_form',
  'api': 'api',
  'import': 'import',
  'email': 'api', // Map email to api since it's not in the enum
};

const channel = channelMap[payload.source?.toLowerCase()] || 'widget';
```

**Valid CRM channel values:** `"widget"`, `"voice"`, `"web_form"`, `"api"`, `"import"`

### Lead Scoring

Calculate a lead score (0-100) based on your business rules:

```javascript
let leadScore = 50; // Base score

// Adjust based on data completeness
if (payload.email) leadScore += 10;
if (payload.phone) leadScore += 10;
if (payload.company) leadScore += 15;
if (payload.message && payload.message.length > 50) leadScore += 15;

// Cap at 100
leadScore = Math.min(leadScore, 100);
```

### Future Automation Placeholder

Add a node named **"Lead Intake - Future Automation Placeholder"** that executes after validation. This is where you'll add future automation logic like:
- CRM enrichment
- Email verification
- Duplicate detection
- Lead routing

---

## CRM SYNC CALLBACK (REQUIRED)

After processing, you MUST call back to the CRM to sync the data.

### Endpoint

**POST** `{CRM_BASE_URL}/api/intake/sync`

### Required Headers

```
Content-Type: application/json
Authorization: Bearer {N8N_INTERNAL_TOKEN}
```

**IMPORTANT:** The CRM's `requireInternalToken` middleware expects `Authorization: Bearer <token>` format. The token is validated against `process.env.N8N_INTERNAL_TOKEN` on the CRM side.

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
    "tags": ["hvac", "residential", "neo8flow-processed"],
    "custom_fields": {},
    "contact_id": "optional-existing-contact-id",
    "timestamp": "2025-12-06T10:30:00.000Z"
  },
  "channel": "widget",
  "lead_score": 85
}
```

### Error Callback Payload

If processing fails, report the error:

```json
{
  "outbox_id": "original-outbox-uuid",
  "tenant_id": "tenant-uuid",
  "status": "error",
  "error_message": "Description of what failed",
  "payload": {}
}
```

### Field Descriptions for Sync (crmSyncSchema)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outbox_id` | string | Yes | Echo back the original outbox_id |
| `tenant_id` | string | Yes | Echo back the original tenant_id |
| `status` | enum | Yes | `"success"` or `"error"` |
| `error_message` | string | Only if error | Description of failure |
| `payload` | object | Yes | Processed lead data (can be empty `{}` on error) |
| `channel` | string | No | Lead channel - must be one of: `"widget"`, `"voice"`, `"web_form"`, `"api"`, `"import"` |
| `recording_url` | string (URL) | No | Voice recording URL if applicable |
| `lead_score` | integer | No | 0-100 lead quality score |

### Expected CRM Response

**Success (200):**
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

---

## RESPONSE SPECIFICATIONS

### Successful Processing

Return HTTP 200 with:

```json
{
  "status": "ok",
  "outbox_id": "<string>",
  "message": "lead intake processed"
}
```

### Authentication Error

Return HTTP 401 with:

```json
{
  "error": "Unauthorized",
  "timestamp": "<ISO8601>"
}
```

### Validation Error

Return HTTP 400 with:

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "<description>",
  "details": "<object or string>",
  "timestamp": "<ISO8601>"
}
```

### Processing Error

Return HTTP 500 with:

```json
{
  "error_code": "PROCESSING_ERROR",
  "message": "<description>",
  "outbox_id": "<string if available>",
  "timestamp": "<ISO8601>"
}
```

---

## ENVIRONMENT VARIABLES

Configure these in n8n:

| Variable | Description | Example |
|----------|-------------|---------|
| `INTERNAL_TOKEN` | Expected token in incoming `x-internal-token` header | `sk_tenant_abc123` |
| `CRM_BASE_URL` | Base URL of Smart Klix CRM | `https://your-crm.replit.app` |
| `CRM_AUTH_TOKEN` | Token for `Authorization: Bearer` header in sync callback (matches CRM's `N8N_INTERNAL_TOKEN`) | `n8n_sync_token_xyz` |

---

## WORKFLOW NODES SPECIFICATION

Build the following nodes in order:

### Node 1: Webhook Trigger
- **Type:** Webhook
- **Name:** "Receive Lead Intake"
- **HTTP Method:** POST
- **Path:** `events/intake`
- **Response Mode:** Using "Respond to Webhook" node

### Node 2: Validate Token (IF Node)
- **Type:** IF
- **Name:** "Validate Token"
- **Condition:** `{{ $json.headers['x-internal-token'] }}` equals `{{ $env.INTERNAL_TOKEN }}`
- **True Output:** Continue to Node 4
- **False Output:** Continue to Node 3

### Node 3: Unauthorized Response
- **Type:** Respond to Webhook
- **Name:** "Unauthorized Response"
- **Response Code:** 401
- **Response Body:**
```json
{
  "error": "Unauthorized",
  "timestamp": "{{ $now.toISO() }}"
}
```

### Node 4: Validate Required Fields (IF Node)
- **Type:** IF
- **Name:** "Validate Required Fields"
- **Condition:** Check that `body.outbox_id`, `body.tenant_id`, `body.payload` exist and are not empty
- **True Output:** Continue to Node 6
- **False Output:** Continue to Node 5

### Node 5: Validation Error Response
- **Type:** Respond to Webhook
- **Name:** "Validation Error Response"
- **Response Code:** 400
- **Response Body:**
```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Missing required fields",
  "details": "outbox_id, tenant_id, and payload are required",
  "timestamp": "{{ $now.toISO() }}"
}
```

### Node 6: Normalize & Process Lead (Code Node)
- **Type:** Code
- **Name:** "Normalize & Process Lead"
- **JavaScript:**

```javascript
// Access the incoming webhook data
const body = $input.first().json.body;
const { outbox_id, tenant_id, payload } = body;

// Normalize email to lowercase
if (payload.email) {
  payload.email = payload.email.toLowerCase().trim();
}

// Normalize phone to E.164 format
if (payload.phone) {
  let cleaned = payload.phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = '+1' + cleaned;
  }
  payload.phone = cleaned;
}

// Deduplicate and normalize tags
let tags = payload.tags || [];
tags = [...new Set(tags.map(t => t.toLowerCase().trim()))];
tags.push('neo8flow-processed');
payload.tags = tags;

// Map source to valid CRM channel
const channelMap = {
  'widget': 'widget',
  'chat_widget': 'widget',
  'voice': 'voice',
  'twilio_voice': 'voice',
  'web_form': 'web_form',
  'contact_form': 'web_form',
  'extended_form': 'web_form',
  'form': 'web_form',
  'api': 'api',
  'import': 'import',
  'email': 'api',
};
const channel = channelMap[(payload.source || '').toLowerCase()] || 'widget';

// Calculate lead score (0-100)
let leadScore = 50;
if (payload.email) leadScore += 10;
if (payload.phone) leadScore += 10;
if (payload.company) leadScore += 15;
if (payload.message && payload.message.length > 50) leadScore += 15;
leadScore = Math.min(leadScore, 100);

// Return the sync payload
return [{
  json: {
    outbox_id,
    tenant_id,
    status: 'success',
    payload,
    channel,
    lead_score: leadScore
  }
}];
```

### Node 7: Future Automation Placeholder
- **Type:** No Operation (NoOp)
- **Name:** "Lead Intake - Future Automation Placeholder"
- **Purpose:** Placeholder for future automation like enrichment, routing, etc.
- **Note:** Just passes data through for now

### Node 8: CRM Sync Callback (HTTP Request)
- **Type:** HTTP Request
- **Name:** "CRM Sync Callback"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/intake/sync`
- **Authentication:** None (we set header manually)
- **Send Headers:** Yes
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Send Body:** Yes
- **Body Content Type:** JSON
- **JSON Body:** `{{ $json }}`

### Node 9: Handle Sync Response (IF Node)
- **Type:** IF
- **Name:** "Handle Sync Response"
- **Condition:** Check if HTTP response `success` is `true`
- **True Output:** Continue to Node 10
- **False Output:** Continue to Node 11

### Node 10: Success Response
- **Type:** Respond to Webhook
- **Name:** "Success Response"
- **Response Code:** 200
- **Response Body:**
```json
{
  "status": "ok",
  "outbox_id": "{{ $('Normalize & Process Lead').item.json.outbox_id }}",
  "message": "lead intake processed"
}
```

### Node 11: Error Response
- **Type:** Respond to Webhook
- **Name:** "Error Response"
- **Response Code:** 500
- **Response Body:**
```json
{
  "error_code": "SYNC_ERROR",
  "message": "Failed to sync with CRM",
  "outbox_id": "{{ $('Normalize & Process Lead').item.json.outbox_id }}",
  "timestamp": "{{ $now.toISO() }}"
}
```

---

## NODE CONNECTIONS

```
[1: Receive Lead Intake]
         |
         v
[2: Validate Token]
    |           |
    v           v
  (True)      (False)
    |           |
    v           v
[4: Validate     [3: Unauthorized Response] --> END
 Required Fields]
    |           |
    v           v
  (True)      (False)
    |           |
    v           v
[6: Normalize    [5: Validation Error Response] --> END
 & Process Lead]
    |
    v
[7: Future Automation Placeholder]
    |
    v
[8: CRM Sync Callback]
    |
    v
[9: Handle Sync Response]
    |           |
    v           v
  (True)      (False)
    |           |
    v           v
[10: Success    [11: Error Response] --> END
 Response]
    |
    v
   END
```

---

## COMPLETE WORKFLOW JSON

Import this JSON directly into n8n:

```json
{
  "name": "Lead Intake Flow",
  "nodes": [
    {
      "id": "node-1",
      "name": "Receive Lead Intake",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [250, 300],
      "parameters": {
        "path": "events/intake",
        "httpMethod": "POST",
        "responseMode": "responseNode"
      }
    },
    {
      "id": "node-2",
      "name": "Validate Token",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [450, 300],
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "token-check",
              "leftValue": "={{ $json.headers['x-internal-token'] }}",
              "rightValue": "={{ $env.INTERNAL_TOKEN }}",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      }
    },
    {
      "id": "node-3",
      "name": "Unauthorized Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [650, 500],
      "parameters": {
        "options": {
          "responseCode": 401
        },
        "respondWith": "json",
        "responseBody": "={{ { error: 'Unauthorized', timestamp: $now.toISO() } }}"
      }
    },
    {
      "id": "node-4",
      "name": "Validate Required Fields",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [650, 300],
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "outbox-check",
              "leftValue": "={{ $json.body?.outbox_id }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "notEmpty"
              }
            },
            {
              "id": "tenant-check",
              "leftValue": "={{ $json.body?.tenant_id }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "notEmpty"
              }
            },
            {
              "id": "payload-check",
              "leftValue": "={{ typeof $json.body?.payload }}",
              "rightValue": "object",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      }
    },
    {
      "id": "node-5",
      "name": "Validation Error Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [850, 500],
      "parameters": {
        "options": {
          "responseCode": 400
        },
        "respondWith": "json",
        "responseBody": "={{ { error_code: 'VALIDATION_ERROR', message: 'Missing required fields', details: 'outbox_id, tenant_id, and payload are required', timestamp: $now.toISO() } }}"
      }
    },
    {
      "id": "node-6",
      "name": "Normalize & Process Lead",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [850, 300],
      "parameters": {
        "jsCode": "// Access the incoming webhook data\nconst body = $input.first().json.body;\nconst { outbox_id, tenant_id, payload } = body;\n\n// Normalize email to lowercase\nif (payload.email) {\n  payload.email = payload.email.toLowerCase().trim();\n}\n\n// Normalize phone to E.164 format\nif (payload.phone) {\n  let cleaned = payload.phone.replace(/[^\\d+]/g, '');\n  if (!cleaned.startsWith('+') && cleaned.length === 10) {\n    cleaned = '+1' + cleaned;\n  }\n  payload.phone = cleaned;\n}\n\n// Deduplicate and normalize tags\nlet tags = payload.tags || [];\ntags = [...new Set(tags.map(t => t.toLowerCase().trim()))];\ntags.push('neo8flow-processed');\npayload.tags = tags;\n\n// Map source to valid CRM channel\nconst channelMap = {\n  'widget': 'widget',\n  'chat_widget': 'widget',\n  'voice': 'voice',\n  'twilio_voice': 'voice',\n  'web_form': 'web_form',\n  'contact_form': 'web_form',\n  'extended_form': 'web_form',\n  'form': 'web_form',\n  'api': 'api',\n  'import': 'import',\n  'email': 'api',\n};\nconst channel = channelMap[(payload.source || '').toLowerCase()] || 'widget';\n\n// Calculate lead score (0-100)\nlet leadScore = 50;\nif (payload.email) leadScore += 10;\nif (payload.phone) leadScore += 10;\nif (payload.company) leadScore += 15;\nif (payload.message && payload.message.length > 50) leadScore += 15;\nleadScore = Math.min(leadScore, 100);\n\n// Return the sync payload\nreturn [{\n  json: {\n    outbox_id,\n    tenant_id,\n    status: 'success',\n    payload,\n    channel,\n    lead_score: leadScore\n  }\n}];"
      }
    },
    {
      "id": "node-7",
      "name": "Lead Intake - Future Automation Placeholder",
      "type": "n8n-nodes-base.noOp",
      "typeVersion": 1,
      "position": [1050, 300],
      "parameters": {}
    },
    {
      "id": "node-8",
      "name": "CRM Sync Callback",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1250, 300],
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
      "id": "node-9",
      "name": "Handle Sync Response",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1450, 300],
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "success-check",
              "leftValue": "={{ $json.success }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      }
    },
    {
      "id": "node-10",
      "name": "Success Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1650, 200],
      "parameters": {
        "options": {
          "responseCode": 200
        },
        "respondWith": "json",
        "responseBody": "={{ { status: 'ok', outbox_id: $('Normalize & Process Lead').item.json.outbox_id, message: 'lead intake processed' } }}"
      }
    },
    {
      "id": "node-11",
      "name": "Error Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1650, 400],
      "parameters": {
        "options": {
          "responseCode": 500
        },
        "respondWith": "json",
        "responseBody": "={{ { error_code: 'SYNC_ERROR', message: 'Failed to sync with CRM', outbox_id: $('Normalize & Process Lead').item.json.outbox_id, timestamp: $now.toISO() } }}"
      }
    }
  ],
  "connections": {
    "Receive Lead Intake": {
      "main": [
        [{ "node": "Validate Token", "type": "main", "index": 0 }]
      ]
    },
    "Validate Token": {
      "main": [
        [{ "node": "Validate Required Fields", "type": "main", "index": 0 }],
        [{ "node": "Unauthorized Response", "type": "main", "index": 0 }]
      ]
    },
    "Validate Required Fields": {
      "main": [
        [{ "node": "Normalize & Process Lead", "type": "main", "index": 0 }],
        [{ "node": "Validation Error Response", "type": "main", "index": 0 }]
      ]
    },
    "Normalize & Process Lead": {
      "main": [
        [{ "node": "Lead Intake - Future Automation Placeholder", "type": "main", "index": 0 }]
      ]
    },
    "Lead Intake - Future Automation Placeholder": {
      "main": [
        [{ "node": "CRM Sync Callback", "type": "main", "index": 0 }]
      ]
    },
    "CRM Sync Callback": {
      "main": [
        [{ "node": "Handle Sync Response", "type": "main", "index": 0 }]
      ]
    },
    "Handle Sync Response": {
      "main": [
        [{ "node": "Success Response", "type": "main", "index": 0 }],
        [{ "node": "Error Response", "type": "main", "index": 0 }]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

---

## TESTING

### Test Webhook Reception

```bash
curl -X POST https://your-n8n-instance.com/webhook/events/intake \
  -H "Content-Type: application/json" \
  -H "x-internal-token: YOUR_INTERNAL_TOKEN" \
  -d '{
    "outbox_id": "test-outbox-123",
    "tenant_id": "test-tenant",
    "payload": {
      "name": "Test User",
      "email": "TEST@Example.com",
      "phone": "(555) 123-4567",
      "company": "Test Corp",
      "message": "I am interested in your HVAC services for my business",
      "source": "widget",
      "tags": ["HVAC", "Commercial", "hvac"],
      "timestamp": "2025-12-06T10:30:00.000Z"
    }
  }'
```

### Expected Normalized Output

After processing, the sync callback payload should include:

```json
{
  "outbox_id": "test-outbox-123",
  "tenant_id": "test-tenant",
  "status": "success",
  "payload": {
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+15551234567",
    "company": "Test Corp",
    "message": "I am interested in your HVAC services for my business",
    "source": "widget",
    "tags": ["hvac", "commercial", "neo8flow-processed"],
    "timestamp": "2025-12-06T10:30:00.000Z"
  },
  "channel": "widget",
  "lead_score": 100
}
```

---

## WHAT CRM DOES WITH SYNC DATA

When the CRM receives the sync callback at `/api/intake/sync`, it performs:

### 1. Contact Upsert
- **Priority:** `contact_id` > `email` > `phone`
- If contact exists: Updates empty fields only, merges tags (deduplicates)
- If new: Creates contact with `customerType: "lead"`

### 2. Conversation/Agent Chat
- Links to contact if found/created
- Creates new conversation if none exists
- Updates existing conversation with `lead_score` if provided
- Adds initial message from `payload.message` if present

### 3. Tags
- Applied to contact record
- Merged with existing tags (no duplicates)

### 4. Lead Score
- Stored on conversation record
- Integer value 0-100

### 5. Recording Attachment (if recording_url provided)
- Creates file record linked to contact
- Type: `audio/recording`

---

## MONITORING & DEBUGGING

### Logs to Check

1. **n8n Execution History:** View all workflow executions
2. **HTTP Request Node:** Check CRM sync responses for errors
3. **Error Handling:** Monitor failed sync callbacks

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 on incoming webhook | Check `INTERNAL_TOKEN` env var matches CRM's `TENANT_TOKEN` |
| 401 on sync callback | Check `CRM_AUTH_TOKEN` matches CRM's `N8N_INTERNAL_TOKEN` env var |
| 400 on sync callback | Check payload structure matches `crmSyncSchema` - ensure `status` is "success" or "error" |
| Missing outbox_id in response | Ensure Code node returns the original `outbox_id` from input |

---

## SUMMARY

This workflow:

1. Receives lead intake events from CRM via webhook with `x-internal-token` auth
2. Validates token and required fields (`outbox_id`, `tenant_id`, `payload`)
3. Normalizes email (lowercase), phone (E.164), and tags (deduplicated)
4. Maps `payload.source` to valid CRM `channel` enum value
5. Calculates a lead score based on data completeness
6. Calls back to CRM `/api/intake/sync` with `Authorization: Bearer` token
7. Returns appropriate success/error responses

All nodes, connections, validation, normalization, and response handling are included. Import the JSON directly or build node-by-node following the specifications.
