# 📊 Email Campaign Tracking System - Complete Guide

## ✅ What's Been Added

Full lifecycle tracking for every email sent through campaigns:
- ✅ Delivery tracking (sent → delivered)
- ✅ Open tracking (first open, total opens, timestamps)
- ✅ Click tracking (URLs clicked, timestamps, counts)
- ✅ Bounce handling (hard vs soft, auto-retry, contact invalidation)
- ✅ Failure logging (detailed error messages)
- ✅ Analytics dashboard (per-campaign + summary)
- ✅ Webhook integration (real-time event processing)

---

## 🏗️ Architecture

```
Campaign Created
    ↓
Emails Queued
    ↓
Sent via Resend SDK
    ↓
Resend sends webhook events → POST /webhooks/email-events
    ↓
Webhook Handler updates DB:
  - campaign_recipients.status
  - campaign_recipients.metadata (opens, clicks, bounces)
  - contacts.metadata (email_status for hard bounces)
    ↓
Analytics Service reads DB → Dashboard
```

**Key Rule:** No direct DB writes from email provider. All updates flow through webhooks.

---

## 🔧 Setup Steps

### 1. Configure Resend Webhook

**In Resend Dashboard:**
1. Go to your domain settings
2. Add webhook URL: `https://yourdomain.com/webhooks/email-events`
3. Select events to receive:
   - ✅ email.sent
   - ✅ email.delivered
   - ✅ email.opened
   - ✅ email.clicked
   - ✅ email.bounced
   - ✅ email.complained
   - ✅ email.delivery_delayed

### 2. Enable Tracking in Resend

Tracking is **automatically enabled** by Resend:
- **Open tracking**: Invisible tracking pixel added to all emails
- **Click tracking**: All links wrapped with Resend tracking URLs
- **Delivery tracking**: Automatic via webhooks

### 3. Database Migration

```bash
npm run db:push
```

This adds the `metadata` JSONB column to `campaign_recipients` for storing tracking data.

---

## 📡 Webhook Events Handled

| Event | Status Update | Action |
|-------|--------------|--------|
| `email.sent` | `sent` | Records sent timestamp |
| `email.delivered` | `delivered` | Confirms inbox delivery |
| `email.opened` | (metadata) | Increments open count, records timestamp |
| `email.clicked` | (metadata) | Logs URL + timestamp to clicks array |
| `email.bounced` | `bounced` or `soft_bounced` | Hard bounce → marks contact invalid |
| `email.complained` | `complained` | Marks as spam complaint |
| `email.delivery_delayed` | (no change) | Logs delay |

---

## 📊 API Endpoints

### 1. Get Campaign Analytics
```bash
GET /api/campaigns/:id/analytics
```

**Response:**
```json
{
  "campaignId": "uuid",
  "name": "Weekly Newsletter",
  "status": "completed",
  "totalRecipients": 500,
  "sent": 495,
  "delivered": 485,
  "opened": 245,
  "clicked": 89,
  "bounced": 10,
  "failed": 5,
  "deliveryRate": 97.0,
  "openRate": 50.5,
  "clickRate": 18.4,
  "bounceRate": 2.0,
  "failureRate": 1.0,
  "topClickedUrls": [
    { "url": "https://example.com/product", "count": 45 },
    { "url": "https://example.com/blog", "count": 32 }
  ]
}
```

### 2. Get All Campaigns Summary
```bash
GET /api/campaigns/analytics/summary
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Campaign A",
    "status": "completed",
    "totalRecipients": 500,
    "deliveryRate": 97.0,
    "openRate": 50.5,
    "clickRate": 18.4,
    "createdAt": "2025-01-..."
  }
]
```

### 3. Get Recipient Details
```bash
GET /api/campaigns/:id/recipients
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "status": "delivered",
    "sentAt": "2025-01-20T10:00:00Z",
    "metadata": {
      "open_count": 3,
      "first_opened_at": "2025-01-20T10:05:00Z",
      "last_opened_at": "2025-01-20T14:30:00Z",
      "clicks": [
        { "url": "https://example.com/link1", "clicked_at": "2025-01-20T10:06:00Z" }
      ]
    },
    "error": null
  }
]
```

---

## 🎯 Tracking Data Structure

