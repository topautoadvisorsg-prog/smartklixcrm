/**
 * Campaign Service - Bulk email campaign management
 * Handles campaign creation, recipient resolution, and queue-based sending
 */

import { db } from './db';
import { campaigns, campaignRecipients, contacts } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { emailService } from './email-service';
import { campaignQueue } from './campaign-queue';
import { log } from './vite';

export interface CampaignFilters {
  tags?: string[];
  customerType?: string;
  status?: string;
  niche?: string;
  hasEmail?: boolean;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  body: string;
  filters: CampaignFilters;
  createdBy?: string;
}

export class CampaignService {
  private static instance: CampaignService;

  static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  /**
   * Create campaign and resolve recipients
   */
  async createCampaign(input: CreateCampaignInput) {
    if (!db) throw new Error("Database not connected");
    log(`📧 Creating campaign: ${input.name}`);

    // Query contacts based on filters
    const recipients = await this.resolveRecipients(input.filters);

    if (recipients.length === 0) {
      throw new Error('No contacts match the selected filters');
    }

    log(`✅ Found ${recipients.length} recipients`);

    // Create campaign
    const [campaign] = await db!.insert(campaigns).values({
      name: input.name,
      subject: input.subject,
      body: input.body,
      filters: input.filters as any,
      createdBy: input.createdBy,
      status: 'queued',
      totalRecipients: recipients.length,
    }).returning();

    // Create recipient records
    const recipientRecords = recipients.map(contact => ({
      campaignId: campaign.id,
      contactId: contact.id!,
      email: contact.email!,
    }));

    await db!.insert(campaignRecipients).values(recipientRecords);

    log(`📋 Campaign ${campaign.id} queued with ${recipients.length} recipients`);

    // Add to durable queue (database-backed)
    await campaignQueue.enqueue(campaign.id);

    return campaign;
  }

  /**
   * Resolve contacts based on filters
   */
  private async resolveRecipients(filters: CampaignFilters) {
    // Build conditions array for proper AND logic
    const conditions: any[] = [
      sql`${contacts.email} IS NOT NULL`,
      sql`${contacts.email} != ''`,
      sql`${contacts.deletedAt} IS NULL`,
      // Exclude invalid/bounced emails
      sql`COALESCE(${contacts.metadata}->>'email_status', 'valid') != 'invalid'`,
    ];

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(
        sql`${contacts.tags} && ARRAY[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]::text[]`
      );
    }

    if (filters.customerType) {
      conditions.push(eq(contacts.customerType, filters.customerType));
    }

    if (filters.status) {
      conditions.push(eq(contacts.status, filters.status));
    }

    if (filters.niche) {
      conditions.push(eq(contacts.niche, filters.niche));
    }

    // Combine all conditions with AND
    return await db!.select()
      .from(contacts)
      .where(and(...conditions));
  }

  /**
   * Process single campaign - send emails to all recipients
   */
  private async processCampaign(campaignId: string) {
    log(`🚀 Processing campaign: ${campaignId}`);

    try {
      // Update campaign status
      await db!.update(campaigns)
        .set({ status: 'sending', startedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      // Get pending recipients
      const recipients = await db!.select()
        .from(campaignRecipients)
        .where(and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, 'pending')
        ));

      // Get campaign details
      const [campaign] = await db!.select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));

      // Send emails in batches
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        try {
          const result = await emailService.send({
            to: recipient.email,
            subject: campaign.subject,
            html: campaign.body,
            // Pass tracking metadata for webhook correlation
            metadata: {
              campaignId: campaignId,
              recipientId: recipient.id,
              contactId: recipient.contactId,
            },
          });

          if (result.success) {
            await db!.update(campaignRecipients)
              .set({
                status: 'sent',
                providerMessageId: result.messageId,
                sentAt: new Date(),
              })
              .where(eq(campaignRecipients.id, recipient.id));
            sentCount++;
          } else {
            await db!.update(campaignRecipients)
              .set({
                status: 'failed',
                error: result.error,
              })
              .where(eq(campaignRecipients.id, recipient.id));
            failedCount++;
          }
        } catch (error: any) {
          log(`❌ Failed to send to ${recipient.email}: ${error.message}`);
          await db.update(campaignRecipients)
            .set({
              status: 'failed',
              error: error.message,
            })
            .where(eq(campaignRecipients.id, recipient.id));
          failedCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update campaign status
      await db!.update(campaigns)
        .set({
          status: 'completed',
          sentCount,
          failedCount,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));

      log(`✅ Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error: any) {
      log(`❌ Campaign ${campaignId} failed: ${error.message}`);
      await db.update(campaigns)
        .set({ status: 'failed' })
        .where(eq(campaigns.id, campaignId));
    }
  }

  /**
   * Get campaign with stats
   */
  async getCampaign(campaignId: string) {
    const [campaign] = await db.select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) return null;

    const stats = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      sent: sql<number>`count(*) filter (where status = 'sent')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

    return { ...campaign, stats: stats[0] };
  }

  /**
   * List all campaigns
   */
  async listCampaigns() {
    return await db.select()
      .from(campaigns)
      .orderBy(sql`${campaigns.createdAt} DESC`);
  }

  /**
   * Get campaign recipients
   */
  async getCampaignRecipients(campaignId: string) {
    return await db.select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId))
      .orderBy(campaignRecipients.createdAt);
  }
}

export const campaignService = CampaignService.getInstance();
