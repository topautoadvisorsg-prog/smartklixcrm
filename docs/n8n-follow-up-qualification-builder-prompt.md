# Neo8Flow Follow-Up & Qualification Workflow - Builder Prompt

**Send this complete prompt to Neo8Flow (n8n) to build the Follow-Up & Qualification workflow.**

---

## BUILDER PROMPT

We need a complete n8n workflow that integrates with Smart Klix CRM for automated lead follow-up and qualification. Build all nodes, connections, scheduling, and business logic as specified below.

### Flow Name

**Follow-Up & Qualification Flow**

### Purpose

This workflow runs on a schedule to:

1. Query CRM for leads/contacts needing follow-up
2. Score and categorize leads based on age, data completeness, and engagement
3. Identify stale leads that need attention
4. Trigger automated follow-up actions or queue for human approval
5. Update CRM with qualification status and activity logs

**IMPORTANT: This flow uses scheduled triggers and calls back to CRM to update lead status.**

---

## TRIGGER SPECIFICATION

### Scheduled Trigger

**Cron Expression:** `0 */2 * * *` (Every 2 hours during business hours, adjust as needed)

Alternative: `0 8,12,16 * * 1-5` (8am, 12pm, 4pm on weekdays)

---

## CRM API ENDPOINTS

All endpoints require `Authorization: Bearer {CRM_AUTH_TOKEN}` header.

### 1. Get All Contacts

**GET** `{CRM_BASE_URL}/api/contacts`

Returns array of contacts with fields: `id`, `name`, `email`, `phone`, `status`, `customerType`, `tags`, `createdAt`, `updatedAt`

### 2. Get All Jobs

**GET** `{CRM_BASE_URL}/api/jobs`

Returns array of jobs with fields: `id`, `title`, `clientId`, `status`, `jobType`, `priority`, `tags`, `createdAt`, `updatedAt`

### 3. Update Job Status

**POST** `{CRM_BASE_URL}/api/jobs/update-status`

**Headers:**
```
Authorization: Bearer {CRM_AUTH_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "jobId": "uuid-string",
  "status": "qualified|stale|follow_up_scheduled|estimate_needed"
}
```

### 4. Update Contact

**POST** `{CRM_BASE_URL}/api/contacts/update`

**Headers:**
```
Authorization: Bearer {CRM_AUTH_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "id": "contact-uuid",
  "status": "qualified|unqualified|stale|active",
  "customerType": "lead|prospect|customer",
  "tags": ["follow-up-needed", "high-value"]
}
```

### 5. Write Activity Log

**POST** `{CRM_BASE_URL}/api/activity-log/write`

**Headers:**
```
Authorization: Bearer {CRM_AUTH_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "entityType": "contact|job",
  "entityId": "uuid-string",
  "action": "follow_up_scheduled|qualification_updated|stale_alert",
  "details": {
    "reason": "No response after 48 hours",
    "lead_score": 65,
    "next_action": "send_reminder_email"
  }
}
```

### 6. Queue for Approval (Assist Queue)

**POST** `{CRM_BASE_URL}/api/assist-queue`

**Headers:**
```
Authorization: Bearer {CRM_AUTH_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "mode": "assist",
  "userRequest": "Lead qualification review needed",
  "requiresApproval": true,
  "agentResponse": "Lead John Doe (score: 85) has been qualified as high-priority. Recommend sending estimate.",
  "toolsCalled": [{"name": "qualify_lead", "args": {"contactId": "uuid"}}],
  "toolResults": [{"result": "qualified", "score": 85}]
}
```

---

## LEAD QUALIFICATION RULES

### Lead Age Thresholds

| Age | Classification | Action |
|-----|---------------|--------|
| 0-24 hours | Hot | Priority follow-up |
| 24-72 hours | Warm | Standard follow-up |
| 3-7 days | Cooling | Re-engagement needed |
| 7+ days | Stale | Mark for review or archive |

### Lead Scoring Algorithm

Calculate a qualification score (0-100) based on:

```javascript
function calculateQualificationScore(lead, job) {
  let score = 0;
  
  // Data completeness (max 40 points)
  if (lead.email) score += 15;
  if (lead.phone) score += 15;
  if (lead.company) score += 10;
  
  // Engagement signals (max 30 points)
  if (job && job.value && parseFloat(job.value) > 0) score += 15;
  if (lead.tags && lead.tags.length > 0) score += 10;
  if (job && job.description && job.description.length > 50) score += 5;
  
  // Recency bonus (max 30 points)
  const ageHours = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60);
  if (ageHours < 24) score += 30;
  else if (ageHours < 72) score += 20;
  else if (ageHours < 168) score += 10;
  
  return Math.min(score, 100);
}
```

