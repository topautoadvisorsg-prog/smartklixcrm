# Marketplace

## Purpose
The Marketplace page provides an interface for discovering, installing, and managing integrations, extensions, and add-ons for the CRM platform.

## UI Behavior

### Layout Structure
1. **Header**:
   - Title
   - Search input
   - Category filter

2. **Category Sidebar**:
   - All Integrations
   - Communication
   - Payments
   - Analytics
   - Productivity
   - AI/Automation
   - Installed

3. **Integration Grid**:
   - Cards with logo, name, description
   - Install/Uninstall button
   - Rating/reviews
   - Pricing indicator

4. **Integration Detail Modal**:
   - Full description
   - Screenshots
   - Setup instructions
   - Configuration options
   - Reviews

### Interactions
- **Search**: Filter by name/description
- **Category Click**: Filter by category
- **Install**: Begin setup wizard
- **Configure**: Open integration settings
- **Uninstall**: Remove with confirmation

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/marketplace` | GET | List available integrations |
| `/api/marketplace/:id` | GET | Integration details |
| `/api/marketplace/:id/install` | POST | Install integration |
| `/api/marketplace/:id/uninstall` | POST | Uninstall |
| `/api/marketplace/installed` | GET | User's installed |

## Backend/API Interactions
- Integration catalog from central registry
- Installation configures webhooks/APIs
- OAuth flows for third-party auth

## Automation (Neo8) Involvement
- **Integration Webhooks**: n8n handles external callbacks
- **Data Sync**: Periodic sync workflows
- **Event Triggers**: Integration-specific automations

## Integration Categories
| Category | Examples |
|----------|----------|
| Communication | Twilio, SendGrid, Slack |
| Payments | Stripe, Square, PayPal |
| Analytics | Google Analytics, Mixpanel |
| Productivity | Google Workspace, Notion |
| AI | OpenAI, Anthropic, Custom LLMs |

## Design Tokens
- Integration cards: `bg-glass-surface border-glass-border`
- Installed: `bg-emerald-500/10` badge
- Category selected: `bg-primary/10`
- Free: `text-emerald-500`
- Paid: `text-amber-500`

## Test IDs
- `input-search-marketplace`: Search
- `category-{category}`: Category items
- `integration-card-{id}`: Integration cards
- `button-install-{id}`: Install buttons
- `button-configure-{id}`: Configure buttons
