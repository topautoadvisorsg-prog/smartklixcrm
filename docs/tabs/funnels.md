# Funnels

## Purpose
The Funnels page manages marketing and sales funnels, tracking lead progression through conversion stages. It provides funnel analytics and optimization insights.

## UI Behavior

### Layout Structure
1. **Header**:
   - Title with funnel count
   - New Funnel button
   - View toggle (list/visual)

2. **Funnel List/Cards**:
   - Funnel name
   - Stage count
   - Total leads
   - Conversion rate
   - Status (active/paused)

3. **Funnel Detail View**:
   - Funnel visualization
   - Stage-by-stage metrics
   - Drop-off analysis
   - Lead list per stage

4. **Funnel Builder**:
   - Drag-and-drop stage creation
   - Stage configuration
   - Automation triggers
   - Goal setting

### Interactions
- **Create Funnel**: Open builder wizard
- **Edit Funnel**: Modify stages and settings
- **View Analytics**: Detailed conversion metrics
- **Clone Funnel**: Duplicate existing funnel
- **Archive Funnel**: Soft delete

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/funnels` | GET | List funnels |
| `/api/funnels` | POST | Create funnel |
| `/api/funnels/:id` | PATCH | Update funnel |
| `/api/funnels/:id/analytics` | GET | Funnel metrics |

## Backend/API Interactions
- Funnel stages linked to pipeline stages
- Lead tracking across funnel stages
- Conversion analytics computed

## Automation (Neo8) Involvement
- **Stage Triggers**: Automated actions on stage entry/exit
- **Follow-Up Sequences**: Drip campaigns per stage
- **Goal Notifications**: Alerts on conversion

## Design Tokens
- Funnel cards: `bg-glass-surface border-glass-border`
- Active funnels: `border-l-2 border-l-emerald-500`
- Paused funnels: `border-l-2 border-l-muted`
- Conversion rate: Color gradient (red → green)

## Test IDs
- `button-new-funnel`: Create button
- `funnel-card-{id}`: Funnel cards
- `stage-{id}`: Stage elements
- `button-view-analytics`: Analytics button