### Qualification Tiers

| Score | Tier | Recommended Action |
|-------|------|-------------------|
| 80-100 | Hot Lead | Immediate contact, schedule appointment |
| 60-79 | Qualified | Send estimate or proposal |
| 40-59 | Nurture | Add to drip campaign |
| 0-39 | Low Priority | Review periodically |

---

## WORKFLOW NODES SPECIFICATION

Build the following nodes in order:

### Node 1: Schedule Trigger

- **Type:** Schedule Trigger
- **Name:** "Follow-Up Check Schedule"
- **Cron:** `0 */2 * * *` (every 2 hours)

### Node 2: Fetch Contacts (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Fetch All Contacts"
- **Method:** GET
- **URL:** `{{ $env.CRM_BASE_URL }}/api/contacts`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`

### Node 3: Fetch Jobs (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Fetch All Jobs"
- **Method:** GET
- **URL:** `{{ $env.CRM_BASE_URL }}/api/jobs`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`

### Node 4: Merge Data (Merge Node)

- **Type:** Merge
- **Name:** "Merge Contacts and Jobs"
- **Mode:** Combine
- **Combination Mode:** Multiplex (or use Code node to join)

### Node 5: Identify Follow-Up Candidates (Code Node)

- **Type:** Code
- **Name:** "Identify Follow-Up Candidates"
- **JavaScript:**

```javascript
// Get contacts and jobs from inputs
const contacts = $('Fetch All Contacts').all().map(item => item.json);
const jobs = $('Fetch All Jobs').all().map(item => item.json);

// Create a map of jobs by clientId
const jobsByClient = {};
jobs.forEach(job => {
  if (job.clientId) {
    if (!jobsByClient[job.clientId]) {
      jobsByClient[job.clientId] = [];
    }
    jobsByClient[job.clientId].push(job);
  }
});

// Filter for leads that need follow-up
const now = Date.now();
const candidates = [];

contacts.forEach(contact => {
  // Only process leads and prospects
  if (!['lead', 'prospect'].includes(contact.customerType)) return;
  
  // Skip if already has certain tags
  if (contact.tags && contact.tags.includes('do-not-contact')) return;
  
  const contactJobs = jobsByClient[contact.id] || [];
  const leadJobs = contactJobs.filter(j => j.jobType === 'lead');
  
  // Calculate age in hours
  const ageHours = (now - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60);
  
  // Calculate qualification score
  let score = 0;
  
  // Data completeness (max 40)
  if (contact.email) score += 15;
  if (contact.phone) score += 15;
  if (contact.company) score += 10;
  
  // Engagement signals (max 30)
  const highValueJob = leadJobs.find(j => j.value && parseFloat(j.value) > 0);
  if (highValueJob) score += 15;
  if (contact.tags && contact.tags.length > 0) score += 10;
  const detailedJob = leadJobs.find(j => j.description && j.description.length > 50);
  if (detailedJob) score += 5;
  
  // Recency bonus (max 30)
  if (ageHours < 24) score += 30;
  else if (ageHours < 72) score += 20;
  else if (ageHours < 168) score += 10;
  
  score = Math.min(score, 100);
  
  // Determine classification
  let classification;
  let action;
  
  if (ageHours < 24) {
    classification = 'hot';
    action = 'priority_followup';
  } else if (ageHours < 72) {
    classification = 'warm';
    action = 'standard_followup';
  } else if (ageHours < 168) {
    classification = 'cooling';
    action = 'reengagement';
  } else {
    classification = 'stale';
    action = 'review_or_archive';
  }
  
  // Determine tier
  let tier;
  if (score >= 80) tier = 'hot_lead';
  else if (score >= 60) tier = 'qualified';
  else if (score >= 40) tier = 'nurture';
  else tier = 'low_priority';
  
  // Only include leads that need action (not recently updated)
  const lastUpdated = new Date(contact.updatedAt).getTime();
  const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate > 24 || classification === 'stale') {
    candidates.push({
      contact,
      jobs: leadJobs,
      score,
      classification,
      tier,
      action,
      ageHours: Math.round(ageHours),
      hoursSinceUpdate: Math.round(hoursSinceUpdate)
    });
  }
});

// Sort by score (highest first)
candidates.sort((a, b) => b.score - a.score);

return candidates.map(c => ({ json: c }));
```

