# SMART KLIX CRM — UI IMPLEMENTATION BLUEPRINT

**Version**: 1.0  
**Date**: November 21, 2025  
**Status**: Ready for Implementation  
**Based On**: Comprehensive UI/UX Audit Report

---

## EXECUTIVE SUMMARY

This blueprint transforms Smart Klix CRM from a navigation-bloated prototype into a production-grade, Fortune 500-quality field service CRM. We consolidate **17 navigation items down to 9**, enhance detail pages to become true command centers, and establish clear hierarchy for AI/automation features.

**Key Metrics**:
- Navigation reduction: 17 → 9 items (47% simplification)
- Detail page enhancement: Contact & Job pages become full-featured workspaces
- AI visibility: Unified control center for all AI/automation tasks
- API-first architecture: All features exposed via clean REST endpoints

**Philosophy**: Best-in-class CRMs (Salesforce, HubSpot, ServiceTitan) succeed because they minimize clicks, maximize context, and embed AI naturally. We follow that playbook.

---

## PHASED IMPLEMENTATION PLAN

### PHASE 1: NAVIGATION CLEANUP & TAB REMOVAL (Week 1-2)

**Goal**: Simplify navigation from 17 items to 9 items. Remove bloat, establish clean hierarchy.

**Changes**:

1. **REMOVE Files Tab** (`client/src/pages/Files.tsx`)
   - Delete entire page component
   - Remove route from `client/src/App.tsx`
   - Remove sidebar item from `client/src/components/AppSidebar.tsx`
   - **Migration**: Files functionality moves to Contact/Job detail pages

2. **REMOVE Notes Tab** (`client/src/pages/Notes.tsx`)
   - Delete entire page component
   - Remove route from `client/src/App.tsx`
   - Remove sidebar item from `client/src/components/AppSidebar.tsx`
   - **Migration**: Notes functionality embeds in Contact/Job detail pages

3. **REMOVE Metrics Tab** (`client/src/pages/Metrics.tsx`)
   - Delete entire page (100% mock data)
   - Remove route and sidebar item
   - **Alternative**: Enhance Dashboard with real metrics OR create new Reports page later

4. **REMOVE AI Assist Queue Tab** (`client/src/pages/AIAssistQueue.tsx` if exists)
   - Merge functionality into Master Architect Hub
   - Remove duplicate navigation item

5. **RELOCATE User Management**
   - Move from main nav to Settings → User Management
   - Keep component, change route structure
   - Admin-only visibility

6. **RELOCATE Audit Log**
   - Move from main nav to Settings → System → Audit Log
   - Admin-only visibility

7. **RELOCATE AI Memory**
   - Move from main nav to Settings → AI Configuration → AI Memory
   - Admin-only visibility

**Files Modified**:
- `client/src/App.tsx` (routing)
- `client/src/components/AppSidebar.tsx` (navigation)
- Delete: `client/src/pages/Files.tsx`
- Delete: `client/src/pages/Notes.tsx`
- Delete: `client/src/pages/Metrics.tsx`

**Breaking Changes**:
- Users will no longer see Files/Notes/Metrics in main navigation
- Admin features move to Settings (admins must adjust)

**Testing**:
- [ ] All routes resolve correctly
- [ ] Sidebar renders with 9 items
- [ ] No broken links
- [ ] Settings page accessible

---

### PHASE 2: CONTACT & JOB DETAIL PAGE ENHANCEMENT (Week 3-4)

**Goal**: Transform Contact Detail and Job Detail pages into full-featured command centers where users can complete 90% of tasks without leaving.

**Contact Detail Enhancements**:

1. **Add Inline Note Creation**
   - Text area component in Notes & Files tab
   - "Add Note" button creates note without modal
   - Real-time note list updates

2. **Add Drag-and-Drop File Upload**
   - Drop zone in Notes & Files tab
   - Upload progress indicator
   - File preview cards

3. **Add Communication Timeline**
   - New tab: "Communication"
   - Shows all SMS, emails, calls chronologically
   - Filter by type, search by keyword

4. **Add Quick Actions Panel**
   - Always-visible action bar: Create Job, Schedule Appointment, Send SMS, Send Email
   - Context-aware (contact data pre-filled)

5. **Add Financial Summary Tab**
   - Shows all estimates, invoices, payments for this contact
   - Total revenue, outstanding balance
   - Quick links to related financial records

6. **Add AI Recommendations Section**
   - Widget in Overview tab
   - Shows AI-suggested next actions for this contact
   - Links to Master Architect Hub for details

**Job Detail Enhancements**:

1. **Add Task Checklist System**
   - Inline checklist in Overview tab
   - Check/uncheck tasks
   - Progress percentage displayed in header

2. **Add Team Assignment**
   - Dropdown in header to assign team members
   - Shows who's assigned to this job
   - Avatar display for assigned users

3. **Add Priority Indicator**
   - Badge in header: Low/Medium/High/Urgent
   - Color-coded for visibility

4. **Add Time & Materials Tracking**
   - New tab: "Time & Materials"
   - Log hours worked by team members
   - Log parts/materials used
   - Expense tracking
   - Profitability calculator (revenue vs. costs)

5. **Add Inline Notes & Files**
   - Same as Contact Detail
   - Drag-and-drop upload
   - Inline note creation

6. **Add Photo Gallery**
   - Section in Notes & Files tab
   - Before/after photo upload
   - Grid view display

7. **Add AI Recommendations**
   - Widget in Overview tab
   - Suggested next steps for this job
   - Links to Master Architect Hub

**Files Modified**:
- `client/src/pages/ContactDetail.tsx` (major enhancement)
- `client/src/pages/JobDetail.tsx` (major enhancement)
- Create: `client/src/components/InlineNoteCreator.tsx`
- Create: `client/src/components/FileDropZone.tsx`
- Create: `client/src/components/CommunicationTimeline.tsx`
- Create: `client/src/components/QuickActionsPanel.tsx`
- Create: `client/src/components/TaskChecklist.tsx`
- Create: `client/src/components/TimeAndMaterialsTracker.tsx`
- Create: `client/src/components/AIRecommendationsWidget.tsx`

**API Endpoints Needed**:
- `POST /api/notes` (inline creation)
- `POST /api/files/upload` (drag-and-drop)
- `GET /api/contacts/:id/communication-timeline`
- `GET /api/contacts/:id/financial-summary`
- `POST /api/jobs/:id/tasks` (checklist)
- `PATCH /api/jobs/:id/assign` (team assignment)
- `GET /api/jobs/:id/time-materials`
- `POST /api/jobs/:id/time-materials`
- `GET /api/ai/recommendations/:entityType/:entityId`

**Breaking Changes**:
- Notes no longer accessible from standalone tab (only in detail pages)
- Files no longer accessible from standalone tab (only in detail pages)

**Testing**:
- [ ] Inline note creation works
- [ ] File upload via drag-and-drop works
- [ ] Communication timeline loads correctly
- [ ] Task checklist persists
- [ ] Time tracking saves correctly
- [ ] AI recommendations display

---

### PHASE 3: AI & AUTOMATION VISIBILITY (Week 5-6)

**Goal**: Make AI and automation features visible and accessible throughout the UI. Users should see the AI working for them.

**Dashboard Enhancements**:

1. **Add AI Recommendations Widget**
   - Card showing top 3 AI-suggested actions
   - "View All" links to Master Architect Hub
   - Dismissible suggestions

2. **Add N8N Integration Status Panel**
   - Shows connection health for N8N, OpenAI, Database
   - Recent automation events (last 5)
   - Error notifications if disconnected

3. **Add Quick Action Buttons**
   - Floating action button or header buttons
   - Create Contact, Create Job, Schedule Appointment
   - Opens pre-filled dialogs

**Master Architect Hub Refinement**:

1. **Admin-Only Access**
   - Move to Settings → AI Control → Master Architect Hub
   - Role-based visibility check

2. **Enhanced Task Display**
   - Show original user request
   - Show AI's proposed action
   - Show context (contact name, job ID, etc.)
   - Show status with color coding

3. **Bulk Actions**
   - Select multiple tasks
   - Bulk approve/reject
   - Priority sorting

4. **Action Scheduling**
   - Approve but schedule for later execution
   - Recurring action templates

**Intelligence Bot Improvements**:

1. **Rename to "AI Assistant"**
   - More intuitive name
   - Update sidebar label

2. **Context-Aware Chat**
   - Add "Chat about this contact" button in Contact Detail
   - Add "Chat about this job" button in Job Detail
   - Pre-load context when opened from detail pages

3. **Slide-Out Panel Option** (Optional)
   - Consider making it accessible as slide-out instead of full page
   - Allows chat while viewing other pages

**Files Modified**:
- `client/src/pages/Dashboard.tsx` (add widgets)
- `client/src/pages/MasterArchitectHub.tsx` (enhance)
- `client/src/pages/IntelligenceBot.tsx` (rename, enhance)
- Create: `client/src/components/AIRecommendationsDashboardWidget.tsx`
- Create: `client/src/components/N8NStatusPanel.tsx`
- Create: `client/src/components/QuickActionsFAB.tsx`

