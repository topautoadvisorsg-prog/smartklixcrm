# Frontend Architecture

## Technology Stack

- **Framework**: React 18 with TypeScript (strict mode)
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack Query (React Query v5)
- **Forms**: React Hook Form + Zod validation
- **Styling**: TailwindCSS + Shadcn UI components
- **Build Tool**: Vite

## Project Structure

```
client/
├── public/
│   └── favicon.png
├── src/
│   ├── components/
│   │   ├── ui/              # Shadcn UI components
│   │   ├── AppSidebar.tsx   # Main navigation sidebar
│   │   ├── ThemeToggle.tsx  # Dark mode toggle
│   │   ├── StatsCard.tsx    # Metric display card
│   │   ├── StatusBadge.tsx  # Status indicator
│   │   ├── EmptyState.tsx   # Empty state handler
│   │   ├── AIQueueItem.tsx  # AI action approval item
│   │   └── ActivityTimeline.tsx # Activity feed
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Contacts.tsx
│   │   ├── Jobs.tsx
│   │   ├── Calendar.tsx
│   │   ├── AIAssistQueue.tsx
│   │   ├── Files.tsx
│   │   ├── Notes.tsx
│   │   ├── Metrics.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── queryClient.ts   # React Query config
│   │   └── utils.ts         # Utility functions
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
└── index.html
```

## Design System

### Colors & Theming

Uses CSS custom properties for complete light/dark mode support:

**Light Mode**:
- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(0 0% 9%)`
- Primary: `hsl(221 83% 53%)` (Blue)
- Card: `hsl(0 0% 98%)`
- Muted: `hsl(0 0% 92%)`

**Dark Mode**:
- Background: `hsl(0 0% 9%)`
- Foreground: `hsl(0 0% 98%)`
- Primary: `hsl(221 83% 53%)` (Blue)
- Card: `hsl(0 0% 11%)`
- Muted: `hsl(0 0% 17%)`

### Typography

- **Font Family**: Inter (sans-serif), JetBrains Mono (monospace)
- **Hierarchy**:
  - Page Headers: `text-2xl font-semibold`
  - Card Headers: `text-lg font-semibold`
  - Body: `text-sm`
  - Labels: `text-xs font-medium`

### Spacing

Consistent spacing scale: `gap-3`, `gap-4`, `gap-6`, `p-4`, `p-6`, `mb-6`

### Components

All UI components use Shadcn patterns:
- Consistent API across components
- Accessible by default (ARIA attributes)
- Composable and themeable
- TypeScript typed props

## Routing

### Implementation

Using Wouter for client-side routing:

```typescript
<Switch>
  <Route path="/" component={Dashboard} />
  <Route path="/contacts" component={Contacts} />
  <Route path="/jobs" component={Jobs} />
  {/* ... more routes */}
</Switch>
```

### Navigation

Sidebar navigation with active state indication:

```typescript
const [location] = useLocation();
const isActive = location === item.url;

<Link href={item.url}>
  <SidebarMenuButton isActive={isActive}>
    <Icon />
    <span>{title}</span>
  </SidebarMenuButton>
</Link>
```

## State Management

### React Query

Used for all server state:

```typescript
// Fetching data
const { data, isLoading } = useQuery({
  queryKey: ['/api/contacts'],
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/contacts', {
    method: 'POST',
    body: data,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
  },
});
```

**Configuration** (`lib/queryClient.ts`):
- Default fetcher using `fetch` API
- Automatic retries
- Cache invalidation patterns
- Error handling

### Local State

Component-level state using `useState`:
- UI state (modals, dropdowns)
- Form inputs (via React Hook Form)
- Theme preference (localStorage sync)

## Forms

### React Hook Form + Zod

Pattern for all forms:

```typescript
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    name: '',
    email: '',
  },
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

### Validation

- Schema-first validation with Zod
- Frontend validation matches backend schemas
- Real-time error display
- Type-safe form data

## Page Patterns

### Standard Page Structure

```typescript
export default function PageName() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Page Title</h1>
          <p className="text-sm text-muted-foreground">Description</p>
        </div>
        <Button>Action</Button>
      </div>

      {/* Search/Filters */}
      <Card className="p-4">
        <Input placeholder="Search..." />
      </Card>

      {/* Content */}
      <Card>
        {/* Table or Grid */}
      </Card>
    </div>
  );
}
```

### Dashboard Pattern

- Stats cards grid
- Quick actions
- Activity timeline
- Recent items