### Node 6: Filter Empty Results (IF Node)

- **Type:** IF
- **Name:** "Has Candidates?"
- **Condition:** Check if items array length > 0
- **True Output:** Continue to Node 7
- **False Output:** End workflow (no action needed)

### Node 7: Split by Action Type (Switch Node)

- **Type:** Switch
- **Name:** "Route by Action"
- **Rules:**
  - `priority_followup` → Hot Lead Handler
  - `standard_followup` → Standard Handler
  - `reengagement` → Re-engagement Handler
  - `stale` → Stale Review Handler

### Node 8: Hot Lead Handler (Code Node)

- **Type:** Code
- **Name:** "Hot Lead Handler"
- **Purpose:** Queue high-priority leads for immediate action

```javascript
const item = $input.first().json;

return [{
  json: {
    action: 'queue_for_approval',
    entityType: 'contact',
    entityId: item.contact.id,
    payload: {
      mode: 'assist',
      userRequest: `Hot lead requires immediate attention: ${item.contact.name}`,
      requiresApproval: true,
      agentResponse: `Lead ${item.contact.name} (Score: ${item.score}) is classified as HOT (${item.ageHours}h old). Recommend immediate contact and appointment scheduling.`,
      toolsCalled: [{ name: 'qualify_lead', args: { contactId: item.contact.id, tier: item.tier } }],
      toolResults: [{ result: 'hot_lead', score: item.score, action: 'schedule_appointment' }]
    },
    logPayload: {
      entityType: 'contact',
      entityId: item.contact.id,
      action: 'hot_lead_identified',
      details: {
        score: item.score,
        tier: item.tier,
        ageHours: item.ageHours,
        recommended_action: 'immediate_contact'
      }
    }
  }
}];
```

### Node 9: Standard Follow-Up Handler (Code Node)

- **Type:** Code
- **Name:** "Standard Handler"
- **Purpose:** Update status and log for standard follow-ups

```javascript
const item = $input.first().json;

return [{
  json: {
    action: 'update_and_log',
    contactUpdate: {
      id: item.contact.id,
      status: 'active',
      tags: [...(item.contact.tags || []), 'follow-up-scheduled'].filter((v, i, a) => a.indexOf(v) === i)
    },
    logPayload: {
      entityType: 'contact',
      entityId: item.contact.id,
      action: 'follow_up_scheduled',
      details: {
        score: item.score,
        tier: item.tier,
        classification: item.classification,
        next_action: 'send_follow_up_email'
      }
    }
  }
}];
```

### Node 10: Re-engagement Handler (Code Node)

- **Type:** Code
- **Name:** "Re-engagement Handler"
- **Purpose:** Mark leads needing re-engagement

```javascript
const item = $input.first().json;

return [{
  json: {
    action: 'update_and_log',
    contactUpdate: {
      id: item.contact.id,
      status: 'cooling',
      tags: [...(item.contact.tags || []), 'needs-reengagement'].filter((v, i, a) => a.indexOf(v) === i)
    },
    logPayload: {
      entityType: 'contact',
      entityId: item.contact.id,
      action: 'reengagement_needed',
      details: {
        score: item.score,
        tier: item.tier,
        daysSinceCreated: Math.round(item.ageHours / 24),
        recommended_action: 'drip_campaign'
      }
    }
  }
}];
```

### Node 11: Stale Lead Handler (Code Node)

- **Type:** Code
- **Name:** "Stale Lead Handler"
- **Purpose:** Flag stale leads for review

```javascript
const item = $input.first().json;

return [{
  json: {
    action: 'queue_for_approval',
    entityType: 'contact',
    entityId: item.contact.id,
    payload: {
      mode: 'assist',
      userRequest: `Stale lead review: ${item.contact.name}`,
      requiresApproval: true,
      agentResponse: `Lead ${item.contact.name} (Score: ${item.score}) has been stale for ${Math.round(item.ageHours / 24)} days. Options: 1) Archive, 2) Re-engage, 3) Mark as lost.`,
      toolsCalled: [{ name: 'flag_stale_lead', args: { contactId: item.contact.id } }],
      toolResults: [{ result: 'stale', daysSinceCreated: Math.round(item.ageHours / 24) }]
    },
    logPayload: {
      entityType: 'contact',
      entityId: item.contact.id,
      action: 'stale_alert',
      details: {
        score: item.score,
        daysSinceCreated: Math.round(item.ageHours / 24),
        recommended_action: 'review_and_decide'
      }
    }
  }
}];
```

