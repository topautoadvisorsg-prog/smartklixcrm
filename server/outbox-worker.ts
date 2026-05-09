/**
 * Event Outbox Worker
 * 
 * Processes pending events from the outbox table with:
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Dead letter queue for permanent failures
 * 
 * This ensures reliable external dispatch even when the agent gateway is temporarily unavailable.
 */

import { storage } from "./storage";
import { dispatchToAgent, dispatchWhatsApp, dispatchEmail, dispatchPayment } from "./agent-dispatcher";
import { logger } from "./logger";

// ========================================
// CONFIGURATION
// ========================================

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 30000; // 30 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening circuit
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute before trying again
const POLL_INTERVAL_MS = 5000; // Check for pending events every 5 seconds
const DEAD_LETTER_MAX_RETRIES = 10;

// ========================================
// CIRCUIT BREAKER STATE
// ========================================

interface CircuitBreakerState {
  failures: number;
  lastFailureAt: Date | null;
  state: "closed" | "open" | "half-open";
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureAt: null,
  state: "closed",
};

// ========================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ========================================

function calculateBackoff(retryCount: number): number {
  const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function shouldRetry(retryCount: number, status: string): boolean {
  return retryCount < MAX_RETRIES && status !== "dead_letter";
}

// ========================================
// CIRCUIT BREAKER LOGIC
// ========================================

function recordSuccess() {
  circuitBreaker.failures = 0;
  circuitBreaker.state = "closed";
  circuitBreaker.lastFailureAt = null;
}

function recordFailure() {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureAt = new Date();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = "open";
    console.warn(
      `[Circuit Breaker] OPENED after ${circuitBreaker.failures} consecutive failures. ` +
      `Will retry in ${CIRCUIT_BREAKER_TIMEOUT_MS / 1000}s`
    );
  }
}

function isCircuitOpen(): boolean {
  if (circuitBreaker.state === "closed") {
    return false;
  }

  if (circuitBreaker.state === "open" && circuitBreaker.lastFailureAt) {
    const timeSinceFailure = Date.now() - circuitBreaker.lastFailureAt.getTime();
    if (timeSinceFailure >= CIRCUIT_BREAKER_TIMEOUT_MS) {
      // Transition to half-open: allow one test request
      circuitBreaker.state = "half-open";
      console.log("[Circuit Breaker] Transitioned to HALF-OPEN (testing recovery)");
      return false;
    }
  }

  return true;
}

// ========================================
// EVENT DISPATCHER
// ========================================

async function dispatchEvent(event: any): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const eventType = event.eventType as string;

  console.log(`[Outbox Worker] Dispatching event ${event.id} (type: ${eventType}, retry: ${event.retryCount})`);

  try {
    switch (eventType) {
      case "lead.created":
      case "lead.intake":
        // Lead intake events are processed via CRM sync callback
        // No dispatch needed, just mark as synced
        await storage.updateEventsOutboxStatus(event.id, "synced");
        recordSuccess();
        break;

      case "proposal.execute":
        await dispatchToAgent({
          proposalId: payload.proposalId as string,
          summary: (payload.summary as string) || "",
          actions: (payload.actions as any[]) || [],
          reasoning: (payload.reasoning as string) || "",
          approvedBy: payload.approvedBy as string,
          approvedAt: new Date(payload.approvedAt as string),
          relatedEntity: payload.relatedEntity as any,
          correlationId: payload.correlationId as string,
        });
        
        // Update proposal status to dispatched
        const proposalId = payload.proposalId as string;
        await storage.updateStagedProposal(proposalId, { status: "dispatched" });
        
        // Write PROPOSAL_DISPATCHED to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "outbox_worker",
          actionType: "PROPOSAL_DISPATCHED",
          entityType: "staged_proposal",
          entityId: proposalId,
          mode: "executed",
          status: "dispatched",
          diffJson: {
            proposalId,
            dispatchedAt: new Date().toISOString(),
          },
          correlationId: payload.correlationId as string,
          executionTraceId: event.id,
          idempotencyKey: `dispatch-${proposalId}-${Date.now()}`,
        });
        
        await storage.updateEventsOutboxStatus(event.id, "synced");
        recordSuccess();
        break;

      case "whatsapp.send":
        await dispatchWhatsApp({
          correlationId: payload.correlationId as string,
          contactId: payload.contactId as string,
          conversationId: payload.conversationId as string,
          message: (payload.message as string) || null,
          channel: (payload.channel as string) || "whatsapp",
          approvedBy: payload.approvedBy as string,
          approvedAt: payload.approvedAt as string,
        });
        await storage.updateEventsOutboxStatus(event.id, "synced");
        recordSuccess();
        break;

      case "email.send":
        await dispatchEmail({
          type: "email",
          correlationId: payload.correlationId as string,
          to: payload.to as string,
          subject: payload.subject as string,
          body: payload.body as string,
          identity: (payload.identity as "personal" | "system") || "system",
          contactId: payload.contactId as string,
        });
        await storage.updateEventsOutboxStatus(event.id, "synced");
        recordSuccess();
        break;

      case "payment.create":
        await dispatchPayment({
          type: "payment",
          correlationId: payload.correlationId as string,
          contactId: payload.contactId as string,
          amount: payload.amount as number,
          currency: (payload.currency as string) || "usd",
          description: payload.description as string,
        });
        await storage.updateEventsOutboxStatus(event.id, "synced");
        recordSuccess();
        break;

      default:
        console.warn(`[Outbox Worker] Unknown event type: ${eventType}`);
        await storage.updateEventsOutboxStatus(event.id, "failed", `Unknown event type: ${eventType}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Outbox Worker] Failed to dispatch event ${event.id}:`, errorMessage);
    recordFailure();

    const newRetryCount = event.retryCount + 1;

    if (shouldRetry(newRetryCount, event.status)) {
      // Schedule retry with exponential backoff
      const backoffMs = calculateBackoff(newRetryCount);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await storage.updateEventsOutboxForRetry(
        event.id,
        newRetryCount,
        "pending",
        nextRetryAt,
        errorMessage
      );

      console.log(
        `[Outbox Worker] Scheduled retry ${newRetryCount}/${MAX_RETRIES} for event ${event.id} ` +
        `at ${nextRetryAt.toISOString()} (backoff: ${backoffMs}ms)`
      );
    } else {
      // Move to dead letter queue
      await storage.updateEventsOutboxForRetry(
        event.id,
        newRetryCount,
        "dead_letter",
        undefined,
        `Max retries exceeded: ${errorMessage}`
      );

      console.error(
        `[Outbox Worker] Event ${event.id} moved to DEAD LETTER QUEUE after ${newRetryCount} retries`
      );

      // Log to automation ledger for visibility
      await storage.createAutomationLedgerEntry({
        agentName: "outbox_worker",
        actionType: "EVENT_DEAD_LETTERED",
        entityType: "events_outbox",
        entityId: event.id,
        mode: "auto",
        status: "failed",
        diffJson: {
          eventType,
          retryCount: newRetryCount,
          errorMessage,
          deadLetterAt: new Date().toISOString(),
        },
        reason: `Event permanently failed after ${newRetryCount} retries`,
        correlationId: (payload.correlationId as string) || null,
        executionTraceId: event.id,
      });
    }
  }
}

