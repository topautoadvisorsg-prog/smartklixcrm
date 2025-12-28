# Smart Klix CRM - Deployment Guide

Complete guide for deploying Smart Klix CRM to production.

## Pre-Deployment Checklist

### ✅ Required Services

- [ ] PostgreSQL database (Neon or self-hosted)
- [ ] OpenAI API account with credits
- [ ] N8N instance for workflow automation
- [ ] Domain name and SSL certificate
- [ ] Environment for Node.js 20+

### ✅ Required Secrets

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `OPENAI_API_KEY` - OpenAI API key  
- [ ] `SESSION_SECRET` - Random secure string (32+ characters)
- [ ] `N8N_WEBHOOK_URL` - N8N webhook endpoint

### ✅ Optional Configuration

- [ ] `TENANT_NAME` - Company/brand name
- [ ] `TENANT_LOGO_URL` - Company logo URL
- [ ] Rate limiting configuration
- [ ] Monitoring/logging service

---

## Deployment Platforms

### Replit Deployment

**Best for:** Quick deployment, single-tenant instances

1. **Fork Repository**
   ```bash
   # Clone Smart Klix CRM to your Replit account
   ```

2. **Configure Secrets**
   - Go to Tools → Secrets
   - Add all required environment variables
   - Never commit secrets to repository

3. **Deploy**
   - Click "Deploy" button
   - Configure deployment:
     - Type: `autoscale` (stateless) or `vm` (stateful)
     - Build command: `npm run build`
     - Run command: `npm start`

4. **Database Migration**
   ```bash
   npm run db:push
   ```

5. **Verify Deployment**
   ```bash
   curl https://your-app.replit.app/api/health
   ```

---

### Docker Deployment

**Best for:** Self-hosted, containerized environments

#### 1. Create Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}
    restart: unless-stopped
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=smartklix
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=smartklix_crm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 3. Deploy

```bash
# Build and start
docker-compose up -d

# Run migrations
docker-compose exec app npm run db:push

# View logs
docker-compose logs -f app

# Health check
curl http://localhost:5000/api/health
```

---

### Vercel / Netlify Deployment

**Best for:** Frontend hosting with serverless backend

⚠️ **Note:** Smart Klix requires persistent backend. Use Vercel/Netlify for frontend only, deploy backend separately.

#### Frontend-Only Deployment

1. **Build frontend**
   ```bash
   npm run build
   # Output: dist/public
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Configure API proxy** (vercel.json)
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://your-backend.com/api/$1" }
     ]
   }
   ```

---

### Traditional VPS (Ubuntu/Debian)

**Best for:** Full control, dedicated server

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

#### 2. Database Setup

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE smartklix_crm;
CREATE USER smartklix WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE smartklix_crm TO smartklix;
\q
```

#### 3. Application Setup

```bash
# Create app directory
sudo mkdir -p /var/www/smartklix
sudo chown $USER:$USER /var/www/smartklix
cd /var/www/smartklix

# Clone repository
git clone <repo-url> .

# Install dependencies
npm install --production

# Create .env file
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://smartklix:your_password@localhost:5432/smartklix_crm
OPENAI_API_KEY=sk-your-key
SESSION_SECRET=$(openssl rand -base64 32)
N8N_WEBHOOK_URL=https://n8n.example.com/webhook
EOF

# Build application
npm run build

# Run migrations
npm run db:push
```

#### 4. PM2 Process Manager

```bash
# Start application
pm2 start npm --name "smartklix-crm" -- start

# Configure auto-restart
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs smartklix-crm
```

#### 5. Nginx Configuration

```nginx
# /etc/nginx/sites-available/smartklix

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/smartklix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL
sudo certbot --nginx -d your-domain.com
```

---

## Database Migration

### Initial Setup

```bash
# Sync schema to database
npm run db:push
```

### Schema Changes

```bash
# After modifying shared/schema.ts
npm run db:push

# If conflicts occur
npm run db:push --force
```

⚠️ **Warning:** `--force` may cause data loss. Backup database first!

### Backup and Restore

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
OPENAI_API_KEY=sk-...
SESSION_SECRET=random-32-char-string
```

### Recommended

```bash
NODE_ENV=production
N8N_WEBHOOK_URL=https://n8n.example.com/webhook
```

### Optional

```bash
TENANT_NAME=Your Company
TENANT_LOGO_URL=https://example.com/logo.png
PORT=5000
```

### Generating Secrets

```bash
# Session secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## SSL/HTTPS Configuration

### Let's Encrypt (Free)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (cron)
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

### Custom Certificate

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # ... rest of config
}
```

---

## Performance Optimization

### Node.js Configuration

