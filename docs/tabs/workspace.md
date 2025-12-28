# Google Workspace

## Purpose
The Google Workspace page provides a unified interface for Google services via n8n webhooks: Gmail, Calendar, Sheets, and Docs operations.

## UI Behavior

### Layout Structure - Four Tabs

#### 1. Gmail Tab
- **Compose Email Card**:
  - To, CC, BCC fields
  - Subject line
  - Rich text body
  - Thread ID (for replies)
  - Send button

- **Recent Emails Card**:
  - List of recently sent emails
  - Click to view details

#### 2. Calendar Tab
- **Create Event Card**:
  - Event title
  - Start/end date-time
  - Attendees (email list)
  - Description
  - Create button

- **Upcoming Events Card**:
  - List of events
  - Edit/cancel actions

#### 3. Sheets Tab
- **Append Row Card**:
  - Spreadsheet URL or ID
  - Sheet name
  - Row data (key-value pairs)
  - Append button

- **Recent Operations**:
  - Log of sheet operations

#### 4. Docs Tab
- **Document Operations Card**:
  - Create new document
  - Update existing
  - Append content
  - Replace placeholders
  - Export (PDF/plain text)

- **Recent Documents**:
  - List of operated documents

### Interactions
- **Send Email**: POST to Gmail webhook
- **Create Event**: POST to Calendar webhook
- **Append Row**: POST to Sheets webhook
- **Doc Operation**: POST to Docs webhook

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/google/gmail/send` | POST | Send email |
| `/api/google/calendar/event` | POST | Create/update event |
| `/api/google/sheets/append` | POST | Append row |
| `/api/google/docs/*` | POST | Document operations |

## Automation (Neo8) Involvement
All operations route through Neo8 webhooks:

| Service | Webhook | Operations |
|---------|---------|------------|
| Gmail | `/webhook/google/gmail` | Send, thread reply |
| Calendar | `/webhook/google/calendar` | Create, update, cancel |
| Sheets | `/webhook/google/sheets` | Append rows |
| Docs | `/webhook/google/docs` | Create, update, append, replace, export |

## Google API Permissions
- Gmail: send, read (for threading)
- Calendar: read/write events
- Sheets: read/write data
- Docs: create, edit, export

## Design Tokens
- Tab panels: `bg-glass-surface`
- Service cards: `border-glass-border`
- Success toast: Green
- Error toast: Red

## Test IDs
- `tab-gmail`: Gmail tab
- `tab-calendar`: Calendar tab
- `tab-sheets`: Sheets tab
- `tab-docs`: Docs tab
- `button-send-email`: Send email
- `button-create-event`: Create event
- `button-append-row`: Append row
- `select-doc-operation`: Doc operation
