import { z } from "zod";

export const neo8EventTypes = [
  "new_lead",
  "job_updated",
  "send_sms",
  "missed_call",
  "send_email",
  "invoice_created",
  "create_payment_link",
  "payment_created",
] as const;

// N8N webhook base URL for direct endpoint calls
const N8N_WEBHOOK_BASE = process.env.VITE_N8N_WEBHOOK_BASE_URL || "https://smartg23.app.n8n.cloud";

// Dispatch to a specific n8n webhook endpoint (path-based routing)
export async function dispatchToN8nWebhook(
  path: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = `${N8N_WEBHOOK_BASE}/webhook${path}`;
  
  try {
    console.log(`[N8N] Dispatching to ${webhookUrl}`);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[N8N] Webhook ${path} failed: ${response.status} - ${errorText}`);
      return { success: false, error: `N8N webhook returned ${response.status}: ${errorText}` };
    }

    console.log(`[N8N] Webhook ${path} dispatched successfully`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[N8N] Failed to dispatch to ${path}: ${message}`);
    return { success: false, error: `Failed to dispatch: ${message}` };
  }
}

export const neo8OutboundEventSchema = z.object({
  eventType: z.enum(neo8EventTypes),
  eventId: z.string(),
  prompt: z.string().optional().default(""),
  leadName: z.string().optional().default(""),
  fromNumber: z.string().optional().default(""),
  toNumber: z.string().optional().default(""),
  message: z.string().optional().default(""),
  fromEmail: z.string().optional().default(""),
  toEmail: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  customerId: z.string().optional().default(""),
  amount: z.string().optional().default(""),
  paymentSourceId: z.string().optional().default(""),
  productName: z.string().optional().default(""),
});

export const neo8InboundResultSchema = z.object({
  eventId: z.string(),
  eventType: z.enum(neo8EventTypes),
  status: z.enum(["success", "error"]),
  result: z.object({
    aiGeneratedText: z.string().optional(),
    paymentLink: z.string().optional(),
    emailSent: z.boolean().optional(),
    smsSent: z.boolean().optional(),
    stripePaymentStatus: z.string().optional(),
    invoiceResult: z.any().optional(),
    error: z.string().optional(),
  }).optional(),
  timestamp: z.string(),
});

export type Neo8OutboundEvent = z.infer<typeof neo8OutboundEventSchema>;
export type Neo8InboundResult = z.infer<typeof neo8InboundResultSchema>;
export type Neo8EventType = typeof neo8EventTypes[number];