### Node 12: Queue for Approval (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Queue for Approval"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/assist-queue`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Body:** `{{ $json.payload }}`
- **Execute for:** Items with `action === 'queue_for_approval'`

### Node 13: Update Contact (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Update Contact"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/contacts/update`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Body:** `{{ $json.contactUpdate }}`
- **Execute for:** Items with `action === 'update_and_log'`

### Node 14: Write Activity Log (HTTP Request)

- **Type:** HTTP Request
- **Name:** "Write Activity Log"
- **Method:** POST
- **URL:** `{{ $env.CRM_BASE_URL }}/api/activity-log/write`
- **Headers:**
  - `Authorization`: `Bearer {{ $env.CRM_AUTH_TOKEN }}`
  - `Content-Type`: `application/json`
- **Body:** `{{ $json.logPayload }}`

### Node 15: Summary Report (Code Node)

- **Type:** Code
- **Name:** "Generate Summary"
- **Purpose:** Create a summary of actions taken

```javascript
const items = $input.all();

const summary = {
  timestamp: new Date().toISOString(),
  processed: items.length,
  actions: {
    hot_leads: items.filter(i => i.json.action === 'queue_for_approval' && i.json.logPayload?.action === 'hot_lead_identified').length,
    follow_ups: items.filter(i => i.json.logPayload?.action === 'follow_up_scheduled').length,
    reengagement: items.filter(i => i.json.logPayload?.action === 'reengagement_needed').length,
    stale_reviews: items.filter(i => i.json.logPayload?.action === 'stale_alert').length
  }
};

return [{ json: summary }];
```

---

## NODE CONNECTIONS

```
[1: Schedule Trigger]
         |
    (parallel)
         |
   +-----+-----+
   |           |
   v           v
[2: Fetch    [3: Fetch
 Contacts]    Jobs]
   |           |
   +-----+-----+
         |
         v
[4: Merge Contacts and Jobs]
         |
         v
[5: Identify Follow-Up Candidates]
         |
         v
[6: Has Candidates?]
    |           |
    v           v
  (Yes)       (No)
    |           |
    v           v
[7: Route    END
 by Action]
    |
    +--> priority_followup --> [8: Hot Lead Handler] --> [12: Queue for Approval] --> [14: Write Log]
    |
    +--> standard_followup --> [9: Standard Handler] --> [13: Update Contact] --> [14: Write Log]
    |
    +--> reengagement --> [10: Re-engagement Handler] --> [13: Update Contact] --> [14: Write Log]
    |
    +--> stale --> [11: Stale Lead Handler] --> [12: Queue for Approval] --> [14: Write Log]
                                                         |
                                                         v
                                                 [15: Generate Summary]
                                                         |
                                                         v
                                                        END
```

---

## ENVIRONMENT VARIABLES

Configure these in n8n:

| Variable | Description | Example |
|----------|-------------|---------|
| `CRM_BASE_URL` | Base URL of Smart Klix CRM | `https://your-crm.replit.app` |
| `CRM_AUTH_TOKEN` | Token for Authorization Bearer header | `n8n_sync_token_xyz` |

---

## FUTURE ENHANCEMENTS

Add nodes for these features when ready:

1. **Email Integration** - Send automated follow-up emails via SendGrid
2. **SMS Reminders** - Send SMS via Twilio for hot leads
3. **Calendar Integration** - Auto-create follow-up tasks in Google Calendar
4. **AI Summary** - Use OpenAI to generate personalized follow-up messages
5. **Duplicate Merge** - Consolidate duplicate contacts detected

---

## TESTING

### Manual Trigger Test

1. Set schedule to manual trigger for testing
2. Ensure CRM has sample leads in various states
3. Verify each action type routes correctly
4. Check CRM audit log for recorded activities
5. Verify Approval Hub shows queued items

### Expected Outcomes

| Input State | Expected Action |
|-------------|-----------------|
| Lead < 24h old, complete data | Hot lead queue → Approval Hub |
| Lead 24-72h old | Standard follow-up → Contact updated |
| Lead 3-7 days old | Re-engagement → Tags added |
| Lead > 7 days old | Stale review → Approval Hub |

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| No candidates found | Check CRM has leads with `customerType: 'lead'` |
| Auth errors | Verify `CRM_AUTH_TOKEN` matches `N8N_INTERNAL_TOKEN` in CRM |
| Empty responses | Check contacts/jobs API returns data |
| Merge node fails | Use Code node instead to manually join data |
