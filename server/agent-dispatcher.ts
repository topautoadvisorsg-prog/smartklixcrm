/**
 * External Agent Dispatcher
 * 
 * The CRM talks to ONE external system — a cloud agent.
 * The CRM sends a structured JSON payload via POST.
 * The cloud agent handles delivery (Telegram, WhatsApp, email, etc).
 * The CRM does not know or care about the delivery channel.
 * 
 * Updated: Now uses unified agent contracts with correlation spine
 */

import { 
  type TaskDispatchPayload,
  type WhatsappDispatchPayload,
  type EmailDispatchPayload,
  type PaymentDispatchPayload,
  getAgentWebhookUrl,
  generateCorrelationId,
} from "./agent-contracts";

export interface ActionItem {
  tool: string;
  args: Record<string, unknown>;
}

export interface DispatchPayload {
  correlationId: string; // REQUIRED: Links proposal → ledger → dispatch → callback
  proposalId: string;
  summary: string;
  actions: ActionItem[];
  reasoning: string;
  approvedBy: string;
  approvedAt: string;
  relatedEntity: { type: string; id: string } | null;
  timestamp: string;
}

export async function dispatchToAgent(proposal: {
  proposalId: string;
  summary: string;
  actions: ActionItem[];
  reasoning: string;
  approvedBy: string;
  approvedAt: Date;
  relatedEntity?: { type: string; id: string };
  correlationId?: string; // Optional: use existing or generate new
}): Promise<{ correlationId: string }> {
  const webhookUrl = getAgentWebhookUrl("task");
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  // Use provided correlationId or generate new one
  const correlationId = proposal.correlationId || generateCorrelationId();

  const payload: DispatchPayload = {
    correlationId,
    proposalId: proposal.proposalId,
    summary: proposal.summary,
    actions: proposal.actions,
    reasoning: proposal.reasoning,
    approvedBy: proposal.approvedBy,
    approvedAt: proposal.approvedAt.toISOString(),
    relatedEntity: proposal.relatedEntity ?? null,
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Agent dispatch failed: ${response.status}`);
  }

  // Return correlationId for ledger tracking
  return { correlationId };
}

/**
 * Dispatch WhatsApp/SMS message via agent
 */
export async function dispatchWhatsApp(payload: {
  correlationId: string;
  contactId?: string;
  conversationId?: string;
  message: string | null;
  templateId?: string | null;
  channel?: string;
  approvedBy: string;
  approvedAt: string;
}): Promise<{ correlationId: string }> {
  const webhookUrl = getAgentWebhookUrl("whatsapp");
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  const correlationId = payload.correlationId || generateCorrelationId();

  const fullPayload = {
    type: "whatsapp" as const,
    correlationId,
    contactId: payload.contactId || "unknown",
    phoneNumber: payload.contactId || "unknown",
    message: payload.message || "",
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(fullPayload),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp dispatch failed: ${response.status}`);
  }

  return { correlationId };
}

/**
 * Dispatch email via agent
 */
export async function dispatchEmail(payload: Omit<EmailDispatchPayload, "timestamp">): Promise<{ correlationId: string }> {
  const webhookUrl = getAgentWebhookUrl("email");
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  const correlationId = payload.correlationId || generateCorrelationId();

  const fullPayload: EmailDispatchPayload = {
    ...payload,
    correlationId,
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(fullPayload),
  });

  if (!response.ok) {
    throw new Error(`Email dispatch failed: ${response.status}`);
  }

  return { correlationId };
}

/**
 * Dispatch payment link creation via agent
 */
export async function dispatchPayment(payload: Omit<PaymentDispatchPayload, "timestamp">): Promise<{ correlationId: string }> {
  const webhookUrl = getAgentWebhookUrl("payment");
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  const correlationId = payload.correlationId || generateCorrelationId();

  const fullPayload: PaymentDispatchPayload = {
    ...payload,
    correlationId,
    timestamp: new Date().toISOString(),
    currency: payload.currency || "usd",
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(fullPayload),
  });

  if (!response.ok) {
    throw new Error(`Payment dispatch failed: ${response.status}`);
  }

  return { correlationId };
}
