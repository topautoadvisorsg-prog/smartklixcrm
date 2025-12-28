# TopOut Deployment Guide

## Pre-Deployment Checklist

Before deploying TopOut to a new tenant:

- [ ] Provision PostgreSQL database
- [ ] Create Redis instance (optional, for queue features)
- [ ] Generate secure secrets (JWT, session)
- [ ] Configure environment variables
- [ ] Run database migrations
- [ ] Test health endpoint
- [ ] Configure tenant branding

## Environment Setup

### 1. Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security
JWT_SECRET=<generate-secure-random-string>
SESSION_SECRET=<generate-secure-random-string>

# Application
NODE_ENV=production
PORT=5000
```

### 2. Optional Integration Variables (Set Later)

```bash
# AI & Automation
OPENAI_API_KEY=sk-...
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/...

# Cache & Queue
REDIS_URL=redis://user:password@host:6379

# Tenant Customization
TENANT_NAME="Customer Name"
TENANT_LOGO_URL=https://...

# Feature Flags
ENABLE_AI_AGENT=false
ENABLE_N8N_WORKFLOWS=false
ENABLE_REDIS_CACHE=false
```

## Database Setup

### Option 1: Automatic Schema Sync (Development)

```bash
npm install
npm run db:push --force
```

This syncs the Drizzle schema to your database automatically.

### Option 2: Manual Migration (Production)

1. Connect to your PostgreSQL database
2. Run the migration script:

```bash
psql $DATABASE_URL < drizzle/001_init_schema.sql
```

### Verify Database

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Should show:
# users, contacts, jobs, appointments, notes, files, audit_log
```

## Application Deployment

### Using Node.js Directly

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start production server
NODE_ENV=production node dist/server/index.js
```

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "topout" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 5000

# Start application
CMD ["node", "dist/server/index.js"]
```

Build and run:

```bash
docker build -t topout .
docker run -p 5000:5000 --env-file .env topout
```

## Health Check

After deployment, verify the system is running:

```bash
curl https://your-domain.com/api/health
```

Expected response:

```json
{
  "status": "operational",
  "timestamp": "2025-01-12T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "not_configured",
    "openai": "not_configured",
    "n8n": "not_configured"
  }
}
```

## Tenant Customization

### 1. Branding Configuration

After deployment, access Settings page:

1. Navigate to `/settings`
2. Update "Tenant Branding" section:
   - Company Name
   - Primary Color
   - Upload Logo

Or set via environment:

```bash
TENANT_NAME="Customer Inc"
```

### 2. AI Agent Configuration

Configure AI agent mode in Settings:

- **Draft**: Suggests actions only
- **Assist**: Queues actions for approval (default)
- **Auto**: Executes approved actions

Set feature flag to enable:

```bash
ENABLE_AI_AGENT=true
OPENAI_API_KEY=sk-...
```

## Post-Deployment Tasks

### 1. Create Admin User

Access database directly:

```sql
INSERT INTO users (username, password, email, role)
VALUES (
  'admin',
  '<bcrypt-hashed-password>',
  'admin@customer.com',
  'admin'
);
```

**Note**: Password hashing will be implemented in integration phase.

### 2. Test Core Functionality

- [ ] Dashboard loads
- [ ] Create contact
- [ ] Create job
- [ ] Add note
- [ ] Check audit log
- [ ] Toggle dark mode
- [ ] All pages accessible

### 3. Configure Monitoring

Set up monitoring for:

- Application uptime
- Database connectivity
- Error rates
- API response times

## Scaling

### Horizontal Scaling

TopOut is designed for single-tenant deployment. To scale:

1. **Same Tenant, Multiple Instances**:
   - Deploy multiple app instances behind load balancer
   - Share same database
   - Use Redis for session storage

2. **Multiple Tenants**:
   - Deploy separate instance per tenant
   - Each with dedicated database
   - Completely isolated

### Database Scaling

- Use connection pooling (built-in with Neon)
- Add read replicas for queries
- Vertical scaling for primary database

## Backup Strategy

### Database Backups

```bash
# Daily automated backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20250112.sql
```

### File Backups

If using file uploads, configure S3 bucket versioning or similar.

## Troubleshooting

### Application Won't Start

1. Check environment variables:
   ```bash
   echo $DATABASE_URL
   echo $SESSION_SECRET
   ```

2. Verify database connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

3. Check logs:
   ```bash
   pm2 logs topout
   # or
   docker logs <container-id>
   ```

### Database Connection Issues

- Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Check network connectivity
- Verify PostgreSQL is running
- Check firewall rules

### "Placeholder Mode" Warning

If dashboard shows "Running in placeholder mode":

- `DATABASE_URL` not set or invalid
- Falls back to in-memory storage
- Data will be lost on restart
- Set correct `DATABASE_URL` to fix

## Security Hardening

### Before Production Launch

1. **Environment Variables**:
   - Never commit `.env` to Git
   - Use secret management (Vault, AWS Secrets Manager)
   - Rotate secrets regularly

2. **Database**:
   - Enable SSL connections
   - Restrict network access
   - Use strong passwords
   - Enable row-level security (future)

3. **Application**:
   - Enable rate limiting (future)
   - Configure CORS properly
   - Use HTTPS only
   - Set secure headers

4. **Monitoring**:
   - Set up error tracking
   - Monitor failed login attempts
   - Track unusual API usage
   - Alert on database issues

## Updating TopOut

### Minor Updates

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Rebuild
npm run build

# Restart application
pm2 restart topout
```

### Major Updates with Schema Changes

```bash
# Backup database first
pg_dump $DATABASE_URL > backup-before-update.sql

# Pull updates
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run db:push --force

# Rebuild and restart
npm run build
pm2 restart topout

# Verify health
curl http://localhost:5000/api/health
```

## Support Contacts

For deployment issues:

1. Check documentation in `/docs`
2. Review health endpoint output
3. Check application logs
4. Verify environment configuration

## Checklist: First Deployment

Before going live:

- [ ] Database provisioned and accessible
- [ ] All required environment variables set
- [ ] Database schema migrated
- [ ] Health endpoint returns "connected" for database
- [ ] Admin user created
- [ ] Settings configured (branding, AI mode)
- [ ] Core functionality tested
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] SSL/HTTPS enabled
- [ ] Error tracking configured

---

**Deployment Time**: ~30 minutes  
**First-Time Setup**: ~1 hour with customization  
**Clone for New Tenant**: ~20 minutes
