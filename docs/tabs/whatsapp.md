# WhatsApp

## Purpose
The WhatsApp page manages WhatsApp Business messaging through Twilio integration. It provides a conversation interface for customer communication and automation settings.

## UI Behavior

### Layout Structure

#### Conversation List (Left)
- Customer conversations
- Unread message count
- Last message preview
- Timestamp

#### Chat Interface (Center)
- Message history
- Customer info header
- Message input
- Template message selector
- Media attachment

#### Contact Context (Right)
- Contact details
- Related jobs
- Quick actions
- Conversation history

### Interactions
- **Select Conversation**: Load message history
- **Send Message**: Text or template
- **Send Media**: Image/document attachment
- **Link to Contact**: Associate with CRM contact
- **Quick Action**: Create job, add note

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/whatsapp/conversations` | GET | List conversations |
| `/api/whatsapp/messages` | GET | Get messages |
| `/api/whatsapp/send` | POST | Send message |
| `/api/whatsapp/templates` | GET | List templates |

## Backend/API Interactions
- Messages stored in CRM
- Contact matching by phone
- Template message approval

## Automation (Neo8) Involvement
- **Send Message**: `/webhook/whatsapp/send` for outbound
- **Receive Message**: Twilio webhook → n8n → CRM
- **Auto-Response**: Triggered by keywords

## WhatsApp Business Rules
- 24-hour messaging window
- Template messages outside window
- Media size limits
- Template approval required

## Design Tokens
- Conversation list: `bg-glass-surface`
- Outgoing messages: `bg-primary text-primary-foreground`
- Incoming messages: `bg-muted`
- Unread indicator: `bg-primary` dot

## Test IDs
- `conversation-item-{id}`: Conversation list
- `message-{id}`: Message bubbles
- `input-message`: Message input
- `button-send`: Send button
- `button-template`: Template selector
