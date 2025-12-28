import { storage } from "./storage";
import { dispatchIntakeToNeo8Flow } from "./neo8-events";
import type { EventsOutbox } from "@shared/schema";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const POLL_INTERVAL_MS = 10000;

let isRunning = false;
let pollTimeoutId: NodeJS.Timeout | null = null;

function calculateBackoffDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 60000);
}

async function processOutboxEntry(entry: EventsOutbox): Promise<void> {
  const { id, tenantId, payload, retryCount } = entry;
  
  console.log(`[OutboxDispatcher] Processing entry ${id}, retry ${retryCount}/${MAX_RETRIES}`);

  try {
    const result = await dispatchIntakeToNeo8Flow(
      id,
      tenantId,
      payload as Record<string, unknown>
    );

    if (result.success) {
      await storage.updateEventsOutboxForRetry(
        id,
        retryCount,
        'dispatched',
        new Date(),
        undefined
      );
      console.log(`[OutboxDispatcher] Entry ${id} dispatched successfully`);
    } else {
      await handleDispatchFailure(entry, result.error || 'Unknown dispatch error');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await handleDispatchFailure(entry, errorMessage);
  }
}

async function handleDispatchFailure(entry: EventsOutbox, errorMessage: string): Promise<void> {
  const { id, retryCount } = entry;
  const newRetryCount = retryCount + 1;

  if (newRetryCount >= MAX_RETRIES) {
    await storage.updateEventsOutboxForRetry(
      id,
      newRetryCount,
      'dead_letter',
      undefined,
      `Max retries exceeded. Last error: ${errorMessage}`
    );
    console.error(`[OutboxDispatcher] Entry ${id} moved to dead-letter queue after ${MAX_RETRIES} retries`);
    
    await storage.createAuditLogEntry({
      action: 'outbox.dead_letter',
      entityType: 'events_outbox',
      entityId: id,
      details: {
        retryCount: newRetryCount,
        errorMessage,
      },
    });
  } else {
    await storage.updateEventsOutboxForRetry(
      id,
      newRetryCount,
      'retry',
      undefined,
      errorMessage
    );
    console.warn(`[OutboxDispatcher] Entry ${id} scheduled for retry ${newRetryCount}/${MAX_RETRIES}`);
  }
}

async function processPendingEntries(): Promise<number> {
  const entries = await storage.getPendingEventsOutbox(10);
  
  if (entries.length === 0) {
    return 0;
  }

  console.log(`[OutboxDispatcher] Found ${entries.length} pending entries`);

  for (const entry of entries) {
    if (entry.retryCount > 0) {
      const delay = calculateBackoffDelay(entry.retryCount);
      const lastUpdate = entry.dispatchedAt || entry.createdAt;
      const timeSinceLastAttempt = Date.now() - lastUpdate.getTime();
      
      if (timeSinceLastAttempt < delay) {
        console.log(`[OutboxDispatcher] Entry ${entry.id} waiting for backoff (${Math.ceil((delay - timeSinceLastAttempt) / 1000)}s remaining)`);
        continue;
      }
    }

    await processOutboxEntry(entry);
  }

  return entries.length;
}

async function pollLoop(): Promise<void> {
  if (!isRunning) return;

  try {
    await processPendingEntries();
  } catch (error) {
    console.error('[OutboxDispatcher] Error in poll loop:', error);
  }

  if (isRunning) {
    pollTimeoutId = setTimeout(pollLoop, POLL_INTERVAL_MS);
  }
}

export function startOutboxDispatcher(): void {
  if (isRunning) {
    console.log('[OutboxDispatcher] Already running');
    return;
  }

  isRunning = true;
  console.log('[OutboxDispatcher] Starting outbox dispatcher worker');
  pollLoop();
}

export function stopOutboxDispatcher(): void {
  if (!isRunning) {
    console.log('[OutboxDispatcher] Not running');
    return;
  }

  isRunning = false;
  if (pollTimeoutId) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
  console.log('[OutboxDispatcher] Stopped outbox dispatcher worker');
}

export function isOutboxDispatcherRunning(): boolean {
  return isRunning;
}
