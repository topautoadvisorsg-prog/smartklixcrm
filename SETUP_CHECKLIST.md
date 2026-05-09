# 🎯 SETUP CHECKLIST - WHAT YOU NEED TO CONFIGURE

**Generated from System Audit - April 20, 2026**

This is your **complete checklist** of everything you need to set up to make Smart Klix CRM fully operational.

---

## 🔴 CRITICAL (System Won't Work Without These)

### 1. PostgreSQL Database
**Status**: ❌ NOT CONFIGURED  
**Impact**: System runs in memory mode, loses all data on restart

**What to Do**:
```bash
# Option A: Local PostgreSQL
# Install PostgreSQL, then:
createdb smartklix_db

# Option B: Cloud PostgreSQL (Neon, Supabase, Railway, etc.)
# Create a database instance, get connection string

# Add to .env:
DATABASE_URL=postgresql://user:password@host:5432/smartklix_db

# Run migrations:
npm run db:push
```

**Time Required**: 30 minutes  
**Priority**: 🔴 DO THIS FIRST

---

### 2. External Agent Gateway
**Status**: ❌ NOT CONFIGURED  
**Impact**: Cannot execute ANY external actions (email, WhatsApp, payments, calendar)

**What It Is**: A separate service that handles all external communications. The CRM sends it proposals, it executes them.

**What to Do**:

#### Step 1: Add to .env
```bash
AGENT_WEBHOOK_URL=https://your-agent-gateway.com
AGENT_INTERNAL_TOKEN=$(openssl rand -hex 32)
```

#### Step 2: Build/Deploy Agent Gateway Service
Your agent gateway MUST expose these 4 endpoints:

```
POST /execute/task       - General task execution
POST /execute/whatsapp   - WhatsApp messaging
POST /execute/email      - Email sending
POST /execute/payment    - Payment link generation
```

#### Step 3: Authentication
All requests include:
```
Authorization: Bearer {AGENT_INTERNAL_TOKEN}
Content-Type: application/json
X-Correlation-ID: {uuid}
```

#### Step 4: Callback to CRM
After execution, agent gateway calls back:
```
POST {APP_BASE_URL}/api/agent/callback
```

**What This Agent Covers**:
- ✅ WhatsApp messaging (via Twilio)
- ✅ SMS messaging (via Twilio)
- ✅ Email sending (via SendGrid/Resend)
- ✅ Payment links (via Stripe)
- ✅ Calendar events (via Google Calendar API)
- ✅ Document generation (via Google Docs API)

**Tech Stack Recommendation**:
- Node.js/Express or Python/FastAPI
- Redis for job queue
- PostgreSQL for execution logs
- Circuit breaker pattern for resilience

**Time Required**: 8-12 hours  
**Priority**: 🔴 CRITICAL - This is THE blocker

**Alternative for Testing**:
```bash
# Run mock agent gateway (simulates execution):
npm run mock-gateway
# Runs on port 8787
```

---

## 🟠 HIGH PRIORITY (Key Features Blocked)

### 3. Twilio Account (WhatsApp/SMS/Voice)
**Status**: ❌ NOT CONFIGURED  
**Impact**: No WhatsApp, SMS, or voice capabilities