**API Endpoints Needed**:
- `GET /api/ai/recommendations` (dashboard widget)
- `GET /api/integrations/status` (N8N, OpenAI health checks)
- `GET /api/master-architect/tasks` (already exists, enhance response)
- `POST /api/master-architect/bulk-approve`
- `POST /api/master-architect/schedule`

**Breaking Changes**:
- Master Architect Hub moves to Settings (admins must adjust)
- Intelligence Bot renamed to AI Assistant

**Testing**:
- [ ] Dashboard widgets display correctly
- [ ] N8N status panel shows real connection state
- [ ] Master Architect Hub accessible from Settings
- [ ] Bulk actions work correctly
- [ ] AI Assistant renamed everywhere

---

### PHASE 4: WORKFLOW & SCHEDULING IMPROVEMENTS (Week 7-8)

**Goal**: Streamline daily operations with better views, filters, and interactions.

**Jobs Page Enhancements**:

1. **Add Kanban View Toggle**
   - Button to switch between Table and Kanban views
   - Drag-and-drop job cards between columns (status)
   - Persist user preference (local storage)

2. **Add Bulk Actions**
   - Checkbox column for multi-select
   - Bulk status update
   - Bulk delete (with confirmation)
   - Bulk assign team member

3. **Add Advanced Filters**
   - Filter by status (multi-select)
   - Filter by assigned team member
   - Filter by date range
   - Filter by value range
   - Save filter presets

**Contacts Page Enhancements**:

1. **Add Bulk Actions**
   - Multi-select checkboxes
   - Bulk send SMS
   - Bulk send email
   - Bulk tag/untag
   - Bulk status change

2. **Add Advanced Filters**
   - Filter by status
   - Filter by tags
   - Filter by company
   - Filter by date added
   - Filter by last contact date

3. **Add Contact Segments**
   - Create saved segments (e.g., "VIP Customers", "Leads")
   - Quick access to segments
   - Auto-updating smart segments

**Calendar Enhancements**:

1. **Add Drag-and-Drop Rescheduling**
   - Drag appointment to new time slot
   - Confirm before saving
   - Update job/contact automatically

2. **Add Team Calendar View**
   - Toggle to see all team members' calendars
   - Color-coded by team member
   - Filter by person

3. **Add Resource Booking** (Optional)
   - Book vehicles, equipment alongside appointments
   - Prevent double-booking resources

4. **Add Automated Scheduling**
   - "AI Suggest Time" button
   - Considers team availability, job priority
   - One-click accept suggestion

**Files Modified**:
- `client/src/pages/Jobs.tsx` (Kanban view, filters)
- `client/src/pages/Contacts.tsx` (bulk actions, filters)
- `client/src/pages/Calendar.tsx` (drag-and-drop, team view)
- Create: `client/src/components/JobKanbanView.tsx`
- Create: `client/src/components/BulkActionsToolbar.tsx`
- Create: `client/src/components/AdvancedFilters.tsx`
- Create: `client/src/components/TeamCalendarView.tsx`

**API Endpoints Needed**:
- `PATCH /api/jobs/bulk-update`
- `DELETE /api/jobs/bulk-delete`
- `PATCH /api/contacts/bulk-update`
- `POST /api/contacts/bulk-sms`
- `POST /api/contacts/bulk-email`
- `GET /api/contacts/segments`
- `POST /api/contacts/segments`
- `PATCH /api/appointments/:id/reschedule`
- `GET /api/calendar/team-view`
- `POST /api/calendar/ai-suggest-time`

**Breaking Changes**: None (additive features only)

**Testing**:
- [ ] Kanban view renders correctly
- [ ] Drag-and-drop changes job status
- [ ] Bulk actions execute correctly
- [ ] Filters persist and work
- [ ] Calendar drag-and-drop reschedules
- [ ] Team calendar shows all members

---

### PHASE 5: POLISH, TEMPLATES & QOL (Week 9-10)

**Goal**: Premium finishing touches that make the CRM delightful to use.

**Settings Page Reorganization**:

1. **Create Clear Sections**
   - Company Profile (name, logo, address)
   - Branding (colors, white-label settings)
   - Templates (email templates, SMS templates)
   - User Management (moved here from nav)
   - AI Configuration (Master Architect, AI Memory)
   - System (Audit Log, database info)
   - Integrations (N8N, Stripe, OpenAI status)

2. **Add Template Managers**
   - Email template builder (subject, body, variables)
   - SMS template builder (message, variables)
   - Pre-defined templates (appointment reminder, invoice sent, etc.)

3. **Add Branding Controls**
   - Upload company logo
   - Set primary/secondary colors
   - Preview changes live
   - White-label toggle (hide "Smart Klix" branding)

**Estimates & Invoices Enhancements**:

1. **Add Templates**
   - Create estimate templates
   - Create invoice templates
   - Duplicate existing estimates/invoices

2. **Add PDF Generation**
   - "Download PDF" button
   - Branded PDF with company logo/colors
   - Email PDF directly from CRM

3. **Add Approval Workflow** (Estimates)
   - Send estimate for approval
   - Customer can approve/reject
   - Auto-convert to job on approval

**Payments Enhancement**:

1. **Quick Payment Recording**
   - "Record Payment" button in Invoice detail
   - Auto-update payment status
   - Send confirmation email

2. **Payment Reminders**
   - Auto-send reminder for overdue invoices
   - Configurable reminder schedule

**Job Detail Polish**:

1. **Add Customer Signature Capture**
   - Signature pad in job detail
   - Save signature as image
   - Required for job completion

2. **Add Before/After Photos**
   - Dedicated photo upload section
   - Side-by-side comparison view
   - Attach to invoices/estimates

**Files Modified**:
- `client/src/pages/Settings.tsx` (major reorganization)
- `client/src/pages/Estimates.tsx` (templates, PDF)
- `client/src/pages/Invoices.tsx` (payment workflow)
- `client/src/pages/JobDetail.tsx` (signature, photos)
- Create: `client/src/components/EmailTemplateBuilder.tsx`
- Create: `client/src/components/SMSTemplateBuilder.tsx`
- Create: `client/src/components/BrandingControls.tsx`
- Create: `client/src/components/SignatureCapture.tsx`
- Create: `client/src/components/BeforeAfterPhotoGallery.tsx`

**API Endpoints Needed**:
- `GET /api/settings/company`
- `PATCH /api/settings/company`
- `GET /api/settings/branding`
- `PATCH /api/settings/branding`
- `GET /api/templates/email`
- `POST /api/templates/email`
- `GET /api/templates/sms`
- `POST /api/templates/sms`
- `POST /api/estimates/:id/generate-pdf`
- `POST /api/invoices/:id/generate-pdf`
- `POST /api/invoices/:id/record-payment`
- `POST /api/jobs/:id/signature`

**Breaking Changes**: None (additive features only)

**Testing**:
- [ ] Settings page organized correctly
- [ ] Template builders work
- [ ] Branding changes apply globally
- [ ] PDF generation works
- [ ] Signature capture saves
- [ ] Payment recording updates status

---

## TAB DECISION TABLE

| Current Tab | Decision | New Location/Behavior | Reason |
|-------------|----------|----------------------|--------|
| Dashboard | **Keep as-is, enhance** | Main nav → Dashboard | Central hub, add widgets and quick actions |
| Contacts | **Keep as-is, enhance** | Main nav → Contacts | Core entity, add bulk actions and filters |
| Jobs | **Keep as-is, enhance** | Main nav → Jobs | Core entity, add Kanban view and filters |
| Estimates | **Keep as-is, enhance** | Main nav → Estimates | Core entity, add templates and PDF |
| Invoices | **Keep as-is, enhance** | Main nav → Invoices | Core entity, add payment workflow |
| Payments | **Keep as-is** (optional merge) | Main nav → Payments OR merge with Invoices | Could merge but standalone is fine for field service |
| Calendar | **Keep as-is, enhance** | Main nav → Calendar | Critical for scheduling, add drag-and-drop |
| Pipeline | **Keep as-is, clarify** | Main nav → Pipeline | Sales funnel visualization, clarify purpose |
| **Notes** | **❌ REMOVE** | Delete tab, embed in Contact/Job detail | Notes are contextual, not standalone browsing |
| **Files** | **❌ REMOVE** | Delete tab, embed in Contact/Job detail | Files belong with entities, not isolated |
| Master Architect | **Relocate to Settings** | Settings → AI Control → Master Architect Hub | Admin feature, not daily user tool |
| Intelligence Bot | **Keep, rename** | Main nav → AI Assistant (or slide-out panel) | Useful feature, better name, context-aware |
| **AI Assist Queue** | **❌ REMOVE** | Merge into Master Architect Hub | Redundant with Master Architect |
| **AI Memory** | **Relocate to Settings** | Settings → AI Configuration → AI Memory | Admin feature, technical/internal |
| **Metrics** | **❌ REMOVE** | Delete (100% mock data), enhance Dashboard instead | Duplicate of Dashboard, no real value yet |
| **Audit Log** | **Relocate to Settings** | Settings → System → Audit Log | Admin/compliance tool, not daily use |
| **User Management** | **Relocate to Settings** | Settings → User Management | Admin feature, team setup |
| Settings | **Keep, massively enhance** | Main nav → Settings (with sections) | Central config hub, add many sub-sections |

