# Smart Klix CRM - Developer Onboarding Guide

Welcome to Smart Klix CRM! This guide will get you up and running quickly.

## Day 1: Environment Setup

### Prerequisites

Install these tools on your development machine:

```bash
# Node.js 20+
node --version  # Should be v20.x.x or higher

# npm
npm --version

# Git
git --version

# PostgreSQL (optional - app can use in-memory mode)
psql --version
```

### Clone Repository

```bash
# Clone the repository
git clone <repo-url>
cd smart-klix-crm

# Install dependencies
npm install
```

### Environment Configuration

Create `.env` file:

```bash
# Optional - for full functionality
DATABASE_URL=postgresql://user:pass@localhost:5432/smartklix_dev
OPENAI_API_KEY=sk-your-key-here
N8N_WEBHOOK_URL=http://localhost:5678/webhook
SESSION_SECRET=dev-secret-change-in-production
```

**Note:** The app works without these! It falls back to:
- In-memory storage (no DATABASE_URL)
- Mock AI responses (no OPENAI_API_KEY)
- Placeholder N8N status

### Start Development Server

```bash
npm run dev
```

Navigate to `http://localhost:5000` - you should see the dashboard!

### Verify Installation

```bash
# Health check
curl http://localhost:5000/api/health

# Expected response:
{
  "status": "healthy",
  "database": "memory",      # or "connected" if DATABASE_URL set
  "ai_agent": "not_configured",  # or "ready" if OPENAI_API_KEY set
  "storage": "memory",       # or "database"
  "timestamp": "2025-01-21T..."
}
```

✅ **Success!** You're ready to start developing.

---

## Day 2: Understanding the Codebase

### Project Structure

```
smart-klix-crm/
├── client/                   # Frontend (React)
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── ui/         # Shadcn primitives
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── CreateJobDialog.tsx
│   │   │   └── ...
│   │   ├── pages/          # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Contacts.tsx
│   │   │   ├── Jobs.tsx
│   │   │   └── ...
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
│   └── index.css           # Tailwind + theme
├── server/                  # Backend (Express)
│   ├── index.ts            # Server entry
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Data layer
│   ├── ai-agent.ts         # AI agent
│   └── ai-tools.ts         # AI tools
├── shared/                  # Shared code
│   └── schema.ts           # Database schema
└── docs/                    # Documentation
```

### Technology Stack

**Frontend:**
- React 18 (hooks)
- TypeScript (strict mode)
- TailwindCSS (styling)
- Shadcn UI (components)
- TanStack Query (data fetching)
- Wouter (routing)
- React Hook Form + Zod (forms)

**Backend:**
- Express.js (server)
- TypeScript (strict mode)
- Drizzle ORM (database)
- PostgreSQL (database)
- OpenAI API (AI agent)
- Zod (validation)

### Key Concepts

#### 1. Storage Abstraction

All database operations use the `IStorage` interface:

```typescript
// server/storage.ts
interface IStorage {
  listContacts(): Promise<Contact[]>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | null>;
  // ...
}
```

Two implementations:
- **MemStorage**: In-memory (development)
- **DbStorage**: PostgreSQL (production)

#### 2. Schema-First Development

All types are defined in `shared/schema.ts` using Drizzle:

```typescript
// shared/schema.ts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name"),
  email: varchar("email"),
  // ...
});

// Zod schema for validation
export const insertContactSchema = createInsertSchema(contacts);

// TypeScript types
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
```

#### 3. API Routes with Validation

All POST/PATCH routes use Zod validation:

```typescript
// server/routes.ts
app.post("/api/contacts", async (req, res) => {
  try {
    const validated = insertContactSchema.parse(req.body);
    const contact = await storage.createContact(validated);
    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create contact" });
  }
});
```

#### 4. Frontend Data Fetching

Use TanStack Query for all server state:

```typescript
// client/src/pages/Contacts.tsx
const { data: contacts = [], isLoading } = useQuery<Contact[]>({
  queryKey: ["/api/contacts"],
});
```

Mutations with optimistic updates:

```typescript
const createMutation = useMutation({
  mutationFn: async (data: InsertContact) => {
    return apiRequest("POST", "/api/contacts", data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
  },
});
```

#### 5. Forms with Validation

Use React Hook Form + Zod:

