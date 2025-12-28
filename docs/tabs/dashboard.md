# Dashboard

## Purpose
The Dashboard serves as the **read-only operational snapshot** of the Smart Klix CRM system. It provides at-a-glance visibility into active missions (jobs), pending reviews, completion rates, and pipeline value without allowing any mutations.

## UI Behavior

### Layout Structure
1. **Header**: Title with "Read-Only View" badge, system health indicator, and manual refresh button
2. **KPI Row**: 4 clickable metric cards (Active Missions, Awaiting Review, Completion Rate, Pipeline Value)
3. **Middle Section**: 
   - Activity Volume chart (24h throughput visualization)
   - Discovery Insights panel (AI-derived observations)
   - Next High-Priority Mission card
4. **Activity Feed**: Last 4 ledger entries with navigation to full Automation Ledger

### Interactions
- **KPI Cards**: Click to navigate to related page (Jobs, Review Queue, Automation Ledger, Pipeline)
- **Refresh Button**: Manually refetches all data and updates timestamp
- **Activity Rows**: Hover state with border highlight
- **View in Ledger**: Links to Automation Ledger for full history

### Loading State
- Boot sequence skeleton loader (800ms)
- Animated fade-in on data load

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/contacts` | GET | Total contact count for insights |
| `/api/jobs` | GET | Job metrics (active, completed, scheduled) |
| `/api/appointments` | GET | Scheduled appointments count |
| `/api/audit-log` | GET | Recent activity feed entries |

### Computed Metrics
- **Active Missions**: Jobs not completed or cancelled
- **Awaiting Review**: Jobs with status `estimate_sent`
- **Completion Rate**: `(completedJobs / totalJobs) * 100`
- **Pipeline Value**: Sum of `value` field from completed jobs

## Backend/API Interactions
- All endpoints are **read-only GET requests**
- No mutations occur on this page
- Data refresh is manual (user-initiated)

## Automation (Neo8) Involvement
- **None**: Dashboard is purely observational
- Activity feed displays Neo8 event history from `audit-log` endpoint
- No webhooks triggered from this page

## Design Tokens
- Uses `bg-glass-surface` and `border-glass-border` for glassmorphic cards
- All cards use `rounded-xl shadow-sm` for consistent rounded corners
- Purple accent for AI Insights panel (`bg-purple-500/5 border-purple-500/20`)
- Amber accent for Next Mission card (`bg-amber-500/5 border-amber-500/20`)
- Emerald indicator for system health status (`bg-emerald-500` with glow)

## Test IDs
- `button-refresh-dashboard`: Manual refresh trigger
- `kpi-card-{0-3}`: KPI metric cards
- `card-next-mission`: Next mission navigation card
- `activity-row-{0-3}`: Activity feed rows
- `button-view-ledger`: Link to Automation Ledger
