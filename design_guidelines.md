# TopOut AI CRM Platform - Design Guidelines

## Design Approach

**Selected System:** Modern Material Design 3 principles combined with Linear's clean aesthetics and Notion's information density management.

**Justification:** Enterprise CRM platforms require clarity, efficiency, and trust. The design must support complex workflows while maintaining visual hierarchy across dense information displays. Material Design 3 provides proven patterns for data-heavy applications, while Linear's typography and spacing offer premium polish.

**Core Principles:**
- Information clarity over decoration
- Predictable interaction patterns
- Professional trustworthiness
- Efficient space utilization
- Consistent component behavior

## Typography System

**Font Stack:**
- Primary: Inter (400, 500, 600, 700) via Google Fonts CDN
- Monospace: JetBrains Mono (400, 500) for codes, IDs, technical data

**Hierarchy:**
- Page Headers: text-2xl font-semibold (32px)
- Section Headers: text-lg font-semibold (20px)
- Card Headers: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Labels/Meta: text-xs font-medium uppercase tracking-wide (12px)
- Captions: text-xs (12px)

**Application:**
- Dashboard page titles use text-2xl with mb-6
- Data table headers use text-xs uppercase with font-medium
- CRM entity names (contacts, jobs) use text-base font-semibold
- Timestamps and metadata use text-xs with reduced opacity

## Layout System

**Spacing Primitives:** Use Tailwind units: 2, 3, 4, 6, 8, 12, 16, 24

**Core Patterns:**
- Component padding: p-4 or p-6
- Section spacing: space-y-6 or space-y-8
- Card margins: gap-4 or gap-6 in grids
- Form field spacing: space-y-4
- Button groups: gap-3

**Dashboard Layout:**
- Sidebar: Fixed width 240px (w-60), full height
- Main content: max-w-7xl mx-auto with px-6 py-8
- Content cards: rounded-lg with shadow-sm
- Two-column details: grid grid-cols-2 gap-6 for key/value pairs

## Component Library

### Navigation
- **Sidebar:** Fixed left navigation with icon + text labels, active state with subtle accent background, nested items indented with pl-8
- **Top Bar:** Fixed header with tenant branding, user menu (avatar + dropdown), global search, notification bell icon

### Data Display
- **Tables:** Striped rows (even:bg-gray-50), sticky headers, sortable columns with arrow indicators, row hover states, checkbox selection column
- **Cards:** White background, border border-gray-200, rounded-lg, p-6, with header/body/footer sections clearly separated
- **Stats Tiles:** Grid of metric cards showing number (text-3xl font-bold), label (text-sm), and change indicator (text-xs with arrow)
- **Status Badges:** Rounded-full px-3 py-1 text-xs font-medium with semantic colors (success, warning, error, info)

### Forms
- **Input Fields:** Border border-gray-300, rounded-md, px-4 py-2, focus:ring-2 outline treatment, consistent height (h-10)
- **Labels:** Block mb-2 text-sm font-medium, required fields marked with asterisk
- **Field Groups:** Stack with space-y-4, related fields in grid grid-cols-2 gap-4
- **Validation:** Error text in text-sm text-red-600 with mt-1, inline field-level feedback

### Actions
- **Primary Buttons:** Solid fill, rounded-md, px-4 py-2, font-medium, text-sm
- **Secondary Buttons:** Border border-gray-300, transparent background, same padding
- **Icon Buttons:** Square (w-10 h-10), centered icon, rounded-md, border for secondary style
- **Button Groups:** Flex with gap-3, primary action rightmost

### Lists & Queues
- **AI Assist Queue:** List items with left accent bar indicating priority, checkbox for approval, expandable details, action buttons (approve/reject)
- **Activity Timeline:** Vertical timeline with connecting line, timestamp + user + action description, icons indicating event type

### Overlays
- **Modals:** Centered overlay with max-w-2xl, rounded-lg, p-6, header with close button, footer with action buttons aligned right
- **Slide-Overs:** Fixed right panel (w-96), slide-in animation, for detail views and quick actions
- **Dropdowns:** Rounded-md shadow-lg, py-1, items with px-4 py-2 hover:bg-gray-100
- **Toasts:** Fixed top-right notifications, auto-dismiss, with icon + message + close button

## Dashboard-Specific Patterns

**Page Structure:**
- Page header with title + primary action button (top-right)
- Optional filter bar below header (flex items-center gap-4)
- Main content area with cards or table
- Sidebar details panel for selected items

**Data Tables:**
- Pagination controls at bottom-right
- Items-per-page selector bottom-left
- Bulk action toolbar appears when rows selected
- Empty states with icon + message + suggested action

**Metrics Dashboard:**
- Grid of stat cards (grid-cols-4 gap-6)
- Charts use muted fills, clean axes, tooltips on hover
- Date range picker in top-right of metrics section

## Widget Design

**Embeddable Chat Widget:**
- Compact launcher button: Fixed bottom-right, circular (w-14 h-14), with chat icon
- Expanded view: Fixed bottom-right panel (w-96 h-[600px]), rounded-t-lg, shadow-2xl
- Message list: Scrollable area with user messages right-aligned, bot messages left-aligned
- Input area: Fixed bottom, border-t, with textarea + send button + file attachment icon
- File uploads: Thumbnail previews in flex row, remove button on each
- Clean, minimal chrome focusing on conversation

## Images

No hero images for this application - it's a dashboard/productivity tool, not a marketing site. Images appear only as:
- User avatars (circular, w-8 h-8 or w-10 h-10)
- Contact profile photos (larger, w-24 h-24)
- File upload thumbnails (square previews)
- Empty state illustrations (centered, grayscale, decorative)

## Accessibility & Polish

- Maintain consistent focus indicators (ring-2 ring-blue-500)
- All interactive elements meet 44px minimum touch target
- Form inputs include placeholder text and aria-labels
- Tables include proper th/scope attributes
- Loading states use skeleton screens matching content structure
- Smooth transitions: transition-colors duration-200 for interactive elements