**Final Navigation Count**: **9 main items**
1. Dashboard
2. Contacts
3. Jobs
4. Estimates
5. Invoices
6. Calendar
7. Pipeline
8. AI Assistant
9. Settings

---

## CONTACT DETAIL PAGE - FINAL SPECIFICATION

### Layout Structure (Top to Bottom)

#### 1. Header Section
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back]                                                     │
│                                                              │
│  ┌───┐  [Contact Name]                    [Status Badge]   │
│  │IMG│  email@example.com | (555) 123-4567 | ABC Company   │
│  └───┘                                                       │
│                                                              │
│  [📱 Send SMS] [✉️ Send Email] [💵 Payment Link] [✏️ Edit] │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- Avatar (with fallback initials)
- Contact name (h1)
- Status badge (visual pill)
- Contact info row (email, phone, company with icons)
- Action buttons (always visible, context-aware)

**Inline Editable**: None (use Edit button → modal)

**Button Actions**:
- Send SMS → Opens `SendSMSDialog` with contact pre-filled
- Send Email → Opens `SendEmailDialog` with contact pre-filled
- Payment Link → Opens `CreatePaymentLinkDialog` with contact pre-filled
- Edit → Opens `EditContactDialog` with current data

---

#### 2. Tabs Section

**Tab List**: Overview | Jobs | Financial | Notes & Files | Appointments | Communication | Activity

##### Tab 1: Overview (Default)
```
┌─────────────────────┬────────────────────────────────┐
│                     │                                │
│ Contact Information │   AI Recommendations           │
│ ─────────────────── │   ──────────────────────────   │
│ Name: John Smith    │   ⚡ Suggested Next Actions:   │
│ Email: john@...     │   • Follow up on estimate      │
│ Phone: 555-1234     │   • Schedule service call      │
│ Company: ABC Corp   │   • Send payment reminder      │
│ Address: 123...     │                                │
│ Tags: VIP, Lead     │   [View All in AI Hub →]       │
│                     │                                │
│ [Edit Contact]      │                                │
└─────────────────────┴────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Quick Actions                                        │
│ ─────────────────────────────────────────────────    │
│ [+ Create Job] [📅 Schedule Appointment] [📝 Add Note]│
└──────────────────────────────────────────────────────┘
```

**Components**:
- Contact information card (read-only display)
- AI Recommendations widget (shows top 3 suggested actions)
- Quick actions panel (prominent buttons)

**Data Displayed**:
- All contact fields from database
- AI-suggested actions from `/api/ai/recommendations/contact/:id`

##### Tab 2: Jobs
```
┌──────────────────────────────────────────────────────┐
│ Jobs for this Contact                    [+ New Job] │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ [Filter: All | Active | Completed]                   │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ 🔧 Kitchen Remodel          [In Progress]    │    │
│ │ $15,000 | Scheduled: Dec 1, 2025             │    │
│ │ [View Details →]                              │    │
│ └──────────────────────────────────────────────┘    │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ 🔧 Bathroom Repair          [Completed]      │    │
│ │ $3,500 | Completed: Oct 15, 2025             │    │
│ │ [View Details →]                              │    │
│ └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Job list (filtered by contactId)
- Job cards (clickable → Job Detail page)
- New Job button (opens CreateJobDialog with contact pre-filled)
- Status filter dropdown

**Data Source**: `GET /api/jobs?clientId={contactId}`

##### Tab 3: Financial
```
┌──────────────────────────────────────────────────────┐
│ Financial Summary                                     │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ Total Revenue: $24,500                               │
│ Outstanding Balance: $1,200                          │
│ Lifetime Value: $25,700                              │
│                                                       │
│ ┌─ Estimates ─────────────────────────────────┐     │
│ │ EST-001 | $15,000 | Approved                │     │
│ │ EST-002 | $3,500  | Sent                    │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─ Invoices ──────────────────────────────────┐     │
│ │ INV-001 | $15,000 | Paid                    │     │
│ │ INV-002 | $3,500  | Paid                    │     │
│ │ INV-003 | $1,200  | Overdue                 │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─ Payments ──────────────────────────────────┐     │
│ │ Oct 20 | $15,000 | Credit Card             │     │
│ │ Nov 5  | $3,500  | Check                   │     │
│ └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Financial summary cards (calculated totals)
- Estimates list (for this contact)
- Invoices list (for this contact)
- Payments list (for this contact)

**Data Source**: `GET /api/contacts/:id/financial-summary`

##### Tab 4: Notes & Files (MERGED)
```
┌──────────────────────────────────────────────────────┐
│ Notes & Files                                         │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌─ Add Note ───────────────────────────────────┐    │
│ │ [Text area for quick note entry]              │    │
│ │ [Save Note]                                   │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Notes ──────────────────────────────────────┐    │
│ │ 📝 Nov 20, 2025 - Follow-up needed           │    │
│ │    "Customer requested quote for..."         │    │
│ │    [Edit] [Delete]                            │    │
│ │                                               │    │
│ │ 📝 Nov 15, 2025 - Initial consultation        │    │
│ │    "Met with customer to discuss..."         │    │
│ │    [Edit] [Delete]                            │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Upload Files ───────────────────────────────┐    │
│ │ [Drag and drop files here or click to browse]│    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Files ──────────────────────────────────────┐    │
│ │ 📄 Quote_Kitchen.pdf (245 KB)                │    │
│ │    Uploaded Nov 18, 2025                     │    │
│ │    [Download] [Delete]                        │    │
│ │                                               │    │
│ │ 📷 Before_Photo.jpg (1.2 MB)                 │    │
│ │    Uploaded Nov 10, 2025                     │    │
│ │    [Download] [Delete]                        │    │
│ └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Inline note creator (textarea + save button)
- Notes list (chronological, newest first)
- File drop zone (drag-and-drop upload)
- Files grid (with previews for images)

**Inline Editable**: Notes (click Edit → inline edit mode)

**Button Actions**:
- Save Note → `POST /api/notes` with `entityType: 'contact', entityId: contactId`
- Upload File → `POST /api/files/upload` with `entityType: 'contact', entityId: contactId`
- Download → Direct file URL download
- Delete → `DELETE /api/notes/:id` or `DELETE /api/files/:id`

**Data Source**:
- `GET /api/notes?entityType=contact&entityId={contactId}`
- `GET /api/files?entityType=contact&entityId={contactId}`

##### Tab 5: Appointments
```
┌──────────────────────────────────────────────────────┐
│ Appointments                         [+ New Appointment]│
│ ──────────────────────────────────────────────────── │
│                                                       │
│ [Upcoming | Past]                                    │
│                                                       │
│ ┌─ Upcoming ───────────────────────────────────┐    │
│ │ 📅 Dec 5, 2025 at 2:00 PM                    │    │
│ │    Kitchen Consultation                       │    │
│ │    [Reschedule] [Cancel]                      │    │
│ │                                               │    │
│ │ 📅 Dec 12, 2025 at 10:00 AM                  │    │
│ │    Final Walkthrough                          │    │
│ │    [Reschedule] [Cancel]                      │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Past ───────────────────────────────────────┐    │
│ │ ✅ Nov 20, 2025 at 3:00 PM                   │    │
│ │    Initial Consultation                       │    │
│ └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Appointments list (filtered by contactId)
- Upcoming/Past toggle
- New Appointment button (opens CreateAppointmentDialog)

**Button Actions**:
- Reschedule → Opens edit modal with date/time picker
- Cancel → `DELETE /api/appointments/:id` with confirmation

**Data Source**: `GET /api/appointments?contactId={contactId}`

