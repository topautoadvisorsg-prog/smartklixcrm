# 📧 Mass Email Campaign Module - Setup Guide

## ✅ What's Been Built

### Backend Components:
1. **Database Schema** (`shared/schema.ts`)
   - `campaigns` table - stores campaign details
   - `campaign_recipients` table - tracks each email sent
   - `email_templates` table - reusable email templates

2. **Email Service** (`server/email-service.ts`)
   - Resend integration (can swap for Brevo/Mailgun)
   - Batch sending support (50 emails per batch)
   - Error handling and logging

3. **Campaign Service** (`server/campaign-service.ts`)
   - Campaign creation with contact filtering
   - Queue-based processing (no blocking)
   - Real-time status tracking
   - Automatic retry logic

4. **API Routes** (`server/routes.ts`)
   - `POST /api/campaigns` - Create & send campaign
   - `GET /api/campaigns` - List all campaigns
   - `GET /api/campaigns/:id` - Get campaign stats
   - `GET /api/campaigns/:id/recipients` - Get recipient list
   - `POST /api/email-templates` - Create template
   - `GET /api/email-templates` - List templates

## 🔧 Setup Steps

### 1. Install Dependencies
```bash
npm install resend  # ✅ Already done
```

### 2. Add Environment Variables
Add to your `.env` file:
```env
# Email Provider (Resend)
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Smart Klix CRM
```

**Get Resend API Key:**
1. Go to https://resend.com
2. Sign up (free tier: 3,000 emails/month, 100 emails/day)
3. Get API key from dashboard
4. Verify your domain (required for production)

### 3. Push Database Schema
```bash
npm run db:push
```

This will create:
- `campaigns` table
- `campaign_recipients` table
- `email_templates` table

### 4. Restart Dev Server
```bash
npm run dev
```

## 📡 API Usage Examples

### Create Email Campaign
```bash
POST /api/campaigns
{
  "name": "Weekly Newsletter - Jan 2025",
  "subject": "Your Weekly Update from Smart Klix",
  "body": "<h1>Hello!</h1><p>Here's your weekly update...</p>",
  "filters": {
    "tags": ["newsletter"],
    "customerType": "lead",
    "hasEmail": true
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Weekly Newsletter - Jan 2025",
  "status": "queued",
  "totalRecipients": 150,
  "createdAt": "2025-01-..."
}
```

### Check Campaign Status
```bash
GET /api/campaigns/:id
```

**Response:**
```json
{
  "id": "uuid",
  "status": "sending",
  "totalRecipients": 150,
  "stats": {
    "total": 150,
    "pending": 80,
    "sent": 70,
    "failed": 0
  }
}
```

### Get Campaign Recipients
```bash
GET /api/campaigns/:id/recipients
```

## 🎯 Available Filters

When creating a campaign, you can filter contacts by:

```json
{
  "filters": {
    "tags": ["vip", "follow_up"],      // Contact tags
    "customerType": "lead",             // lead, customer, prospect
    "status": "qualified",              // new, contacted, qualified, etc.
    "niche": "healthcare",              // Industry niche
    "hasEmail": true                    // Only contacts with email
  }
}
```

## 🚀 How It Works

1. **User creates campaign** via API/UI with filters + email content
2. **System resolves recipients** - queries contacts matching filters
3. **Campaign queued** - added to processing queue
4. **Worker processes** - sends emails one-by-one (100ms delay between each)
5. **Results logged** - each recipient tracked (sent/failed/error)
6. **Status updated** - campaign marked complete when done

## ⚡ Performance

- **Batch size**: 50 emails per API call to Resend
- **Rate limiting**: 100ms delay between sends (avoid provider limits)
- **Queue-based**: Non-blocking, runs in background
- **Scalable**: Can handle thousands of contacts

## 📊 Tracking

Every email is tracked in `campaign_recipients`:
- `status`: pending, sent, failed, bounced
- `providerMessageId`: Resend message ID for delivery tracking
- `error`: Error message if failed
- `sentAt`: Timestamp when sent

## 🔄 Next Steps (Optional)

1. **Build UI** - Campaign creation page with contact selector
2. **Add webhooks** - Receive delivery/bounce events from Resend
3. **Email templates** - Pre-built templates with placeholders
4. **Analytics** - Open rate, click tracking (requires Resend upgrade)
5. **Scheduling** - Delay campaign start time

## 🚫 Out of Scope (As Requested)

- ❌ AI decision making
- ❌ Automated follow-up sequences
- ❌ Smart personalization
- ❌ Multi-step workflows
- ❌ Complex scheduling

## 💡 Notes

- Campaigns process automatically after creation
- No manual worker start needed
- All logging goes to server console
- Failed emails don't stop the campaign (continues with next recipient)
- Can run multiple campaigns simultaneously (queued)
