# Email

## Purpose
The Email page manages IMAP/SMTP email accounts and provides an inbox interface for viewing and sending emails. It integrates with Gmail via Neo8 for automated email workflows.

## UI Behavior

### Layout Structure - Two Tabs

#### 1. Accounts Tab
- **Account List**:
  - Email address
  - Provider (Gmail, Outlook, Custom)
  - Connection status (green/red indicator)
  - Last sync time

- **Account Actions**:
  - Add Account button
  - Edit configuration
  - Test connection
  - Delete account

- **Account Configuration Modal**:
  - Email address
  - IMAP host/port/security
  - SMTP host/port/security
  - Username/password
  - OAuth option (for Gmail)

#### 2. Inbox Tab
- **Folder List (Left)**:
  - Inbox
  - Sent
  - Drafts
  - Archive

- **Email List (Center)**:
  - From, Subject, Preview, Date
  - Unread indicator
  - Attachment indicator
  - Click to view

- **Email Detail (Right)**:
  - Full headers
  - HTML/text body
  - Attachments list
  - Reply/Forward buttons

### Interactions
- **Add Account**: Open configuration modal
- **Test Connection**: Verify IMAP/SMTP credentials
- **Compose**: New email composer
- **Reply**: Reply to selected email (supports threads)
- **Sync**: Manual folder sync

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/email-accounts` | GET | List accounts |
| `/api/email-accounts` | POST | Add account |
| `/api/email-accounts/:id` | PATCH | Update account |
| `/api/email-accounts/:id` | DELETE | Remove account |
| `/api/emails` | GET | List emails |
| `/api/emails/:id` | GET | Get email detail |
| `/api/emails/send` | POST | Send email |

## Backend/API Interactions
- Email sync runs periodically
- Thread detection via Message-ID headers
- Attachments stored separately

## Automation (Neo8) Involvement
- **Send Email**: `/webhook/google/gmail` handles Gmail sending
- **Thread Reply**: Maintains conversation threading
- **Auto-Response**: Triggers based on rules

## Gmail Integration
Uses OAuth for Gmail accounts:
- Send with thread reply support
- Read access for sync
- Label management

## Design Tokens
- Tab panels: `bg-glass-surface`
- Account cards: `border-glass-border`
- Unread emails: `font-bold`
- Connection green: `text-emerald-500`
- Connection red: `text-red-500`

## Test IDs
- `tab-accounts`: Accounts tab
- `tab-inbox`: Inbox tab
- `button-add-account`: Add account
- `account-card-{id}`: Account cards
- `email-row-{id}`: Email list items
- `button-compose`: Compose button
- `button-reply`: Reply button
