# TopOut Quick Start Guide

## ⚡ Get Running in 5 Minutes

### Prerequisites

- Node.js 20+ installed
- PostgreSQL database access (optional for development)

### 1. Clone and Install

```bash
git clone <repo-url>
cd topout
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

**For local development**, you can run with defaults:

```bash
# .env file - minimal configuration
DATABASE_URL=postgresql://localhost/topout_dev
SESSION_SECRET=dev-secret-change-in-production
```

Or **skip database entirely** and run in placeholder mode (in-memory storage).

### 3. Start Development Server

```bash
npm run dev
```

Open `http://localhost:5000` in your browser.

✅ **You're done!** The dashboard should load immediately.

## Understanding Placeholder Mode

TopOut runs in **placeholder mode** when services aren't configured:

| Service | Placeholder Behavior |
|---------|---------------------|
| **Database** | Uses in-memory storage (data lost on restart) |
| **Redis** | Not required for basic functionality |
| **OpenAI** | Shows "not configured" status |
| **N8N** | Shows "not configured" status |

Check system status:
```bash
curl http://localhost:5000/api/health
```

## Quick Tour

### Dashboard Pages

Navigate via sidebar:

- **Dashboard** - Metrics overview
- **Contacts** - Customer management
- **Jobs** - Project tracking
- **Calendar** - Appointments
- **AI Assist Queue** - AI suggestions
- **Files** - Document storage
- **Notes** - Quick notes
- **Metrics** - Analytics
- **Audit Log** - Activity history
- **Settings** - Configuration

### Dark Mode

Click moon/sun icon in top-right corner.

### System Status

Dashboard shows current service status:
- 🟢 Connected
- 🟡 Placeholder mode
- ⚪ Not configured

## Database Setup (Optional)

### Using PostgreSQL

1. Create database:
   ```bash
   createdb topout_dev
   ```

2. Update `.env`:
   ```bash
   DATABASE_URL=postgresql://localhost/topout_dev
   ```

3. Sync schema:
   ```bash
   npm run db:push
   ```

4. Restart dev server:
   ```bash
   npm run dev
   ```

Dashboard now shows "Connected" for database.

### Using Neon (Cloud Postgres)

1. Sign up at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string
4. Update `.env`:
   ```bash
   DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname
   ```
5. Run: `npm run db:push`

## API Testing

### Health Check

```bash
curl http://localhost:5000/api/health
```

### Create Contact

```bash
curl -X POST http://localhost:5000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Inc",
    "status": "new"
  }'
```

### List Contacts

```bash
curl http://localhost:5000/api/contacts
```

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:push      # Sync database schema
npm run db:generate  # Generate migration files
```

## Project Structure

```
topout/
├── client/          # Frontend React app
│   ├── src/
│   │   ├── pages/   # Page components
│   │   └── components/  # Reusable components
├── server/          # Backend Express API
│   ├── routes.ts    # API endpoints
│   └── storage.ts   # Data layer
└── shared/          # Shared types
    └── schema.ts    # Database schema
```

## Common Tasks

### Add New Page

1. Create `client/src/pages/MyPage.tsx`
2. Add route in `client/src/App.tsx`:
   ```typescript
   <Route path="/mypage" component={MyPage} />
   ```
3. Add to sidebar in `client/src/components/AppSidebar.tsx`

### Add New API Endpoint

1. Define schema in `shared/schema.ts`
2. Add storage methods in `server/storage.ts`
3. Create route in `server/routes.ts`:
   ```typescript
   app.get("/api/mydata", async (req, res) => {
     const data = await storage.getMyData();
     res.json(data);
   });
   ```

### Change Theme Colors

1. Open `client/src/index.css`
2. Modify CSS variables:
   ```css
   :root {
     --primary: 221 83% 53%;  /* Blue */
   }
   ```

Or use Settings page: `/settings` → Tenant Branding → Primary Color

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Database Connection Failed

- Verify PostgreSQL is running: `pg_isready`
- Check connection string format
- Or run without database (placeholder mode)

### Hot Reload Not Working

- Restart dev server: `Ctrl+C` then `npm run dev`
- Clear browser cache
- Check browser console for errors

### TypeScript Errors

```bash
npm run build  # Check for type errors
```

## Next Steps

### For Development

1. Read [Architecture Documentation](docs/architecture.md)
2. Explore [Frontend Architecture](docs/frontend_architecture.md)
3. Review [Audit Checklist](docs/audit_checklist.md)

### For Production

1. Follow [Deployment Guide](DEPLOYMENT.md)
2. Configure real database
3. Set secure secrets
4. Enable HTTPS

### For Integration

Integration phase includes:
- OpenAI AI agent
- N8N workflows
- Redis queues
- Authentication system
- File uploads
- Email/SMS

See `.env.example` for integration variables.

## Getting Help

### Documentation

- [README.md](README.md) - Overview
- [docs/architecture.md](docs/architecture.md) - System architecture
- [docs/frontend_architecture.md](docs/frontend_architecture.md) - Frontend details
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

### Common Issues

**"Running in placeholder mode"**
- This is normal without `DATABASE_URL`
- Set up database to persist data

**"Not configured" services**
- AI, N8N, Redis not needed for basic functionality
- Enable in integration phase

**Changes not showing**
- Refresh browser (hard reload: Ctrl+Shift+R)
- Restart dev server
- Clear browser cache

---

**Time to First Page**: ~2 minutes  
**Time to Full Setup**: ~5-10 minutes  
**Time to Production**: ~30 minutes
