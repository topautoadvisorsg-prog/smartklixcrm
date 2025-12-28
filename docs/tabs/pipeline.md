# Pipeline

## Purpose
The Pipeline page provides a Kanban-style visual workflow for managing deals from lead intake to completion. It includes revenue forecasting with weighted probabilities and AI-powered signals for deal health assessment.

## UI Behavior

### Layout Structure
1. **Header - Velocity Dashboard**:
   - Total weighted forecast display (large number)
   - Velocity bar showing stage breakdown by color
   - Stage legend with weighted values

2. **Kanban Board**:
   - 5 columns: New Leads, Estimate Sent, Scheduled, In Progress, Completed
   - Drag-and-drop between columns with transition validation
   - Droppable zones with visual feedback

### Deal Cards
Each card displays:
- Job title and customer name
- AI Win Score badge (color-coded: green >70%, yellow 40-70%, red <40%)
- Estimated value
- Velocity sparkline (7-day trend)
- Assigned technician avatars
- Rotting indicator (orange triangle) if stale

### Stage Weights (for forecasting)
| Stage | Weight | Description |
|-------|--------|-------------|
| Lead Intake | 0% | New, unqualified |
| Estimate Sent | 25% | Proposal delivered |
| Scheduled | 50% | Appointment set |
| In Progress | 75% | Work underway |
| Completed | 90% | Work done, pending invoice |
| Invoiced | 95% | Awaiting payment |
| Paid | 100% | Finalized |

### Allowed Transitions
- Lead Intake -> Estimate Sent, Scheduled
- Estimate Sent -> Scheduled, In Progress, Lead Intake
- Scheduled -> In Progress, Estimate Sent
- In Progress -> Completed
- Completed -> Invoiced
- Invoiced -> Paid
- Paid -> (locked)

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs` | GET | Fetch all jobs |
| `/api/jobs/:id` | PATCH | Update job status |
| `/api/contacts` | GET | Fetch contact details |

### AI Signal Generation
- **Win Score**: Based on stage, value, assigned techs, age decay
- **Rotting Detection**: Stage-specific thresholds (lead: 3d, estimate: 5d, etc.)
- **Velocity Trend**: 7-day simulated activity trend

## Backend/API Interactions
- Optimistic updates for drag-and-drop
- Rollback on mutation failure
- Cache invalidation after successful update

## Automation (Neo8) Involvement
- **Stage Transitions**: Log to Automation Ledger
- **Booking Gate**: When moving to final stage, triggers commitment wizard
- **Stale Deal Alerts**: Neo8 can trigger follow-up workflows

## Design Tokens
- Header: `bg-glass-surface`, `border-border`
- Velocity bar: Stage-specific colors (blue, amber, purple, emerald)
- Rotting border: `border-l-orange-500`
- Win score colors: green/yellow/red variants

## Test IDs
- `button-create-deal`: New deal button
- `pipeline-card-{id}`: Individual deal cards

## Drag-and-Drop
Uses `@dnd-kit/core` with:
- `PointerSensor` with 8px activation distance
- `DraggableJobCard` for each card
- `DroppableColumn` for each stage
- `DragOverlay` for ghost preview

## State Machine
Transitions validated before allowing drop. Invalid moves show toast notification with reason.
