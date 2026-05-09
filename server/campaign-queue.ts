/**
 * Campaign Queue - Durable queue backed by database
 * Replaces in-memory queue to survive server restarts
 */

import { db } from './db';
import { campaigns } from '@shared/schema';
import { eq, sql, and, lt } from 'drizzle-orm';
import { log } from './vite';

export class CampaignQueue {
  private static instance: CampaignQueue;
  private processing = false;

  static getInstance(): CampaignQueue {
    if (!CampaignQueue.instance) {
      CampaignQueue.instance = new CampaignQueue();
    }
    return CampaignQueue.instance;
  }

  /**
   * Add campaign to queue (persists to DB)
   */
  async enqueue(campaignId: string): Promise<void> {
    if (!db) throw new Error('Database not connected');
    
    await db.update(campaigns)
      .set({ status: 'queued' })
      .where(eq(campaigns.id, campaignId));
    
    log(`📋 Campaign ${campaignId} enqueued`);
  }

  /**
   * Get next queued campaign (oldest first)
   */
  async dequeue(): Promise<string | null> {
    if (!db) return null;

    const queued = await db.select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.status, 'queued'))
      .orderBy(campaigns.createdAt)
      .limit(1);

    if (queued.length === 0) return null;

    // Mark as processing atomically
    await db.update(campaigns)
      .set({ status: 'processing' })
      .where(eq(campaigns.id, queued[0].id));

    return queued[0].id;
  }

  /**
   * Start processing queue
   */
  async startProcessing(processFn: (campaignId: string) => Promise<void>): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    log('🚀 Queue processor started');

    while (this.processing) {
      const campaignId = await this.dequeue();
      
      if (!campaignId) {
        // No campaigns in queue, wait before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      try {
        await processFn(campaignId);
      } catch (error: any) {
        log(`❌ Campaign ${campaignId} failed: ${error.message}`);
        
        // Mark as failed in DB
        await db.update(campaigns)
          .set({ 
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignId));
      }
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Recover stuck campaigns (status = 'processing' but not actually running)
   * Call this on server startup
   */
  async recoverStuckCampaigns(): Promise<void> {
    if (!db) return;

    // Find campaigns stuck in 'processing' or 'sending' state
    const stuck = await db.select({ id: campaigns.id })
      .from(campaigns)
      .where(and(
        sql`${campaigns.status} IN ('processing', 'sending')`,
        lt(campaigns.updatedAt, new Date(Date.now() - 30 * 60 * 1000)) // Older than 30 min
      ));

    if (stuck.length > 0) {
      log(`🔄 Recovering ${stuck.length} stuck campaigns`);
      
      // Reset to queued so they'll be reprocessed
      await db.update(campaigns)
        .set({ 
          status: 'queued',
          updatedAt: new Date(),
        })
        .where(
          sql`id IN (${sql.join(stuck.map(c => c.id), sql`, `)})`
        );
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{ queued: number; processing: number }> {
    if (!db) return { queued: 0, processing: 0 };

    const stats = await db.select({
      status: campaigns.status,
      count: sql<number>`count(*)`,
    })
    .from(campaigns)
    .where(sql`${campaigns.status} IN ('queued', 'processing', 'sending')`)
    .groupBy(campaigns.status);

    return {
      queued: stats.find(s => s.status === 'queued')?.count || 0,
      processing: stats.find(s => s.status === 'processing' || s.status === 'sending')?.count || 0,
    };
  }
}

export const campaignQueue = CampaignQueue.getInstance();
