/**
 * Agent Execution Gateway - Unified Contract Definitions
 * 
 * This module defines the standardized payload schemas for all external agent dispatch.
 * Replaces fragmented N8N webhook calls with a single, unified contract.
 * 
 * Contract Requirements:
 * - correlationId REQUIRED in all payloads
 * - Ledger write REQUIRED before dispatch
 * - Callback REQUIRED for completion
 */

import { z } from "zod";

// ========================================
// BASE PAYLOAD (All dispatches include this)
// ========================================

export const baseDispatchSchema = z.object({
  correlationId: z.string().uuid().describe("Links proposal → ledger → dispatch → callback"),
  proposalId: z.string().uuid().optional().describe("Source proposal ID (if applicable)"),
  timestamp: z.string().datetime().describe("ISO 8601 timestamp of dispatch"),
});

// ========================================
// TASK DISPATCH (General CRM actions)
// ========================================

export const taskDispatchSchema = baseDispatchSchema.extend({
  type: z.literal("task"),
  summary: z.string().describe("Human-readable summary of the task"),
  actions: z.array(z.object({
    tool: z.string(),
    args: z.record(z.unknown()),
  })).describe("Array of actions to execute"),
  reasoning: z.string().optional().describe("Why this task is being dispatched"),
  approvedBy: z.string().describe("User who approved this action"),
  approvedAt: z.string().datetime().describe("When the action was approved"),
  relatedEntity: z.object({
    type: z.string(),
    id: z.string(),
  }).nullable().optional().describe("Related CRM entity (contact, job, etc.)"),
});

export type TaskDispatchPayload = z.infer<typeof taskDispatchSchema>;

// ========================================
// WHATSAPP/SMS DISPATCH
// ========================================

export const whatsappDispatchSchema = baseDispatchSchema.extend({
  type: z.literal("whatsapp"),
  contactId: z.string().uuid().describe("Target contact ID"),
  phoneNumber: z.string().describe("Phone number to send to"),
  message: z.string().describe("Message content"),
  mediaUrl: z.string().url().optional().describe("Optional media attachment URL"),
  proposalId: z.string().uuid().optional().describe("Source proposal ID (if from proposal)"),
});

export type WhatsappDispatchPayload = z.infer<typeof whatsappDispatchSchema>;

// ========================================
// EMAIL DISPATCH
// ========================================

export const emailDispatchSchema = baseDispatchSchema.extend({
  type: z.literal("email"),
  identity: z.enum(["personal", "system"]).describe("Email identity to use"),
  to: z.string().email().describe("Recipient email address"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body (HTML or plain text)"),
  contactId: z.string().uuid().optional().describe("Target contact ID"),
  proposalId: z.string().uuid().optional().describe("Source proposal ID (if from proposal)"),
});

export type EmailDispatchPayload = z.infer<typeof emailDispatchSchema>;

// ========================================
// PAYMENT DISPATCH
// ========================================

export const paymentDispatchSchema = baseDispatchSchema.extend({
  type: z.literal("payment"),
  contactId: z.string().uuid().describe("Target contact ID"),
  amount: z.number().positive().describe("Payment amount"),
  currency: z.string().default("usd").describe("Currency code"),
  description: z.string().describe("Payment description"),
  proposalId: z.string().uuid().optional().describe("Source proposal ID (if from proposal)"),
});

export type PaymentDispatchPayload = z.infer<typeof paymentDispatchSchema>;

// ========================================
// UNION TYPE (All dispatch types)
// ========================================

export const agentDispatchSchema = z.discriminatedUnion("type", [
  taskDispatchSchema,
  whatsappDispatchSchema,
  emailDispatchSchema,
  paymentDispatchSchema,
]);

export type AgentDispatchPayload = z.infer<typeof agentDispatchSchema>;

// ========================================
// CALLBACK SCHEMA (External agent reports back)
// ========================================

export const agentCallbackSchema = z.object({
  correlationId: z.string().uuid().describe("Must match the correlationId from dispatch"),
  proposalId: z.string().uuid().optional().describe("Source proposal ID"),
  status: z.enum(["completed", "failed"]).describe("Execution result"),
  result: z.record(z.unknown()).optional().describe("Execution result data"),
  errorMessage: z.string().optional().describe("Error message if failed"),
  completedAt: z.string().datetime().optional().describe("When the action completed"),
});

export type AgentCallbackPayload = z.infer<typeof agentCallbackSchema>;

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Generate a new correlation ID for a dispatch chain
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Build the full webhook URL for a specific dispatch type
 */
export function getAgentWebhookUrl(dispatchType: string): string {
  const baseUrl = process.env.AGENT_WEBHOOK_URL;
  if (!baseUrl) {
    throw new Error("AGENT_WEBHOOK_URL not configured");
  }
  
  // Route to specific endpoint based on type
  return `${baseUrl}/execute/${dispatchType}`;
}
