/**
 * Campaign Analytics Service - Performance tracking and reporting
 */

import { db } from './db';
import { campaigns, campaignRecipients } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { log } from './vite';

export interface CampaignAnalytics {
  campaignId: string;
  name: string;
  status: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  failureRate: number;
  topClickedUrls: Array<{ url: string; count: number }>;
}

export class CampaignAnalyticsService {
  private static instance: CampaignAnalyticsService;

  static getInstance(): CampaignAnalyticsService {
    if (!CampaignAnalyticsService.instance) {
      CampaignAnalyticsService.instance = new CampaignAnalyticsService();
    }
    return CampaignAnalyticsService.instance;
  }

  /**
   * Get comprehensive analytics for a single campaign
   */
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    if (!db) return null;
    const [campaign] = await db.select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) return null;

    // Get recipient stats
    const stats = await db.select({
      total: sql<number>`count(*)`,
      sent: sql<number>`count(*) filter (where status in ('sent', 'delivered'))`,
      delivered: sql<number>`count(*) filter (where status = 'delivered')`,
      opened: sql<number>`count(*) filter (where metadata->>'first_opened_at' IS NOT NULL)`,
      clicked: sql<number>`count(*) filter (where jsonb_array_length(COALESCE(metadata->'clicks', '[]'::jsonb)) > 0)`,
      bounced: sql<number>`count(*) filter (where status in ('bounced', 'soft_bounced'))`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      complained: sql<number>`count(*) filter (where status = 'complained')`,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

    const { total, sent, delivered, opened, clicked, bounced, failed } = stats[0];

    // Calculate rates
    const deliveryRate = delivered > 0 ? (delivered / total) * 100 : 0;
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
    const clickRate = delivered > 0 ? (clicked / delivered) * 100 : 0;
    const bounceRate = total > 0 ? (bounced / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    // Get top clicked URLs
    const topClickedUrls = await this.getTopClickedUrls(campaignId);

    return {
      campaignId,
      name: campaign.name,
      status: campaign.status,
      totalRecipients: total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      topClickedUrls,
    };
  }

  /**
   * Get top clicked URLs for a campaign
   */
  private async getTopClickedUrls(campaignId: string): Promise<Array<{ url: string; count: number }>> {
    if (!db) return [];
    const recipients = await db.select({
      metadata: campaignRecipients.metadata,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

    const urlCounts: Record<string, number> = {};

    recipients.forEach(recipient => {
      const meta = recipient.metadata as any;
      if (meta?.clicks && Array.isArray(meta.clicks)) {
        meta.clicks.forEach((click: any) => {
          if (click.url) {
            urlCounts[click.url] = (urlCounts[click.url] || 0) + 1;
          }
        });
      }
    });

    // Sort by count and return top 10
    return Object.entries(urlCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));
  }

  /**
   * Get analytics for all campaigns
   */
  async getAllCampaignsAnalytics(): Promise<Array<{
    id: string;
    name: string;
    status: string;
    totalRecipients: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    createdAt: Date;
  }>> {
    if (!db) return [];
    const allCampaigns = await db.select()
      .from(campaigns)
      .orderBy(sql`${campaigns.createdAt} DESC`);

    const analyticsPromises = allCampaigns.map(async (campaign) => {
      const stats = await db.select({
        total: sql<number>`count(*)`,
        delivered: sql<number>`count(*) filter (where status = 'delivered')`,
        opened: sql<number>`count(*) filter (where metadata->>'first_opened_at' IS NOT NULL)`,
        clicked: sql<number>`count(*) filter (where jsonb_array_length(COALESCE(metadata->'clicks', '[]'::jsonb)) > 0)`,
      })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaign.id));

      const { total, delivered, opened, clicked } = stats[0];

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: total,
        deliveryRate: delivered > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
        clickRate: delivered > 0 ? Math.round((clicked / delivered) * 10000) / 100 : 0,
        createdAt: campaign.createdAt,
      };
    });

    return Promise.all(analyticsPromises);
  }

  /**
   * Get recipient-level details for a campaign
   */
  async getRecipientDetails(campaignId: string) {
    if (!db) return [];
    return await db.select({
      id: campaignRecipients.id,
      email: campaignRecipients.email,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
      metadata: campaignRecipients.metadata,
      error: campaignRecipients.error,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.createdAt);
  }

  /**
   * Get contact email engagement history
   */
  async getContactEngagement(contactId: string) {
    if (!db) return [];
    return await db.select({
      campaignId: campaignRecipients.campaignId,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
      metadata: campaignRecipients.metadata,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.contactId, contactId))
    .orderBy(campaignRecipients.createdAt);
  }
}

export const campaignAnalyticsService = CampaignAnalyticsService.getInstance();
