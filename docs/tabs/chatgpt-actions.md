# ChatGPT Actions

## Purpose
The ChatGPT Actions page manages the integration between external ChatGPT instances and the CRM's Master Architect pipeline. It provides configuration, workflow management, action logging, and health monitoring.

## UI Behavior

### Layout Structure - Four Tabs

#### 1. ChatGPT Setup Tab
- **API Configuration Card**:
  - Endpoint URL display
  - Authentication token management
  - Test connection button
  
- **OpenAPI Schema Card**:
  - Schema viewer (read-only)
  - Copy to clipboard button
  - Download schema button
  - Link to ChatGPT configuration guide

#### 2. Workflows Tab
- List of configured GPT Actions workflows
- Enable/disable toggle per workflow
- Permission level (Draft/Assist/Auto)
- Edit workflow configuration

#### 3. Action Logs Tab
- Chronological log of GPT Action requests
- Shows: Timestamp, Action, Input, Output, Status
- Filter by action type
- Filter by status (success/error)
- Expandable for full payload

#### 4. Settings Tab (N8N Health Panel)
- N8N connection status
- Webhook health indicators
- Last successful ping
- Manual health check button

### Interactions
- **Test Connection**: Verify ChatGPT can reach endpoint
- **Copy Schema**: Copy OpenAPI spec to clipboard
- **Toggle Workflow**: Enable/disable specific actions
- **View Log Entry**: Expand for full details
- **Health Check**: Ping N8N workflows

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chatgpt-actions/config` | GET/PUT | Configuration |
| `/api/chatgpt-actions/logs` | GET | Action logs |
| `/api/chatgpt-actions/health` | GET | Health status |
| `/api/openapi.json` | GET | OpenAPI schema |

## Backend/API Interactions
- GPT Actions route through Master Architect
- Logs capture request/response pairs
- Health checks ping N8N workflows

## Automation (Neo8) Involvement
- **GPT Action Requests**: Received via webhook, routed to Master Architect
- **Workflow Execution**: N8N handles external API calls
- **Health Monitoring**: Regular health checks on N8N connection

## ChatGPT Integration Flow
```
User ChatGPT → GPT Action → /api/gpt-actions/{action}
             → Master Architect (gpt_actions channel)
             → Tool execution (if approved)
             → Response to ChatGPT → User
```

## Design Tokens
- Tab panels: `bg-glass-surface`
- Config cards: `border-glass-border`
- Success logs: `text-emerald-500`
- Error logs: `text-red-500`
- Health status: Green/red indicator

## Test IDs
- `tab-setup`: Setup tab
- `tab-workflows`: Workflows tab
- `tab-logs`: Action logs tab
- `tab-settings`: Settings tab
- `button-test-connection`: Test button
- `button-copy-schema`: Copy schema
- `log-entry-{id}`: Log entries
- `workflow-toggle-{id}`: Workflow toggles
- `health-status`: Health indicator