**What to Do**:
1. Sign up at [twilio.com](https://www.twilio.com)
2. Get Account SID and Auth Token
3. Purchase a phone number
4. Enable WhatsApp Business API (requires approval)
5. Add credentials to agent gateway

**Time Required**: 1-2 hours (WhatsApp approval takes 1-3 days)  
**Cost**: ~$1/month for phone number + usage fees

---

### 4. Email Service Account (SendGrid or Resend)
**Status**: ❌ NOT CONFIGURED  
**Impact**: Cannot send emails

**What to Do**:

#### Option A: Resend (Already Integrated)
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain
3. Get API key
4. Add to agent gateway config

#### Option B: SendGrid
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Verify sender identity
3. Get API key
4. Add to agent gateway config

**Time Required**: 1-2 hours (domain verification takes 24-48 hours)  
**Cost**: Free tier available (100 emails/day)

---

### 5. Stripe Account (Payments)
**Status**: ❌ NOT CONFIGURED  
**Impact**: Cannot process payments or generate payment links

**What to Do**:
1. Sign up at [stripe.com](https://stripe.com)
2. Get API keys (publishable + secret)
3. Configure webhook endpoint in Stripe dashboard:
   ```
   POST {AGENT_WEBHOOK_URL}/webhooks/stripe
   ```
4. Add credentials to agent gateway

**Time Required**: 1 hour  
**Cost**: 2.9% + $0.30 per transaction

---

### 6. Google Cloud Account (Calendar/Workspace)
**Status**: ❌ NOT CONFIGURED  
**Impact**: No calendar integration, no Google Workspace features

**What to Do**:
1. Create Google Cloud project
2. Enable APIs:
   - Google Calendar API
   - Gmail API
   - Google Sheets API
   - Google Docs API
3. Create service account
4. Download credentials JSON
5. Add to agent gateway config

**Time Required**: 2-3 hours  
**Cost**: Free tier available

---

### 7. Application Base URL
**Status**: ⚠️ PARTIALLY CONFIGURED  
**Impact**: OAuth callbacks and webhooks won't work correctly

**What to Do**:
```bash
# Add to .env:
APP_BASE_URL=https://your-app-domain.com

# For local development:
APP_BASE_URL=http://localhost:5000
```

**Time Required**: 5 minutes

---

## 🟡 MEDIUM PRIORITY (Nice to Have)

### 8. Redis (Caching & Sessions)
**Status**: ❌ NOT CONFIGURED  
**Impact**: No session persistence across restarts, no caching

**What to Do**:
```bash
# Option A: Local Redis
# Install Redis, then:
redis-server

# Option B: Cloud Redis (Upstash, Redis Cloud)
# Create instance, get connection string

# Add to .env:
REDIS_URL=redis://localhost:6379
```

**Time Required**: 30 minutes  
**Cost**: Free tier available

---

### 9. Voice Receptionist Agent
**Status**: ❌ NOT CONFIGURED  
**Impact**: No AI phone receptionist

**What It Does**: Handles inbound phone calls with AI, extracts lead info, sends to CRM

**Two Tiers**:

#### Economy Mode (Basic)
- Twilio STT → Your Agent → Twilio TTS
- Lower quality, cheaper
- Good for MVP

#### Premium Mode (Advanced)
- OpenAI Real-time Voice API OR Vapi/Bland AI/Retell AI
- High quality, natural conversation
- More expensive

**What to Do**:
1. Choose provider (Twilio, Vapi, Bland AI, or Retell AI)
2. Set up account and get API keys
3. Configure webhook to CRM:
   ```
   POST {APP_BASE_URL}/api/voice/receptionist/premium/result
   ```
4. Test call flow

**Time Required**: 12-16 hours  
**Priority**: 🟠 HIGH if voice is important to you

---

### 10. Monitoring & Alerting Agent
**Status**: ❌ NOT CONFIGURED  
**Impact**: No system health monitoring, no alerts on failures

**What It Does**:
- Monitors system health
- Alerts on failures
- Tracks AI costs
- Generates reports

**Time Required**: 8 hours  
**Priority**: 🟡 MEDIUM - Important for production

---

## 🟢 LOW PRIORITY (Future Enhancements)

### 11. OpenAI Usage Monitoring
**Status**: ⚠️ API KEY SET, NO MONITORING  
**Impact**: Could get unexpected bills

**What to Do**:
1. Go to [platform.openai.com](https://platform.openai.com)
2. Set up usage alerts
3. Set monthly budget limit
4. Monitor usage dashboard

**Time Required**: 15 minutes

---

### 12. SSL/TLS Certificate (Production)
**Status**: ❌ NOT CONFIGURED  
**Impact**: No HTTPS in production

**What to Do**:
- If using Replit: Automatic
- If self-hosting: Use Let's Encrypt (free)
- Configure in reverse proxy (nginx, Caddy, etc.)

**Time Required**: 1 hour

---

## 📋 QUICK START ORDER (Do It In This Order)

### Week 1: Core Infrastructure
1. ✅ **OpenAI API Key** - Already done
2. 🔴 **Set up PostgreSQL** - 30 min
3. 🔴 **Set up Agent Gateway** - 8-12 hours
4. 🟠 **Configure Twilio** - 1-2 hours
5. 🟠 **Configure Email Service** - 1-2 hours

### Week 2: Payments & Calendar
6. 🟠 **Configure Stripe** - 1 hour
7. 🟠 **Configure Google Cloud** - 2-3 hours
8. 🟡 **Set up Redis** - 30 min
9. 🟡 **Configure APP_BASE_URL** - 5 min

### Week 3: Voice (Optional)
10. 🟠 **Set up Voice Receptionist** - 12-16 hours
11. 🟡 **Test call flows** - 4 hours

### Week 4: Production Readiness
12. 🟡 **Set up Monitoring** - 8 hours
13. 🟢 **Configure SSL** - 1 hour
14. 🟢 **Load testing** - 4 hours

---

## 💰 ESTIMATED COSTS (Monthly)

| Service | Cost | Required? |
|---------|------|-----------|
| PostgreSQL | $0-15 | 🔴 YES |
| Agent Gateway Hosting | $5-20 | 🔴 YES |
| Twilio | $1 + usage | 🟠 YES (for WhatsApp/SMS) |
| SendGrid/Resend | $0-20 | 🟠 YES (for email) |
| Stripe | 2.9% + $0.30/tx | 🟠 YES (for payments) |
| Google Cloud | $0-10 | 🟠 YES (for calendar) |
| Redis | $0-10 | 🟡 Optional |
| Voice (Twilio) | $1 + usage | 🟡 Optional |
| Voice (Premium) | $0.10-0.20/min | 🟡 Optional |
| **TOTAL (Minimum)** | **$6-35** | Core only |
| **TOTAL (Full)** | **$20-100+** | All features |

---

## 🎯 WHAT EACH AGENT COVERS

### Agent 1: Execution Agent (REQUIRED)
**Covers**:
- ✅ WhatsApp messaging
- ✅ SMS messaging
- ✅ Email sending
- ✅ Payment link generation
- ✅ Calendar event management
- ✅ Document creation
- ✅ Webhook delivery

**What You Need**:
- Twilio account
- SendGrid/Resend account
- Stripe account
- Google Cloud account

---

### Agent 2: Voice Receptionist Agent (RECOMMENDED)
**Covers**:
- ✅ 24/7 call answering
- ✅ Lead capture from phone calls
- ✅ Appointment scheduling (tentative)
- ✅ Call transcript logging
- ✅ Intelligent routing

**What You Need**:
- Twilio account (with phone number)
- OpenAI API key (already have)
- Speech-to-text provider
- Text-to-speech provider

---

### Agent 3: Intake Processing Agent (OPTIONAL)
**Covers**:
- ✅ Multi-source intake (forms, widgets, webhooks)
- ✅ Data normalization
- ✅ Contact deduplication
- ✅ Automatic job creation

**What You Need**:
- Access to CRM API
- Validation rules
- Deduplication logic

**Note**: CRM can handle this directly for now

---

### Agent 4: Monitoring Agent (RECOMMENDED FOR PRODUCTION)
**Covers**:
- ✅ System health monitoring
- ✅ Failure alerts
- ✅ AI cost tracking
- ✅ Performance reports

**What You Need**:
- Read access to database
- Alerting service (PagerDuty, Slack, email)
- Cost tracking

---

## 🚨 BLOCKERS IF NOT CONFIGURED

| Missing Config | What Breaks |
|----------------|-------------|
| DATABASE_URL | All data lost on restart |
| AGENT_WEBHOOK_URL | Cannot send emails, WhatsApp, payments |
| AGENT_INTERNAL_TOKEN | Agent gateway authentication fails |
| Twilio | No WhatsApp, SMS, or voice |
| SendGrid/Resend | No email sending |
| Stripe | No payment processing |
| Google Cloud | No calendar integration |

---

## ✅ VERIFICATION CHECKLIST

After setup, verify each component:

```bash
# 1. Check system health
curl http://localhost:5000/internal/health

# Expected response:
{
  "status": "ok",
  "database": "connected",
  "agent": "configured",
  "openai": "configured",
  "redis": "connected"
}

# 2. Test database connection
npm run db:push

# 3. Test agent gateway
curl -X POST $AGENT_WEBHOOK_URL/execute/task \
  -H "Authorization: Bearer $AGENT_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 4. Start mock gateway for testing
npm run mock-gateway

# 5. Verify OpenAI
curl https://your-repl.replit.dev/api/health | grep ai_agent
```

---

## 📞 NEED HELP?

**Full Audit Document**: [SYSTEM_AUDIT_COMPLETE.md](./SYSTEM_AUDIT_COMPLETE.md)  
**Main README**: [README.md](./README.md)  
**Environment Example**: [.env.example](./.env.example)

**Key Files**:
- Agent contracts: `server/agent-contracts.ts`
- Agent dispatcher: `server/agent-dispatcher.ts`
- Outbox worker: `server/outbox-worker.ts`
- Mock gateway: `server/mock-agent-gateway.ts`

---

## 🎯 BOTTOM LINE

**What You MUST Do This Week**:
1. Set up PostgreSQL (30 min)
2. Build/Deploy Agent Gateway (8-12 hours)
3. Configure Twilio (1-2 hours)
4. Configure Email Service (1-2 hours)

**Total Time**: ~15-18 hours  
**Total Cost**: $6-35/month (minimum)

**After This, System Can**:
- ✅ Store data persistently
- ✅ Send WhatsApp messages
- ✅ Send emails
- ✅ Generate payment links
- ✅ Execute all external actions

**Everything else is optional** but recommended for full feature set.

---

*Generated from comprehensive system audit*  
*April 20, 2026*