##### Tab 6: Communication
```
┌──────────────────────────────────────────────────────┐
│ Communication Timeline                                │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ [All | SMS | Email | Calls]                          │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 📧 Nov 21, 2025 at 3:45 PM                  │     │
│ │    Email: Invoice #INV-003 Sent             │     │
│ │    Subject: "Your invoice is ready"         │     │
│ │    Status: Delivered ✓                      │     │
│ │    [View Full Email]                         │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 💬 Nov 20, 2025 at 11:20 AM                 │     │
│ │    SMS: "Appointment reminder for tomorrow" │     │
│ │    Status: Delivered ✓                      │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 📞 Nov 18, 2025 at 2:00 PM                  │     │
│ │    Call: Outbound (5 min 23 sec)            │     │
│ │    Notes: "Discussed project timeline"      │     │
│ └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Communication timeline (all SMS, emails, calls)
- Filter by type dropdown
- Chronological display (newest first)
- Status indicators (sent/delivered/failed)

**Data Source**: `GET /api/contacts/:id/communication-timeline`

**This endpoint must aggregate**:
- SMS messages from N8N events
- Emails from N8N events
- Call logs from N8N events
- Manual communications logged in CRM

##### Tab 7: Activity
```
┌──────────────────────────────────────────────────────┐
│ Activity Log                                          │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 System - 2 hours ago                     │     │
│ │    Created payment link for $1,200          │     │
│ │    ID: test-con-...                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 System - 3 hours ago                     │     │
│ │    SMS status update on communication       │     │
│ │    ID: test-con-...                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 Admin User - 1 day ago                   │     │
│ │    Updated contact status                   │     │
│ │    ID: test-con-...                          │     │
│ └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Audit log timeline (filtered by entityId = contactId)
- User avatars
- Action descriptions
- Timestamps (relative)

**Data Source**: `GET /api/audit-log?entityId={contactId}`

---

### Contact Detail Page - Summary

**Total Tabs**: 7 (Overview, Jobs, Financial, Notes & Files, Appointments, Communication, Activity)

**Key Principles**:
- **Everything accessible without leaving page**
- **Notes and files embedded (no separate navigation)**
- **AI recommendations prominently displayed**
- **Quick actions for common workflows**
- **Communication history centralized**

**User Flow Example**:
1. User clicks contact from Contacts list
2. Lands on Overview tab → sees AI suggestions
3. Clicks "Create Job" → modal opens with contact pre-filled
4. Switches to Notes & Files → adds note inline, uploads contract
5. Switches to Communication → sees all past emails/SMS
6. Completes entire workflow without leaving Contact Detail page

---

## JOB DETAIL PAGE - FINAL SPECIFICATION

### Layout Structure (Top to Bottom)

#### 1. Header Section
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back]                                                     │
│                                                              │
│  [Job Title]                            [Status Badge]      │
│  [Job Description]                      [Priority Badge]    │
│                                                              │
│  👤 John Smith (ABC Company)   |   💵 $15,000   |   📅 Dec 1│
│                                                              │
│  Status: [Dropdown ▼]   Assign: [Team Dropdown ▼]  ✏️ Edit │
│                                                              │
│  Progress: ████████░░ 80% (4/5 tasks complete)             │
└─────────────────────────────────────────────────────────────┘
```

**Components**:
- Job title (h1)
- Job description (p, truncated if long)
- Status badge (visual pill)
- Priority badge (Low/Medium/High/Urgent with color)
- Client info (avatar, name, company - clickable → Contact Detail)
- Job value (dollar amount)
- Scheduled date
- Status dropdown (inline change)
- Team assignment dropdown (inline change)
- Edit button (opens EditJobDialog)
- Progress bar (based on task checklist completion)

**Inline Editable**:
- Status (dropdown)
- Team assignment (dropdown)

**Button Actions**:
- Client name click → Navigate to Contact Detail
- Status change → `PATCH /api/jobs/:id` with new status
- Team assignment → `PATCH /api/jobs/:id/assign` with userId
- Edit → Opens `EditJobDialog` with current data

---

#### 2. Tabs Section

**Tab List**: Overview | Estimates | Invoices | Time & Materials | Notes & Files | Appointments | Activity

##### Tab 1: Overview (Default)
```
┌─────────────────────┬────────────────────────────────┐
│                     │                                │
│ Task Checklist      │   AI Recommendations           │
│ ─────────────────── │   ──────────────────────────   │
│ ☑ Site inspection   │   ⚡ Suggested Next Actions:   │
│ ☑ Materials ordered │   • Create final invoice       │
│ ☑ Work completed    │   • Schedule follow-up         │
│ ☐ Customer approval │   • Request review             │
│ ☐ Final invoice sent│                                │
│                     │   [View All in AI Hub →]       │
│ [+ Add Task]        │                                │
└─────────────────────┴────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Job Timeline                                         │
│ ──────────────────────────────────────────────────── │
│ ✅ Nov 20 - Job started (Status: In Progress)        │
│ ✅ Nov 21 - Materials delivered                      │
│ ✅ Nov 22 - Work 80% complete                        │
│ 🔜 Dec 1 - Scheduled completion                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Quick Actions                                        │
│ ─────────────────────────────────────────────────    │
│ [+ Create Estimate] [+ Create Invoice] [📅 Schedule] │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Task checklist (interactive checkboxes)
- AI Recommendations widget (shows top 3 suggested actions)
- Job timeline (status changes, milestones)
- Quick actions panel (prominent buttons)

**Inline Editable**: Task checklist (check/uncheck, add new task)

**Button Actions**:
- Check/uncheck task → `PATCH /api/jobs/:id/tasks/:taskId` with completed status
- Add Task → Inline input appears, `POST /api/jobs/:id/tasks` on save
- Create Estimate → Opens CreateEstimateDialog with job pre-filled
- Create Invoice → Opens CreateInvoiceDialog with job pre-filled
- Schedule → Opens CreateAppointmentDialog with job context

**Data Source**:
- `GET /api/jobs/:id/tasks` (checklist)
- `GET /api/ai/recommendations/job/:id` (AI suggestions)
- `GET /api/jobs/:id/timeline` (status changes, events)

##### Tab 2: Estimates
```
┌──────────────────────────────────────────────────────┐
│ Estimates for this Job               [+ New Estimate]│
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ EST-001                          [Approved]  │    │
│ │ $15,000 | Sent: Nov 10, 2025                 │    │
│ │ Kitchen Remodel - Full scope                 │    │
│ │ [View] [Download PDF] [Duplicate]            │    │
│ └──────────────────────────────────────────────┘    │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ EST-002                          [Draft]     │    │
│ │ $18,500 | Created: Nov 5, 2025               │    │
│ │ Alternative scope with upgrades              │    │
│ │ [View] [Edit] [Send]                         │    │
│ └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Estimates list (filtered by jobId)
- Estimate cards (with status badges)
- New Estimate button

**Button Actions**:
- View → Navigate to Estimate Detail page
- Download PDF → `POST /api/estimates/:id/generate-pdf` → download
- Duplicate → Creates copy with new ID
- Edit → Opens edit modal/page
- Send → Sends estimate to customer via email

**Data Source**: `GET /api/estimates?jobId={jobId}`

##### Tab 3: Invoices
```
┌──────────────────────────────────────────────────────┐
│ Invoices for this Job                [+ New Invoice] │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ INV-001                          [Paid] ✅   │    │
│ │ $15,000 | Due: Nov 30, 2025                  │    │
│ │ Payment received: Nov 28, 2025               │    │
│ │ [View] [Download PDF]                        │    │
│ └──────────────────────────────────────────────┘    │
│                                                       │
│ ┌──────────────────────────────────────────────┐    │
│ │ INV-002                          [Sent]      │    │
│ │ $1,200 | Due: Dec 5, 2025                    │    │
│ │ Balance: $1,200                              │    │
│ │ [View] [Record Payment] [Send Reminder]      │    │
│ └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Invoices list (filtered by jobId)
- Invoice cards (with payment status)
- Payment status badges
- Quick payment actions

**Button Actions**:
- View → Navigate to Invoice Detail page
- Download PDF → `POST /api/invoices/:id/generate-pdf` → download
- Record Payment → Opens payment recording modal → `POST /api/invoices/:id/record-payment`
- Send Reminder → Triggers automated reminder email

**Data Source**: `GET /api/invoices?jobId={jobId}`