```typescript
const form = useForm<InsertContact>({
  resolver: zodResolver(insertContactSchema),
  defaultValues: {
    name: "",
    email: "",
    // ...
  },
});

const onSubmit = (data: InsertContact) => {
  createMutation.mutate(data);
};
```

---

## Day 3: Making Your First Changes

### Task: Add a New Field to Contacts

Let's add a "LinkedIn URL" field to contacts.

#### 1. Update Database Schema

```typescript
// shared/schema.ts
export const contacts = pgTable("contacts", {
  // ... existing fields
  linkedinUrl: varchar("linkedin_url"), // Add this
});
```

#### 2. Update Zod Schema

The Zod schema auto-updates, but you can customize:

```typescript
export const insertContactSchema = createInsertSchema(contacts).extend({
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});
```

#### 3. Sync Database

```bash
npm run db:push
```

If conflicts occur:

```bash
npm run db:push --force
```

⚠️ **Warning:** `--force` may lose data. Backup first!

#### 4. Update Frontend Form

```tsx
// client/src/components/CreateContactDialog.tsx
<FormField
  control={form.control}
  name="linkedinUrl"
  render={({ field }) => (
    <FormItem>
      <FormLabel>LinkedIn URL</FormLabel>
      <FormControl>
        <Input placeholder="https://linkedin.com/in/..." {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### 5. Display in Contact Detail

```tsx
// client/src/pages/ContactDetail.tsx
{contact.linkedinUrl && (
  <div className="flex items-center gap-2">
    <Linkedin className="w-4 h-4 text-muted-foreground" />
    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
      LinkedIn Profile
    </a>
  </div>
)}
```

#### 6. Test Your Changes

```bash
# Restart dev server
npm run dev

# Test in browser:
# 1. Create new contact with LinkedIn URL
# 2. Verify validation (must be valid URL)
# 3. Check contact detail page shows link
```

✅ **Congratulations!** You've made your first change.

---

## Common Development Tasks

### Adding a New Page

#### 1. Create Page Component

```tsx
// client/src/pages/MyNewPage.tsx
export default function MyNewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">My New Page</h1>
        <p className="text-sm text-muted-foreground">Page description</p>
      </div>

      {/* Page content */}
    </div>
  );
}
```

#### 2. Add Route

```tsx
// client/src/App.tsx
import MyNewPage from "@/pages/MyNewPage";

function Router() {
  return (
    <Switch>
      {/* ... existing routes */}
      <Route path="/my-new-page" component={MyNewPage} />
    </Switch>
  );
}
```

#### 3. Add to Sidebar

```tsx
// client/src/components/AppSidebar.tsx
import { Icon } from "lucide-react";