export async function dispatchNeo8Event(event: Neo8OutboundEvent): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  
  if (!webhookUrl || webhookUrl === "TO_BE_PROVIDED" || webhookUrl === "__SET_AT_DEPLOY__") {
    console.warn("[Neo8] N8N_WEBHOOK_URL not configured, skipping event dispatch");
    return { success: false, error: "N8N_WEBHOOK_URL not configured" };
  }

  try {
    const validated = neo8OutboundEventSchema.parse(event);
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Neo8 webhook returned ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to dispatch Neo8 event: ${message}` };
  }
}

export function createNeo8Event(
  eventType: Neo8EventType,
  eventId: string,
  payload: Partial<Omit<Neo8OutboundEvent, 'eventType' | 'eventId'>>
): Neo8OutboundEvent {
  return {
    eventType,
    eventId,
    prompt: payload.prompt ?? "",
    leadName: payload.leadName ?? "",
    fromNumber: payload.fromNumber ?? "",
    toNumber: payload.toNumber ?? "",
    message: payload.message ?? "",
    fromEmail: payload.fromEmail ?? "",
    toEmail: payload.toEmail ?? "",
    subject: payload.subject ?? "",
    customerId: payload.customerId ?? "",
    amount: payload.amount ?? "",
    paymentSourceId: payload.paymentSourceId ?? "",
    productName: payload.productName ?? "",
  };
}

// Dispatch lead intake event to Neo8Flow
export async function dispatchIntakeToNeo8Flow(
  outboxId: string,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const neo8FlowUrl = process.env.NEO8FLOW_URL;
  const tenantToken = process.env.N8N_INTERNAL_TOKEN;
  
  if (!neo8FlowUrl || neo8FlowUrl === "__SET_AT_DEPLOY__") {
    console.warn("[Neo8Flow] NEO8FLOW_URL not configured, skipping intake dispatch");
    return { success: false, error: "NEO8FLOW_URL not configured" };
  }

  try {
    const response = await fetch(`${neo8FlowUrl}/events/intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": tenantToken || "",
      },
      body: JSON.stringify({
        outbox_id: outboxId,
        tenant_id: tenantId,
        payload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Neo8Flow] Intake dispatch failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Neo8Flow returned ${response.status}: ${errorText}` };
    }

    console.log(`[Neo8Flow] Intake dispatch successful for outbox_id: ${outboxId}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Neo8Flow] Failed to dispatch intake event: ${message}`);
    return { success: false, error: `Failed to dispatch intake: ${message}` };
  }
}

export const EXTERNAL_TOOL_WEBHOOK_PATHS: Record<string, string> = {
  "send_email": "/outreach/trigger",
  "send_sms": "/outreach/trigger",
  "send_whatsapp": "/outreach/trigger",
  "send_estimate": "/outreach/trigger",
  "send_invoice": "/outreach/trigger",
  "record_payment": "/payment/create",
  "start_job": "/jobs/update",
  "complete_job": "/jobs/update",
  "accept_estimate": "/estimates/update",
  "reject_estimate": "/estimates/update",
  "google_docs_create": "/google/docs",
  "google_docs_update": "/google/docs",
  "google_docs_append": "/google/docs",
  "google_docs_export": "/google/docs",
  "google_sheets_create": "/google/sheets/create",
  "google_sheets_update": "/google/sheets/update",
  "google_sheets_append": "/google/sheets/append",
  "google_calendar_create": "/google/calendar/create",
  "stripe_create_payment_link": "/payment/create",
};

// Map CRM tool names to n8n action names (lowercase, underscore format for Switch routing)
export const TOOL_TO_N8N_ACTION: Record<string, string> = {
  "google_docs_create": "create_doc",
  "google_docs_update": "update_doc",
  "google_docs_append": "append_content",
  "google_docs_export": "export_doc",
  "google_sheets_create": "create_sheet",
  "google_sheets_update": "update_sheet",
  "google_sheets_append": "append_sheet",
  "google_calendar_create": "create_event",
};

export interface ExternalActionDispatchResult {
  success: boolean;
  error?: string;
  responseData?: unknown;
}

export async function dispatchExternalAction(
  toolName: string,
  args: unknown,
  metadata?: {
    assistQueueId?: string;
    ledgerId?: string;
    userId?: string;
  }
): Promise<ExternalActionDispatchResult> {
  const webhookPath = EXTERNAL_TOOL_WEBHOOK_PATHS[toolName];
  
  if (!webhookPath) {
    console.error(`[Neo8] No webhook path configured for EXTERNAL tool: ${toolName}`);
    return { 
      success: false, 
      error: `No webhook path configured for tool: ${toolName}. This EXTERNAL action cannot be dispatched.` 
    };
  }

  const neo8FlowUrl = process.env.NEO8FLOW_URL || process.env.VITE_N8N_WEBHOOK_BASE_URL;
  const tenantToken = process.env.N8N_INTERNAL_TOKEN;
  
  if (!neo8FlowUrl || neo8FlowUrl === "__SET_AT_DEPLOY__") {
    console.error("[Neo8] NEO8FLOW_URL not configured - cannot dispatch EXTERNAL action");
    return { 
      success: false, 
      error: "NEO8FLOW_URL not configured. External actions cannot be executed without n8n integration." 
    };
  }

  // Always use production webhook - n8n workflows are configured with /webhook endpoints
  const webhookPrefix = "/webhook";
  const webhookUrl = `${neo8FlowUrl}${webhookPrefix}${webhookPath}`;
  
  // Generate callback URL for n8n to report results back to CRM
  const crmBaseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:5000";
  const callbackUrl = `${crmBaseUrl}/api/neo8/callback`;
  
  // Map CRM tool name to n8n action name for Switch routing
  const n8nActionName = TOOL_TO_N8N_ACTION[toolName] || toolName;
  
  const payload = {
    action: n8nActionName,
    args,
    metadata: {
      ...metadata,
      ledgerId: metadata?.ledgerId,
      assistQueueId: metadata?.assistQueueId,
      timestamp: new Date().toISOString(),
      source: "crm_ready_execution",
      callbackUrl,
      // Note: n8n should use x-internal-token header for auth, not embed token in payload
    },
  };

  try {
    console.log(`[Neo8] Dispatching EXTERNAL action "${toolName}" to ${webhookUrl}`);
    console.log(`[Neo8] Payload:`, JSON.stringify(payload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": tenantToken || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Neo8] EXTERNAL action dispatch failed: ${response.status} - ${errorText}`);
      return { 
        success: false, 
        error: `Neo8 webhook returned ${response.status}: ${errorText}` 
      };
    }

    let responseData: unknown = null;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    console.log(`[Neo8] EXTERNAL action "${toolName}" dispatched successfully`);
    return { success: true, responseData };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Neo8] Failed to dispatch EXTERNAL action "${toolName}": ${message}`);
    return { 
      success: false, 
      error: `Failed to dispatch to Neo8: ${message}` 
    };
  }
}