### List/Table Pattern

- Search input
- Data table with sorting
- Row actions (dropdown menu)
- Empty states
- Pagination (future)

### Detail Pattern

- Header with back button
- Form or read-only display
- Related items
- Action buttons

## Reusable Components

### StatsCard

Displays key metrics:
```typescript
<StatsCard
  title="Total Contacts"
  value="1,234"
  change="+12% from last month"
  changeType="positive"
  icon={Users}
/>
```

### StatusBadge

Shows status with color coding:
```typescript
<StatusBadge status="in_progress" />
```

### EmptyState

Handles empty data:
```typescript
<EmptyState
  icon={Inbox}
  title="No items"
  description="Create your first item"
  actionLabel="Create"
  onAction={handleCreate}
/>
```

### ActivityTimeline

Displays chronological events:
```typescript
<ActivityTimeline events={activities} />
```

## Data Fetching Patterns

### Loading States

```typescript
if (isLoading) return <Skeleton />;
if (error) return <ErrorDisplay />;
return <DataDisplay data={data} />;
```

### Mutations

```typescript
const { mutate, isPending } = useMutation({
  mutationFn: updateContact,
  onSuccess: () => {
    toast({ title: "Success" });
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
  },
});

<Button onClick={() => mutate(data)} disabled={isPending}>
  {isPending ? "Saving..." : "Save"}
</Button>
```

## Accessibility

### Standards

- Semantic HTML (`<nav>`, `<main>`, `<article>`)
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators
- Screen reader friendly

### Test IDs

Every interactive element has `data-testid`:
```typescript
<Button data-testid="button-create-contact">
  Create Contact
</Button>
```

Pattern: `{type}-{action}-{target}` or `{type}-{description}-{id}`

## Performance

### Optimizations

- Code splitting (React.lazy for routes - future)
- Image optimization (responsive images)
- React Query caching
- Memoization where appropriate
- Debounced search inputs

### Bundle Size

- Tree-shakeable imports
- Minimal dependencies
- TailwindCSS purging

## Error Handling

### API Errors

```typescript
try {
  await apiRequest('/api/contacts', { method: 'POST', body: data });
} catch (error) {
  toast({
    title: "Error",
    description: "Failed to create contact",
    variant: "destructive",
  });
}
```

### Form Validation Errors

Automatically displayed via React Hook Form:
```typescript
{form.formState.errors.email && (
  <FormMessage>{form.formState.errors.email.message}</FormMessage>
)}
```

## Dark Mode

### Implementation

```typescript
const [theme, setTheme] = useState<"light" | "dark">("light");

useEffect(() => {
  const stored = localStorage.getItem("theme");
  const initial = stored || "light";
  setTheme(initial);
  document.documentElement.classList.toggle("dark", initial === "dark");
}, []);

const toggleTheme = () => {
  const newTheme = theme === "light" ? "dark" : "light";
  setTheme(newTheme);
  localStorage.setItem("theme", newTheme);
  document.documentElement.classList.toggle("dark", newTheme === "dark");
};
```

### Styling

All colors use CSS variables that change based on `.dark` class:
```css
:root { --background: 0 0% 100%; }
.dark { --background: 0 0% 9%; }
```

## Testing Strategy

### Current State

- Manual testing
- Visual verification
- Test IDs on all interactive elements

### Future Testing

- Unit tests (Vitest)
- Integration tests (React Testing Library)
- E2E tests (Playwright)
- Visual regression tests

## Build & Deployment

### Development

```bash
npm run dev     # Start Vite dev server
```

### Production

```bash
npm run build   # Build for production
npm run preview # Preview production build
```

### Environment Variables

Frontend variables must be prefixed with `VITE_`:
```bash
VITE_API_URL=https://api.example.com
```

Access via `import.meta.env.VITE_API_URL`

## Common Patterns

### Modal Dialogs

```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Dropdown Menus

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Toast Notifications

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

toast({
  title: "Success",
  description: "Contact created successfully",
});
```

## Maintenance

### Adding New Pages

1. Create component in `client/src/pages/`
2. Add route in `App.tsx`
3. Add navigation item in `AppSidebar.tsx`
4. Follow established patterns

### Updating Styles

- Modify CSS variables in `index.css`
- Update Tailwind config for new utilities
- Keep light/dark mode in sync

### Code Standards

- TypeScript strict mode
- ESLint + Prettier
- Consistent component structure
- Descriptive variable names
- Comments only for "why", not "what"
