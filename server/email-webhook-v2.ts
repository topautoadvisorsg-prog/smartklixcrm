/**
 * Email Webhook Handler v2 - With Fallback Correlation + State Protection
 * 
 * CORRELATION STRATEGY (3-tier fallback):
 * 1. recipientId from tags (primary)
 * 2. providerMessageId lookup (fallback)
 * 3. email + campaignId combination (last resort)
 * 
 * STATE PROTECTION:
 * - Never allows status to move backwards
 * - Prevents analytics corruption from late/delayed webhooks
 */

import { db } from './db';
import { campaignRecipients, contacts } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { log } from './vite';
import { isValidTransition, getStatusDescription } from './webhook-state-protection';

export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    bounce?: {
      bounce_type: string;
      bounce_sub_type: string;
      diagnostic_code: string;
    };
    failed_at?: string;
    delivered_at?: string;
    opened_at?: string;
    clicked_at?: string;
    url?: string;
  };
}

export class EmailWebhookHandler {
  /**
   * Process incoming webhook event from Resend
   */
  async handleEvent(event: ResendWebhookEvent): Promise<void> {
    const { type, data } = event;
    const emailId = data.email_id;
    const recipientEmail = data.to[0];

    // Extract tracking metadata from tags
    const tags = data.tags || [];
    const campaignId = tags.find(t => t.name === 'campaignId')?.value;
    let recipientId = tags.find(t => t.name === 'recipientId')?.value;
    const contactId = tags.find(t => t.name === 'contactId')?.value;

    log(`📧 Webhook event: ${type} for ${recipientEmail}`);

    // FALLBACK CORRELATION: If no recipientId, try other methods
    if (!recipientId) {
      log(`⚠️  No recipientId in tags, attempting fallback correlation...`);
      recipientId = await this.fallbackCorrelate(emailId, recipientEmail, campaignId);
      
      if (!recipientId) {
        log(`❌ Orphan webhook event: ${type} for ${recipientEmail} (no correlation possible)`);
        return;
      }
      
      log(`✅ Fallback correlation successful: ${recipientId}`);
    }

    try {
      switch (type) {
        case 'email.sent':
          await this.handleSent(recipientId, emailId, event.created_at);
          break;

        case 'email.delivered':
          await this.handleDelivered(recipientId, event.created_at);
          break;

        case 'email.opened':
          await this.handleOpened(recipientId, event.created_at);
          break;

        case 'email.clicked':
          await this.handleClicked(recipientId, data.url || '', event.created_at);
          break;

        case 'email.bounced':
          await this.handleBounced(recipientId, recipientEmail, data.bounce, event.created_at);
          break;

        case 'email.complained':
          await this.handleComplained(recipientId, event.created_at);
          break;

        case 'email.delivery_delayed':
          await this.handleDelayed(recipientId, event.created_at);
          break;

        default:
          log(`⚠️  Unhandled webhook event type: ${type}`);
      }
    } catch (error: any) {
      log(`❌ Error processing webhook event ${type}: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * FALLBACK CORRELATION: Try multiple strategies to find recipient
   */
  private async fallbackCorrelate(
    emailId: string,
    email: string,
    campaignId?: string
  ): Promise<string | null> {
    if (!db) return null;

    // Strategy 1: Try providerMessageId
    if (emailId) {
      const byProviderId = await db.select({ id: campaignRecipients.id })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.providerMessageId, emailId))
        .limit(1);

      if (byProviderId.length > 0) {
        log(`  ✓ Correlated by providerMessageId`);
        return byProviderId[0].id;
      }
    }

    // Strategy 2: Try email + campaignId combination
    if (email && campaignId) {
      const byEmailCampaign = await db.select({ id: campaignRecipients.id })
        .from(campaignRecipients)
        .where(and(
          eq(campaignRecipients.email, email),
          eq(campaignRecipients.campaignId, campaignId),
        ))
        .limit(1);

      if (byEmailCampaign.length > 0) {
        log(`  ✓ Correlated by email + campaignId`);
        return byEmailCampaign[0].id;
      }
    }

    // Strategy 3: Try email alone (risky but better than nothing)
    if (email) {
      const byEmail = await db.select({ id: campaignRecipients.id })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.email, email))
        .orderBy(sql`${campaignRecipients.createdAt} DESC`)
        .limit(1);

      if (byEmail.length > 0) {
        log(`  ⚠️  Correlated by email only (LOW CONFIDENCE)`);
        return byEmail[0].id;
      }
    }

    return null;
  }

  /**
   * Email sent successfully to provider
   */
  private async handleSent(recipientId: string, emailId: string, timestamp: string): Promise<void> {
    if (!db) return;

    // STATE PROTECTION: Check current status
    const current = await db.select({ status: campaignRecipients.status })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (current.length === 0) return;

    if (!isValidTransition(current[0].status, 'sent')) {
      log(`⏭️  Skipping 'sent' - current status '${current[0].status}' is ahead`);
      return;
    }

    await db.update(campaignRecipients)
      .set({
        status: 'sent',
        providerMessageId: emailId,
        sentAt: new Date(timestamp),
      })
      .where(eq(campaignRecipients.id, recipientId));

    log(`✅ Email sent`);
  }

  /**
   * Email delivered to recipient's inbox
   */
  private async handleDelivered(recipientId: string, timestamp: string): Promise<void> {
    if (!db) return;

    // STATE PROTECTION
    const current = await db.select({ status: campaignRecipients.status })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (current.length === 0) return;

    if (!isValidTransition(current[0].status, 'delivered')) {
      log(`⏭️  Skipping 'delivered' - current status '${current[0].status}' is ahead`);
      return;
    }

    await db.update(campaignRecipients)
      .set({
        status: 'delivered',
      })
      .where(eq(campaignRecipients.id, recipientId));

    log(`📬 Email delivered`);
  }

  /**
   * Email opened by recipient
   */
  private async handleOpened(recipientId: string, timestamp: string): Promise<void> {
    if (!db) return;

    const recipient = await db.select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (recipient.length === 0) return;

    const currentMeta = recipient[0].metadata as any || {};
    const openCount = currentMeta.open_count || 0;

    await db.update(campaignRecipients)
      .set({
        metadata: {
          ...currentMeta,
          open_count: openCount + 1,
          first_opened_at: currentMeta.first_opened_at || timestamp,
          last_opened_at: timestamp,
        },
      })
      .where(eq(campaignRecipients.id, recipientId));

    log(`👁️  Email opened (Count: ${openCount + 1})`);
  }

  /**
   * Link clicked in email
   */
  private async handleClicked(
    recipientId: string,
    url: string,
    timestamp: string
  ): Promise<void> {
    if (!db) return;

    const recipient = await db.select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (recipient.length === 0) return;

    const currentMeta = recipient[0].metadata as any || {};
    const clicks = currentMeta.clicks || [];

    await db.update(campaignRecipients)
      .set({
        metadata: {
          ...currentMeta,
          clicks: [...clicks, { url, clicked_at: timestamp }],
        },
      })
      .where(eq(campaignRecipients.id, recipientId));

    log(`🖱️  Link clicked -> ${url}`);
  }

  /**
   * Email bounced (hard or soft)
   */
  private async handleBounced(
    recipientId: string,
    email: string,
    bounce: any,
    timestamp: string
  ): Promise<void> {
    if (!db) return;

    const isHardBounce = bounce?.bounce_type === 'hard' || bounce?.bounce_type === 'permanent';
    const newStatus = isHardBounce ? 'bounced' : 'soft_bounced';

    // STATE PROTECTION
    const current = await db.select({ status: campaignRecipients.status })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (current.length === 0) return;

    // Bounce states are terminal (99), always allow
    if (!isValidTransition(current[0].status, newStatus)) {
      log(`⏭️  Skipping '${newStatus}' - current status '${current[0].status}' is ahead`);
      return;
    }

    await db.update(campaignRecipients)
      .set({
        status: newStatus,
        error: bounce?.diagnostic_code || 'Bounced',
        metadata: {
          bounce_type: bounce?.bounce_type,
          bounce_sub_type: bounce?.bounce_sub_type,
          bounced_at: timestamp,
        },
      })
      .where(eq(campaignRecipients.id, recipientId));

    // If hard bounce, mark contact email as invalid
    if (isHardBounce) {
      const contact = await db.select()
        .from(contacts)
        .where(eq(contacts.email, email))
        .limit(1);

      if (contact.length > 0) {
        const currentMeta = contact[0].metadata as any || {};
        await db.update(contacts)
          .set({
            metadata: {
              ...currentMeta,
              email_status: 'invalid',
            },
          })
          .where(eq(contacts.id, contact[0].id!));

        log(`🚫 Hard bounce - marked contact ${email} as invalid`);
      }
    } else {
      log(`⚠️  Soft bounce for ${email}`);
    }
  }

  /**
   * Recipient marked email as spam
   */
  private async handleComplained(recipientId: string, timestamp: string): Promise<void> {
    if (!db) return;

    // STATE PROTECTION
    const current = await db.select({ status: campaignRecipients.status })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);

    if (current.length === 0) return;

    if (!isValidTransition(current[0].status, 'complained')) {
      log(`⏭️  Skipping 'complained' - current status '${current[0].status}' is ahead`);
      return;
    }

    await db.update(campaignRecipients)
      .set({
        status: 'complained',
        metadata: sql`jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{complained_at}',
          to_jsonb(${timestamp}::text)
        )`,
      })
      .where(eq(campaignRecipients.id, recipientId));

    log(`🚨 Spam complaint`);
  }

  /**
   * Email delivery delayed
   */
  private async handleDelayed(recipientId: string, timestamp: string): Promise<void> {
    log(`⏳ Email delayed`);
  }
}

export const emailWebhookHandler = new EmailWebhookHandler();
