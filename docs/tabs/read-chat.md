# Read Chat

## Purpose
Read Chat provides a read-only observation interface for monitoring AI conversations without execution authority. This is the passive companion to Action Console, enforcing the separation between observation and execution.

## UI Behavior

### Layout Structure
1. **Header**:
   - "Read Chat" title with "Observation Mode" badge
   - Channel filter (CRM Chat, GPT Actions, Voice, Widget)
   - Date range filter

2. **Conversation List (Left)**:
   - Chronological list of conversations
   - Shows: Contact name, channel, timestamp, preview
   - Unread indicator
   - Click to load in main panel

3. **Chat Display (Center)**:
   - Full conversation transcript
   - Message bubbles: User vs AI
   - Timestamps for each message
   - Tool call displays (read-only)

4. **Context Panel (Right)**:
   - Contact information
   - Related job/estimate
   - AI reasoning summary
   - NO action buttons

### Key Principle
**This interface has NO execution capabilities.** It is purely observational.
- No approve/reject buttons
- No action triggers
- No editing of any kind
- Read-only display only

### Interactions
- **Click Conversation**: Load transcript
- **Filter by Channel**: Focus on specific source
- **Search**: Find specific conversations
- **Export**: Download transcript (optional)

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/conversations` | GET | List conversations |
| `/api/conversations/:id/messages` | GET | Get transcript |
| `/api/contacts/:id` | GET | Contact context |

## Backend/API Interactions
- Conversations streamed from Master Architect logs
- No mutation endpoints exposed
- Audit log of who viewed what

## Automation (Neo8) Involvement
None - this is a passive observation interface.

## Design Tokens
- Header: `bg-glass-surface`
- Observation badge: `bg-muted text-muted-foreground`
- User messages: `bg-primary/10`
- AI messages: `bg-muted`
- Tool calls: `bg-purple-500/5 border-purple-500/20`

## Test IDs
- `conversation-list-item-{id}`: Conversation entries
- `message-bubble-{id}`: Individual messages
- `filter-channel`: Channel dropdown
- `search-conversations`: Search input

## Security Model
- View-only permissions
- No action execution
- Separate from Action Console access