##### Tab 4: Time & Materials (NEW)
```
┌──────────────────────────────────────────────────────┐
│ Time & Materials Tracking                            │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌─ Labor Hours ────────────────────────────────┐    │
│ │ [+ Log Hours]                                 │    │
│ │                                               │    │
│ │ Nov 20 | John Doe | 8 hrs | Installation     │    │
│ │ Nov 21 | Jane Smith | 6 hrs | Finishing      │    │
│ │                                               │    │
│ │ Total Labor: 14 hours @ $75/hr = $1,050      │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Materials & Parts ──────────────────────────┐    │
│ │ [+ Add Material]                              │    │
│ │                                               │    │
│ │ Cabinet Set | Qty: 1 | $5,000                │    │
│ │ Hardware Kit | Qty: 2 | $150                 │    │
│ │ Paint | Qty: 5 gal | $200                    │    │
│ │                                               │    │
│ │ Total Materials: $5,350                      │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Expenses ───────────────────────────────────┐    │
│ │ [+ Add Expense]                               │    │
│ │                                               │    │
│ │ Delivery Fee | $75                           │    │
│ │ Permit | $200                                │    │
│ │                                               │    │
│ │ Total Expenses: $275                         │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Profitability ──────────────────────────────┐    │
│ │ Revenue: $15,000                             │    │
│ │ Costs: $6,675 (Labor + Materials + Expenses) │    │
│ │ Profit: $8,325 (55.5% margin)                │    │
│ └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Labor hours tracker (team member, hours, hourly rate)
- Materials/parts list (item, quantity, cost)
- Expenses tracker (miscellaneous costs)
- Profitability calculator (auto-calculated)

**Inline Editable**: All items (click to edit inline)

**Button Actions**:
- Log Hours → Opens time entry modal → `POST /api/jobs/:id/time-materials`
- Add Material → Opens material entry modal → `POST /api/jobs/:id/time-materials`
- Add Expense → Opens expense entry modal → `POST /api/jobs/:id/time-materials`
- Edit/Delete → Inline actions on each row

**Data Source**: `GET /api/jobs/:id/time-materials`

**Calculations**:
- Total Labor = Sum of (hours × hourly rate)
- Total Materials = Sum of material costs
- Total Expenses = Sum of expenses
- Total Cost = Labor + Materials + Expenses
- Profit = Revenue - Total Cost
- Margin = (Profit / Revenue) × 100

##### Tab 5: Notes & Files (MERGED)
```
┌──────────────────────────────────────────────────────┐
│ Notes & Files                                         │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌─ Add Note ───────────────────────────────────┐    │
│ │ [Text area for quick note entry]              │    │
│ │ [Save Note]                                   │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Notes ──────────────────────────────────────┐    │
│ │ 📝 Nov 21, 2025 - Work progress update       │    │
│ │    "Team completed framing today..."         │    │
│ │    [Edit] [Delete]                            │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Upload Files ───────────────────────────────┐    │
│ │ [Drag and drop files here or click to browse]│    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Before & After Photos ──────────────────────┐    │
│ │ Before:                  After:               │    │
│ │ ┌─────────┐             ┌─────────┐          │    │
│ │ │  [IMG]  │             │  [IMG]  │          │    │
│ │ └─────────┘             └─────────┘          │    │
│ │ [+ Upload Before]       [+ Upload After]     │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Documents ──────────────────────────────────┐    │
│ │ 📄 Contract_Signed.pdf (342 KB)              │    │
│ │    Uploaded Nov 15, 2025                     │    │
│ │    [Download] [Delete]                        │    │
│ └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Inline note creator (textarea + save button)
- Notes list (chronological)
- File drop zone (drag-and-drop upload)
- Before/After photo gallery (side-by-side comparison)
- Documents list (non-photo files)

**Special Features**:
- Photos tagged as "before" or "after" show in gallery
- Regular documents show in list below

**Inline Editable**: Notes (click Edit → inline edit mode)

**Button Actions**:
- Save Note → `POST /api/notes` with `entityType: 'job', entityId: jobId`
- Upload File → `POST /api/files/upload` with `entityType: 'job', entityId: jobId, tags: ['before'/'after']`
- Download → Direct file URL download
- Delete → `DELETE /api/notes/:id` or `DELETE /api/files/:id`

**Data Source**:
- `GET /api/notes?entityType=job&entityId={jobId}`
- `GET /api/files?entityType=job&entityId={jobId}`

##### Tab 6: Appointments
```
┌──────────────────────────────────────────────────────┐
│ Related Appointments             [+ New Appointment] │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ [Upcoming | Completed]                               │
│                                                       │
│ ┌─ Upcoming ───────────────────────────────────┐    │
│ │ 📅 Dec 1, 2025 at 9:00 AM                    │    │
│ │    Final Walkthrough & Approval               │    │
│ │    Assigned: John Doe                         │    │
│ │    [Reschedule] [Complete] [Cancel]           │    │
│ └───────────────────────────────────────────────┘    │
│                                                       │
│ ┌─ Completed ──────────────────────────────────┐    │
│ │ ✅ Nov 20, 2025 at 8:00 AM                   │    │
│ │    Initial Site Visit                         │    │
│ │    Completed by: Jane Smith                   │    │
│ └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Appointments list (related to this job)
- Upcoming/Completed toggle
- Team member assignment visible

**Button Actions**:
- Reschedule → Opens edit modal with date/time picker
- Complete → Marks appointment as completed, prompts for notes
- Cancel → `DELETE /api/appointments/:id` with confirmation

**Data Source**: `GET /api/appointments?jobId={jobId}`

##### Tab 7: Activity
```
┌──────────────────────────────────────────────────────┐
│ Activity Log                                          │
│ ──────────────────────────────────────────────────── │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 John Doe - 1 hour ago                    │     │
│ │    Logged 8 hours of labor                  │     │
│ │    ID: test-job-...                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 System - 2 hours ago                     │     │
│ │    Status changed to In Progress            │     │
│ │    ID: test-job-...                          │     │
│ └─────────────────────────────────────────────┘     │
│                                                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ 👤 Admin User - 1 day ago                   │     │
│ │    Created job from estimate                │     │
│ │    ID: test-job-...                          │     │
│ └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Components**:
- Audit log timeline (filtered by entityId = jobId)
- User avatars
- Action descriptions
- Timestamps (relative)

**Data Source**: `GET /api/audit-log?entityId={jobId}`

---

### Job Detail Page - Summary

**Total Tabs**: 7 (Overview, Estimates, Invoices, Time & Materials, Notes & Files, Appointments, Activity)

**Key Principles**:
- **Status and team assignment editable inline in header**
- **Task checklist front and center (field service focus)**
- **Time & materials tracking for profitability**
- **Before/after photos for quality documentation**
- **All related entities accessible without leaving page**

**User Flow Example (Field Technician)**:
1. Technician opens job from mobile device
2. Sees task checklist → checks off "Work completed"
3. Switches to Time & Materials → logs 8 hours of work
4. Switches to Notes & Files → uploads "after" photos
5. Marks job as "Pending Customer Approval" via status dropdown
6. Completes entire workflow without leaving Job Detail page

**User Flow Example (Manager)**:
1. Manager reviews job
2. Sees progress bar at 80% complete
3. Switches to Time & Materials → verifies costs ($6,675) vs revenue ($15,000)
4. Sees 55% profit margin → approves
5. Switches to Invoices → clicks "Record Payment"
6. Marks job as "Completed"

---

## MASTER ARCHITECT HUB - AI CONTROL CENTER SPECIFICATION

### Location in UI
**Primary Access**: Settings → AI Control → Master Architect Hub  
**Secondary Access**: Dashboard → AI Recommendations Widget → "View All in AI Hub" link  
**Visibility**: Admin-only (role-based access control)

### Purpose
The Master Architect Hub is the central command center for all AI-driven and automation-driven actions in Smart Klix CRM. It provides administrators with:
- **Unified task queue** from all AI sources (Master Architect agent, N8N events, Intelligence Bot)
- **Approval workflow** for AI-suggested actions
- **Audit trail** for AI decisions
- **Configuration panel** for AI behavior

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Master Architect Hub                                         │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ [Filters: All | AI Assist | Automation | N8N Events]        │
│ [Status: All | Pending | Approved | Rejected | Executed]    │
│ [Search tasks...]                              [Bulk Actions ▼]│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Pending Tasks (3)                            [Bulk Approve] │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ ☐ ┌────────────────────────────────────────────────────┐   │
│   │ 🤖 AI Assist - 5 minutes ago           [Pending]   │   │
│   │ Original Request: "Follow up with John Smith"      │   │
│   │ Context: Contact #C-001 (John Smith)               │   │
│   │                                                     │   │
│   │ Proposed Action:                                   │   │
│   │ • Send SMS: "Hi John, following up on estimate..." │   │
│   │ • Schedule reminder for 3 days                     │   │
│   │                                                     │   │
│   │ AI Confidence: 94%                                 │   │
│   │                                                     │   │
│   │ [Approve] [Reject] [Edit & Approve] [Details ▼]   │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
│ ☐ ┌────────────────────────────────────────────────────┐   │
│   │ ⚡ N8N Event - 12 minutes ago          [Pending]   │   │
│   │ Event Type: voice_call_completed                   │   │
│   │ Context: Job #J-042 (Kitchen Remodel)              │   │
│   │                                                     │   │
│   │ Proposed Action:                                   │   │
│   │ • Update job status to "In Progress"               │   │
│   │ • Create note: "Customer confirmed start date"     │   │
│   │                                                     │   │
│   │ Automation Rule: Auto-execute if confidence > 90%  │   │
│   │                                                     │   │
│   │ [Approve] [Reject] [View Call Details]            │   │
│   └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Completed Tasks (12)                                         │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ ✅ ┌───────────────────────────────────────────────────┐   │
│    │ 🤖 AI Assist - 2 hours ago          [Approved]    │   │
│    │ Action: Created estimate for $15,000               │   │
│    │ Quality Score: 4.5/5 (from user feedback)         │   │
│    │ [View Details]                                     │   │
│    └───────────────────────────────────────────────────┘   │
│                                                              │
│ ❌ ┌───────────────────────────────────────────────────┐   │
│    │ ⚡ N8N Event - 3 hours ago          [Rejected]    │   │
│    │ Action: Send invoice reminder (too soon)           │   │
│    │ Rejection Reason: "Invoice not due yet"            │   │
│    │ [View Details]                                     │   │
│    └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Task Card Components