const items = [
  // ... existing items
  {
    title: "My New Page",
    url: "/my-new-page",
    icon: Icon,
  },
];
```

### Adding a New API Endpoint

#### 1. Define Schema (if new entity)

```typescript
// shared/schema.ts
export const myEntity = pgTable("my_entity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMyEntitySchema = createInsertSchema(myEntity);
export type MyEntity = typeof myEntity.$inferSelect;
export type InsertMyEntity = z.infer<typeof insertMyEntitySchema>;
```

#### 2. Add Storage Methods

```typescript
// server/storage.ts
interface IStorage {
  // ... existing methods
  listMyEntities(): Promise<MyEntity[]>;
  createMyEntity(data: InsertMyEntity): Promise<MyEntity>;
}

// Implement in both MemStorage and DbStorage
class DbStorage implements IStorage {
  async listMyEntities() {
    return await db.select().from(myEntity);
  }

  async createMyEntity(data: InsertMyEntity) {
    const [created] = await db.insert(myEntity).values(data).returning();
    return created;
  }
}
```

#### 3. Add API Routes

```typescript
// server/routes.ts
app.get("/api/my-entities", async (req, res) => {
  try {
    const entities = await storage.listMyEntities();
    res.json(entities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch entities" });
  }
});

app.post("/api/my-entities", async (req, res) => {
  try {
    const validated = insertMyEntitySchema.parse(req.body);
    const entity = await storage.createMyEntity(validated);
    res.json(entity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create entity" });
  }
});
```

#### 4. Use in Frontend

```tsx
// client/src/pages/MyNewPage.tsx
const { data: entities = [], isLoading } = useQuery<MyEntity[]>({
  queryKey: ["/api/my-entities"],
});
```

---

## Development Best Practices

### Code Style

- **TypeScript strict mode** - No `any` types
- **Functional components** - Use hooks, not classes
- **Descriptive names** - Clear variable/function names
- **Comments** - Explain "why", not "what"

### Testing

All interactive elements need `data-testid`:

```tsx
<Button data-testid="button-create-contact">Create Contact</Button>
<Input data-testid="input-search" />
<Card data-testid={`contact-card-${contact.id}`} />
```

Pattern: `{element}-{action/description}-{id?}`

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/add-linkedin-field

# Make changes
git add .
git commit -m "feat: add LinkedIn URL field to contacts"

# Push and create PR
git push origin feature/add-linkedin-field
```

Commit message format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

## Debugging Tips

### Backend Debugging

```typescript
// Add logging
console.log("[DEBUG] Contact created:", contact);

// Use debugger
debugger; // Pauses execution in VSCode
```

Run with debugging:

```bash
# Enable verbose logging
DEBUG=* npm run dev
```

### Frontend Debugging

```tsx
// React Query DevTools (already configured)
// Check browser DevTools → TanStack Query

// Log component state
console.log("Form values:", form.getValues());
console.log("Form errors:", form.formState.errors);
```

### Database Debugging

```bash
# Connect to database
psql $DATABASE_URL

# View tables
\dt

# Query data
SELECT * FROM contacts LIMIT 10;

# Check schema
\d contacts
```

### Common Issues

**Port 5000 already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Database connection fails:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or use in-memory mode (remove DATABASE_URL)
```

**TypeScript errors:**
```bash
# Check types
npm run typecheck

# Restart TypeScript server in VSCode
Cmd+Shift+P → "Restart TypeScript Server"
```

---

## Helpful Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production build

# Database
npm run db:push      # Sync schema (safe)
npm run db:push --force  # Force sync (data loss warning)

# Code Quality
npm run typecheck    # TypeScript errors
npm run lint         # Linting (if configured)

# Debugging
DEBUG=* npm run dev  # Verbose logging
```

---

## Learning Resources

### Internal Documentation

- [README](../README.md) - Project overview
- [API Reference](API_REFERENCE.md) - Complete API docs
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment
- [replit.md](../replit.md) - Architecture notes

### External Resources

**React:**
- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**UI:**
- [Shadcn UI](https://ui.shadcn.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

**Data Fetching:**
- [TanStack Query](https://tanstack.com/query/latest)

**Forms:**
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)

**Backend:**
- [Express.js](https://expressjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [OpenAI API](https://platform.openai.com/docs/)

---

## Getting Help

### Ask Your Team

- Check existing PRs and issues
- Review recent commits for similar changes
- Ask in team chat

### Debug Yourself

1. Check browser console for errors
2. Check server logs for backend errors
3. Verify database schema matches code
4. Test API endpoints with curl
5. Check health endpoint: `/api/health`

### Common Questions

**Q: Where do I add validation?**  
A: All validation is in `shared/schema.ts` using Zod schemas.

**Q: How do I add a new AI tool?**  
A: Add to `server/ai-tools.ts` and update AI agent configuration.

**Q: Why isn't my form submitting?**  
A: Check `form.formState.errors` - likely validation failure.

**Q: Database changes not showing?**  
A: Run `npm run db:push` after schema changes.

**Q: How do I test without OpenAI API key?**  
A: The app falls back to mock responses automatically.

---

## Next Steps

### Week 1 Goals

- [ ] Complete environment setup
- [ ] Make your first code change
- [ ] Create your first pull request
- [ ] Review 5 files in the codebase
- [ ] Fix a small bug

### Week 2 Goals

- [ ] Add a new database field
- [ ] Create a new API endpoint
- [ ] Build a new UI component
- [ ] Understand the AI agent system
- [ ] Deploy to staging environment

### Month 1 Goals

- [ ] Ship your first feature
- [ ] Review others' pull requests
- [ ] Improve documentation
- [ ] Optimize a slow query
- [ ] Write tests for your code

---

## Welcome to the Team!

You're now ready to contribute to Smart Klix CRM. Remember:

✨ **Ask questions** - No question is too small  
🚀 **Ship early, ship often** - Small PRs are better  
📖 **Document your work** - Help future you and others  
🧪 **Test your changes** - Break it before users do  
🎯 **Focus on users** - Build features that matter  

Happy coding! 🎉

---

**Smart Klix CRM** - Production-grade AI CRM for field service businesses.
