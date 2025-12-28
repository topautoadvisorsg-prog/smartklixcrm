# Automation Ledger

## Purpose
The Automation Ledger is an immutable, cryptographically hash-chained record of all automation events, AI actions, and system operations. It provides complete audit trail and compliance documentation.

## UI Behavior

### Layout Structure
1. **Header**:
   - "Automation Ledger" title with "Immutable Record" badge
   - Export button (CSV/JSON)
   - Date range filter
   - Hash verification status

2. **Filter Bar**:
   - Event type filter
   - Source filter (AI, Neo8, Manual, System)
   - Contact/Job filter
   - Search by hash or content

3. **Ledger Table**:
   - Columns: Timestamp, Type, Source, Actor, Target, Hash (truncated), Status
   - Expandable rows for full payload
   - Hash chain verification indicator

4. **Entry Detail Modal**:
   - Full event payload (JSON)
   - Previous hash (chain link)
   - Current hash
   - Verification status
   - Related entries

### Hash Chain Structure
```
Entry N:
  - payload: { action, target, data, timestamp }
  - previousHash: hash(Entry N-1)
  - currentHash: hash(payload + previousHash)
```

### Interactions
- **Expand Row**: View full payload
- **Verify Hash**: Validate chain integrity
- **Export**: Download filtered entries
- **Link Navigation**: Jump to related entries

## Data Flow

### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/automation-ledger` | GET | List entries |
| `/api/automation-ledger/:id` | GET | Get entry detail |
| `/api/automation-ledger/verify` | GET | Verify chain integrity |
| `/api/automation-ledger/export` | GET | Export entries |

## Backend/API Interactions
- Write-only (no updates/deletes)
- Hash computed on insert
- Chain verification on demand

## Event Types
| Type | Description |
|------|-------------|
| `ai.action` | AI tool execution |
| `ai.proposal` | AI action proposal |
| `approval.granted` | Human approval |
| `approval.denied` | Human rejection |
| `neo8.trigger` | Workflow triggered |
| `neo8.complete` | Workflow completed |
| `execution.start` | Action began |
| `execution.complete` | Action finished |
| `execution.failed` | Action failed |

## Design Tokens
- Header: `bg-glass-surface`
- Valid hash: `text-emerald-500`
- Invalid hash: `text-red-500`
- AI source: `bg-purple-500/10`
- Neo8 source: `bg-blue-500/10`
- Manual source: `bg-amber-500/10`

## Compliance
- Immutable: No entry can be modified
- Verifiable: Hash chain proves integrity
- Exportable: Full audit trail download
- Timestamped: UTC timestamps on all entries

## Test IDs
- `ledger-entry-{id}`: Entry rows
- `button-verify-chain`: Verification button
- `button-export`: Export button
- `filter-event-type`: Type filter
- `hash-display-{id}`: Hash values
- `chain-status`: Chain verification status