Each task displays:

1. **Header**:
   - Source icon (🤖 AI Assist | ⚡ N8N Event | 💬 Intelligence Bot)
   - Timestamp (relative, e.g., "5 minutes ago")
   - Status badge (Pending | Approved | Rejected | Executed | Failed)

2. **Original Context**:
   - **For AI Assist**: Original user request or prompt
   - **For N8N Events**: Event type and trigger
   - **For Intelligence Bot**: User's chat message
   - **Related Entity**: Contact, Job, Estimate, etc. (clickable link)

3. **Proposed Action**:
   - Clear description of what will happen
   - Bullet points for multiple actions
   - Preview of any messages/emails to be sent

4. **Metadata**:
   - AI confidence score (if applicable)
   - Automation rule (if auto-execute)
   - Tool calls (technical details, collapsible)

5. **Action Buttons**:
   - **Approve**: Executes the action immediately
   - **Reject**: Marks as rejected, prompts for reason
   - **Edit & Approve**: Opens modal to modify action before executing
   - **Details**: Expands full technical details (tool calls, API responses)
   - **Schedule**: Approve but execute at specified time (future feature)

### Filtering & Search

**Filter by Type**:
- All (default)
- AI Assist (from Master Architect agent)
- Automation (from automated rules)
- N8N Events (from N8N workflows)

**Filter by Status**:
- All (default)
- Pending (awaiting approval)
- Approved (approved but not yet executed)
- Executed (successfully completed)
- Failed (execution failed)
- Rejected (manually rejected by admin)

**Search**:
- Search by contact name
- Search by job ID
- Search by action description
- Search by date range

### Bulk Actions

When tasks are selected (checkboxes):
- **Bulk Approve**: Approve all selected tasks
- **Bulk Reject**: Reject all selected tasks (prompts for reason)
- **Bulk Schedule**: Schedule all selected tasks for later execution

### User Interactions

#### Approve Flow
1. Admin clicks "Approve" on pending task
2. System executes the action (calls appropriate API)
3. Task moves to "Executed" status
4. **AI Reflection created**: Quality score = 5 (approved)
5. Audit log entry created

#### Reject Flow
1. Admin clicks "Reject" on pending task
2. Modal prompts: "Why are you rejecting this action?"
3. Admin enters reason (e.g., "Wrong contact", "Too soon", "Incorrect estimate")
4. **AI Reflection created**: Quality score = 1 (rejected), notes = rejection reason
5. Audit log entry created
6. **AI learns**: Next time, similar actions are less likely to be suggested

#### Edit & Approve Flow
1. Admin clicks "Edit & Approve"
2. Modal opens with editable fields (e.g., message text, amount, date)
3. Admin modifies as needed
4. Admin clicks "Approve Modified Action"
5. System executes the modified action
6. **AI Reflection created**: Quality score = 3 (approved with changes), notes = what was changed
7. **AI learns**: Adjusts future suggestions based on changes

### AI Reflection & Learning

Every action (approval, rejection, execution) creates an entry in the `aiReflection` table:

```typescript
{
  taskId: "assist-queue-123",
  outcome: "approved" | "rejected" | "modified",
  qualityScore: 1-5,
  userFeedback: "Optional notes from admin",
  context: { contactId, jobId, etc. },
  createdAt: timestamp
}
```

This data feeds back into the AI system:
- **Approved actions** → AI learns these patterns are good
- **Rejected actions** → AI learns to avoid these patterns
- **Modified actions** → AI learns to adjust (e.g., different tone, different timing)

Over time, the Master Architect agent becomes more accurate and requires less human oversight.

### Configuration Panel (Sub-section)

Located at Settings → AI Control → AI Configuration:

```
┌─────────────────────────────────────────────────────────────┐
│ AI Configuration                                             │
│ ──────────────────────────────────────────────────────────── │
│                                                              │
│ Master Architect Mode:                                       │
│ ○ Draft (suggest only, never execute)                       │
│ ● Assist (queue for approval)                  [Current]    │
│ ○ Auto (execute if confidence > threshold)                  │
│                                                              │
│ Auto-Execution Threshold: [90%] (only for Auto mode)        │
│                                                              │
│ Allowed Tools:                                               │
│ ☑ create_contact                                            │
│ ☑ send_sms                                                  │
│ ☑ send_email                                                │
│ ☑ create_job                                                │
│ ☐ delete_contact (disabled for safety)                     │
│                                                              │
│ [Save Configuration]                                         │
└─────────────────────────────────────────────────────────────┘
```

**Mode Explanations**:
- **Draft**: AI only suggests actions, displays in Intelligence Bot chat. Nothing is queued or executed.
- **Assist** (Recommended): AI queues actions in Master Architect Hub for admin approval.
- **Auto**: AI auto-executes actions if confidence score exceeds threshold (e.g., 90%). Logs everything in Hub.

### API Endpoints for Master Architect Hub

All endpoints already exist or are straightforward to implement:

**Get Tasks**:
```
GET /api/master-architect/tasks
Query params:
  - type: 'all' | 'ai_assist' | 'automation' | 'n8n_event'
  - status: 'all' | 'pending' | 'approved' | 'executed' | 'failed' | 'rejected'
  - search: string
  - page: number
  - limit: number

Returns:
{
  tasks: [
    {
      id: "assist-queue-123",
      type: "ai_assist",
      status: "pending",
      originalRequest: "Follow up with John Smith",
      context: { entityType: "contact", entityId: "C-001", contactName: "John Smith" },
      proposedAction: {
        description: "Send SMS and schedule reminder",
        toolCalls: [...],
      },
      confidence: 0.94,
      createdAt: "2025-11-21T10:30:00Z"
    },
    ...
  ],
  totalCount: 15,
  page: 1,
  limit: 10
}
```

**Approve Task**:
```
POST /api/master-architect/tasks/:id/approve
Body: { }

Returns:
{
  success: true,
  executionResult: { ... },
  reflectionId: "refl-456"
}
```

**Reject Task**:
```
POST /api/master-architect/tasks/:id/reject
Body: {
  reason: "Wrong contact"
}

Returns:
{
  success: true,
  reflectionId: "refl-789"
}
```

**Edit & Approve Task**:
```
POST /api/master-architect/tasks/:id/edit-approve
Body: {
  modifiedAction: {
    message: "Updated message text",
    // other modified fields
  }
}

Returns:
{
  success: true,
  executionResult: { ... },
  reflectionId: "refl-101"
}
```

**Bulk Approve**:
```
POST /api/master-architect/bulk-approve
Body: {
  taskIds: ["assist-queue-123", "assist-queue-124", ...]
}

Returns:
{
  success: true,
  results: [
    { taskId: "assist-queue-123", executed: true },
    { taskId: "assist-queue-124", executed: false, error: "..." }
  ]
}
```

### Integration with Other Parts of the System

**From Intelligence Bot**:
- When user chats with AI Assistant and AI suggests an action
- If mode = "Assist", action is queued in Master Architect Hub
- User sees: "I've queued this action for approval in the AI Control Center"

**From N8N Workflows**:
- When N8N sends event to `/api/events/update`
- System determines if human approval needed
- If yes, creates task in Master Architect Hub
- Admin approves/rejects in Hub

**From Automated Rules** (future):
- System detects condition (e.g., "invoice overdue by 7 days")
- Creates task: "Send payment reminder to [Contact]"
- Admin reviews and approves in Hub

---

## API & INTEGRATION STRATEGY

### Philosophy: API-First Architecture

Smart Klix CRM is built **API-first**. This means:
1. **Every UI feature** is powered by a clean REST API
2. **External tools** (N8N, Zapier, custom integrations) use the same APIs as the UI
3. **Consistent data model** across UI, API, and integrations
4. **No vendor lock-in** - customers can build custom integrations easily

### API Standards

All APIs follow these conventions:

**Protocol**: JSON over HTTPS

**Base URL**: `https://[customer-domain].smartklix.app/api`

**Authentication**: Session-based (cookies) for UI, API keys for external integrations

**HTTP Verbs**:
- `GET` - Retrieve resources (read-only, no side effects)
- `POST` - Create new resources
- `PATCH` - Update existing resources (partial update)
- `DELETE` - Remove resources

**Resource Naming**:
- Plural nouns: `/api/contacts`, `/api/jobs`, `/api/estimates`
- Nested resources: `/api/contacts/:id/jobs`, `/api/jobs/:id/tasks`
- Actions as verbs: `/api/invoices/:id/send`, `/api/estimates/:id/generate-pdf`