// ========================================
// WORKER LOOP
// ========================================

async function processPendingEvents(): Promise<void> {
  // Check circuit breaker
  if (isCircuitOpen()) {
    console.log(
      `[Outbox Worker] Circuit breaker OPEN, skipping processing. ` +
      `Failures: ${circuitBreaker.failures}, Last failure: ${circuitBreaker.lastFailureAt?.toISOString()}`
    );
    return;
  }

  try {
    // Get pending events (including those ready for retry)
    const pendingEvents = await storage.getPendingEventsOutbox(50);

    if (pendingEvents.length === 0) {
      return; // No events to process
    }

    console.log(`[Outbox Worker] Processing ${pendingEvents.length} pending event(s)`);

    // Process events sequentially to avoid overwhelming the agent gateway
    for (const event of pendingEvents) {
      // Check if event is ready for retry (if it has a next retry time)
      if (event.retryCount > 0) {
        const backoffMs = calculateBackoff(event.retryCount);
        const earliestRetryTime = new Date(event.createdAt.getTime() + backoffMs);
        
        if (Date.now() < earliestRetryTime.getTime()) {
          continue; // Not ready for retry yet
        }
      }

      await dispatchEvent(event);
    }
  } catch (error) {
    console.error("[Outbox Worker] Error processing pending events:", error);
  }
}

// ========================================
// WORKER START/STOP
// ========================================

let workerInterval: NodeJS.Timeout | null = null;

export function startOutboxWorker(): void {
  if (workerInterval) {
    console.log("[Outbox Worker] Already running");
    return;
  }

  console.log(
    `[Outbox Worker] Starting (poll interval: ${POLL_INTERVAL_MS}ms, ` +
    `max retries: ${MAX_RETRIES}, circuit breaker threshold: ${CIRCUIT_BREAKER_THRESHOLD})`
  );

  workerInterval = setInterval(processPendingEvents, POLL_INTERVAL_MS);

  // Run immediately on start
  processPendingEvents().catch(console.error);
}

export function stopOutboxWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[Outbox Worker] Stopped");
  }
}

export function getCircuitBreakerState(): CircuitBreakerState {
  return { ...circuitBreaker };
}

// ========================================
// HELPER: Write to Outbox
// ========================================

export async function writeToOutbox(event: {
  tenantId: string;
  idempotencyKey: string;
  eventType: string;
  channel: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}): Promise<string> {
  const outboxEntry = await storage.createEventsOutbox({
    tenantId: event.tenantId,
    idempotencyKey: event.idempotencyKey,
    eventType: event.eventType,
    channel: event.channel,
    payload: {
      ...event.payload,
      correlationId: event.correlationId,
      queuedAt: new Date().toISOString(),
    },
    status: "pending",
  });

  console.log(`[Outbox] Event ${outboxEntry.id} queued (type: ${event.eventType})`);

  return outboxEntry.id;
}
