# Calendar (Scheduling Mirror)

## Purpose

The Calendar tab is a **read-only scheduling reference view** that mirrors the business schedule from Google Calendar. It provides dispatchers and technicians with a unified view of installations, site visits, and client meetings linked to CRM records.

**This tab is a passive consumer of calendar data - it never writes to Google Calendar.**

## Core Authority Rules

| Rule | Description |
|------|-------------|
| **Google Calendar is Master** | The CRM does NOT own scheduling logic, availability checks, or conflict resolution |
| **Read-Only Mirror** | No event creation, editing, or deletion is supported in this tab |
| **No Conflict Detection** | All scheduling disputes must be resolved in Google Calendar |
| **Click-Through to Edit** | Clicking any event opens Google Calendar in a new tab |

## Who Uses This

- **Dispatchers**: Verify team availability and location status
- **Technicians**: View daily route and site details
- **Operations**: Quick reference for day's schedule

## Sync & Refresh Model

| Behavior | Implementation |
|----------|----------------|
| **Fetch on Load** | Calendar data retrieved when tab is accessed |
| **Manual Refresh** | Data updates ONLY when user clicks Refresh button |
| **No Background Polling** | System does NOT auto-poll to prevent API quota abuse |
| **Rate Limiting** | Refresh button has 5-second cooldown to prevent hammering |

## UI Layout

### Header
| Element | Description |
|---------|-------------|
| Title | "Scheduling Mirror" |
| Authority Indicator | Green dot with "Authority Source: Google Calendar" |
| Filter Toggle | "Linked Only" / "Show All" switcher |
| Sync Timestamp | Last sync time display |
| Refresh Button | Manual refresh with rate limiting |

### Date Navigation
| Element | Description |
|---------|-------------|
| Current Date | Bold display of selected date |
| Today Badge | Shown when viewing current date |
| Prev/Next Buttons | Navigate by day |
| Today Button | Jump to current date (when not on today) |
| View Switcher | Day/Week/Month (only Day is functional in v1) |

### Event List
| Element | Description |
|---------|-------------|
| Event Cards | Time, title, linked entity, type badge, status indicator |
| Status Indicators | Active (green pulse), Imminent (amber), Completed (gray), Future (outline) |
| Type Badges | Installation, Meeting, Follow-up, Maintenance, Site Visit, General |
| Entity Chips | Job/Contact/Deal with icon |
| Click Action | Opens Google Calendar in new tab |

## Status Indicators

| Status | Condition | Visual |
|--------|-----------|--------|
| **Active** | Current time is between start/end | Green badge with pulse animation |
| **Imminent** | Starts within 60 minutes | Amber outline badge |
| **Completed** | End time has passed | Gray muted badge |
| **Future** | More than 60 mins until start | Outline badge |

## View Scope (v1)

| View | Status |
|------|--------|
| **Day** | Fully implemented |
| **Week** | Placeholder (disabled) |
| **Month** | Placeholder (disabled) |

Week and Month views are visible but disabled. Day view is the operational view dispatchers actually need.

## Data Flow

```
Google Calendar → Neo8 Webhook → CRM Database → Calendar Tab
```

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs` | GET | Fetch jobs with scheduled dates |
| `/api/contacts` | GET | Fetch contact names for display |

**Note:** Calendar events are derived from Jobs with `scheduledStart` dates. Full Google Calendar integration is handled externally via Neo8.

## Neo8 / Automation

| Question | Answer |
|----------|--------|
| Triggers automations? | **NO** |
| Reads automation results? | **YES** (displays synced calendar data) |
| Writes to Automation Ledger? | **NO** |

Inbound only flow:
```
Google Calendar → Neo8 → CRM DB → Calendar Tab
```

## What This Tab Is NOT

- **A Scheduler**: Cannot drag-and-drop to reschedule
- **A Conflict Resolver**: Does not warn about double-bookings
- **A Write Surface**: Never writes to Google Calendar
- **Real-time**: Does not auto-refresh or poll

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API Failure | Dismissible error banner with retry prompt |
| Auth Expired | Prompt for Google Marketplace re-auth (if applicable) |
| Empty State | Clear message with filter/refresh suggestions |

## Design Tokens

| Element | Token |
|---------|-------|
| Header | `bg-glass-surface`, `border-glass-border` |
| Event Cards | `bg-glass-surface`, `rounded-xl`, `hover-elevate` |
| Active Event | `ring-2 ring-emerald-500/50` |
| Type Colors | Indigo (install), Amber (meeting), Emerald (follow-up), Blue (maintenance), Purple (site visit) |

## Test IDs

| Element | Test ID |
|---------|---------|
| Page Title | `text-calendar-title` |
| Current Date | `text-current-date` |
| Linked Filter | `button-filter-linked` |
| Show All Filter | `button-filter-all` |
| Refresh Button | `button-refresh` |
| Previous Day | `button-prev-day` |
| Next Day | `button-next-day` |
| Today Button | `button-today` |
| View Buttons | `button-view-day`, `button-view-week`, `button-view-month` |
| Event Cards | `event-card-{id}` |
| Dismiss Error | `button-dismiss-error` |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_GOOGLE_CALENDAR_ID` | Org-level shared Google Calendar ID |