**Response Format**:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or on error:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "fields": {
      "email": "This field is required"
    }
  }
}
```

**Status Codes**:
- `200 OK` - Success (GET, PATCH, DELETE)
- `201 Created` - Resource created (POST)
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized (wrong role)
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error

### Core Resource Endpoints

These endpoints MUST exist and be stable:

#### Contacts
```
GET    /api/contacts                    - List all contacts (with filters)
POST   /api/contacts                    - Create new contact
GET    /api/contacts/:id                - Get single contact
PATCH  /api/contacts/:id                - Update contact
DELETE /api/contacts/:id                - Delete contact
GET    /api/contacts/:id/jobs           - Get jobs for contact
GET    /api/contacts/:id/financial-summary - Get financial summary
GET    /api/contacts/:id/communication-timeline - Get all communications
POST   /api/contacts/bulk-update        - Bulk update contacts
POST   /api/contacts/bulk-sms           - Send bulk SMS
POST   /api/contacts/bulk-email         - Send bulk email
```

#### Jobs
```
GET    /api/jobs                        - List all jobs (with filters)
POST   /api/jobs                        - Create new job
GET    /api/jobs/:id                    - Get single job
PATCH  /api/jobs/:id                    - Update job (status, assignment, etc.)
DELETE /api/jobs/:id                    - Delete job
GET    /api/jobs/:id/tasks              - Get task checklist
POST   /api/jobs/:id/tasks              - Add task to checklist
PATCH  /api/jobs/:id/tasks/:taskId      - Update task (check/uncheck)
DELETE /api/jobs/:id/tasks/:taskId      - Delete task
GET    /api/jobs/:id/time-materials     - Get time & materials entries
POST   /api/jobs/:id/time-materials     - Log time/materials/expenses
GET    /api/jobs/:id/timeline           - Get job timeline (status changes)
POST   /api/jobs/bulk-update            - Bulk update jobs
DELETE /api/jobs/bulk-delete            - Bulk delete jobs
```

#### Estimates
```
GET    /api/estimates                   - List all estimates
POST   /api/estimates                   - Create new estimate
GET    /api/estimates/:id               - Get single estimate
PATCH  /api/estimates/:id               - Update estimate
DELETE /api/estimates/:id               - Delete estimate
POST   /api/estimates/:id/generate-pdf  - Generate PDF
POST   /api/estimates/:id/send          - Send to customer via email
POST   /api/estimates/:id/duplicate     - Create copy
```

#### Invoices
```
GET    /api/invoices                    - List all invoices
POST   /api/invoices                    - Create new invoice
GET    /api/invoices/:id                - Get single invoice
PATCH  /api/invoices/:id                - Update invoice
DELETE /api/invoices/:id                - Delete invoice
POST   /api/invoices/:id/generate-pdf   - Generate PDF
POST   /api/invoices/:id/send           - Send to customer
POST   /api/invoices/:id/record-payment - Record payment received
POST   /api/invoices/:id/send-reminder  - Send payment reminder
```

#### Payments
```
GET    /api/payments                    - List all payments
POST   /api/payments                    - Record new payment
GET    /api/payments/:id                - Get single payment
PATCH  /api/payments/:id                - Update payment
DELETE /api/payments/:id                - Delete payment
```

#### Appointments
```
GET    /api/appointments                - List all appointments (with filters)
POST   /api/appointments                - Create new appointment
GET    /api/appointments/:id            - Get single appointment
PATCH  /api/appointments/:id            - Update appointment
PATCH  /api/appointments/:id/reschedule - Reschedule appointment
DELETE /api/appointments/:id            - Cancel appointment
GET    /api/calendar/team-view          - Get team calendar data
POST   /api/calendar/ai-suggest-time    - Get AI-suggested time slots
```

#### Notes
```
GET    /api/notes                       - List all notes (filter by entityType, entityId)
POST   /api/notes                       - Create new note
GET    /api/notes/:id                   - Get single note
PATCH  /api/notes/:id                   - Update note
DELETE /api/notes/:id                   - Delete note
```

#### Files
```
GET    /api/files                       - List all files (filter by entityType, entityId)
POST   /api/files/upload                - Upload new file (multipart/form-data)
GET    /api/files/:id                   - Get file metadata
DELETE /api/files/:id                   - Delete file
GET    /api/files/:id/download          - Download file content
```

#### AI & Automation
```
GET    /api/ai/recommendations          - Get AI recommendations for dashboard
GET    /api/ai/recommendations/:entityType/:entityId - Get recommendations for specific entity
POST   /api/ai/chat                     - Send message to Intelligence Bot
GET    /api/ai/chat/:sessionId/history  - Get chat history
GET    /api/master-architect/tasks      - Get tasks in Master Architect Hub (with filters)
POST   /api/master-architect/tasks/:id/approve - Approve task
POST   /api/master-architect/tasks/:id/reject  - Reject task
POST   /api/master-architect/tasks/:id/edit-approve - Edit and approve task
POST   /api/master-architect/bulk-approve - Bulk approve tasks
```

#### N8N Integration
```
POST   /api/events/update               - Receive N8N event (callback endpoint)
POST   /api/n8n/trigger/:event          - Trigger N8N workflow from CRM
GET    /api/integrations/status         - Get integration health status (N8N, OpenAI, DB)
```

#### Settings & Configuration
```
GET    /api/settings/company            - Get company profile
PATCH  /api/settings/company            - Update company profile
GET    /api/settings/branding           - Get branding settings
PATCH  /api/settings/branding           - Update branding settings
GET    /api/templates/email             - List email templates
POST   /api/templates/email             - Create email template
GET    /api/templates/sms               - List SMS templates
POST   /api/templates/sms               - Create SMS template
```

#### Users & Audit
```
GET    /api/users                       - List all users
POST   /api/users                       - Create new user (invite)
GET    /api/users/:id                   - Get single user
PATCH  /api/users/:id                   - Update user
DELETE /api/users/:id                   - Delete user
GET    /api/audit-log                   - Get audit log (filter by entityId, userId, action)
```

### Field Naming Conventions

**Consistent across UI, API, and N8N**:
- `id` - Primary key (always string)
- `createdAt` - Timestamp when created (ISO 8601)
- `updatedAt` - Timestamp when last updated (ISO 8601)
- `status` - Current status (enum string)
- `clientId` - Foreign key to contact (not "customerId" or "contactId")
- `userId` - Foreign key to user
- `jobId` - Foreign key to job

**Date/Time Format**: ISO 8601 (e.g., `"2025-11-21T10:30:00Z"`)

**Money Format**: String with decimal (e.g., `"15000.00"`) to avoid floating-point errors

**Phone Format**: E.164 (e.g., `"+15551234567"`)

### API Usage by Different Consumers

**1. Smart Klix Web UI**:
- Uses session-based authentication (cookies)
- Calls APIs via `apiRequest` helper from `@lib/queryClient`
- TanStack Query manages caching and invalidation
- All user interactions trigger API calls

**2. N8N Workflows**:
- Uses webhook authentication (shared secret or API key)
- **CRM → N8N**: POST to N8N webhook URLs (`/api/n8n/trigger/:event`)
- **N8N → CRM**: POST to CRM callback (`/api/events/update`)
- N8N stores contact/job data, then updates CRM via API

**3. Future External Integrations** (Zapier, custom apps):
- Uses API key authentication
- Same endpoints as web UI
- JSON request/response
- Webhooks for real-time events (future feature)

### Integration Testing Requirements

Every API endpoint must have:
1. **Unit test** (backend logic)
2. **Integration test** (full request/response cycle)
3. **N8N test** (if endpoint is used by N8N)

Example test cases:
- Create contact via API → verify contact exists in database
- Update job status via API → verify audit log entry created
- N8N sends voice call event → verify job status updated, reflection created

---

## IMPLEMENTATION ORDER & RISK MANAGEMENT

### Phase 1: Navigation Cleanup (LOWEST RISK)

**Dependencies**: None (can start immediately)

**What Could Break**:
- Broken routes if not updated correctly in `App.tsx`
- Users looking for removed tabs (Files, Notes) will be confused
- Admins looking for User Management in main nav

**Mitigation**:
- Test all routes after removal
- Add redirect from old routes to new locations (e.g., `/files` → `/contacts` with toast message)
- Update admin user guide/documentation

**Testing Checklist**:
- [ ] All routes resolve (no 404s)
- [ ] Sidebar renders with correct 9 items
- [ ] Settings page accessible and organized
- [ ] Admin features visible to admins, hidden from regular users
- [ ] No console errors

**Data Migration**: None (only UI changes)

---

### Phase 2: Detail Page Enhancement (MEDIUM RISK)

**Dependencies**:
- Phase 1 must be complete (Notes/Files tabs removed)
- Backend APIs must exist for inline note creation, file upload, etc.

**What Could Break**:
- File uploads fail if backend API not implemented correctly
- Notes don't save if entity type/ID not passed correctly
- Performance issues if loading too much data at once
- Existing notes/files not visible (wrong query filter)

**Mitigation**:
- Implement backend APIs FIRST, test with Postman/curl
- Add loading states to avoid blank screens
- Paginate notes/files lists if count > 50
- Verify query filters match database schema

**Testing Checklist**:
- [ ] Inline note creation works
- [ ] Inline note editing works
- [ ] File drag-and-drop upload works
- [ ] File download works
- [ ] Communication timeline loads correctly
- [ ] Financial summary calculates correctly
- [ ] Task checklist saves state
- [ ] Time & materials tracking persists
- [ ] Before/after photos display side-by-side
- [ ] All data is scoped correctly (only shows data for current contact/job)

**Data Migration**:
- No schema changes required
- Existing notes/files already have `entityType` and `entityId` fields
- If missing, run migration script to add these fields

---

### Phase 3: AI & Automation Visibility (MEDIUM RISK)

**Dependencies**:
- Master Architect Hub already exists (implemented in previous sprint)
- N8N integration endpoints exist
- AI recommendation logic exists

**What Could Break**:
- Dashboard widgets crash if API returns unexpected data
- N8N status panel shows "disconnected" if health check fails
- Master Architect Hub doesn't load tasks correctly
- Bulk actions fail silently

**Mitigation**:
- Add error boundaries around widgets
- Implement graceful fallback if API fails (show "Unable to load")
- Test N8N health check endpoint independently
- Add confirmation dialogs for bulk actions
- Log all bulk action results for debugging

**Testing Checklist**:
- [ ] Dashboard AI recommendations widget loads
- [ ] Clicking "View All" navigates to Master Architect Hub
- [ ] N8N status panel shows correct connection state
- [ ] Master Architect Hub filters work
- [ ] Task approval executes action and creates reflection
- [ ] Task rejection creates reflection with reason
- [ ] Bulk approve works for multiple tasks
- [ ] AI Assistant renamed everywhere

**Data Migration**: None

---

### Phase 4: Workflow Improvements (MEDIUM RISK)

**Dependencies**:
- Phase 2 complete (detail pages working)
- Kanban view library installed (e.g., `@dnd-kit/core`)

**What Could Break**:
- Kanban drag-and-drop updates wrong job status
- Bulk actions execute on wrong records
- Filters break existing queries
- Calendar drag-and-drop reschedules to wrong time (timezone issues)

**Mitigation**:
- Test Kanban status updates with console logging
- Add confirmation for bulk delete ("Are you sure you want to delete X jobs?")
- Test filters in isolation before combining
- Use UTC for all date/time storage, convert to local timezone in UI

**Testing Checklist**:
- [ ] Kanban view renders job cards correctly
- [ ] Dragging job card updates status in database
- [ ] Bulk status update works
- [ ] Bulk delete prompts for confirmation
- [ ] Advanced filters work correctly
- [ ] Calendar drag-and-drop reschedules appointment
- [ ] Team calendar view shows all team members
- [ ] No timezone bugs (appointments show correct time)

**Data Migration**: None

---

### Phase 5: Polish & Templates (LOW RISK)

**Dependencies**: All previous phases complete

**What Could Break**:
- Template builder doesn't save templates
- PDF generation fails (library issue)
- Branding changes don't apply globally
- Signature capture doesn't save image correctly

**Mitigation**:
- Test PDF generation with multiple browsers
- Test branding changes in light and dark mode
- Use canvas API correctly for signature capture
- Store signature as base64 image in database

**Testing Checklist**:
- [ ] Email template builder saves templates
- [ ] SMS template builder saves templates
- [ ] Templates can be used when sending email/SMS
- [ ] PDF generation works for estimates and invoices
- [ ] Branding changes apply to all pages
- [ ] Logo upload works
- [ ] Signature capture saves correctly
- [ ] Before/after photos display in job detail

**Data Migration**:
- Create `emailTemplates` and `smsTemplates` tables if not exist
- Add `signatureUrl` field to `jobs` table

---

### Critical Success Factors

**For Every Phase**:
1. **Test locally** before committing
2. **Run linter** and fix all warnings
3. **Update documentation** (replit.md, API specs)
4. **Create audit log entries** for all data changes
5. **Test in production mode** (not just dev mode)

**Rollback Plan**:
- Each phase can be rolled back independently
- Use git tags for each phase completion
- Keep database migrations reversible
- Document any breaking changes

**User Communication**:
- Notify users before Phase 1 (navigation changes)
- Provide training for new features (detail page enhancements)
- Highlight AI features in Phase 3
- No notification needed for Phase 5 (polish)

---

## APPENDIX: QUICK REFERENCE

### Navigation Before & After

**BEFORE (17 items)**:
1. Dashboard
2. Contacts
3. Jobs
4. Estimates
5. Invoices
6. Payments
7. Calendar
8. Pipeline
9. Notes ❌
10. Master Architect
11. Intelligence Bot
12. AI Assist Queue ❌
13. AI Memory
14. Metrics ❌
15. Audit Log
16. User Management
17. Settings

**AFTER (9 items)**:
1. Dashboard
2. Contacts
3. Jobs
4. Estimates
5. Invoices
6. Calendar
7. Pipeline
8. AI Assistant
9. Settings (with sub-sections: User Management, AI Control, System, Integrations)

### Key Files to Modify

**Phase 1**:
- `client/src/App.tsx`
- `client/src/components/AppSidebar.tsx`
- `client/src/pages/Settings.tsx`
- Delete: `Files.tsx`, `Notes.tsx`, `Metrics.tsx`

**Phase 2**:
- `client/src/pages/ContactDetail.tsx`
- `client/src/pages/JobDetail.tsx`
- Create: Multiple new components (InlineNoteCreator, FileDropZone, etc.)

**Phase 3**:
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/MasterArchitectHub.tsx`
- `client/src/pages/IntelligenceBot.tsx`