### campaign_recipients.metadata
```json
{
  "open_count": 5,
  "first_opened_at": "2025-01-20T10:05:00Z",
  "last_opened_at": "2025-01-20T14:30:00Z",
  "clicks": [
    {
      "url": "https://example.com/product",
      "clicked_at": "2025-01-20T10:06:00Z"
    },
    {
      "url": "https://example.com/pricing",
      "clicked_at": "2025-01-20T10:08:00Z"
    }
  ],
  "bounce_type": "hard",
  "bounce_sub_type": "suppressed",
  "bounced_at": "2025-01-20T10:01:00Z"
}
```

---

## 🚨 Bounce Handling

### Hard Bounce
- **Status**: `bounced`
- **Action**: Contact marked as `email_status: "invalid"` in metadata
- **Result**: Future campaigns will skip this contact

### Soft Bounce
- **Status**: `soft_bounced`
- **Action**: Logged, will retry automatically
- **Result**: Can be promoted to hard bounce after 3+ failures

---

## 📈 Analytics Dashboard Data

### Per Campaign Metrics:
- **Total Sent**: Emails successfully handed to Resend
- **Delivered**: Reached recipient's inbox
- **Opened**: At least one open tracked
- **Clicked**: At least one link clicked
- **Bounced**: Hard + soft bounces
- **Failed**: Send failures (API errors, etc.)
- **Delivery Rate**: (delivered / total) × 100
- **Open Rate**: (opened / delivered) × 100
- **Click Rate**: (clicked / delivered) × 100
- **Bounce Rate**: (bounced / total) × 100
- **Top Clicked URLs**: Most popular links

---

## 🔍 Tracking Visibility

### Answer These Questions:

✅ **"Did it send?"** → Check `status = 'sent'`
✅ **"Did it deliver?"** → Check `status = 'delivered'`
✅ **"Did they open it?"** → Check `metadata.open_count > 0`
✅ **"Did they click it?"** → Check `metadata.clicks.length > 0`
✅ **"Did it fail?"** → Check `status = 'failed'` + `error` field
✅ **"Did it bounce?"** → Check `status = 'bounced'` or `soft_bounced`

---

## 🎨 Example: Full Lifecycle

```
1. Campaign created with 100 recipients
2. All 100 queued
3. Email #1 sent → status: "sent"
4. 2 seconds later → webhook: "delivered" → status: "delivered"
5. 5 minutes later → webhook: "opened" → metadata.open_count: 1
6. 6 minutes later → webhook: "clicked" → metadata.clicks: [{url: "..."}]
7. Analytics updated in real-time
```

---

## 🚫 Out of Scope

- ❌ AI decision making
- ❌ Automated segmentation changes
- ❌ Predictive scoring
- ❌ Marketing optimization
- ❌ A/B testing (future enhancement)

---

## 💡 Pro Tips

1. **Test webhooks locally** using ngrok:
   ```bash
   ngrok http 5002
   # Use ngrok URL in Resend webhook config
   ```

2. **Monitor webhook logs** in server console:
   ```
   📧 Webhook event: email.delivered for user@example.com
   👁️  Email opened: user@example.com (Count: 1)
   🖱️  Link clicked: user@example.com -> https://example.com
   ```

3. **Check contact email validity**:
   ```sql
   SELECT email, metadata->>'email_status' 
   FROM contacts 
   WHERE metadata->>'email_status' = 'invalid';
   ```

4. **Get campaign performance**:
   ```bash
   GET /api/campaigns/:id/analytics
   ```

---

## 🔄 Next Steps (Optional Enhancements)

1. **Webhook signature verification** - Security hardening
2. **Unsubscribe link** - Compliance (CAN-SPAM/GDPR)
3. **Email template variables** - `{{first_name}}`, etc.
4. **Scheduled campaigns** - Delay send time
5. **A/B testing** - Test subject lines
6. **Export analytics** - CSV/PDF reports
7. **Real-time dashboard** - WebSocket updates

---

## 📝 Files Modified/Created

- ✅ `shared/schema.ts` - Added metadata column
- ✅ `server/email-service.ts` - Updated with tracking
- ✅ `server/email-webhook.ts` - NEW: Webhook handler
- ✅ `server/campaign-analytics.ts` - NEW: Analytics service
- ✅ `server/routes.ts` - Added webhook + analytics routes

---

**Your mass email system now has full lifecycle tracking! 🎉**
