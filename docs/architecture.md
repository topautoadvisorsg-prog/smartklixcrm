# TopOut Platform Architecture

## Overview

TopOut is a production-grade, single-tenant, white-label AI CRM automation platform. Each tenant deployment operates as a fully isolated SaaS instance with dedicated database, storage, secrets, and AI runtime.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  Dashboard, Contacts, Jobs, Calendar, AI Queue, Settings   │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/REST API
┌────────────────▼────────────────────────────────────────────┐
│                  Backend (Express.js)                       │
│  ├── API Routes (/api/*)                                    │
│  ├── Storage Layer (Memory/DB)                              │
│  └── Audit Logging                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼─────┐      ┌────────▼──────┐
│ PostgreSQL│      │  Redis (Queue)│
│  Database │      │   [Pending]   │
└───────────┘      └───────────────┘
```

## Core Modules

### 1. Frontend (`/client`)

**Technology**: React, TypeScript, TailwindCSS, Shadcn UI

**Key Features**:
- Sidebar navigation with full routing
- Dashboard with metrics and activity timeline
- CRUD interfaces for Contacts, Jobs, Appointments, Notes, Files
- AI Assist Queue for reviewing AI-suggested actions
- Audit Log for system transparency
- Settings page for tenant branding and AI agent configuration
- Dark mode support
- Responsive design

**Routes**:
- `/` - Dashboard
- `/contacts` - Contact management
- `/jobs` - Job/project tracking
- `/calendar` - Appointment scheduling
- `/ai-assist-queue` - AI action approval queue
- `/files` - File management
- `/notes` - Quick notes
- `/metrics` - Analytics and performance
- `/audit-log` - Activity history
- `/settings` - Configuration

### 2. Backend (`/server`)

**Technology**: Express.js, TypeScript, Drizzle ORM

**Key Files**:
- `server/index.ts` - Express app initialization
- `server/routes.ts` - API route definitions
- `server/storage.ts` - Storage abstraction layer
- `server/db.ts` - Database connection management

**API Endpoints**:
- `GET /api/health` - System health check
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `PATCH /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- Similar CRUD endpoints for jobs, notes, appointments
- `GET /api/audit-log` - Retrieve audit history

### 3. Data Layer (`/shared`)

**Schema Definition**: Drizzle ORM with Zod validation

**Entities**:
- `users` - User accounts and authentication
- `contacts` - Customer/lead information
- `jobs` - Projects and work items
- `appointments` - Scheduled meetings
- `notes` - Quick notes and documentation
- `files` - File metadata tracking
- `audit_log` - System activity history

### 4. Storage Abstraction

**Dual Mode Operation**:

1. **Memory Storage (`MemStorage`)**: 
   - In-memory data structures
   - Used when `DATABASE_URL` is not configured
   - Perfect for development and testing
   - Data lost on restart

2. **Database Storage (`DbStorage`)**:
   - PostgreSQL with Drizzle ORM
   - Production-ready persistence
   - Used when `DATABASE_URL` is configured
   - Supports tenant isolation

The system automatically selects the appropriate storage based on environment configuration.

## Deployment Architecture

### Single-Tenant Isolation

Each customer deployment includes:
- **Dedicated Database**: Separate Postgres instance or schema
- **Independent Secrets**: Unique encryption keys, JWT secrets
- **Isolated Storage**: Separate file storage bucket
- **Custom Branding**: Logo, colors, company name
- **Independent Runtime**: Separate Node.js process

### Environment Configuration

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Token signing key
- `SESSION_SECRET` - Session encryption key

Optional (set during integration):
- `OPENAI_API_KEY` - AI agent capabilities
- `N8N_WEBHOOK_URL` - Workflow automation
- `REDIS_URL` - Queue and caching

## Data Flow

### Typical Request Flow

1. **User Action** → Frontend component
2. **API Call** → React Query mutation
3. **Backend Route** → Express handler
4. **Validation** → Zod schema check
5. **Storage Layer** → Memory or Database
6. **Audit Log** → Record action
7. **Response** → JSON back to frontend
8. **UI Update** → React Query cache invalidation

### Audit Trail

Every mutating action creates an audit log entry:
```typescript
{
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: object,
  timestamp: Date
}
```

## Security Considerations

### Current State (Audit Phase)

- No authentication implemented yet
- Database RLS disabled (development mode)
- Placeholder environment variables
- No external API integrations

### Production Requirements (Post-Audit)

- JWT-based authentication
- RBAC with role enforcement
- Database row-level security
- Secret rotation
- Rate limiting
- CSRF protection
- XSS sanitization

## Extensibility

### Adding New Entities

1. Define schema in `shared/schema.ts`
2. Add storage methods in `server/storage.ts`
3. Create API routes in `server/routes.ts`
4. Build frontend page in `client/src/pages/`
5. Add navigation in `AppSidebar.tsx`

### Customization Points

- **Branding**: Settings page allows logo, colors, company name
- **AI Behavior**: Agent mode (Draft/Assist/Auto) configurable
- **Workflows**: N8N integration for custom automation
- **Tools**: Extend AI tool endpoints for domain-specific actions

## Technology Decisions

### Why Drizzle ORM?
- Type-safe queries
- Schema-first approach
- Migration support
- Lightweight and performant

### Why Memory Storage Fallback?
- Enables development without database
- Easier testing and prototyping
- Graceful degradation
- Clear separation of concerns

### Why Single-Tenant?
- Complete data isolation
- Per-customer customization
- Independent scaling
- Simplified compliance (GDPR, HIPAA)
- No noisy neighbor problems

## Monitoring & Observability

### Current Capabilities

- Health check endpoint (`/api/health`)
- Service status indicators
- Audit log for all actions

### Planned Enhancements

- OpenTelemetry integration
- LLM latency tracking
- Queue depth monitoring
- Token usage analytics
- Error rate dashboards

## Maintenance

### Database Migrations

Use Drizzle Kit:
```bash
npm run db:push        # Sync schema to database
npm run db:generate    # Generate migration files
npm run db:migrate     # Run migrations
```

### Backup Strategy

- Database: Daily automated backups
- Files: S3 bucket versioning
- Secrets: Vault snapshots
- Code: Git repository

## N8N Integration Architecture

### Overview

TopOut integrates with N8N using a **hybrid model**:
1. **Direct REST API**: N8N makes HTTP calls to TopOut CRM endpoints for CRUD operations
2. **Event Webhooks**: TopOut sends events to N8N for AI-driven workflows

### N8N REST API Endpoints

All n8n workflows can access these authenticated endpoints:

**Base URL**: `https://5111a1a7-2f59-4ad2-9b99-d56328fad3c6-00-3byo21gezjnvn.worf.replit.dev`  
**Authentication**: `Authorization: Bearer {N8N_INTERNAL_TOKEN}`

#### Contact Management
- `GET /api/contacts/lookup?phone={phone}` - Find contact by phone
- `POST /api/contacts/create` - Upsert contact (deduplicates by phone)
- `POST /api/contacts/update` - Partial contact update

#### Job & Lead Management
- `POST /api/leads/create` - Create new lead
- `POST /api/jobs/create` - Create job with metadata

#### Activity & Audit
- `POST /api/activity-log/write` - Log communication/activity
- `POST /api/events/update` - Report n8n workflow results back to CRM

### Voice Call Event Workflow

**Purpose**: Processes incoming voice call events from Twilio/Vapi and integrates with SmartKlix CRM.

**Webhook URL**: `/webhook/voice-call-event`

**Event Types**:
1. **call_completed**: Full call with AI summary and job details
2. **call_missed**: Missed call requiring follow-up

**Workflow Architecture**:
```
┌─────────────────┐
│ Voice Provider  │
│ (Twilio/Vapi)  │
└────────┬────────┘
         │ POST /webhook/voice-call-event
         ▼
┌─────────────────────────────────────┐
│ Voice Call Event Handler Workflow   │
├─────────────────────────────────────┤
│  ┌──────────────────┐              │
│  │ Route by Event   │              │
│  │  - call_completed│              │
│  │  - call_missed   │              │
│  └────────┬─────────┘              │
│           │                         │
│     ┌─────┴──────┐                 │
│     ▼            ▼                 │
│ COMPLETED     MISSED                │
│ PATH          PATH                  │
│     │            │                  │
│     ▼            ▼                  │
│ Contact      Contact                │
│ Upsert       Upsert                 │
│     │            │                  │
│     ▼            ▼                  │
│ Job/Lead     Lead +                 │
│ Decision     SMS Alert              │
│     │            │                  │
│     ▼            ▼                  │
│ Activity     Activity               │
│ Log          Log                    │
│     │            │                  │
│     └─────┬──────┘                 │
│           ▼                         │
│    Event Update                     │
│    (Optional)                       │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ SmartKlix CRM   │
│ - Contacts      │
│ - Jobs/Leads    │
│ - Activity Log  │
└─────────────────┘
```

**Completed Call Flow**:
1. Contact upsert by phone + name
2. Check if `details.job_type` exists
3. If yes → Create Job with full details
4. If no → Create Lead with reason
5. Log activity with AI summary
6. Optional: Report to `/api/events/update`

**Missed Call Flow**:
1. Contact upsert by phone only
2. Create lead for follow-up
3. Send SMS notification via Twilio
4. Log activity

**Documentation**: See `VOICE_CALL_TEST_PAYLOADS.md` for:
- Complete test payloads
- Expected workflow execution
- Verification steps
- Troubleshooting guide

**Workflow File**: `voice-call-event-workflow.json`

### Integration Security

**Authentication**: All SmartKlix API requests require bearer token:
```
Authorization: Bearer f13ae889ddabed317a1090f861c3904e52786e9bde3217862a62b1486f550ca1
```

**Token Validation**: Backend uses `requireInternalToken` middleware for n8n endpoints.

**Logging**: All n8n API requests/responses logged with `[N8N API]` prefix for debugging.

## Future Roadmap

**Phase 2 - Integration** (In Progress):
- ✅ N8N workflow automation (REST API complete)
- ✅ Voice call integration (workflow ready)
- Real OpenAI connection
- Redis queue implementation
- Authentication system

**Phase 3 - Enhancement**:
- Email/SMS via N8N
- Memory subsystem with embeddings
- Advanced AI agent modes
- Additional voice workflows (outbound calls, voicemail)

**Phase 4 - Enterprise**:
- SSO integration
- Advanced RBAC
- Compliance certifications
- Multi-region deployment