**Phase 4**:
- `client/src/pages/Jobs.tsx`
- `client/src/pages/Contacts.tsx`
- `client/src/pages/Calendar.tsx`

**Phase 5**:
- `client/src/pages/Settings.tsx`
- `client/src/pages/Estimates.tsx`
- `client/src/pages/Invoices.tsx`
- `client/src/pages/JobDetail.tsx`

### Component Library to Create

New reusable components:
1. `InlineNoteCreator.tsx` - Textarea + save button for quick note creation
2. `FileDropZone.tsx` - Drag-and-drop file upload area
3. `CommunicationTimeline.tsx` - Chronological display of SMS/emails/calls
4. `QuickActionsPanel.tsx` - Horizontal row of action buttons
5. `TaskChecklist.tsx` - Interactive checklist with progress bar
6. `TimeAndMaterialsTracker.tsx` - Form for logging hours/materials/expenses
7. `AIRecommendationsWidget.tsx` - Card showing top AI suggestions
8. `N8NStatusPanel.tsx` - Integration health indicators
9. `JobKanbanView.tsx` - Kanban board with drag-and-drop
10. `BulkActionsToolbar.tsx` - Toolbar that appears when rows selected
11. `AdvancedFilters.tsx` - Multi-select dropdown filters
12. `TeamCalendarView.tsx` - Calendar showing all team members
13. `EmailTemplateBuilder.tsx` - Rich text editor for email templates
14. `SMSTemplateBuilder.tsx` - Textarea with variable insertion
15. `BrandingControls.tsx` - Color picker and logo upload
16. `SignatureCapture.tsx` - Canvas for customer signature
17. `BeforeAfterPhotoGallery.tsx` - Side-by-side image comparison

### Database Schema Changes Required

**Phase 2**:
- Ensure `notes` table has `entityType` and `entityId` columns
- Ensure `files` table has `entityType` and `entityId` columns
- Add `jobs.tasks` JSONB column for task checklist (or separate `jobTasks` table)
- Add `jobTimeMaterials` table (or use existing structure)

**Phase 5**:
- Add `emailTemplates` table
- Add `smsTemplates` table
- Add `jobs.signatureUrl` column
- Add `settings.companyProfile` JSONB column
- Add `settings.branding` JSONB column

**No Breaking Changes**: All additions, no deletions or renames

---

## CONCLUSION

This blueprint transforms Smart Klix CRM from a functional prototype into a production-grade, Fortune 500-quality field service management system. By following this phased approach, we minimize risk, maintain stability, and deliver value incrementally.

**Expected Outcomes**:
- **Navigation**: 47% reduction in complexity (17 → 9 items)
- **Productivity**: 90% of tasks completable from detail pages (no tab-hopping)
- **AI Visibility**: Users see AI working for them on every page
- **Integration-Ready**: Clean APIs enable N8N and future integrations
- **Premium UX**: Matches or exceeds Salesforce, ServiceTitan, HubSpot

**Timeline**: 10 weeks total (5 phases × 2 weeks each)

**Success Criteria**:
- All tests pass
- No regressions in existing functionality
- User feedback positive
- System performance maintained
- API documentation complete

This blueprint is ready for development. Let's build it.