```bash
# Increase memory limit
NODE_OPTIONS=--max-old-space-size=4096

# Enable production mode
NODE_ENV=production
```

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_contact_id ON jobs(contact_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
```

### Nginx Caching

```nginx
# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## Monitoring and Logging

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Application logs
pm2 logs smartklix-crm

# System metrics
pm2 info smartklix-crm
```

### Health Checks

```bash
# Automated health check
*/5 * * * * curl -f http://localhost:5000/api/health || echo "Health check failed"
```

### Log Management

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Database Security

```sql
-- Create read-only user for reporting
CREATE USER readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE smartklix_crm TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
```

### Rate Limiting (Nginx)

```nginx
# Rate limit zone
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location /api {
        limit_req zone=api burst=20 nodelay;
        # ... proxy config
    }
}
```

---

## Backup Strategy

### Automated Database Backup

```bash
#!/bin/bash
# /usr/local/bin/backup-smartklix.sh

BACKUP_DIR=/var/backups/smartklix
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Delete old backups (keep 7 days)
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
# Crontab entry (daily at 2 AM)
0 2 * * * /usr/local/bin/backup-smartklix.sh
```

### Application Backup

```bash
# Backup application files
tar -czf smartklix_app_$(date +%Y%m%d).tar.gz /var/www/smartklix
```

---

## Scaling Considerations

### Horizontal Scaling

⚠️ **Current Limitation:** Smart Klix is single-tenant and runs as a single instance per customer.

For multiple customers:
- Deploy separate instances
- Each with dedicated database
- Independent branding/configuration

### Vertical Scaling

**Recommended Server Specs:**

- **Small** (< 100 users): 2 CPU, 4GB RAM
- **Medium** (100-500 users): 4 CPU, 8GB RAM
- **Large** (500+ users): 8+ CPU, 16+ GB RAM

### Database Scaling

```bash
# Connection pooling
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20

# Read replicas (future)
# Point analytics/reporting to read replica
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs smartklix-crm --lines 100

# Common issues:
# 1. Missing DATABASE_URL
# 2. Database connection failed
# 3. Port 5000 already in use
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### High Memory Usage

```bash
# Check Node.js memory
pm2 info smartklix-crm

# Increase memory limit
pm2 delete smartklix-crm
NODE_OPTIONS=--max-old-space-size=4096 pm2 start npm --name smartklix-crm -- start
```

### SSL Certificate Issues

```bash
# Test SSL
sudo certbot certificates

# Renew manually
sudo certbot renew

# Check Nginx config
sudo nginx -t
```

---

## Post-Deployment

### 1. Verify Services

```bash
# Health check
curl https://your-domain.com/api/health

# Expected response:
# {"status":"healthy","database":"connected","ai_agent":"ready"}
```

### 2. Configure Branding

- Navigate to https://your-domain.com/settings
- Update company name, logo, colors
- Set AI agent mode (Draft/Assist/Auto)

### 3. Create First User

⚠️ **Note:** Authentication not yet implemented. Add via database:

```sql
INSERT INTO users (id, email, name, role) 
VALUES (gen_random_uuid(), 'admin@example.com', 'Admin User', 'admin');
```

### 4. Test AI Agent

- Open Intelligence Bot page
- Send test message in Draft mode
- Verify OpenAI connection

### 5. Configure N8N Workflows

- Set N8N_WEBHOOK_URL in settings
- Test workflow triggers from dashboard

### 6. Monitor Performance

```bash
# CPU/Memory usage
pm2 monit

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Application logs
pm2 logs smartklix-crm --lines 50
```

---

## Maintenance

### Regular Updates

```bash
# Pull latest code
cd /var/www/smartklix
git pull origin main

# Install dependencies
npm install --production

# Rebuild
npm run build

# Run migrations
npm run db:push

# Restart application
pm2 restart smartklix-crm
```

### Database Maintenance

```sql
-- Vacuum database (weekly)
VACUUM ANALYZE;

-- Check database size
SELECT pg_database_size('smartklix_crm');

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback Procedure

### Application Rollback

```bash
# List deployments
git log --oneline -10

# Rollback to previous version
git checkout <commit-hash>
npm install --production
npm run build
pm2 restart smartklix-crm
```

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < /var/backups/smartklix/db_20250121_020000.sql.gz
```

---

## Support and Monitoring

### Uptime Monitoring

Use services like:
- UptimeRobot
- Pingdom
- StatusCake

Monitor: `GET /api/health`

### Error Tracking

Consider integrating:
- Sentry (error tracking)
- LogRocket (session replay)
- DataDog (APM)

### Performance Monitoring

```bash
# PM2 Plus (paid)
pm2 plus

# Or use open-source alternatives
# - Grafana + Prometheus
# - ELK Stack
```

---

**Smart Klix CRM Deployment Guide** - Production-ready deployment for field service CRM.

For questions or issues, refer to [README](../README.md) or contact support.
