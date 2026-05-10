import express, { type Express } from "express";
import { agentCallbackSchema } from "./agent-contracts";
import { createServer, type Server } from "http";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { 
  insertContactSchema, 
  insertJobSchema, 
  insertJobTaskSchema,
  insertNoteSchema,
  insertEstimateSchema,
  insertInvoiceSchema,
  insertPaymentSchema,
  insertSettingsSchema,
  insertAiSettingsSchema,
  insertAiVoiceDispatchConfigSchema,
  insertCompanyInstructionsSchema,
  insertEmailAccountSchema,
  insertEmailSchema,
  insertIntakeSchema,
  insertIntakeFieldSchema,
  insertIntakeSubmissionSchema,
  insertUserSchema,
  insertAppointmentSchema,
  insertWhatsappMessageSchema,
  insertCampaignSchema,
  insertEmailTemplateSchema,
  type InsertContact,
  type Contact,
  type InsertJob,
  type InsertCampaign,
  type InsertEmailTemplate,
} from "@shared/schema";
import { isDatabaseConnected } from "./db";
import {
  acceptEstimate,
  rejectEstimate,
  sendEstimate,
  startJob,
  completeJob,
  sendInvoice,
  recordPayment,
  assignTechnician,
  updateJobStatus,
} from "./pipeline";
import { reviewProposal } from "./validator";
import { aiToolDefinitions, executeAITool, classifyAction, isInternalAction, isExternalAction, isReadOnlyTool, INTERNAL_TOOLS, EXTERNAL_TOOLS } from "./ai-tools";
import { requireInternalToken } from "./auth-middleware";
import { requireAuth, requireRole } from "./middleware/auth";
// TEMP: neo8-events removed
/** Master Architect removed. All validation handled by validator.ts */
// DEAD CODE: Chat services deleted - stub implementations removed during system purge
// Chat endpoints temporarily disabled until proper AI chat implementation
// import { chatService } from "./chat-service";
// TEMP: webhook-verification removed
import { dispatchToAgent } from "./agent-dispatcher";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { buildSystemInstructions } from "./ai-prompts";
import { campaignService } from "./campaign-service";
import { emailWebhookHandler } from "./email-webhook";
import { campaignAnalyticsService } from "./campaign-analytics";
import fieldFinancialExportRoutes from "./routes-field-financial-export";
import { logger } from "./logger";
import { verifyHmacSignature, verifyInternalToken } from "./security";


const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many AI chat requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Server-side staged action storage now uses the proposals table in the database
// The StagedActionBundle interface is replaced by StagedProposal from the schema

// Cleanup expired staged actions every 5 minutes
setInterval(() => {
  storage.cleanupExpiredProposals().catch((err) => logger.error('Failed to cleanup expired proposals', err));
}, 5 * 60 * 1000);

async function createStagedBundle(
  actions: Array<{ tool: string; args: Record<string, unknown> }>, 
  userRequest?: string,
  reasoningSummary?: string,
  currentAgentMode?: string | null,
  req?: any
): Promise<{ id: string; validationResult: ReturnType<typeof reviewProposal> } | null> {
  // P0 HARDENING: Check kill switch BEFORE creating staged proposal
  const aiSettings = await storage.getAiSettings();
  if (aiSettings?.killSwitchActive) {
    logger.warn(`Kill switch active - staged bundle creation blocked`);
    return null;
  }

  // Run validator BEFORE creating the staged proposal
  const validationResult = reviewProposal({
    action: actions[0]?.tool || "unknown",
    target: "action_bundle",
    summary: `AI proposed ${actions.length} action(s)`,
    requestedBy: "ai_chat",
    payload: { actions, userRequest },
    reasoning: reasoningSummary || `AI proposed ${actions.length} action(s)`,
  });

  if (validationResult.decision === "reject") {
    // Don't create the proposal if rejected
    logger.warn(`Proposal rejected: ${validationResult.reason}`);
    return null;
  }

  // Generate correlation ID for tracing across systems
  const correlationId = crypto.randomUUID();

  const proposal = await storage.createStagedProposal({
    status: "pending",
    actions: JSON.stringify(actions),
    summary: userRequest || null,
    reasoning: reasoningSummary || null,
    riskLevel: validationResult.riskLevel,
    relatedEntity: null,
    approvedBy: null,
    approvedAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minute expiry
    // Governance columns
    userId: req?.session?.userId || null,
    origin: "ai_chat",
    userRequest: userRequest || null,
    validatorDecision: validationResult.decision,
    validatorReason: validationResult.reason,
    requiresApproval: validationResult.requiresHumanApproval !== false,
    mode: currentAgentMode || null,
    correlationId,
  });
  return { id: proposal.id, validationResult };
}

// MULTI-STEP WORKFLOW ENFORCEMENT
// Detect required actions from user message and ensure all are staged
interface RequiredAction {
  tool: string;
  keywords: string[];
  description: string;
}

const ACTION_DETECTION_RULES: RequiredAction[] = [
  { tool: "create_contact", keywords: ["create contact", "create customer", "new contact", "new customer", "add contact", "add customer"], description: "contact creation" },
  { tool: "create_estimate", keywords: ["estimate", "quote", "$ for", "dollars for", "$"], description: "estimate creation" },
  { tool: "stripe_create_payment_link", keywords: ["payment link", "pay link", "stripe link", "payment url"], description: "payment link" },
  { tool: "send_email", keywords: ["send email", "email them", "email to", "email with", "and email", "with email", "via email", "by email", "include payment link in email", "email the", "email it"], description: "email sending" },
  { tool: "create_invoice", keywords: ["create invoice", "invoice for", "send invoice"], description: "invoice creation" },
  { tool: "send_estimate", keywords: ["send estimate", "send the estimate", "email estimate"], description: "estimate sending" },
  { tool: "send_invoice", keywords: ["send invoice", "send the invoice", "email invoice"], description: "invoice sending" },
  { tool: "create_job", keywords: ["create job", "new job", "create work order"], description: "job creation" },
];

function detectRequiredActions(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const requiredTools: string[] = [];
  
  for (const rule of ACTION_DETECTION_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerMessage.includes(keyword)) {
        if (!requiredTools.includes(rule.tool)) {
          requiredTools.push(rule.tool);
        }
        break;
      }
    }
  }
  
  return requiredTools;
}

function getMissingActions(requiredTools: string[], stagedTools: string[]): string[] {
  return requiredTools.filter(tool => !stagedTools.includes(tool));
}

function buildEnforcementMessage(missingTools: string[]): string {
  const toolDescriptions = missingTools.map(tool => {
    const rule = ACTION_DETECTION_RULES.find(r => r.tool === tool);
    return rule ? `- ${tool} (${rule.description})` : `- ${tool}`;
  }).join('\n');
  
  return `CRITICAL ENFORCEMENT: Your proposal is INCOMPLETE. You MUST stage these missing actions NOW:

${toolDescriptions}

You are NOT ALLOWED to:
- Present a partial proposal
- Ask for more information
- Skip any of these actions
- Respond with text only

Your ONLY acceptable response is to call ALL the missing tool functions listed above with appropriate arguments. Stage them NOW.`;
}

const MAX_ENFORCEMENT_RETRIES = 2;

const gptActionsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many GPT action requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for internal webhook callbacks (generous limits for automation)
const internalWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // Higher limit for automation workflows
  message: { error: "Too many webhook requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Backward compatibility alias
const n8nWebhookRateLimiter = internalWebhookRateLimiter;

// Rate limiter for public intake webhooks (moderate limit to prevent abuse)
const intakeWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // 50 requests per minute per IP
  message: { error: "Too many intake submissions, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Internal webhook verification middleware (optional mode for backward compatibility)
// Agents should include X-INTERNAL-TOKEN header
const internalTokenVerification = (req: any, res: any, next: any) => {
  // Verification is handled by requireInternalToken middleware
  // This stub is kept for backward compatibility
  next();
};

// Legacy alias (N8N removed, keeping for route compatibility)
const n8nVerification = internalTokenVerification;

// N8N logging stubs (DEPRECATED - no-op functions kept for backward compatibility)
// These functions do nothing and will be removed once all N8N references are cleaned up
function logN8NRequest(_endpoint: string, _method: string, _data: unknown) {
  // No-op: N8N logging disabled
}
function logN8NResponse(_endpoint: string, _status: number, _data: unknown) {
  // No-op: N8N logging disabled  
}
function logN8NError(_endpoint: string, _error: unknown) {
  // No-op: N8N logging disabled
}


const createConversationSchema = z.object({
  contactId: z.string().nullable().optional(),
  channel: z.string().optional().default("widget"),
});

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  contactId: z.string().nullable().optional(),
  message: z.string().min(1, "message is required"),
  systemPrompt: z.string().optional(),
});

const internalChatSchema = z.object({
  message: z.string().min(1, "message is required"),
  context: z.enum(["crm_agent", "actiongpt", "read_chat"]).default("crm_agent"),
  contactId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
});

const gptActionsExecuteSchema = z.object({
  message: z.string().min(1, "message is required"),
  contactId: z.string().nullable().optional(),
  jobId: z.string().nullable().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
});

const identifyContactSchema = z.object({
  conversationId: z.string().min(1, "conversationId is required"),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

// Lead Intake Event Schema - Canonical envelope for Neo8Flow integration
// Uses snake_case field names for API consistency
export const leadIntakeEventSchema = z.object({
  tenant_id: z.string().min(1, "tenant_id is required"),
  idempotency_key: z.string().min(1, "idempotency_key is required"),
  schema_version: z.string().default("1.0"),
  event_type: z.literal("lead.created"),
  channel: z.enum(["widget", "voice", "web_form", "api", "import"]),
  source_id: z.string().optional(),
  source_ip: z.string().optional(),
  recording_url: z.string().url().optional(),
  lead_score: z.number().int().min(0).max(100).optional(),
  payload: z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    company: z.string().optional(),
    message: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.unknown()).optional(),
    contact_id: z.string().optional(),
  }),
});

// Pipeline operation schemas
const assignTechnicianSchema = z.object({
  technicianId: z.string().min(1, "technicianId is required"),
});

const updateStatusSchema = z.object({
  status: z.string().min(1, "status is required"),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive("amount must be positive"),
  method: z.string().min(1, "method is required"),
  transactionRef: z.string().optional(),
});

// AI tool execution schema
const executeToolSchema = z.object({
  toolName: z.string().min(1, "toolName is required"),
  args: z.record(z.unknown()).optional().default({}),
});

// Pipeline operation schemas
const updateJobStatusSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
  status: z.string().min(1, "status is required"),
});

const sendEstimateSchema = z.object({
  estimateId: z.string().min(1, "estimateId is required"),
});

// Aliases for backward compatibility
const sendEstimateN8NSchema = sendEstimateSchema;
const sendInvoiceN8NSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
});

const markInvoicePaidSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
});

// @deprecated assist_queue schemas. Use proposals endpoints instead.
// const approveAssistSchema = z.object({
//   reason: z.string().optional(),
// });

// @deprecated assist_queue schemas. Use proposals endpoints instead.
// const rejectAssistSchema = z.object({
//   reason: z.string().min(1, "reason is required"),
// });

// CRM Sync Schema - N8N / agent callback after processing a lead intake event
const crmSyncSchema = z.object({
  outbox_id:     z.string().min(1, "outbox_id is required"),
  tenant_id:     z.string().min(1, "tenant_id is required"),
  status:        z.enum(["success", "error"], { errorMap: () => ({ message: 'status must be "success" or "error"' }) }),
  payload:       z.record(z.unknown()).optional().default({}),
  recording_url: z.string().url().optional().nullable(),
  lead_score:    z.number().int().min(0).max(100).optional().nullable(),
  channel:       z.string().optional(),
  error_message: z.string().optional(),
});

type AgentMode = "execute" | "propose" | "review" | "draft";
type ToolCallResult = { name: string; status: string; arguments: string; result?: unknown };



export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware to attach userId from X-User-Id header for authenticated endpoints
  app.use((req, _res, next) => {
    const userIdHeader = req.headers['x-user-id'] as string | undefined;
    if (userIdHeader) {
      (req as unknown as { userId: string }).userId = userIdHeader;
    }
    next();
  });

  app.get("/internal/health", async (_req, res) => {
    const health = {
      status: "operational",
      timestamp: new Date().toISOString(),
      services: {
        database: isDatabaseConnected() ? "connected" : "placeholder_mode",
        agent: process.env.AGENT_WEBHOOK_URL ? "configured" : "not_configured",
      },
    };
    res.json(health);
  });

  app.get("/api/health", async (_req, res) => {
    const health = {
      status: "operational",
      timestamp: new Date().toISOString(),
      services: {
        database: isDatabaseConnected() ? "connected" : "placeholder_mode",
        redis: process.env.REDIS_URL !== "redis://placeholder:6379" ? "connected" : "not_configured",
        openai: process.env.OPENAI_API_KEY !== "__SET_AT_DEPLOY__" ? "connected" : "not_configured",
        agent: process.env.AGENT_WEBHOOK_URL ? "configured" : "not_configured",
      },
    };
    res.json(health);
  });

  // PUBLIC — agent callback (secret-verified, no session)
  // POST /api/agent/callback — external agent posts results back
  app.post("/api/agent/callback", async (req, res) => {
    const secret = process.env.AGENT_WEBHOOK_SECRET;
    const headerSecret = req.headers["x-webhook-secret"] as string;
    const hmacSignature = req.headers["x-webhook-signature"] as string;
    const hmacTimestamp = req.headers["x-webhook-timestamp"] as string;

    let isAuthorized = false;
    if (secret) {
      if (headerSecret === secret) {
        isAuthorized = true;
      } else if (hmacSignature && hmacTimestamp && verifyHmacSignature(req.body, hmacSignature, hmacTimestamp, secret)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Invalid webhook secret, signature, or timestamp" });
    }

    // Bug fix 1: Validate payload against contract schema before touching anything
    const parseResult = agentCallbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid callback payload", details: parseResult.error.flatten() });
    }

    const { proposalId, status, result, errorMessage, correlationId } = parseResult.data;

    if (!proposalId) {
      return res.status(400).json({ error: "proposalId is required" });
    }

    // Find the staged proposal
    const proposal = await storage.getStagedProposal(proposalId);

    // Bug fix 3: Dead-letter log for orphaned callbacks (no matching proposal)
    if (!proposal) {
      await storage.createAutomationLedgerEntry({
        agentName: "external_agent",
        actionType: "CALLBACK_ORPHANED",
        entityType: "staged_proposal",
        entityId: proposalId,
        status: "dead_letter",
        mode: "executed",
        diffJson: { proposalId, correlationId, status, result: result || null, errorMessage: errorMessage || null },
        reason: `Callback received for unknown or expired proposal: ${proposalId}`,
        correlationId: correlationId || null,
        executionTraceId: proposalId,
        idempotencyKey: `orphan-${proposalId}-${Date.now()}`,
      });
      return res.status(404).json({ error: "Proposal not found — callback logged to dead-letter queue" });
    }

    // Bug fix 2: Verify correlationId matches what was stored at dispatch time
    if (proposal.correlationId && correlationId !== proposal.correlationId) {
      return res.status(403).json({
        error: "correlationId mismatch — callback rejected",
        expected: proposal.correlationId,
        received: correlationId,
      });
    }

    const newStatus = status === "completed" ? "completed" : "failed";
    await storage.updateStagedProposal(proposalId, { 
      status: newStatus,
      completedAt: status === "completed" ? new Date() : undefined,
    });

    // CRITICAL: Write EXTERNAL_CALLBACK_RECEIVED to automation ledger
    await storage.createAutomationLedgerEntry({
      agentName: "external_agent",
      actionType: "EXTERNAL_CALLBACK_RECEIVED",
      entityType: "staged_proposal",
      entityId: proposalId,
      status: "received",
      mode: "executed",
      diffJson: {
        proposalId,
        externalStatus: status,
        result: result || null,
        errorMessage: errorMessage || null,
        callbackReceivedAt: new Date().toISOString(),
      },
      reason: `External agent reported execution result: ${status}`,
      correlationId: correlationId || proposal.correlationId || null,
      executionTraceId: proposalId,
      idempotencyKey: `callback-${proposalId}-${status}-${Date.now()}`,
    });

    // CRITICAL: Write PROPOSAL_EXECUTED or PROPOSAL_FAILED based on status
    await storage.createAutomationLedgerEntry({
      agentName: "external_agent",
      actionType: status === "completed" ? "PROPOSAL_EXECUTED" : "PROPOSAL_FAILED",
      entityType: "staged_proposal",
      entityId: proposalId,
      status: newStatus,
      mode: "executed",
      diffJson: {
        proposalId,
        summary: proposal.summary,
        actions: proposal.actions,
        result: result || null,
        errorMessage: errorMessage || null,
        executedAt: new Date().toISOString(),
      },
      reason: status === "completed" 
        ? "Proposal successfully executed by external agent" 
        : `Proposal execution failed: ${errorMessage || "Unknown error"}`,
      correlationId: correlationId || proposal.correlationId || null,
      executionTraceId: proposalId,
      idempotencyKey: `execution-${proposalId}-${status}-${Date.now()}`,
    });

    res.json({ received: true, proposalId, status: newStatus });
  });

  // ========== PUBLIC AUTH ENDPOINTS ==========
  // POST /api/auth/login — PUBLIC
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    
    const user = await storage.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    
    req.session.userId = user.id;
    res.json({ userId: user.id, name: user.username, role: user.role });
  });

  // POST /api/auth/logout — requireAuth
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ success: true });
    });
  });

  // GET /api/auth/me — requireAuth
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ userId: user.id, name: user.username, role: user.role });
  });

  // Mount field reports, financial records, and export center routes BEFORE auth wall
  // These endpoints are added to PUBLIC_PATHS below for testing access
  app.use("/api", fieldFinancialExportRoutes);

  // ========== AUTH WALL — everything below requires authentication ==========
  // Public paths that bypass authentication
  const PUBLIC_PATHS = [
    { path: "/api/health", method: "GET" },
    { path: "/api/auth/login", method: "POST" },
    { path: "/api/public-chat/sessions", method: "POST" },
    { path: "/api/public-chat/messages", method: "POST" },
    { path: "/api/public-chat/identify", method: "POST" },
    { path: "/api/public-chat/messages/", method: "GET" }, // prefix match for /:sessionToken
    { path: "/api/intake/lead", method: "POST" },
    { path: "/api/webhook/intake/", method: "POST" }, // prefix match for /:token
    { path: "/api/agent/callback", method: "POST" },
    { path: "/api/intake/sync", method: "POST" },   // uses requireInternalToken, not requireAuth
    { path: "/api/prospects/check", method: "GET" }, // agent dedup check — token-verified inside handler
    { path: "/api/prospects", method: "POST" },      // agent adds prospect — token-verified inside handler
    { path: "/api/prospects/", method: "PATCH" },    // agent updates prospect status — prefix match
    { path: "/api/prospects/", method: "POST" },     // agent converts / do-not-outreach — prefix match
    // Export endpoints (for testing - can be restricted later)
    { path: "/api/export/contacts", method: "GET" },
    { path: "/api/export/jobs", method: "GET" },
    { path: "/api/export/financials", method: "GET" },
    { path: "/api/export/field-reports", method: "GET" },
    // Field reports and financial records (for testing)
    { path: "/api/field-reports", method: "GET" },
    { path: "/api/field-reports", method: "POST" },
    { path: "/api/financial-records", method: "GET" },
    { path: "/api/financial-records", method: "POST" },
  ];

  app.use("/api", (req, res, next) => {
    // NOTE: Inside app.use("/api", ...), Express strips the "/api" prefix from req.path.
    // We use req.originalUrl (full path) to correctly match PUBLIC_PATHS which include "/api/".
    const fullPath = req.originalUrl.split('?')[0];
    const isPublic = PUBLIC_PATHS.some((publicPath) => {
      if (req.method !== publicPath.method) return false;
      if (fullPath === publicPath.path) return true;
      // Handle prefix matches (for paths with dynamic segments)
      if (publicPath.path.endsWith("/") && fullPath.startsWith(publicPath.path)) return true;
      return false;
    });
    
    if (isPublic) {
      return next();
    }
    
    // Otherwise, require auth
    return requireAuth(req, res, next);
  });

  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      const pageParam = req.query.page as string | undefined;
      const limitParam = req.query.limit as string | undefined;

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50") || 50));
        const total = contacts.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const data = contacts.slice(offset, offset + limit);
        res.json({ data, total, page, limit, totalPages });
      } else {
        res.json(contacts);
      }
    } catch (error) {
      logger.error("Error fetching contacts", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // N8N callback endpoint: Lookup contact by phone
  app.get("/api/contacts/lookup", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const phone = req.query.phone as string;
      
      if (!phone) {
        return res.status(400).json({ success: false, error: "Phone number is required" });
      }

      const contact = await storage.getContactByPhone(phone);
      
      if (!contact) {
        return res.status(404).json({ success: false, error: "Contact not found" });
      }

      res.json({ success: true, data: contact });
    } catch (error) {
      logger.error("Contacts lookup failed", error);
      const message = error instanceof Error ? error.message : "Failed to lookup contact";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Internal API endpoint: Search contact by email
  app.get("/api/contacts/search", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required" });
      }

      // Get all contacts and find by email (case-insensitive)
      const contacts = await storage.getContacts();
      const contact = contacts.find(c => 
        c.email?.toLowerCase() === email.toLowerCase()
      );
      
      if (!contact) {
        return res.status(404).json({ success: false, error: "Contact not found" });
      }

      res.json({ success: true, data: contact });
    } catch (error) {
      logger.error("Contacts search failed", error);
      const message = error instanceof Error ? error.message : "Failed to search contact";
      res.status(500).json({ success: false, error: message });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validated = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_contact",
        entityType: "contact",
        entityId: contact.id,
        details: { name: contact.name },
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const validated = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, validated);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_contact",
        entityType: "contact",
        entityId: contact.id,
        details: validated,
      });
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid contact data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "delete_contact",
        entityType: "contact",
        entityId: req.params.id,
        details: {},
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // Outreach trigger - disabled (external agent dispatch only via approved proposals)
  app.post("/api/contacts/:id/outreach", async (req, res) => {
    res.status(501).json({ error: "Direct outreach dispatch disabled. Use proposal-based dispatch." });
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const pageParam = req.query.page as string | undefined;
      const limitParam = req.query.limit as string | undefined;

      const jobs = await storage.getJobs();

      // Batch-compute financeStatus for all jobs
      const allInvoices = await storage.getInvoices();
      const allPayments = await storage.getPayments();

      // Build invoice lookup by jobId
      const invoicesByJobId = new Map<string, typeof allInvoices>();
      for (const inv of allInvoices) {
        if (inv.jobId) {
          const list = invoicesByJobId.get(inv.jobId) ?? [];
          list.push(inv);
          invoicesByJobId.set(inv.jobId, list);
        }
      }

      // Build payment lookup by invoiceId
      const paymentsByInvoiceId = new Map<string, typeof allPayments>();
      for (const pay of allPayments) {
        const list = paymentsByInvoiceId.get(pay.invoiceId) ?? [];
        list.push(pay);
        paymentsByInvoiceId.set(pay.invoiceId, list);
      }

      type FinanceStatus = "paid" | "invoiced" | "outstanding" | "unquoted";

      const jobsWithFinance = jobs.map((job) => {
        const jobInvoices = invoicesByJobId.get(job.id) ?? [];
        let financeStatus: FinanceStatus = "unquoted";

        if (jobInvoices.length > 0) {
          // Check if any invoice is fully paid
          let hasPaymentCoveringInvoice = false;
          for (const inv of jobInvoices) {
            const invPayments = paymentsByInvoiceId.get(inv.id) ?? [];
            const totalPaid = invPayments
              .filter((p) => p.status === "completed")
              .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
            const invoiceTotal = Number(inv.totalAmount ?? 0);
            if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
              hasPaymentCoveringInvoice = true;
              break;
            }
          }
          financeStatus = hasPaymentCoveringInvoice ? "paid" : "invoiced";
        } else if (job.status === "completed") {
          financeStatus = "outstanding";
        }

        return { ...job, financeStatus };
      });

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50") || 50));
        const total = jobsWithFinance.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const data = jobsWithFinance.slice(offset, offset + limit);
        res.json({ data, total, page, limit, totalPages });
      } else {
        res.json(jobsWithFinance);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      // Support both contactId (user-friendly) and clientId (schema field)
      const body = { ...req.body };
      if (body.contactId && !body.clientId) {
        body.clientId = body.contactId;
        delete body.contactId;
      }
      const validated = insertJobSchema.parse(body);
      const job = await storage.createJob(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_job",
        entityType: "job",
        entityId: job.id,
        details: { title: job.title },
      });
      res.status(201).json(job);
    } catch (error) {
      res.status(400).json({ error: "Invalid job data" });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      // Support both contactId (user-friendly) and clientId (schema field)
      const body = { ...req.body };
      if (body.contactId && !body.clientId) {
        body.clientId = body.contactId;
        delete body.contactId;
      }
      const validated = insertJobSchema.partial().parse(body);
      const job = await storage.updateJob(req.params.id, validated);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_job",
        entityType: "job",
        entityId: job.id,
        details: validated,
      });
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update job" });
    }
  });

  // Job Tasks endpoints
  app.get("/api/jobs/:id/tasks", async (req, res) => {
    try {
      const tasks = await storage.getJobTasks(req.params.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job tasks" });
    }
  });

  app.post("/api/jobs/:id/tasks", async (req, res) => {
    try {
      const validated = insertJobTaskSchema.parse({
        ...req.body,
        jobId: req.params.id,
      });
      const task = await storage.createJobTask(validated);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/jobs/:id/tasks/:taskId", async (req, res) => {
    try {
      const validated = insertJobTaskSchema.partial().parse(req.body);
      const task = await storage.updateJobTask(req.params.taskId, validated);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/jobs/:id/tasks/:taskId", async (req, res) => {
    try {
      const success = await storage.deleteJobTask(req.params.taskId);
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ============================================
  // PIPELINE ENDPOINTS
  // ============================================

  // GET /api/pipeline/cards - Get all pipeline cards grouped by stage
  app.get("/api/pipeline/cards", async (_req, res) => {
    try {
      const allJobs = await storage.getJobs();
      const allContacts = await storage.getContacts();
      const allEstimates = await storage.getEstimates();

      // Map jobs to pipeline cards
      const pipelineCards = allJobs.map(job => {
        const contact = allContacts.find(c => c.id === job.clientId);
        
        // Check if job has an active estimate
        const jobEstimates = allEstimates.filter(e => e.jobId === job.id && e.status === 'active');
        const hasActiveEstimate = jobEstimates.length > 0;
        const activeEstimate = jobEstimates[0];

        // Map job status to pipeline stage
        // Pipeline stages: new_request, qualification, negotiation, approved, booked
        let pipelineStage: string;
        switch (job.status) {
          case 'lead_intake':
          case 'new':
            pipelineStage = 'new_request';
            break;
          case 'estimate_sent':
          case 'qualified':
            pipelineStage = 'qualification';
            break;
          case 'negotiating':
          case 'pending':
            pipelineStage = 'negotiation';
            break;
          case 'approved':
          case 'accepted':
            pipelineStage = 'approved';
            break;
          case 'scheduled':
          case 'booked':
          case 'in_progress':
          case 'completed':
            pipelineStage = 'booked';
            break;
          default:
            pipelineStage = 'new_request';
        }

        // Calculate age in days
        const createdAt = job.createdAt ? new Date(job.createdAt) : new Date();
        const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Get assigned user name from assignedTechs
        const assignedTechs = (job.assignedTechs as string[]) || [];
        const assignedUserName = assignedTechs.length > 0 ? assignedTechs[0] : undefined;

        // Format last activity
        const updatedAt = job.updatedAt ? new Date(job.updatedAt) : new Date();
        const hoursAgo = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60));
        let lastActivityAt: string;
        if (hoursAgo < 1) {
          lastActivityAt = 'Just now';
        } else if (hoursAgo < 24) {
          lastActivityAt = `${hoursAgo}h ago`;
        } else {
          const daysAgo = Math.floor(hoursAgo / 24);
          lastActivityAt = `${daysAgo}d ago`;
        }

        return {
          id: job.id,
          status: pipelineStage,
          customerId: job.clientId || '',
          customerName: contact?.name || contact?.company || 'Unknown',
          customerPhone: contact?.phone || undefined,
          customerEmail: contact?.email || undefined,
          jobTitle: job.title,
          totalValue: job.estimatedValue ? parseFloat(job.estimatedValue as string) : 0,
          assignedUserId: assignedTechs.length > 0 ? assignedTechs[0] : undefined,
          assignedUserName: assignedUserName,
          lastActivityAt: lastActivityAt,
          createdAt: createdAt.toISOString().split('T')[0],
          ageDays: ageDays,
          hasActiveEstimate: hasActiveEstimate,
          estimateId: activeEstimate?.id,
        };
      });

      res.json(pipelineCards);
    } catch (error) {
      logger.error("[Pipeline] Error fetching cards:", error);
      res.status(500).json({ error: "Failed to fetch pipeline cards" });
    }
  });

  // POST /api/pipeline/transition - Move a card between pipeline stages
  app.post("/api/pipeline/transition", async (req, res) => {
    try {
      const { cardId, fromStage, toStage } = req.body;

      if (!cardId || !fromStage || !toStage) {
        return res.status(400).json({ error: "cardId, fromStage, and toStage are required" });
      }

      const job = await storage.getJob(cardId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Map pipeline stage to job status
      let newStatus: string;
      switch (toStage) {
        case 'new_request':
          newStatus = 'lead_intake';
          break;
        case 'qualification':
          newStatus = 'estimate_sent';
          break;
        case 'negotiation':
          newStatus = 'negotiating';
          break;
        case 'approved':
          newStatus = 'approved';
          break;
        case 'booked':
          newStatus = 'scheduled';
          break;
        default:
          newStatus = job.status;
      }

      const updatedJob = await storage.updateJob(cardId, { status: newStatus });
      if (!updatedJob) {
        return res.status(500).json({ error: "Failed to update job status" });
      }

      // Create audit log entry
      await storage.createAuditLogEntry({
        userId: null,
        action: "pipeline_transition",
        entityType: "job",
        entityId: cardId,
        details: { fromStage, toStage, previousStatus: job.status, newStatus },
      });

      res.json({ success: true, job: updatedJob });
    } catch (error) {
      logger.error("[Pipeline] Error transitioning card:", error);
      res.status(500).json({ error: "Failed to transition pipeline card" });
    }
  });

  // POST /api/pipeline/book - Finalize booking for a job
  app.post("/api/pipeline/book", async (req, res) => {
    try {
      const { cardId, technicianId, scheduledStart, scheduledEnd, depositPaid } = req.body;

      if (!cardId) {
        return res.status(400).json({ error: "cardId is required" });
      }

      const job = await storage.getJob(cardId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Build update data
      const updateData: Partial<InsertJob> = {
        status: 'scheduled',
      };

      if (technicianId) {
        updateData.assignedTechs = [technicianId];
      }

      if (scheduledStart) {
        updateData.scheduledStart = new Date(scheduledStart);
      }

      if (scheduledEnd) {
        updateData.scheduledEnd = new Date(scheduledEnd);
      }

      const updatedJob = await storage.updateJob(cardId, updateData);
      if (!updatedJob) {
        return res.status(500).json({ error: "Failed to update job" });
      }

      // Create audit log entry
      await storage.createAuditLogEntry({
        userId: null,
        action: "job_booked",
        entityType: "job",
        entityId: cardId,
        details: { 
          technicianId, 
          scheduledStart, 
          scheduledEnd, 
          depositPaid,
          previousStatus: job.status 
        },
      });

      res.json({ success: true, job: updatedJob });
    } catch (error) {
      logger.error("[Pipeline] Error booking job:", error);
      res.status(500).json({ error: "Failed to book job" });
    }
  });

  app.get("/api/notes", async (_req, res) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validated = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_note",
        entityType: "note",
        entityId: note.id,
        details: { title: note.title },
      });
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    try {
      const validated = insertNoteSchema.partial().parse(req.body);
      const note = await storage.updateNote(req.params.id, validated);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_note",
        entityType: "note",
        entityId: note.id,
        details: validated,
      });
      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const success = await storage.deleteNote(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "delete_note",
        entityType: "note",
        entityId: req.params.id,
        details: {},
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  app.get("/api/appointments", async (_req, res) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const validated = insertAppointmentSchema.parse(req.body);
      const appointment = await storage.createAppointment(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_appointment",
        entityType: "appointment",
        entityId: appointment.id,
        details: validated,
      });
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Invalid appointment data" });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const validated = insertAppointmentSchema.partial().parse(req.body);
      const appointment = await storage.updateAppointment(req.params.id, validated);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_appointment",
        entityType: "appointment",
        entityId: appointment.id,
        details: validated,
      });
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to update appointment" });
    }
  });

  app.get("/api/files", async (_req, res) => {
    try {
      const files = await storage.getFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // ========================================
  // Workspace Files (Google Workspace Artifact Mirror)
  // ========================================
  app.get("/api/workspace/files", async (req, res) => {
    try {
      const { jobId, contactId, type } = req.query;
      const files = await storage.getWorkspaceFiles({
        jobId: jobId as string | undefined,
        contactId: contactId as string | undefined,
        type: type as string | undefined,
      });
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace files" });
    }
  });

  app.get("/api/workspace/files/:id", async (req, res) => {
    try {
      const file = await storage.getWorkspaceFile(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "Workspace file not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace file" });
    }
  });

  app.get("/api/audit-log", async (_req, res) => {
    try {
      const logs = await storage.getAuditLog();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  app.post("/api/audit-log", async (req, res) => {
    try {
      const { action, entityType, entityId, details } = req.body;
      if (!action) {
        return res.status(400).json({ error: "Action is required" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        details: details || null,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to create audit log entry" });
    }
  });

  // ========================================
  // Notifications (from Audit Log)
  // ========================================
  app.get("/api/notifications", async (_req, res) => {
    try {
      // Get audit log entries from the last 24 hours
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const allLogs = await storage.getAuditLog();

      const notificationActions = [
        "contact_created", "create_contact",
        "job_completed", "update_job_status",
        "payment_recorded", "record_payment",
        "estimate_approved", "update_estimate",
        "create_job", "create_estimate", "create_invoice",
      ];

      const notifications = allLogs
        .filter(log => {
          const logTime = new Date(log.timestamp);
          return logTime >= since && notificationActions.includes(log.action);
        })
        .slice(0, 20) // Limit to 20 most recent
        .map(log => ({
          id: log.id,
          title: formatNotificationTitle(log.action),
          message: formatNotificationMessage(log),
          timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
          read: false,
          type: getNotificationType(log.action),
        }));

      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  function formatNotificationTitle(action: string): string {
    const titles: Record<string, string> = {
      contact_created: "Contact Created",
      create_contact: "Contact Created",
      job_completed: "Job Completed",
      update_job_status: "Job Status Updated",
      payment_recorded: "Payment Received",
      record_payment: "Payment Received",
      estimate_approved: "Estimate Approved",
      update_estimate: "Estimate Updated",
      create_job: "Job Created",
      create_estimate: "Estimate Created",
      create_invoice: "Invoice Created",
    };
    return titles[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function formatNotificationMessage(log: any): string {
    const details = log.details as Record<string, any> || {};
    if (details.contactName) return `${details.contactName}`;
    if (details.jobTitle) return `${details.jobTitle}`;
    if (details.summary) return details.summary;
    return `${log.entityType || 'Record'} ${log.entityId ? '#' + log.entityId.substring(0, 8) : ''}`;
  }

  function getNotificationType(action: string): string {
    if (action.includes('payment') || action.includes('completed')) return 'success';
    if (action.includes('create') || action.includes('contact')) return 'info';
    return 'info';
  }

  // ========================================
  // Automation Ledger (Agent Action Logging)
  // ========================================
  app.get("/api/automation-ledger", async (req, res) => {
    try {
      const { agentName, actionType, mode, status, limit } = req.query;
      const entries = await storage.getAutomationLedgerEntries({
        agentName: agentName as string | undefined,
        actionType: actionType as string | undefined,
        mode: mode as string | undefined,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      
      // Return entries with consistent field names expected by frontend
      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        actionType: entry.actionType,
        agentName: entry.agentName,
        entityType: entry.entityType,
        entityId: entry.entityId,
        mode: entry.mode,
        status: entry.status,
        reason: entry.reason,
        diffJson: entry.diffJson,
        assistQueueId: entry.assistQueueId,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
      }));
      
      res.json(transformedEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation ledger entries" });
    }
  });
  
  // Helper function to generate human-readable summary
  function generateSummary(entry: {
    actionType: string;
    agentName: string;
    status?: string | null;
    reason?: string | null;
    diffJson?: unknown;
  }): string {
    const action = entry.actionType.replace(/_/g, " ").toLowerCase();
    const agent = entry.agentName;
    const status = entry.status ? ` (${entry.status})` : "";
    const diff = entry.diffJson as Record<string, unknown> | null;
    const context = diff?.userRequest ? `: "${String(diff.userRequest).slice(0, 50)}..."` : "";
    return `${agent} - ${action}${status}${context}`;
  }

  app.get("/api/automation-ledger/:id", async (req, res) => {
    try {
      const entry = await storage.getAutomationLedgerEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Ledger entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ledger entry" });
    }
  });

  // ========================================
  // Ready Execution (Human Authority & Dispatch)
  // Items that passed Review Queue (AI-validated) await human confirmation
  // Includes both ledger entries with status "ai_validated" AND approved proposals
  // ========================================
  app.get("/api/ready-execution", async (_req, res) => {
    try {
      // Get ledger entries that are ai_validated (from approval flow)
      const ledgerEntries = await storage.getAutomationLedgerEntries({
        status: "ai_validated",
        limit: 100,
      });
      
      // Also get approved proposals that haven't been executed yet
      const proposals = await storage.listStagedProposals({ 
        status: ["approved"] 
      });
      
      // Combine and return both sources
      // Transform proposals entries to match ledger format for display
      const combinedEntries = [
        ...ledgerEntries,
        ...proposals.map(p => ({
          id: p.id,
          timestamp: p.approvedAt || p.createdAt,
          agentName: "Proposal Agent",
          actionType: "Approved Proposal",
          entityType: "staged_proposal",
          entityId: p.id,
          mode: p.mode,
          status: "ai_validated" as const,
          diffJson: {
            userRequest: p.userRequest,
            actions: p.actions,
          },
          reason: null,
          assistQueueId: null,
          updatedAt: p.createdAt,
        })),
      ];
      
      res.json(combinedEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ready execution queue" });
    }
  });

  app.get("/api/ready-execution/:id", async (req, res) => {
    try {
      const entry = await storage.getAutomationLedgerEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      if (entry.status !== "ai_validated") {
        return res.status(400).json({ error: "Entry is not ready for execution" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entry" });
    }
  });

  app.post("/api/ready-execution/:id/execute", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || null;
      const executionResults: Array<{ tool: string; status: string; result?: unknown; error?: string }> = [];
      let dispatchStatus: "dispatched" | "dispatch_failed" | "no_payload" | "crm_executed" = "no_payload";
      let dispatchError: string | null = null;

      // P0 HARDENING: Check Kill Switch FIRST
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        logger.info(`[KILL SWITCH] Execution blocked for entry ${req.params.id} - kill switch active`);
        return res.status(503).json({
          error: "AI execution halted",
          message: "Global kill switch is active. All AI execution is paused.",
          killSwitchReason: aiSettings.killSwitchReason,
          killSwitchActivatedAt: aiSettings.killSwitchActivatedAt,
        });
      }

      // Try to find in automation_ledger first
      let entry = await storage.getAutomationLedgerEntry(req.params.id);
      
      if (entry) {
        // P0 HARDENING: Idempotency check - prevent duplicate execution
        if (entry.idempotencyKey) {
          const existingExecuted = await storage.getAutomationLedgerByIdempotencyKey(entry.idempotencyKey);
          if (existingExecuted && existingExecuted.id !== entry.id && existingExecuted.status === "executed") {
            logger.info(`[IDEMPOTENCY] Duplicate execution blocked for key ${entry.idempotencyKey}`);
            return res.status(409).json({
              error: "Duplicate execution blocked",
              message: "An action with this idempotency key has already been executed.",
              idempotencyKey: entry.idempotencyKey,
              existingLedgerId: existingExecuted.id,
              existingExecutedAt: existingExecuted.updatedAt,
            });
          }
        }

        // Found in automation_ledger
        if (entry.status !== "ai_validated") {
          return res.status(400).json({ 
            error: `Cannot execute entry with status: ${entry.status}. Only ai_validated entries can be executed.` 
          });
        }

        const diffJson = entry.diffJson as Record<string, unknown> | null;
        const proposedActions = diffJson?.proposedActions as Array<{ tool: string; args: unknown }> | undefined;
        
        if (proposedActions && proposedActions.length > 0) {
          logger.info(`[Ready Execution] Processing ${proposedActions.length} action(s) from ledger`);
          
          let hasExternalActions = false;
          let hasInternalActions = false;
          
          for (const action of proposedActions) {
            const actionType = classifyAction(action.tool);
            
            if (actionType === "EXTERNAL") {
              hasExternalActions = true;
              logger.info(`[Ready Execution] EXTERNAL action "${action.tool}" staged for agent dispatch`);
              // External actions are dispatched via approved proposals to external agent
              executionResults.push({
                tool: action.tool,
                status: "staged_for_dispatch",
                result: { message: "Staged for external agent dispatch via proposal" },
              });
            } else {
              hasInternalActions = true;
              logger.info(`[Ready Execution] Executing INTERNAL action "${action.tool}" directly`);
              
              try {
                const result = await executeAITool(
                  action.tool,
                  action.args,
                  { userId: userId || undefined, finalizationMode: "semi_autonomous" }
                );
                executionResults.push({
                  tool: action.tool,
                  status: "executed",
                  result,
                });
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Execution failed";
                executionResults.push({
                  tool: action.tool,
                  status: "failed",
                  error: errorMessage,
                });
              }
            }
          }
          
          if (hasExternalActions && !hasInternalActions) {
            dispatchStatus = "dispatched";
          } else if (hasInternalActions && !hasExternalActions) {
            dispatchStatus = "crm_executed";
          } else {
            dispatchStatus = executionResults.some(r => r.status === "dispatch_failed") 
              ? "dispatch_failed" 
              : "dispatched";
          }
          
        }

        await storage.updateAutomationLedgerEntry(req.params.id, {
          status: "executed",
          reason: dispatchStatus === "dispatch_failed" 
            ? `Executed but dispatch failed: ${dispatchError}` 
            : null,
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          details: {
            outcome: "confirmed",
            automationLedgerId: entry.id,
            actionType: entry.actionType,
            executionResults,
            dispatchStatus,
            dispatchError,
          },
        });
        
        await storage.createAutomationLedgerEntry({
          agentName: "Human",
          actionType: "HUMAN_EXECUTION_DECISION",
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          mode: "execute",
          status: "executed",
          diffJson: {
            decision: "confirmed",
            originalLedgerId: entry.id,
            executionResults,
            dispatchStatus,
          },
          reason: null,
        });

        logger.info(`[Ready Execution] Ledger entry completed: ${executionResults.length} actions executed`);

        return res.json({ 
          success: true, 
          status: "executed",
          source: "ledger",
          executionResults,
          dispatchStatus,
          dispatchError,
        });
      }
      
      // Not in ledger - try proposals directly by ID
      const proposalEntry = await storage.getStagedProposal(req.params.id);
      
      if (proposalEntry) {
        // P0 HARDENING: Idempotency check for proposals - prevent duplicate execution
        if (proposalEntry.idempotencyKey) {
          const existingEntry = await storage.getAutomationLedgerByIdempotencyKey(proposalEntry.idempotencyKey);
          if (existingEntry && existingEntry.status === "executed") {
            logger.info(`[IDEMPOTENCY] Duplicate proposal execution blocked for key ${proposalEntry.idempotencyKey}`);
            return res.status(409).json({
              error: "Duplicate execution blocked",
              message: "An action with this idempotency key has already been executed.",
              idempotencyKey: proposalEntry.idempotencyKey,
              existingLedgerId: existingEntry.id,
              existingExecutedAt: existingEntry.updatedAt,
            });
          }
        }

        // Found in proposals - check status
        if (proposalEntry.status !== "approved") {
          return res.status(400).json({ 
            error: `Cannot execute proposal with status: ${proposalEntry.status}. Only approved entries can be executed.` 
          });
        }
        
        // Execute the proposed tools - route INTERNAL vs EXTERNAL appropriately
        const actions = typeof proposalEntry.actions === "string" 
          ? JSON.parse(proposalEntry.actions) 
          : proposalEntry.actions;
        const actionPlan = actions as Array<{ tool: string; args: unknown }> | undefined;
        
        if (actionPlan && actionPlan.length > 0) {
          logger.info(`[Ready Execution] Processing ${actionPlan.length} action(s) from proposals`);
          
          let hasExternalActions = false;
          let hasInternalActions = false;
          
          // Entity ID resolution map - tracks created entity IDs for chained actions
          const createdEntities: {
            contactId?: string;
            estimateId?: string;
            invoiceId?: string;
            jobId?: string;
            appointmentId?: string;
          } = {};
          
          // Helper to check if a value is a placeholder
          const isPlaceholderValue = (val: string): boolean => {
            const lower = val.toLowerCase();
            // Match: new, placeholder, TBD-*, pending, temp, etc.
            return lower === 'new' || 
                   lower.includes('placeholder') || 
                   lower.startsWith('tbd') ||
                   lower === 'pending' ||
                   lower === 'temp' ||
                   lower.includes('tbd-') ||
                   lower.includes('_id') && !val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          };
          
          // Helper to resolve placeholder IDs in action args
          const resolveEntityIds = (args: unknown): unknown => {
            if (!args || typeof args !== 'object') return args;
            const resolved = { ...args as Record<string, unknown> };
            
            // Resolve contactId
            if (resolved.contactId && typeof resolved.contactId === 'string') {
              if (isPlaceholderValue(resolved.contactId) && createdEntities.contactId) {
                logger.info(`[Ready Execution] Resolving contactId: "${resolved.contactId}" → "${createdEntities.contactId}"`);
                resolved.contactId = createdEntities.contactId;
              }
            }
            
            // Resolve estimateId
            if (resolved.estimateId && typeof resolved.estimateId === 'string') {
              if (isPlaceholderValue(resolved.estimateId) && createdEntities.estimateId) {
                logger.info(`[Ready Execution] Resolving estimateId: "${resolved.estimateId}" → "${createdEntities.estimateId}"`);
                resolved.estimateId = createdEntities.estimateId;
              }
            }
            
            // Resolve invoiceId
            if (resolved.invoiceId && typeof resolved.invoiceId === 'string') {
              if (isPlaceholderValue(resolved.invoiceId) && createdEntities.invoiceId) {
                logger.info(`[Ready Execution] Resolving invoiceId: "${resolved.invoiceId}" → "${createdEntities.invoiceId}"`);
                resolved.invoiceId = createdEntities.invoiceId;
              }
            }
            
            // Resolve jobId
            if (resolved.jobId && typeof resolved.jobId === 'string') {
              if (isPlaceholderValue(resolved.jobId) && createdEntities.jobId) {
                logger.info(`[Ready Execution] Resolving jobId: "${resolved.jobId}" → "${createdEntities.jobId}"`);
                resolved.jobId = createdEntities.jobId;
              }
            }
            
            // Resolve placeholders in email body text
            if (resolved.body && typeof resolved.body === 'string') {
              let body = resolved.body;
              
              // Replace estimate ID placeholders in body
              if (createdEntities.estimateId) {
                const estimatePlaceholders = [
                  /\[Estimate ID Placeholder\]/gi,
                  /\[Estimate ID\]/gi,
                  /\[estimateId\]/gi,
                  /pending_revision/gi,
                  /TBD-ESTIMATE-ID/gi,
                ];
                for (const pattern of estimatePlaceholders) {
                  if (pattern.test(body)) {
                    logger.info(`[Ready Execution] Resolving estimate placeholder in body`);
                    body = body.replace(pattern, createdEntities.estimateId);
                  }
                }
              }
              
              // Note: paymentLinkUrl resolution happens on n8n side since stripe_create_payment_link is EXTERNAL
              // n8n workflow should inject the actual URL after creating it
              // Add metadata flag to tell n8n to inject payment link
              if (createdEntities.estimateId && /payment.?link/i.test(body)) {
                resolved._injectPaymentLink = true;
                resolved._estimateId = createdEntities.estimateId;
              }
              
              resolved.body = body;
            }
            
            return resolved;
          };
          
          // Helper to extract created entity ID from tool result
          const captureCreatedEntity = (toolName: string, result: unknown) => {
            if (!result || typeof result !== 'object') return;
            const res = result as Record<string, unknown>;
            
            // Check for success and data.id pattern
            if (res.success && res.data && typeof res.data === 'object') {
              const data = res.data as Record<string, unknown>;
              if (data.id && typeof data.id === 'string') {
                if (toolName === 'create_contact') {
                  createdEntities.contactId = data.id;
                  logger.info(`[Ready Execution] Captured contactId: ${data.id}`);
                } else if (toolName === 'create_estimate') {
                  createdEntities.estimateId = data.id;
                  logger.info(`[Ready Execution] Captured estimateId: ${data.id}`);
                } else if (toolName === 'create_invoice') {
                  createdEntities.invoiceId = data.id;
                  logger.info(`[Ready Execution] Captured invoiceId: ${data.id}`);
                } else if (toolName === 'create_job') {
                  createdEntities.jobId = data.id;
                  logger.info(`[Ready Execution] Captured jobId: ${data.id}`);
                } else if (toolName === 'create_appointment') {
                  createdEntities.appointmentId = data.id;
                  logger.info(`[Ready Execution] Captured appointmentId: ${data.id}`);
                }
              }
            }
          };
          
          // Pre-scan for bundled Stripe+Email pattern
          // If both stripe_create_payment_link and send_email are in the bundle,
          // we'll combine them so n8n can create the payment link first and inject it into the email
          const hasStripePaymentLink = actionPlan.some(a => a.tool === "stripe_create_payment_link");
          const hasSendEmail = actionPlan.some(a => a.tool === "send_email");
          const stripeEmailBundle = hasStripePaymentLink && hasSendEmail;
          
          if (stripeEmailBundle) {
            logger.info(`[Ready Execution] Detected Stripe+Email bundle - will combine for n8n sequencing`);
          }
          
          // Track if we've already dispatched the bundled Stripe+Email
          let stripeEmailDispatched = false;
          
          for (const action of actionPlan) {
            const actionType = classifyAction(action.tool);
            
            // Resolve placeholder IDs before execution
            const resolvedArgs = resolveEntityIds(action.args);
            
            if (actionType === "EXTERNAL") {
              hasExternalActions = true;
              
              // Handle bundled Stripe+Email pattern
              if (stripeEmailBundle && (action.tool === "stripe_create_payment_link" || action.tool === "send_email")) {
                if (stripeEmailDispatched) {
                  // Already dispatched the bundle, skip this action
                  logger.info(`[Ready Execution] Skipping "${action.tool}" - already included in bundled dispatch`);
                  executionResults.push({
                    tool: action.tool,
                    status: "dispatched_to_neo8",
                    result: { bundled: true, note: "Included in combined Stripe+Email dispatch" },
                  });
                  continue;
                }
                
                // First one we encounter - dispatch the combined bundle
                stripeEmailDispatched = true;
                
                // Find both actions and their args
                const stripeAction = actionPlan.find(a => a.tool === "stripe_create_payment_link");
                const emailAction = actionPlan.find(a => a.tool === "send_email");
                
                const stripeArgs = resolveEntityIds(stripeAction?.args);
                const emailArgs = resolveEntityIds(emailAction?.args);
                
                logger.info(`[Ready Execution] Bundled Stripe+Email staged for agent dispatch`);
                executionResults.push({
                  tool: "stripe_create_payment_link",
                  status: "staged_for_dispatch",
                  result: { message: "Staged for external agent dispatch via proposal" },
                });
                executionResults.push({
                  tool: "send_email",
                  status: "staged_for_dispatch",
                  result: { message: "Staged for external agent dispatch via proposal" },
                });
                continue;
              }
              
              // Regular EXTERNAL action dispatch
              logger.info(`[Ready Execution] EXTERNAL action "${action.tool}" staged for agent dispatch (from proposals)`);
              executionResults.push({
                tool: action.tool,
                status: "staged_for_dispatch",
                result: { message: "Staged for external agent dispatch via proposal" },
              });
            } else {
              hasInternalActions = true;
              logger.info(`[Ready Execution] Executing INTERNAL action "${action.tool}" directly (from proposals)`);
              
              try {
                const result = await executeAITool(
                  action.tool,
                  resolvedArgs,
                  { userId: userId || undefined, finalizationMode: "semi_autonomous" }
                );
                
                // Capture created entity IDs for subsequent actions
                captureCreatedEntity(action.tool, result);
                
                executionResults.push({
                  tool: action.tool,
                  status: "executed",
                  result,
                });
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Execution failed";
                executionResults.push({
                  tool: action.tool,
                  status: "failed",
                  error: errorMessage,
                });
              }
            }
          }
          
          if (hasExternalActions && !hasInternalActions) {
            dispatchStatus = "dispatched";
          } else if (hasInternalActions && !hasExternalActions) {
            dispatchStatus = "crm_executed";
          } else {
            dispatchStatus = executionResults.some(r => r.status === "dispatch_failed") 
              ? "dispatch_failed" 
              : "dispatched";
          }
        }

        await storage.updateStagedProposal(req.params.id, {
          status: "completed",
          completedAt: new Date(),
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: "staged_proposal",
          entityId: proposalEntry.id,
          details: {
            outcome: "confirmed",
            proposalId: proposalEntry.id,
            userRequest: proposalEntry.userRequest,
            executionResults,
            dispatchStatus,
          },
        });
        
        // P0 FIX: Check if ledger entry already exists for this idempotency key (created at proposal time)
        // If so, update it instead of creating a duplicate
        if (proposalEntry.idempotencyKey) {
          const existingEntry = await storage.getAutomationLedgerByIdempotencyKey(proposalEntry.idempotencyKey);
          if (existingEntry) {
            // Update existing ledger entry to executed status
            await storage.updateAutomationLedgerEntry(existingEntry.id, {
              status: "executed",
              diffJson: {
                ...(existingEntry.diffJson as Record<string, unknown> || {}),
                decision: "confirmed",
                executionResults,
                executedAt: new Date().toISOString(),
              },
            });
            logger.info(`[Ready Execution] Updated existing ledger entry ${existingEntry.id} to executed`);
          } else {
            // No existing entry, create new one
            await storage.createAutomationLedgerEntry({
              agentName: "Human",
              actionType: "HUMAN_EXECUTION_DECISION",
              entityType: "staged_proposal",
              entityId: proposalEntry.id,
              mode: "execute",
              status: "executed",
              diffJson: {
                decision: "confirmed",
                userRequest: proposalEntry.userRequest,
                actions: proposalEntry.actions,
                executionResults,
              },
              reason: null,
              assistQueueId: null,
              idempotencyKey: proposalEntry.idempotencyKey,
              reasoningSummary: proposalEntry.reasoning,
              executionTraceId: proposalEntry.id,
            });
          }
        } else {
          // No idempotency key, create new entry (legacy flow)
          await storage.createAutomationLedgerEntry({
            agentName: "Human",
            actionType: "HUMAN_EXECUTION_DECISION",
            entityType: "staged_proposal",
            entityId: proposalEntry.id,
            mode: "execute",
            status: "executed",
            diffJson: {
              decision: "confirmed",
              userRequest: proposalEntry.userRequest,
              actions: proposalEntry.actions,
              executionResults,
            },
            reason: null,
            assistQueueId: null,
          });
        }

        logger.info(`[Ready Execution] Staged proposal completed: ${executionResults.length} actions executed`);

        return res.json({ 
          success: true, 
          status: "executed",
          source: "staged_proposals",
          executionResults,
          dispatchStatus,
          dispatchError,
        });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or staged proposals" });
    } catch (error) {
      logger.error("[Ready Execution Execute] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to execute action";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/ready-execution/:id/reject", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || null;
      const { reason } = req.body || {};
      const rejectionReason = reason || "Rejected by human operator";
      
      // Try to find in automation_ledger first
      let entry = await storage.getAutomationLedgerEntry(req.params.id);
      
      if (entry) {
        // Found in automation_ledger
        if (entry.status !== "ai_validated") {
          return res.status(400).json({ 
            error: `Cannot reject entry with status: ${entry.status}. Only ai_validated entries can be rejected.` 
          });
        }

        await storage.updateAutomationLedgerEntry(req.params.id, {
          status: "rejected",
          reason: rejectionReason,
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          details: {
            outcome: "rejected",
            automationLedgerId: entry.id,
            actionType: entry.actionType,
            reason: rejectionReason,
          },
        });
        
        await storage.createAutomationLedgerEntry({
          agentName: "Human",
          actionType: "HUMAN_EXECUTION_DECISION",
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          mode: "execute",
          status: "human_rejected",
          diffJson: {
            decision: "rejected",
            originalLedgerId: entry.id,
          },
          reason: rejectionReason,
          assistQueueId: entry.assistQueueId || null,
        });

        return res.json({ success: true, status: "rejected", source: "ledger" });
      }
      
      // Not in ledger - try proposals directly by ID
      const proposalEntry = await storage.getStagedProposal(req.params.id);
      
      if (proposalEntry) {
        // Found in proposals - check status
        if (proposalEntry.status !== "approved") {
          return res.status(400).json({ 
            error: `Cannot reject proposal with status: ${proposalEntry.status}. Only approved entries can be rejected.` 
          });
        }
        
        // Update status to rejected
        await storage.updateStagedProposal(req.params.id, {
          status: "rejected",
          rejectedAt: new Date(),
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: "staged_proposal",
          entityId: proposalEntry.id,
          details: {
            outcome: "rejected",
            proposalId: proposalEntry.id,
            userRequest: proposalEntry.userRequest,
            reason: rejectionReason,
          },
        });
        
        await storage.createAutomationLedgerEntry({
          agentName: "Human",
          actionType: "HUMAN_EXECUTION_DECISION",
          entityType: "staged_proposal",
          entityId: proposalEntry.id,
          mode: "execute",
          status: "human_rejected",
          diffJson: {
            decision: "rejected",
            userRequest: proposalEntry.userRequest,
            actions: proposalEntry.actions,
          },
          reason: rejectionReason,
          assistQueueId: null,
        });

        return res.json({ success: true, status: "rejected", source: "staged_proposals" });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or staged proposals" });
    } catch (error) {
      logger.error("[Ready Execution Reject] Error:", error);
      res.status(500).json({ error: "Failed to reject action" });
    }
  });

  // P1 HARDENING: Handle Manually - Operator takes over outside the AI system
  // This is distinct from "reject" - it means the operator handled the request themselves
  app.post("/api/ready-execution/:id/handle-manually", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || null;
      const { note, resolution } = req.body as { note?: string; resolution?: string };
      
      if (!note) {
        return res.status(400).json({ error: "Manual handling note is required" });
      }

      // Try to find in proposals first
      const proposalEntry = await storage.getStagedProposal(req.params.id);
      
      if (proposalEntry) {
        // Mark as handled manually
        await storage.updateStagedProposal(req.params.id, {
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason: `Handled manually: ${note}`,
        });

        // Create audit log
        await storage.createAuditLogEntry({
          userId,
          action: "OPERATOR_MANUAL_HANDLING",
          entityType: "staged_proposal",
          entityId: proposalEntry.id,
          details: {
            outcome: "handled_manually",
            proposalId: proposalEntry.id,
            userRequest: proposalEntry.userRequest,
            manualNote: note,
            resolution: resolution || "Manual handling completed",
          },
        });
        
        // Create ledger entry
        await storage.createAutomationLedgerEntry({
          agentName: "Human (Operator)",
          actionType: "OPERATOR_MANUAL_HANDLING",
          entityType: "staged_proposal",
          entityId: proposalEntry.id,
          mode: "manual",
          status: "handled_manually",
          diffJson: {
            decision: "handled_manually",
            userRequest: proposalEntry.userRequest,
            actions: proposalEntry.actions,
            manualNote: note,
            resolution: resolution || "Manual handling completed",
          },
          reason: `Operator handled manually: ${note}`,
        });

        logger.info(`[Ready Execution] Proposal ${req.params.id} handled manually by operator`);

        return res.json({ 
          success: true, 
          status: "handled_manually",
          message: "Proposal marked as handled manually by operator",
          handledManually: true,
        });
      }

      // Also check automation_ledger
      const ledgerEntry = await storage.getAutomationLedgerEntry(req.params.id);
      
      if (ledgerEntry) {
        await storage.updateAutomationLedgerEntry(req.params.id, {
          status: "handled_manually",
          reason: `Operator handled manually: ${note}`,
        });

        await storage.createAuditLogEntry({
          userId,
          action: "OPERATOR_MANUAL_HANDLING",
          entityType: ledgerEntry.entityType,
          entityId: ledgerEntry.entityId || null,
          details: {
            outcome: "handled_manually",
            automationLedgerId: ledgerEntry.id,
            manualNote: note,
            resolution: resolution || "Manual handling completed",
          },
        });

        logger.info(`[Ready Execution] Ledger entry ${req.params.id} handled manually by operator`);

        return res.json({ 
          success: true, 
          status: "handled_manually",
          source: "ledger",
          message: "Entry marked as handled manually by operator",
          handledManually: true,
        });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or staged proposals" });
    } catch (error) {
      logger.error("[Ready Execution Handle Manually] Error:", error);
      res.status(500).json({ error: "Failed to mark entry as handled manually" });
    }
  });

  // ========================================
  // NEO8 CALLBACK ENDPOINT
  // ========================================
  // n8n calls this endpoint after completing external actions (e.g., Google Docs creation)
  // to update the ledger with results
  const neo8CallbackSchema = z.object({
    ledgerId: z.string().uuid(),
    action: z.string(),
    status: z.enum(["success", "failed", "partial"]),
    result: z.object({
      // Support both flat and nested document structure from n8n
      documentId: z.string().optional(),
      documentUrl: z.string().optional(),
      document: z.object({
        id: z.string().optional(),
        url: z.string().optional(),
        title: z.string().optional(),
      }).optional(),
      sheetId: z.string().optional(),
      sheetUrl: z.string().optional(),
      emailSent: z.boolean().optional(),
      smsSent: z.boolean().optional(),
      error: z.string().optional(),
    }).passthrough().optional(),
    error: z.string().optional(),
    timestamp: z.string().optional(),
  });

  app.post("/api/neo8/callback", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      logger.info("[Neo8 Callback] Received:", JSON.stringify(req.body, null, 2));
      
      const validated = neo8CallbackSchema.parse(req.body);
      
      // Find the ledger entry
      const entry = await storage.getAutomationLedgerEntry(validated.ledgerId);
      if (!entry) {
        logger.error(`[Neo8 Callback] Ledger entry not found: ${validated.ledgerId}`);
        return res.status(404).json({ error: "Ledger entry not found" });
      }
      
      // Deep merge n8n results into existing diffJson (preserves proposedActions and prior audit data)
      const existingDiff = entry.diffJson as Record<string, unknown> || {};
      const updatedDiff = {
        ...existingDiff,
        neo8Result: {
          action: validated.action,
          status: validated.status,
          result: validated.result,
          error: validated.error,
          callbackReceivedAt: new Date().toISOString(),
        },
      };
      
      // Map callback status to allowed ledger statuses
      // Allowed: queued, ai_validated, executed, execution_failed, dispatch_failed, rejected, handled_manually
      const newStatus = validated.status === "success" 
        ? "executed" 
        : "execution_failed"; // both "failed" and "partial" map to execution_failed
      
      await storage.updateAutomationLedgerEntry(validated.ledgerId, {
        status: newStatus,
        diffJson: updatedDiff,
      });
      
      // Persist document artifacts for Google Docs operations
      // Support both flat (result.documentId) and nested (result.document.id) payloads from n8n
      const docId = validated.result?.documentId || validated.result?.document?.id;
      const docUrl = validated.result?.documentUrl || validated.result?.document?.url;
      const docTitle = validated.result?.document?.title;
      
      if (validated.status === "success" && docId) {
        const diffJson = entry.diffJson as Record<string, unknown> || {};
        const proposedActions = (diffJson.proposedActions || []) as Array<{ tool?: string; args?: Record<string, unknown> }>;
        const createDocAction = proposedActions.find(a => a.tool === "google_docs_create");
        const title = docTitle || createDocAction?.args?.title as string || "Untitled Document";
        
        try {
          // Check if artifact already exists (handles n8n retries)
          const existing = await storage.getDocumentArtifactByDocumentId(docId);
          if (existing) {
            // Upsert: update existing artifact
            await storage.updateDocumentArtifact(existing.id, {
              documentUrl: docUrl || existing.documentUrl,
              title: title || existing.title,
              ledgerId: validated.ledgerId,
            });
            logger.info(`[Neo8 Callback] Updated document artifact: ${docId}`);
          } else {
            // Insert new artifact
            await storage.createDocumentArtifact({
              documentId: docId,
              documentUrl: docUrl || null,
              title,
              documentType: "google_doc",
              contactId: entry.entityType === "contact" ? entry.entityId : null,
              jobId: entry.entityType === "job" ? entry.entityId : null,
              ledgerId: validated.ledgerId,
              createdBy: "action_ai",
            });
            logger.info(`[Neo8 Callback] Created document artifact: ${docId}`);
          }
        } catch (err) {
          logger.error("[Neo8 Callback] Failed to persist document artifact:", err);
        }
      }
      
      // Create audit log
      await storage.createAuditLogEntry({
        userId: null,
        action: "NEO8_CALLBACK_RECEIVED",
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        details: {
          ledgerId: validated.ledgerId,
          action: validated.action,
          status: validated.status,
          result: validated.result,
          error: validated.error,
        },
      });
      
      logger.info(`[Neo8 Callback] Updated ledger ${validated.ledgerId} with status: ${newStatus}`);
      
      res.json({ 
        success: true, 
        message: "Callback processed successfully",
        ledgerId: validated.ledgerId,
        newStatus,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("[Neo8 Callback] Validation error:", error.errors);
        return res.status(400).json({ error: "Invalid callback payload", details: error.errors });
      }
      logger.error("[Neo8 Callback] Error:", error);
      res.status(500).json({ error: "Failed to process callback" });
    }
  });

  app.get("/api/estimates", async (req, res) => {
    try {
      const estimates = await storage.getEstimates();
      const pageParam = req.query.page as string | undefined;
      const limitParam = req.query.limit as string | undefined;

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50") || 50));
        const total = estimates.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const data = estimates.slice(offset, offset + limit);
        res.json({ data, total, page, limit, totalPages });
      } else {
        res.json(estimates);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estimates" });
    }
  });

  app.get("/api/estimates/:id", async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: "Estimate not found" });
      }
      res.json(estimate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch estimate" });
    }
  });

  app.post("/api/estimates", async (req, res) => {
    try {
      const validated = insertEstimateSchema.parse(req.body);
      
      // Calculate totals from line items if not provided
      let subtotal = parseFloat(validated.subtotal || "0");
      if (validated.lineItems && Array.isArray(validated.lineItems) && subtotal === 0) {
        subtotal = validated.lineItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number }) => {
          const qty = item.quantity || 0;
          const price = item.unitPrice || 0;
          return sum + (qty * price);
        }, 0);
      }
      const taxRate = 0; // Can be configured per estimate later
      const taxTotal = subtotal * taxRate;
      const totalAmount = subtotal + taxTotal;
      
      const estimateWithTotals = {
        ...validated,
        subtotal: subtotal.toString(),
        taxTotal: taxTotal.toString(),
        totalAmount: totalAmount.toString(),
      };
      
      const estimate = await storage.createEstimate(estimateWithTotals);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_estimate",
        entityType: "estimate",
        entityId: estimate.id,
        details: { contactId: estimate.contactId, totalAmount: estimate.totalAmount },
      });
      res.status(201).json(estimate);
    } catch (error) {
      res.status(400).json({ error: "Invalid estimate data" });
    }
  });

  app.patch("/api/estimates/:id", async (req, res) => {
    try {
      const validated = insertEstimateSchema.partial().parse(req.body);
      
      // Recalculate totals if line items changed
      let estimateData = { ...validated };
      if (validated.lineItems && Array.isArray(validated.lineItems)) {
        const subtotal = validated.lineItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number }) => {
          const qty = item.quantity || 0;
          const price = item.unitPrice || 0;
          return sum + (qty * price);
        }, 0);
        const taxRate = 0;
        const taxTotal = subtotal * taxRate;
        const totalAmount = subtotal + taxTotal;
        estimateData = {
          ...validated,
          subtotal: subtotal.toString(),
          taxTotal: taxTotal.toString(),
          totalAmount: totalAmount.toString(),
        };
      }
      
      const estimate = await storage.updateEstimate(req.params.id, estimateData);
      if (!estimate) {
        return res.status(404).json({ error: "Estimate not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_estimate",
        entityType: "estimate",
        entityId: estimate.id,
        details: validated,
      });
      res.json(estimate);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message, details: error });
      } else {
        res.status(400).json({ error: "Failed to update estimate" });
      }
    }
  });

  app.delete("/api/estimates/:id", async (req, res) => {
    try {
      const success = await storage.deleteEstimate(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Estimate not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "delete_estimate",
        entityType: "estimate",
        entityId: req.params.id,
        details: {},
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete estimate" });
    }
  });

  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      const pageParam = req.query.page as string | undefined;
      const limitParam = req.query.limit as string | undefined;

      if (pageParam || limitParam) {
        const page = Math.max(1, parseInt(pageParam || "1") || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limitParam || "50") || 50));
        const total = invoices.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const data = invoices.slice(offset, offset + limit);
        res.json({ data, total, page, limit, totalPages });
      } else {
        res.json(invoices);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const validated = insertInvoiceSchema.parse(req.body);
      
      // Calculate totals from line items if not provided
      let subtotal = parseFloat(validated.subtotal || "0");
      if (validated.lineItems && Array.isArray(validated.lineItems) && subtotal === 0) {
        subtotal = validated.lineItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number }) => {
          const qty = item.quantity || 0;
          const price = item.unitPrice || 0;
          return sum + (qty * price);
        }, 0);
      }
      const taxRate = 0;
      const taxTotal = subtotal * taxRate;
      const totalAmount = subtotal + taxTotal;
      
      const invoiceWithTotals = {
        ...validated,
        subtotal: subtotal.toString(),
        taxTotal: taxTotal.toString(),
        totalAmount: totalAmount.toString(),
      };
      
      const invoice = await storage.createInvoice(invoiceWithTotals);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_invoice",
        entityType: "invoice",
        entityId: invoice.id,
        details: { jobId: invoice.jobId, totalAmount: invoice.totalAmount },
      });
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice data" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const validated = insertInvoiceSchema.partial().parse(req.body);
      
      // Recalculate totals if line items changed
      let invoiceData = { ...validated };
      if (validated.lineItems && Array.isArray(validated.lineItems)) {
        const subtotal = validated.lineItems.reduce((sum: number, item: { quantity?: number; unitPrice?: number }) => {
          const qty = item.quantity || 0;
          const price = item.unitPrice || 0;
          return sum + (qty * price);
        }, 0);
        const taxRate = 0;
        const taxTotal = subtotal * taxRate;
        const totalAmount = subtotal + taxTotal;
        invoiceData = {
          ...validated,
          subtotal: subtotal.toString(),
          taxTotal: taxTotal.toString(),
          totalAmount: totalAmount.toString(),
        };
      }
      
      const invoice = await storage.updateInvoice(req.params.id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_invoice",
        entityType: "invoice",
        entityId: invoice.id,
        details: validated,
      });
      res.json(invoice);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message, details: error });
      } else {
        res.status(400).json({ error: "Failed to update invoice" });
      }
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "delete_invoice",
        entityType: "invoice",
        entityId: req.params.id,
        details: {},
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  app.get("/api/payments", async (_req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/:id", async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const validated = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "record_payment",
        entityType: "payment",
        entityId: payment.id,
        details: { invoiceId: payment.invoiceId, amount: payment.amount },
      });
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data" });
    }
  });

  app.patch("/api/payments/:id", async (req, res) => {
    try {
      const validated = insertPaymentSchema.partial().parse(req.body);
      const payment = await storage.updatePayment(req.params.id, validated);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_payment",
        entityType: "payment",
        entityId: payment.id,
        details: validated,
      });
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to update payment" });
    }
  });

  // ========================================
  // PAYMENT SLIPS (Draft Payments)
  // ========================================

  app.get("/api/payment-slips", async (_req, res) => {
    try {
      const slips = await storage.getPaymentSlips();
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment slips" });
    }
  });

  app.get("/api/payment-slips/:id", async (req, res) => {
    try {
      const slip = await storage.getPaymentSlip(req.params.id);
      if (!slip) {
        return res.status(404).json({ error: "Payment slip not found" });
      }
      res.json(slip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment slip" });
    }
  });

  app.post("/api/payment-slips", async (req, res) => {
    try {
      const { origin, amount, currency, contactId, customerEmail, customerName, description, memo, invoiceId, jobId, paymentMethodTypes } = req.body;
      
      const slip = await storage.createPaymentSlip({
        origin: origin || "human",
        status: "draft",
        amount,
        currency: currency || "usd",
        contactId: contactId || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        description: description || null,
        memo: memo || null,
        invoiceId: invoiceId || null,
        jobId: jobId || null,
        paymentMethodTypes: paymentMethodTypes || ["card"],
        createdBy: null,
      });

      await storage.createAuditLogEntry({
        userId: null,
        action: "PAYMENT_SLIP_CREATED",
        entityType: "payment_slip",
        entityId: slip.id,
        details: { origin: slip.origin, amount: slip.amount, contactId: slip.contactId },
      });

      res.status(201).json(slip);
    } catch (error) {
      res.status(400).json({ error: "Failed to create payment slip" });
    }
  });

  app.post("/api/payment-slips/:id/execute", async (req, res) => {
    try {
      const slipId = req.params.id;
      const slip = await storage.getPaymentSlip(slipId);
      
      if (!slip) {
        return res.status(404).json({ error: "Payment slip not found" });
      }

      // Authority enforcement: AI-originated slips must be approved first
      if (slip.origin === "ai" && slip.status !== "approved") {
        return res.status(403).json({ 
          error: "AI-created payment slips require approval before execution. Send to Review Queue first.",
          requiresApproval: true
        });
      }

      // Generate traceId for observability and correlation (format: pay_<nanoid>)
      const traceId = `pay_${nanoid(12)}`;

      // Dispatch to n8n webhook for Stripe execution
      const webhookPayload = {
        slipId: slip.id,
        traceId,
        origin: slip.origin,
        amount: slip.amount,
        currency: slip.currency,
        contactId: slip.contactId,
        customerEmail: slip.customerEmail,
        customerName: slip.customerName,
        description: slip.description,
        invoiceId: slip.invoiceId,
        jobId: slip.jobId,
        paymentMethodTypes: slip.paymentMethodTypes,
        timestamp: new Date().toISOString(),
      };

      // Update slip status to "sent" and store traceId
      await storage.updatePaymentSlip(slipId, { 
        status: "sent",
        sentAt: new Date(),
        traceId
      });
      
      // Log execution request to ledger with traceId for correlation
      await storage.createAuditLogEntry({
        userId: null,
        action: "PAYMENT_EXECUTION_REQUESTED",
        entityType: "payment_slip",
        entityId: slipId,
        details: { 
          traceId,
          origin: slip.origin,
          amount: slip.amount,
          status: "sent", 
          executedAt: new Date(),
          note: "External dispatch disabled - use proposal-based dispatch",
        },
      });

      res.json({ 
        success: true, 
        message: "Payment slip execution initiated", 
        slipId,
        traceId,
        dispatched: false,
        note: "External dispatch disabled - use proposal-based dispatch",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to execute payment slip" });
    }
  });

  // ========================================
  // SETTINGS
  // ========================================

  const CREDENTIAL_FIELDS = ['openaiApiKey', 'stripeSecretKey', 'twilioAccountSid', 'twilioAuthToken', 'sendgridApiKey', 'n8nWebhookUrl'] as const;

  function maskCredential(value: string | null): string {
    if (!value || value.length < 8) return value ? '••••••••' : '';
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
  }

  function maskSettingsCredentials(settings: any): any {
    const masked = { ...settings };
    for (const field of CREDENTIAL_FIELDS) {
      if (masked[field]) {
        masked[field] = maskCredential(masked[field]);
      }
    }
    return masked;
  }

  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        const defaultSettings = {
          id: 'default',
          agentMode: 'assist',
          autoEmail: true,
          autoSchedule: true,
          autoStatus: false,
          companyName: 'Smart Klix CRM',
          primaryColor: '#FDB913',
          secondaryColor: '#1E40AF',
          logoUrl: null,
          n8nWebhookUrl: null,
          openaiApiKey: null,
          stripeSecretKey: null,
          twilioAccountSid: null,
          twilioAuthToken: null,
          sendgridApiKey: null,
          smsTemplateAppointment: null,
          smsTemplateInvoice: null,
          emailTemplateEstimate: null,
          updatedAt: new Date(),
        };
        return res.json(maskSettingsCredentials(defaultSettings));
      }
      res.json(maskSettingsCredentials(settings));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", requireRole("admin"), async (req, res) => {
    try {
      const validated = insertSettingsSchema.partial().parse(req.body);
      const oldSettings = await storage.getSettings();
      const settings = await storage.updateSettings(validated);
      // Strip credentials from audit log details
      const { openaiApiKey, stripeSecretKey, twilioAccountSid, twilioAuthToken, sendgridApiKey, n8nWebhookUrl, ...safeDetails } = validated as any;
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_settings",
        entityType: "settings",
        entityId: settings.id,
        details: {
          ...safeDetails,
          ...(openaiApiKey ? { openaiApiKey: "[REDACTED]" } : {}),
          ...(stripeSecretKey ? { stripeSecretKey: "[REDACTED]" } : {}),
          ...(twilioAccountSid ? { twilioAccountSid: "[REDACTED]" } : {}),
          ...(twilioAuthToken ? { twilioAuthToken: "[REDACTED]" } : {}),
          ...(sendgridApiKey ? { sendgridApiKey: "[REDACTED]" } : {}),
          ...(n8nWebhookUrl ? { n8nWebhookUrl: "[REDACTED]" } : {}),
        },
      });
      // Create ledger entry if agentMode changed
      if (req.body.agentMode && req.body.agentMode !== oldSettings?.agentMode) {
        await storage.createAutomationLedgerEntry({
          actionType: "agent_mode_changed",
          entityType: "settings",
          entityId: "global",
          diffJson: { from: oldSettings?.agentMode, to: req.body.agentMode },
          reason: "Operator changed autonomy mode",
          status: "recorded",
          agentName: "system",
        });
      }
      res.json(maskSettingsCredentials(settings));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  // Save a single credential
  app.post("/api/settings/credentials", async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!CREDENTIAL_FIELDS.includes(key)) {
        return res.status(400).json({ error: "Invalid credential key" });
      }
      const update: any = { [key]: value };
      const settings = await storage.updateSettings(update);
      // Log WITHOUT the actual value
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_credential",
        entityType: "settings",
        entityId: settings.id?.toString() || "default",
        details: { key, summary: `Credential '${key}' was updated` },
      });
      res.json({ success: true, key, masked: maskCredential(value) });
    } catch (error) {
      res.status(500).json({ error: "Failed to update credential" });
    }
  });

  // One-time reveal of a credential
  app.post("/api/settings/credentials/reveal", async (req, res) => {
    try {
      const { key } = req.body;
      if (!CREDENTIAL_FIELDS.includes(key)) {
        return res.status(400).json({ error: "Invalid credential key" });
      }
      const settings = await storage.getSettings();
      if (!settings || !(settings as any)[key]) {
        return res.status(404).json({ error: "Credential not found" });
      }
      // Log the reveal action
      await storage.createAuditLogEntry({
        userId: null,
        action: "reveal_credential",
        entityType: "settings",
        entityId: settings.id?.toString() || "default",
        details: { key, summary: `Credential '${key}' was revealed` },
      });
      res.json({ key, value: (settings as any)[key] });
    } catch (error) {
      res.status(500).json({ error: "Failed to reveal credential" });
    }
  });

  // Policy Agent config endpoints removed — validation handled by validator.ts

  // ========================================
  // COMPANY INSTRUCTIONS (Per-Company AI Config)
  // ========================================

  app.get("/api/company-instructions", async (_req, res) => {
    try {
      const instructions = await storage.getCompanyInstructions();
      res.json(instructions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company instructions" });
    }
  });

  app.get("/api/company-instructions/:id", async (req, res) => {
    try {
      const instructions = await storage.getCompanyInstructionsById(req.params.id);
      if (!instructions) {
        return res.status(404).json({ error: "Company instructions not found" });
      }
      res.json(instructions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company instructions" });
    }
  });

  app.post("/api/company-instructions", async (req, res) => {
    try {
      const validated = insertCompanyInstructionsSchema.parse(req.body);
      
      // Check if company already exists
      const existing = await storage.getCompanyInstructionsByName(validated.companyName);
      if (existing) {
        return res.status(400).json({ error: "Company instructions already exist for this company name" });
      }
      
      const instructions = await storage.createCompanyInstructions(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_company_instructions",
        entityType: "company_instructions",
        entityId: instructions.id,
        details: { companyName: validated.companyName },
      });
      res.status(201).json(instructions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create company instructions" });
    }
  });

  app.patch("/api/company-instructions/:id", async (req, res) => {
    try {
      const validated = insertCompanyInstructionsSchema.partial().parse(req.body);
      const instructions = await storage.updateCompanyInstructions(req.params.id, validated);
      if (!instructions) {
        return res.status(404).json({ error: "Company instructions not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_company_instructions",
        entityType: "company_instructions",
        entityId: instructions.id,
        details: validated,
      });
      res.json(instructions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update company instructions" });
    }
  });

  app.delete("/api/company-instructions/:id", async (req, res) => {
    try {
      const existing = await storage.getCompanyInstructionsById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Company instructions not found" });
      }
      await storage.deleteCompanyInstructions(req.params.id);
      await storage.createAuditLogEntry({
        userId: null,
        action: "delete_company_instructions",
        entityType: "company_instructions",
        entityId: req.params.id,
        details: { companyName: existing.companyName },
      });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company instructions" });
    }
  });

  // ========================================
  // AI SETTINGS (Unified Configuration)
  // ========================================

  app.get("/api/ai/settings", async (_req, res) => {
    try {
      const settings = await storage.getAiSettings();
      if (!settings) {
        const defaultSettings = {
          id: 'default',
          edgeAgentPrompt: "You are a helpful AI assistant for Smart Klix CRM's external chat widget. You help capture leads, schedule appointments, and answer customer questions. Always be professional, friendly, and action-oriented. When a visitor provides their information, automatically create a contact record.",
          discoveryAiPrompt: `You are Information AI - a read-only assistant for querying CRM data. You help answer questions about your business using natural language.

## WHAT YOU CAN DO
- Look up contacts, jobs, estimates, invoices, payments
- Check pipeline status and queue status
- Find notes and appointment history
- Answer "How many..." and "Show me..." type questions

## WHAT I CANNOT DO
- Create, update, or delete any records
- Send emails, estimates, or invoices
- Execute any actions that change the system

If you need to make changes, use the Action Console instead.`,
          actionAiPrompt: `You are Proposal Agent - the operational brain for Smart Klix CRM.

## CONTACT SAFETY (ALWAYS DO THIS)
Before creating ANY contact:
1. ALWAYS call search_contacts first
2. If matches found: "I found 2 people named Joe - Joe Smith and Joe Garcia. Which one, or create new?"
3. If creating new, ask for full name + phone OR email

## QUOTE/ESTIMATE CREATION
When user asks to send a quote, gather:
1. Customer (search first for duplicates)
2. Quote Title (e.g., "AC Repair")
3. Line Items with prices
4. Total Amount
5. Payment Terms

After creating estimate, ALWAYS propose sending payment request.

## PROGRESSIVE CLARIFICATION
- Never assume missing info - ask for it
- Be conversational, not robotic`,
          masterArchitectPrompt: "You are Policy Agent - responsible for validating Proposal Agent actions against business logic and safety schemas before human approval.",
          companyKnowledge: "Company Name: Smart Klix CRM\nIndustry: Field Service Management\nServices: HVAC, Plumbing, Electrical\nBusiness Hours: Mon-Fri 8AM-6PM, Sat 9AM-3PM\nEmergency Service: 24/7 available\nService Area: Greater metropolitan area, 50-mile radius",
          behaviorRules: "1. Always verify contact information before creating jobs\n2. Suggest follow-ups for open estimates older than 7 days\n3. Flag invoices unpaid after 30 days\n4. Recommend scheduling for approved estimates\n5. Maintain professional tone in all communications\n6. Auto-create contacts from widget interactions with complete info",
          globalEnabled: true,
          updatedAt: new Date(),
        };
        return res.json(defaultSettings);
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI Settings" });
    }
  });

  app.post("/api/ai/settings", async (req, res) => {
    try {
      const validated = insertAiSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateAiSettings(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_ai_settings",
        entityType: "ai_settings",
        entityId: settings.id,
        details: validated,
      });
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to save AI Settings" });
    }
  });

  // ========================================
  // GLOBAL KILL SWITCH (P0 HARDENING)
  // ========================================

  app.get("/api/ai/kill-switch", async (_req, res) => {
    try {
      const settings = await storage.getAiSettings();
      res.json({ 
        active: settings?.killSwitchActive ?? false,
        activatedAt: settings?.killSwitchActivatedAt ?? null,
        activatedBy: settings?.killSwitchActivatedBy ?? null,
        reason: settings?.killSwitchReason ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get kill switch status" });
    }
  });

  app.post("/api/ai/kill-switch/activate", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || null;
      const { reason } = req.body as { reason?: string };
      
      const settings = await storage.updateAiSettings({
        killSwitchActive: true,
        killSwitchActivatedAt: new Date(),
        killSwitchActivatedBy: userId,
        killSwitchReason: reason || "Emergency kill switch activated",
      });
      
      await storage.createAuditLogEntry({
        userId,
        action: "kill_switch_activated",
        entityType: "ai_settings",
        entityId: "default",
        details: { reason: reason || "Emergency kill switch activated" },
      });
      
      logger.info(`[KILL SWITCH] Activated by ${userId || "system"}: ${reason || "No reason provided"}`);
      
      res.json({ 
        success: true, 
        message: "Kill switch activated - all AI execution halted",
        active: true,
        activatedAt: settings.killSwitchActivatedAt,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to activate kill switch" });
    }
  });

  app.post("/api/ai/kill-switch/deactivate", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || null;
      
      const settings = await storage.updateAiSettings({
        killSwitchActive: false,
        killSwitchActivatedAt: null,
        killSwitchActivatedBy: null,
        killSwitchReason: null,
      });
      
      await storage.createAuditLogEntry({
        userId,
        action: "kill_switch_deactivated",
        entityType: "ai_settings",
        entityId: "default",
        details: {},
      });
      
      logger.info(`[KILL SWITCH] Deactivated by ${userId || "system"}`);
      
      res.json({ 
        success: true, 
        message: "Kill switch deactivated - AI execution resumed",
        active: false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate kill switch" });
    }
  });

  // AI Voice Dispatch Config endpoints - dispatch metadata only (behavior lives on external voice server)
  app.get("/api/ai/voice-dispatch/config", async (_req, res) => {
    try {
      const config = await storage.getAiVoiceDispatchConfig();
      if (!config) {
        const defaultConfig = {
          id: 'default',
          enabled: false,
          voiceServerUrl: null,
          webhookSecret: null,
          storeTranscript: true,
          autoCreateContact: true,
          autoCreateNote: true,
          maxCallDuration: 300,
          useOutsideBusinessHours: true,
          updatedAt: new Date(),
        };
        return res.json(defaultConfig);
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI Voice Dispatch config" });
    }
  });

  app.post("/api/ai/voice-dispatch/config", async (req, res) => {
    try {
      const validated = insertAiVoiceDispatchConfigSchema.partial().parse(req.body);
      const config = await storage.updateAiVoiceDispatchConfig(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_ai_voice_dispatch_config",
        entityType: "ai_voice_dispatch_config",
        entityId: config.id,
        details: validated,
      });
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid config data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to save AI Voice Dispatch config" });
    }
  });

  // Voice Dispatch Context Endpoint - Provides CRM context for external voice server
  // All AI behavior/prompts live on external voice server - CRM only provides caller context
  const voiceContextSchema = z.object({
    caller_phone: z.string(),
    conversation_id: z.string(),
  });

  // Provides caller context to external voice server
  app.post("/api/voice/context", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const validated = voiceContextSchema.parse(req.body);
      
      // Check if voice dispatch is enabled
      const voiceConfig = await storage.getAiVoiceDispatchConfig();
      if (!voiceConfig?.enabled) {
        return res.status(503).json({ 
          error: "AI Voice is not enabled",
          enabled: false,
        });
      }

      // Look up caller in contacts
      const contacts = await storage.getContacts();
      const callerContact = contacts.find(c => c.phone === validated.caller_phone);

      // Return CRM context for external voice server to use
      res.json({
        enabled: true,
        caller: callerContact ? {
          id: callerContact.id,
          name: callerContact.name,
          phone: callerContact.phone,
          company: callerContact.company,
          status: callerContact.status,
        } : null,
        conversation_id: validated.conversation_id,
        crm_integration: {
          autoCreateContact: voiceConfig.autoCreateContact,
          autoCreateNote: voiceConfig.autoCreateNote,
          storeTranscript: voiceConfig.storeTranscript,
          maxCallDuration: voiceConfig.maxCallDuration,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request format",
          details: error.errors,
        });
      }
      logger.error("Voice context error:", error);
      res.status(500).json({ 
        error: "Failed to fetch voice context",
        actions_taken: [],
        metadata: { handoff_suggested: true, call_should_end: false },
      });
    }
  });

  // ============================================
  // PREMIUM AI RECEPTIONIST ENDPOINTS
  // ============================================

  // Premium Receptionist Result - Receives call results from Premium AI Receptionist Server via Neo8
  // Uses shared schema from neo8-payloads.ts for contract alignment
  const premiumResultSchema = z.object({
    callId: z.string(),
    contactId: z.string().uuid().optional(),
    callerPhone: z.string(),
    transcript: z.string(),
    summary: z.string(),
    extractedData: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      reason: z.string().optional(),
      appointmentRequested: z.boolean().optional(),
      preferredTime: z.string().optional(),
      urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
      notes: z.string().optional(),
    }),
    callDuration: z.number().int().min(0),
    callOutcome: z.enum(["completed", "transferred", "voicemail", "dropped", "error"]).optional(),
    timestamp: z.string().datetime(),
  });

  app.post("/api/voice/receptionist/premium/result", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const validated = premiumResultSchema.parse(req.body);
      
      // Check if AI Voice dispatch is enabled
      const voiceConfig = await storage.getAiVoiceDispatchConfig();
      if (!voiceConfig?.enabled) {
        return res.status(503).json({ error: "AI Voice is not enabled" });
      }

      // Try to find or create contact based on caller phone
      let contactId = validated.contactId;
      if (!contactId && validated.callerPhone && voiceConfig.autoCreateContact) {
        const contacts = await storage.getContacts();
        const existingContact = contacts.find(c => c.phone === validated.callerPhone);
        
        if (existingContact) {
          contactId = existingContact.id;
        } else if (validated.extractedData.name || validated.extractedData.phone) {
          // Create new contact from extracted data
          const newContact = await storage.createContact({
            name: validated.extractedData.name || "Unknown Caller",
            phone: validated.extractedData.phone || validated.callerPhone,
            email: validated.extractedData.email || null,
            company: null,
            status: "lead",
            customerType: "lead",
            tags: ["ai-receptionist", "premium"],
          });
          contactId = newContact.id;
        }
      }

      // Create note with call summary if enabled
      if (voiceConfig.autoCreateNote && contactId) {
        await storage.createNote({
          title: "Premium AI Receptionist Call Summary",
          content: `${validated.summary}\n\n**Extracted Data:**\n- Reason: ${validated.extractedData.reason || "N/A"}\n- Appointment Requested: ${validated.extractedData.appointmentRequested ? "Yes" : "No"}\n- Preferred Time: ${validated.extractedData.preferredTime || "N/A"}\n- Urgency: ${validated.extractedData.urgency || "normal"}\n\n**Call Duration:** ${Math.floor(validated.callDuration / 60)}m ${validated.callDuration % 60}s\n**Outcome:** ${validated.callOutcome || "completed"}`,
          entityType: "contact",
          entityId: contactId,
          tags: ["call-summary", "premium-receptionist"],
        });
      }

      // Store transcript if enabled
      if (voiceConfig.storeTranscript && contactId) {
        await storage.createNote({
          title: `Call Transcript (${validated.callId})`,
          content: validated.transcript,
          entityType: "contact",
          entityId: contactId,
          tags: ["transcript", "premium-receptionist"],
        });
      }

      // Queue for human review if appointment was requested
      if (validated.extractedData.appointmentRequested) {
        // GOVERNANCE: Run validator BEFORE creating staged_proposal entry
        const validationResult = reviewProposal({
          action: "schedule_appointment",
          target: "appointment",
          targetId: contactId,
          summary: `Schedule appointment for contact ${contactId}`,
          requestedBy: "voice_receptionist",
          payload: {
            contactId,
            preferredTime: validated.extractedData.preferredTime,
            reason: validated.extractedData.reason,
          },
          reasoning: `AI receptionist scheduled appointment for caller`,
        });

        // If validator rejects, log but still queue (appointments are time-sensitive)
        if (validationResult.decision === "reject") {
          logger.info(`[Validator] Appointment rejected: ${validationResult.reason}`);
          await storage.createAuditLogEntry({
            userId: null,
            action: "validator_flagged_appointment",
            entityType: "appointment",
            entityId: contactId,
            details: {
              reason: validationResult.reason,
              riskLevel: validationResult.riskLevel,
              requiresReview: true,
            },
          });
        }

        // Create staged proposal for voice receptionist appointment
        await storage.createStagedProposal({
          status: "pending",
          actions: JSON.stringify([{
            tool: "schedule_appointment",
            args: {
              contactId,
              scheduledAt: validated.extractedData.preferredTime,
              title: "Appointment",
              notes: validated.extractedData.reason || validated.extractedData.notes || "",
              status: "scheduled",
            },
          }]),
          reasoning: validationResult.reason || "Voice receptionist scheduled appointment for caller",
          riskLevel: validationResult.riskLevel || "medium",
          summary: `Voice: Schedule appointment for contact ${contactId}`,
          relatedEntity: JSON.stringify({ type: "appointment", id: null }),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
          // Governance columns
          userId: null,
          origin: "voice",
          userRequest: `Premium AI Receptionist: Caller requested appointment`,
          validatorDecision: validationResult.decision,
          validatorReason: validationResult.reason,
          requiresApproval: validationResult.requiresHumanApproval !== false,
          mode: "assist",
        });
      }

      // Log to audit
      await storage.createAuditLogEntry({
        userId: null,
        action: "premium_receptionist_result",
        entityType: "voice_call",
        entityId: validated.callId,
        details: {
          callerPhone: validated.callerPhone,
          contactId,
          summary: validated.summary,
          extractedData: validated.extractedData,
          callDuration: validated.callDuration,
          callOutcome: validated.callOutcome,
        },
      });

      res.json({
        success: true,
        contactId,
        message: "Premium receptionist result processed successfully",
        actionsQueued: validated.extractedData.appointmentRequested ? 1 : 0,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      logger.error("Premium receptionist result error:", error);
      res.status(500).json({ error: "Failed to process premium receptionist result" });
    }
  });

  // Voice Events - Unified endpoint for call lifecycle events
  // Uses shared schema from neo8-payloads.ts for contract alignment
  const voiceEventSchema = z.object({
    eventType: z.enum(["scheduled", "answered", "missed", "completed", "transferred", "voicemail"]),
    callId: z.string(),
    contactId: z.string().uuid().optional(),
    callerPhone: z.string().optional(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.string()).optional(),
    callDuration: z.number().int().min(0).optional(),
    outcome: z.string().optional(),
  });

  app.post("/api/voice/events", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const validated = voiceEventSchema.parse(req.body);

      // Log to audit with event-specific action
      await storage.createAuditLogEntry({
        userId: null,
        action: `voice_event_${validated.eventType}`,
        entityType: "voice_call",
        entityId: validated.callId,
        details: {
          eventType: validated.eventType,
          contactId: validated.contactId,
          callerPhone: validated.callerPhone,
          callDuration: validated.callDuration,
          outcome: validated.outcome,
          metadata: validated.metadata,
        },
      });

      // Handle specific event types
      if (validated.eventType === "missed" && validated.callerPhone) {
        // GOVERNANCE: Run validator BEFORE creating staged_proposal entry
        const validationResult = reviewProposal({
          action: "follow_up",
          target: "contact",
          targetId: validated.contactId,
          summary: `Follow up for missed call from ${validated.callerPhone}`,
          requestedBy: "voice_receptionist",
          payload: {
            callerPhone: validated.callerPhone,
            contactId: validated.contactId,
            reason: "Missed call - follow-up required",
          },
          reasoning: `AI receptionist flagged missed call for follow-up`,
        });

        // If validator rejects, log but still queue (missed calls are time-sensitive)
        if (validationResult.decision === "reject") {
          logger.info(`[Validator] Missed call follow-up rejected: ${validationResult.reason}`);
          await storage.createAuditLogEntry({
            userId: null,
            action: "validator_flagged_missed_call",
            entityType: "missed_call",
            entityId: validated.contactId || "unknown",
            details: {
              reason: validationResult.reason,
              riskLevel: validationResult.riskLevel,
              requiresReview: true,
            },
          });
        }

        // Create staged proposal for missed call follow-up
        await storage.createStagedProposal({
          status: "pending",
          actions: JSON.stringify([{
            tool: "follow_up",
            args: {
              callerPhone: validated.callerPhone,
              contactId: validated.contactId,
              reason: "Missed call - follow-up required",
              callId: validated.callId,
            },
          }]),
          reasoning: validationResult.reason || "AI receptionist flagged missed call for follow-up",
          riskLevel: validationResult.riskLevel || "medium",
          summary: `Voice: Follow up for missed call from ${validated.callerPhone}`,
          relatedEntity: JSON.stringify({ type: "contact", id: validated.contactId || null }),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
          // Governance columns
          userId: null,
          origin: "voice",
          userRequest: `Missed call from ${validated.callerPhone} - follow-up required`,
          validatorDecision: validationResult.decision,
          validatorReason: validationResult.reason,
          requiresApproval: validationResult.requiresHumanApproval !== false,
          mode: "assist",
        });
      }

      res.json({
        success: true,
        eventType: validated.eventType,
        callId: validated.callId,
        message: `Voice event '${validated.eventType}' logged successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request format", details: error.errors });
      }
      logger.error("Voice event error:", error);
      res.status(500).json({ error: "Failed to process voice event" });
    }
  });

  // Voice Dispatch Config - For external voice server to fetch CRM integration settings
  app.get("/api/voice/dispatch/config", requireInternalToken, async (_req, res) => {
    try {
      const voiceConfig = await storage.getAiVoiceDispatchConfig();
      
      if (!voiceConfig) {
        return res.status(404).json({ error: "AI Voice Dispatch configuration not found" });
      }

      // Return dispatch config (CRM integration flags only, no AI behavior)
      res.json({
        enabled: voiceConfig.enabled,
        voiceServerUrl: voiceConfig.voiceServerUrl,
        maxCallDuration: voiceConfig.maxCallDuration,
        useOutsideBusinessHours: voiceConfig.useOutsideBusinessHours,
        storeTranscript: voiceConfig.storeTranscript,
        autoCreateContact: voiceConfig.autoCreateContact,
        autoCreateNote: voiceConfig.autoCreateNote,
      });
    } catch (error) {
      logger.error("Voice dispatch config error:", error);
      res.status(500).json({ error: "Failed to fetch voice dispatch config" });
    }
  });

  // Internal CRM Agent Chat (Master Architect removed; validation now via validator.ts)
  app.post("/api/ai/chat/internal", aiChatRateLimiter, async (req, res) => {
    try {
      const validated = internalChatSchema.parse(req.body);
      const aiSettings = await storage.getAiSettings();

      // P0 HARDENING: Check kill switch BEFORE any AI processing
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      // Build system instructions using HARDCODED base + database additions
      // Hardcoded base prompt is the foundation for ALL clients
      // Database ai_settings prompts are ADDITIVE - they layer on top
      const systemInstructions = buildSystemInstructions(validated.context, aiSettings ?? null);

      // Get settings to check agent mode
      const settings = await storage.getSettings();
      
      // CRITICAL FIX: ReadChat must use "draft" mode to prevent ledger writes
      // ReadChat is read-only and should NEVER create proposals or ledger entries
      // Only ActionAI (context: "crm_agent" or "actiongpt") should create proposals
      let agentMode: AgentMode;
      if (validated.context === "read_chat") {
        agentMode = "draft"; // ReadChat = read-only, no proposals, no ledger writes
      } else {
        agentMode = (settings?.agentMode || "assist") as AgentMode;
      }

      // Detect required actions from the ORIGINAL user message
      const requiredActions = detectRequiredActions(validated.message);
      
      // Track all staged tools across retries
      let allStagedTools: string[] = [];
      let allToolCalls: Array<{ name: string; status: string; arguments: string; result?: unknown }> = [];
      let finalMessage = "";
      let retryCount = 0;
      
      // Build conversation history for enforcement retries
      let conversationHistory = [...validated.conversationHistory];
      
      // TODO: AI processing pipeline - results come from external agent
      // For now, return a placeholder message indicating actions need to be staged
      finalMessage = "I've analyzed your request. The following actions have been staged for your approval.";
      
      // MULTI-STEP ENFORCEMENT LOOP
      // Only apply to ActionAI contexts (not read_chat)
      if (validated.context !== "read_chat" && requiredActions.length > 0) {
        let missingActions = getMissingActions(requiredActions, allStagedTools);
        
        while (missingActions.length > 0 && retryCount < MAX_ENFORCEMENT_RETRIES) {
          retryCount++;
          logger.info(`[Enforcement] Retry ${retryCount}: Missing actions: ${missingActions.join(", ")}`);
          
          // Build enforcement message
          const enforcementMessage = buildEnforcementMessage(missingActions);
          
          // Add previous AI response and enforcement to conversation
          conversationHistory.push(
            { role: "assistant" as const, content: finalMessage },
            { role: "user" as const, content: enforcementMessage }
          );
          
          // TODO: Re-execute with enforcement via external agent
          logger.info(`[Enforcement] Would re-execute with: ${enforcementMessage}`);
          
          // Check for remaining missing actions
          missingActions = getMissingActions(requiredActions, allStagedTools);
        }
        
        if (missingActions.length > 0) {
          logger.info(`[Enforcement] FAILED after ${retryCount} retries. Still missing: ${missingActions.join(", ")}`);
        } else {
          logger.info(`[Enforcement] SUCCESS: All required actions staged after ${retryCount} retries`);
        }
      }

      // Log the interaction in audit log
      await storage.createAuditLogEntry({
        userId: null,
        action: "internal_chat",
        entityType: "ai_interaction",
        entityId: `chat-${Date.now()}`,
        details: {
          source: "crm_chat",
          context: validated.context,
          message: validated.message,
          response: finalMessage,
          actions: allToolCalls.length,
          mode: agentMode,
          enforcementRetries: retryCount,
        },
      });

      // Process actions and store staged ones server-side
      const processedActions = allToolCalls.map((tc) => ({
        tool: tc.name,
        status: tc.status,
        args: JSON.parse(tc.arguments),
        result: tc.result,
      }));
      
      // Extract staged actions and store them server-side (deduplicate by tool name)
      const stagedActionsMap = new Map<string, { tool: string; args: Record<string, unknown> }>();
      for (const action of processedActions) {
        if (action.status === "staged") {
          stagedActionsMap.set(action.tool, { tool: action.tool, args: action.args as Record<string, unknown> });
        }
      }
      const stagedActions = Array.from(stagedActionsMap.values());
      
      let stagedBundleId: string | undefined;
      if (stagedActions.length > 0) {
        const bundleResult = await createStagedBundle(
          stagedActions,
          validated.message,
          undefined,
          agentMode,
          req
        );
        if (bundleResult) {
          stagedBundleId = bundleResult.id;
        }
      }

      // Detect if AI is ready for proposal (conversation mode → proposal mode transition)
      const readyForProposal = finalMessage.includes("---READY_FOR_PROPOSAL---");
      
      // Clean up the markers from the message for display
      let cleanMessage = finalMessage;
      if (readyForProposal) {
        cleanMessage = finalMessage
          .replace(/---READY_FOR_PROPOSAL---/g, "")
          .replace(/---END_READY---/g, "")
          .trim();
      }

      res.json({
        message: cleanMessage,
        actions: processedActions.filter((a, idx, arr) => 
          arr.findIndex(x => x.tool === a.tool && x.status === a.status) === idx
        ),
        stagedBundleId, // Client uses this ID to accept/reject
        mode: agentMode,
        readyForProposal, // True when AI has gathered all info and is asking for permission to propose
        enforcementRetries: retryCount, // For debugging
      });
    } catch (error) {
      logger.error("Internal chat error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request",
          message: "Please check your message and try again.",
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : "";
      let userFriendlyMessage = "I encountered an issue processing your request. Please try again.";
      
      if (errorMessage.includes("rate limit")) {
        userFriendlyMessage = "Too many requests. Please wait a moment and try again.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT")) {
        userFriendlyMessage = "The request took too long. Please try a simpler request.";
      } else if (errorMessage.includes("401") || errorMessage.includes("authentication")) {
        userFriendlyMessage = "There was an authentication issue with the AI service. Please contact support.";
      } else if (errorMessage.includes("quota") || errorMessage.includes("insufficient")) {
        userFriendlyMessage = "The AI service quota has been reached. Please contact support.";
      }
      
      res.status(500).json({ 
        error: "Chat processing failed",
        message: userFriendlyMessage,
      });
    }
  });

  // Accept Staged Actions - Send to Review Queue (NOT execute directly)
  // Flow: Staged Accept → Ledger (proposed) → AssistQueue → MA Review → Ready Execution → Execute
  app.post("/api/ai/staged/accept", async (req, res) => {
    try {
      // P0 HARDENING: Check kill switch BEFORE accepting staged actions
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      const { stagedBundleId } = req.body as { stagedBundleId: string };

      if (!stagedBundleId) {
        return res.status(400).json({ error: "Missing stagedBundleId" });
      }

      // Retrieve staged bundle from database
      const bundle = await storage.getStagedProposal(stagedBundleId);
      if (!bundle) {
        return res.status(404).json({ 
          error: "Staged bundle not found", 
          message: "The staged actions may have expired or already been processed." 
        });
      }

      // Check expiration
      if (bundle.expiresAt < new Date()) {
        await storage.updateStagedProposal(stagedBundleId, { status: "rejected" });
        return res.status(410).json({ 
          error: "Staged bundle expired", 
          message: "The staged actions have expired. Please submit your request again." 
        });
      }

      // Mark as approved (one-time use)
      await storage.updateStagedProposal(stagedBundleId, { status: "approved" });

      // GOVERNANCE: Validator MUST run BEFORE staged_proposal is created
      // Flow: AI proposal → validator → staged_proposal → human approval → execution
      const actions = bundle.actions as Array<{ tool: string; args: Record<string, unknown> }>;
      const validationResult = reviewProposal({
        action: actions.length > 0 ? actions[0].tool : "unknown",
        target: "action_bundle",
        summary: `Execute ${actions.length} staged action(s)`,
        requestedBy: "staged_accept",
        payload: {
          actions,
          userRequest: bundle.summary,
        },
        reasoning: bundle.reasoning || `AI proposed ${actions.length} action(s)`,
      });

      // If validator REJECTS → do NOT enqueue
      if (validationResult.decision === "reject") {
        logger.info(`[Validator] Proposal rejected: ${validationResult.reason}`);
        
        // Log rejection to audit_log
        await storage.createAuditLogEntry({
          userId: null,
          action: "validator_rejected_proposal",
          entityType: "ai_proposal",
          entityId: stagedBundleId,
          details: {
            reason: validationResult.reason,
            riskLevel: validationResult.riskLevel,
            actions: actions.map(a => a.tool),
          },
        });

        return res.status(400).json({
          error: "Proposal rejected by validator",
          reason: validationResult.reason,
          riskLevel: validationResult.riskLevel,
        });
      }

      // If validator flags human_required → will be handled by requiresApproval flag
      logger.info(`[Validator] Decision: ${validationResult.decision}, Risk: ${validationResult.riskLevel}, Human Required: ${validationResult.requiresHumanApproval}`);

      // Update the staged proposal with validator results
      await storage.updateStagedProposal(stagedBundleId, {
        validatorDecision: validationResult.decision,
        validatorReason: validationResult.reason,
        requiresApproval: validationResult.requiresHumanApproval !== false,
        status: "pending", // confirmed pending, ready for approval
      });

      // Write to Ledger (status: proposed)
      await storage.createAutomationLedgerEntry({
        agentName: "Proposal Agent",
        actionType: "PROPOSAL_CREATED",
        entityType: "staged_proposal",
        entityId: stagedBundleId,
        mode: "assist",
        status: "proposed",
        diffJson: {
          stagedBundleId,
          userRequest: bundle.summary,
          proposedActions: (bundle.actions as Array<{ tool: string; args: Record<string, unknown> }>)?.map((a: { tool: string; args: Record<string, unknown> }) => ({ tool: a.tool, args: a.args })),
        },
        reason: "User approved staged actions for review",
        assistQueueId: null,
        idempotencyKey: `proposal-${stagedBundleId}-${Date.now()}`,
        reasoningSummary: bundle.reasoning || `AI proposed ${actions.length} action(s)`,
        executionTraceId: stagedBundleId,
      });

      logger.info(`[Governance] Proposal ${stagedBundleId} updated and sent to Review Queue`);

      // Return success - actions are now in Review Queue
      res.json({
        success: true,
        message: "Sent to Review Queue for validation",
        queueEntryId: stagedBundleId,
        status: "pending_review",
      });
    } catch (error) {
      logger.error("Staged accept error:", error);
      res.status(500).json({ error: "Failed to send to review queue" });
    }
  });

  // Reject Staged Actions - Discard staged actions by ID
  app.post("/api/ai/staged/reject", async (req, res) => {
    try {
      const { stagedBundleId, reason } = req.body as {
        stagedBundleId: string;
        reason?: string;
      };

      if (!stagedBundleId) {
        return res.status(400).json({ error: "Missing stagedBundleId" });
      }

      // Retrieve and mark as rejected in database
      const bundle = await storage.getStagedProposal(stagedBundleId);
      if (bundle) {
        await storage.updateStagedProposal(stagedBundleId, { status: "rejected" });
      }

      // Log rejection to ledger
      await storage.createAutomationLedgerEntry({
        agentName: "Proposal Agent",
        actionType: "STAGED_ACTIONS_REJECTED",
        entityType: "staged_action",
        entityId: stagedBundleId,
        mode: "assist",
        status: "rejected",
        diffJson: {
          userRequest: bundle?.summary || "Staged actions rejected",
          actionsRejected: (bundle?.actions as Array<{ tool: string }>)?.map(a => a.tool) || [],
        },
        reason: reason || "User rejected staged actions",
        assistQueueId: null,
      });

      res.json({ success: true, message: "Staged actions discarded" });
    } catch (error) {
      logger.error("Staged reject error:", error);
      res.status(500).json({ error: "Failed to reject staged actions" });
    }
  });

  // ========== PROPOSAL API (DB-backed staged proposals) ==========
  // GET /api/proposals?status=pending|approved|all
  app.get("/api/proposals", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const proposals = await storage.listStagedProposals(status ? { status } : undefined);
      res.json(proposals);
    } catch (error) {
      logger.error("Failed to list proposals:", error);
      res.status(500).json({ error: "Failed to list proposals" });
    }
  });

  // POST /api/proposals/:id/approve
  app.post("/api/proposals/:id/approve", async (req, res) => {
    try {
      // P0 HARDENING: Check kill switch BEFORE approving proposal
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      const { id } = req.params;
      const proposal = await storage.getStagedProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      if (proposal.status !== "pending") {
        return res.status(400).json({ error: `Proposal is already ${proposal.status}` });
      }
      if (proposal.expiresAt < new Date()) {
        await storage.updateStagedProposal(id, { status: "rejected" });
        return res.status(410).json({ error: "Proposal expired" });
      }
      const updated = await storage.updateStagedProposal(id, { 
        status: "approved",
        approvedBy: req.userId || null,
        approvedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      logger.error("Failed to approve proposal:", error);
      res.status(500).json({ error: "Failed to approve proposal" });
    }
  });

  // POST /api/proposals/:id/reject
  app.post("/api/proposals/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body as { reason?: string };
      const proposal = await storage.getStagedProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      if (proposal.status !== "pending") {
        return res.status(400).json({ error: `Proposal is already ${proposal.status}` });
      }
      const updated = await storage.updateStagedProposal(id, { status: "rejected" });
      // Log rejection to ledger
      await storage.createAutomationLedgerEntry({
        agentName: "system",
        actionType: "PROPOSAL_REJECTED",
        entityType: "staged_proposal",
        entityId: id,
        status: "recorded",
        diffJson: { reason: reason || "User rejected" },
        reason: reason || "User rejected proposal",
      });
      res.json(updated);
    } catch (error) {
      logger.error("Failed to reject proposal:", error);
      res.status(500).json({ error: "Failed to reject proposal" });
    }
  });

  // POST /api/proposals/:id/execute
  app.post("/api/proposals/:id/execute", async (req, res) => {
    try {
      // P0 HARDENING: Check kill switch BEFORE executing proposal
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      const { id } = req.params;
      const proposal = await storage.getStagedProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      if (proposal.status !== "approved") {
        return res.status(400).json({ error: `Proposal must be approved before execution (current: ${proposal.status})` });
      }
      
      // Import dispatchToAgent from agent-dispatcher
      const agentDispatcher = await import("./agent-dispatcher");
      const dispatchToAgent = (agentDispatcher as any).dispatchToAgent;
      
      if (!dispatchToAgent) {
        return res.status(501).json({ error: "dispatchToAgent not yet implemented" });
      }
      
      // Use existing correlationId from proposal or generate new one
      const correlationId = proposal.correlationId || crypto.randomUUID();
      
      // CRITICAL: Enqueue to outbox instead of direct dispatch
      // This enables retry logic, circuit breaker, and failure tracking
      const { writeToOutbox } = await import("./outbox-worker");
      
      const outboxId = await writeToOutbox({
        tenantId: "default", // Single-tenant system
        idempotencyKey: `proposal-${id}`,
        eventType: "proposal.execute",
        channel: "crm",
        payload: {
          proposalId: proposal.id,
          summary: proposal.summary || "",
          actions: proposal.actions,
          reasoning: proposal.reasoning || "",
          approvedBy: proposal.approvedBy || "",
          approvedAt: proposal.approvedAt ? new Date(proposal.approvedAt).toISOString() : new Date().toISOString(),
          relatedEntity: proposal.relatedEntity,
        },
        correlationId,
      });

      // Update proposal status to "queued" (waiting for outbox worker)
      await storage.updateStagedProposal(id, { status: "queued" });
      
      // CRITICAL: Write PROPOSAL_QUEUED to automation ledger
      await storage.createAutomationLedgerEntry({
        agentName: "system",
        actionType: "PROPOSAL_QUEUED",
        entityType: "staged_proposal",
        entityId: id,
        status: "queued",
        mode: "executed",
        diffJson: {
          proposalId: id,
          summary: proposal.summary,
          actions: proposal.actions,
          approvedBy: proposal.approvedBy,
          outboxId,
          queuedAt: new Date().toISOString(),
        },
        reason: "Proposal queued for execution via outbox worker",
        correlationId,
        executionTraceId: id,
        idempotencyKey: `queue-${id}-${Date.now()}`,
      });
      
      res.json({ 
        success: true, 
        message: "Proposal queued for execution", 
        outboxId,
        correlationId,
        note: "Outbox worker will process this event with retry logic"
      });
    } catch (error: any) {
      logger.error("Failed to execute proposal:", error);
      // Update status to dispatch_failed on error
      await storage.updateStagedProposal(req.params.id, { status: "dispatch_failed" });
      
      // CRITICAL: Write PROPOSAL_FAILED to automation ledger
      const proposal = await storage.getStagedProposal(req.params.id);
      if (proposal) {
        await storage.createAutomationLedgerEntry({
          agentName: "system",
          actionType: "PROPOSAL_FAILED",
          entityType: "staged_proposal",
          entityId: req.params.id,
          status: "failed",
          mode: "executed",
          diffJson: {
            proposalId: req.params.id,
            error: error.message,
            failedAt: new Date().toISOString(),
          },
          reason: `Proposal execution failed: ${error.message}`,
          correlationId: proposal.correlationId || null,
          executionTraceId: req.params.id,
        });
      }
      
      res.status(500).json({ success: false, error: error.message || "Failed to execute proposal" });
    }
  });

  // POST /api/proposals/:id/finalize
  // Finalizes an "approved_pending_send" proposal — operator confirms the send step,
  // then the proposal is queued for execution via the outbox worker.
  app.post("/api/proposals/:id/finalize", async (req, res) => {
    try {
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ success: false, error: "AI execution is currently disabled by kill switch" });
      }

      const { id } = req.params;
      const proposal = await storage.getStagedProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      if (proposal.status !== "approved_pending_send") {
        return res.status(400).json({ error: `Finalize requires status 'approved_pending_send' (current: ${proposal.status})` });
      }

      const correlationId = proposal.correlationId || crypto.randomUUID();
      const { writeToOutbox } = await import("./outbox-worker");

      const outboxId = await writeToOutbox({
        tenantId: "default",
        idempotencyKey: `finalize-${id}`,
        eventType: "proposal.execute",
        channel: "crm",
        payload: {
          proposalId: proposal.id,
          summary: proposal.summary || "",
          actions: proposal.actions,
          reasoning: proposal.reasoning || "",
          approvedBy: proposal.approvedBy || "",
          approvedAt: proposal.approvedAt ? new Date(proposal.approvedAt).toISOString() : new Date().toISOString(),
          relatedEntity: proposal.relatedEntity,
        },
        correlationId,
      });

      await storage.updateStagedProposal(id, { status: "queued" });

      await storage.createAutomationLedgerEntry({
        agentName: "system",
        actionType: "PROPOSAL_QUEUED",
        entityType: "staged_proposal",
        entityId: id,
        status: "queued",
        mode: "executed",
        diffJson: { proposalId: id, outboxId, finalizedAt: new Date().toISOString() },
        reason: "Operator finalized approved_pending_send proposal",
        correlationId,
        executionTraceId: id,
        idempotencyKey: `finalize-queue-${id}-${Date.now()}`,
      });

      res.json({ success: true, message: "Proposal finalized and queued for execution", outboxId, correlationId });
    } catch (error: any) {
      logger.error("Failed to finalize proposal:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to finalize proposal" });
    }
  });

  // GPT Actions Execute (Master Architect removed; validation now via validator.ts, same pipeline as CRM Chat)
  app.post("/api/ai/gpt-actions/execute", gptActionsRateLimiter, async (req, res) => {
    try {
      const validated = gptActionsExecuteSchema.parse(req.body);

      // Get AI Settings and build system instructions using HARDCODED base + database additions
      const aiSettings = await storage.getAiSettings();

      // P0 HARDENING: Check kill switch BEFORE any AI processing
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      const systemInstructions = buildSystemInstructions("actiongpt", aiSettings ?? null);

      // Get settings to check agent mode
      const settings = await storage.getSettings();
      const agentMode = (settings?.agentMode || "assist") as AgentMode;

      // Fetch contact and job context if IDs provided
      let contactContext: string | null = null;
      let jobContext: string | null = null;
      let contactCompany: string | null = null;
      
      if (validated.contactId) {
        const contact = await storage.getContact(validated.contactId);
        if (contact) {
          contactContext = `Contact: ${contact.name || 'Unknown'} (${contact.email || 'no email'})`;
          contactCompany = contact.company || null;
        }
      }
      
      if (validated.jobId) {
        const job = await storage.getJob(validated.jobId);
        if (job) {
          jobContext = `Job: ${job.title} - Status: ${job.status}`;
        }
      }

      // TODO: GPT Actions processing - results come from external agent
      // For now, return a placeholder response
      const resultMessage = "GPT Action received. Processing through external agent pipeline.";

      // Log the interaction in audit log
      await storage.createAuditLogEntry({
        userId: null,
        action: "gpt_actions_execute",
        entityType: "ai_interaction",
        entityId: `gpt-${Date.now()}`,
        details: {
          source: "gpt_actions",
          message: validated.message,
          contactContext: validated.contactId || null,
          jobContext: validated.jobId || null,
          response: resultMessage,
          actions: 0,
          mode: agentMode,
        },
      });

      res.json({
        message: resultMessage,
        actions: [],
        mode: agentMode,
      });
    } catch (error) {
      logger.error("GPT Actions execute error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ 
        error: "Failed to execute GPT action",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/webhook-events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getWebhookEvents(limit);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch webhook events" });
    }
  });

  // ========================================
  // USER MANAGEMENT
  // ========================================

  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/me", async (_req, res) => {
    try {
      const users = await storage.getUsers();
      const currentUser = users[0];
      if (!currentUser) {
        return res.status(404).json({ error: "No user found" });
      }
      res.json(currentUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current user" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  const validUserRoles = ["admin", "manager", "technician", "viewer", "user"] as const;
  const createUserSchema = insertUserSchema.extend({
    role: z.enum(validUserRoles).optional().default("technician"),
  });

  app.post("/api/users", async (req, res) => {
    try {
      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { username, email, password, role } = parseResult.data;
      
      const existingUsers = await storage.getUsers();
      if (existingUsers.some(u => u.email === email)) {
        return res.status(400).json({ error: "Email already exists" });
      }
      if (existingUsers.some(u => u.username === username)) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const user = await storage.createUser({
        username,
        email,
        password,
        role: role || "technician",
      });
      
      await storage.createAuditLogEntry({
        action: "user_created",
        entityType: "user",
        entityId: user.id,
        details: { username, email, role: role || "technician" },
      });
      
      res.status(201).json(user);
    } catch (error) {
      logger.error("Failed to create user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  const updateUserSchema = z.object({
    username: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1).optional(),
    role: z.enum(validUserRoles).optional(),
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const parseResult = updateUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { username, email, password, role } = parseResult.data;
      const userId = req.params.id;
      
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (email && email !== existingUser.email) {
        const allUsers = await storage.getUsers();
        if (allUsers.some(u => u.email === email && u.id !== userId)) {
          return res.status(400).json({ error: "Email already in use by another user" });
        }
      }
      
      if (username && username !== existingUser.username) {
        const allUsers = await storage.getUsers();
        if (allUsers.some(u => u.username === username && u.id !== userId)) {
          return res.status(400).json({ error: "Username already in use by another user" });
        }
      }
      
      const updates: Record<string, any> = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (role) updates.role = role;
      
      const updatedUser = await storage.updateUser(userId, updates);
      
      await storage.createAuditLogEntry({
        action: "user_updated",
        entityType: "user",
        entityId: userId,
        details: { updatedFields: Object.keys(updates).filter(k => k !== 'password') },
      });
      
      res.json(updatedUser);
    } catch (error) {
      logger.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = req.params.id;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.deleteUser(userId);
      
      await storage.createAuditLogEntry({
        action: "user_deleted",
        entityType: "user",
        entityId: userId,
        details: { username: user.username, email: user.email },
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ========================================
  // CONVERSATION PERSISTENCE API
  // ========================================

  app.get("/api/conversations", async (req, res) => {
    try {
      const { contactId, channel, status } = req.query;
      let conversations = await storage.getConversations();
      
      if (contactId) {
        conversations = conversations.filter(c => c.contactId === contactId);
      }
      if (channel) {
        conversations = conversations.filter(c => c.channel === channel);
      }
      if (status) {
        conversations = conversations.filter(c => c.status === status);
      }
      
      res.json(conversations);
    } catch (error) {
      logger.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const messages = await storage.getMessages(req.params.id);
      
      res.json({
        ...conversation,
        messages,
      });
    } catch (error) {
      logger.error("Failed to fetch conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const validated = createConversationSchema.parse(req.body);
      const conversation = await storage.createConversation({
        contactId: validated.contactId || null,
        channel: validated.channel,
        status: "active",
        metadata: {},
      });
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "create_conversation",
        entityType: "conversation",
        entityId: conversation.id,
        details: { channel: validated.channel },
      });
      
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const messages = await storage.getMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      logger.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const validated = sendMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id,
      });
      
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const userMessage = await storage.createMessage({
        conversationId: req.params.id,
        role: "user",
        content: validated.message,
        metadata: {},
      });
      
      const settings = await storage.getSettings();
      const agentMode = (settings?.agentMode || "assist") as AgentMode;
      
      const messages = await storage.getMessages(req.params.id);
      
      // TODO: Process message through external agent pipeline
      // For now, return a placeholder response
      const resultMessage = "Message received. Processing through external agent.";
      
      const assistantMessage = await storage.createMessage({
        conversationId: req.params.id,
        role: "assistant",
        content: resultMessage,
        metadata: {
          toolCalls: [],
          mode: agentMode,
        },
      });
      
      res.json({
        userMessage,
        assistantMessage,
        toolCalls: [],
        mode: agentMode,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.patch("/api/conversations/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!["active", "closed", "archived"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const updated = await storage.updateConversation(req.params.id, { status });
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_conversation_status",
        entityType: "conversation",
        entityId: req.params.id,
        details: { status },
      });
      
      res.json(updated);
    } catch (error) {
      logger.error("Failed to update conversation status:", error);
      res.status(500).json({ error: "Failed to update conversation status" });
    }
  });

  // ========================================
  // CHAT WIDGET (STUBS)
  // ========================================

  const widgetConfigSchema = z.object({
    primaryColor:   z.string().optional(),
    accentColor:    z.string().optional(),
    welcomeMessage: z.string().optional(),
    supportEmail:   z.string().email().optional(),
    position:       z.enum(["bottom-right", "bottom-left"]).optional(),
    logoUrl:        z.string().url().optional().nullable(),
    companyName:    z.string().optional(),
  });

  const WIDGET_DEFAULTS = {
    primaryColor:   "#FDB913",
    accentColor:    "#1E40AF",
    welcomeMessage: "Hi! How can we help you today?",
    supportEmail:   "support@smartklix.com",
    position:       "bottom-right",
  };

  app.post("/api/widget/settings", async (req, res) => {
    try {
      const validated = widgetConfigSchema.parse(req.body);
      const current = await storage.getAiSettings();
      const existing = (current?.widgetConfig as Record<string, unknown>) || {};
      await storage.updateAiSettings({
        widgetConfig: { ...existing, ...validated },
      });
      res.json({ success: true, settings: { ...WIDGET_DEFAULTS, ...existing, ...validated } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid widget config", details: error.errors });
      }
      logger.error("Failed to save widget settings", error);
      res.status(500).json({ error: "Failed to save widget settings" });
    }
  });

  app.get("/api/widget/settings", async (_req, res) => {
    try {
      const settings = await storage.getAiSettings();
      const widgetConfig = (settings?.widgetConfig as Record<string, unknown>) || {};
      res.json({ ...WIDGET_DEFAULTS, ...widgetConfig });
    } catch (error) {
      logger.error("Failed to fetch widget settings", error);
      res.status(500).json({ error: "Failed to fetch widget settings" });
    }
  });

  const widgetMessageSchema = z.object({
    message: z.string().min(1),
    visitorId: z.string().optional(),
    contactId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
  });

  const widgetLeadSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    message: z.string().optional(),
    source: z.string().optional(),
  });

  app.post("/api/widget/identify", async (req, res) => {
    try {
      const { email, name, phone } = req.body;
      
      let contact = null;
      if (email) {
        const contacts = await storage.getContacts();
        contact = contacts.find(c => c.email === email);
        
        if (!contact) {
          contact = await storage.createContact({
            name: name || null,
            email,
            phone: phone || null,
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: "Visitor identified",
        visitorId: contact?.id || `visitor-${Date.now()}`,
        contactId: contact?.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to identify visitor";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/widget/message", async (req, res) => {
    try {
      const validated = widgetMessageSchema.parse(req.body);
      
      let contactId = validated.contactId;
      if (!contactId && validated.email) {
        const contacts = await storage.getContacts();
        let contact = contacts.find(c => c.email === validated.email);
        
        if (!contact) {
          contact = await storage.createContact({
            name: validated.name || null,
            email: validated.email,
            phone: validated.phone || null,
          });
        }
        contactId = contact.id;
      }
      
      const conversation = await storage.createConversation({
        contactId: contactId || null,
        channel: "widget",
        status: "active",
        metadata: { 
          visitorId: validated.visitorId,
          source: "widget" 
        },
      });
      
      await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content: validated.message,
        metadata: { source: "widget" },
      });
      
      // TODO: Process widget message through external agent pipeline
      // For now, return a placeholder response
      const aiResponseMessage = "Thanks for your message! An agent will respond shortly.";
      
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: aiResponseMessage,
        metadata: { 
          source: "widget",
          toolCalls: [],
        },
      });
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "widget_message",
        entityType: "conversation",
        entityId: conversation.id,
        details: { 
          contactId,
          message: validated.message,
          response: aiResponseMessage,
        },
      });
      
      res.json({ 
        success: true, 
        response: aiResponseMessage,
        messageId: assistantMessage.id,
        conversationId: conversation.id,
        contactId,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to process message";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/widget/lead", async (req, res) => {
    try {
      const validated = widgetLeadSchema.parse(req.body);
      
      if (!validated.email && !validated.phone) {
        return res.status(400).json({ error: "Email or phone required" });
      }
      
      const contacts = await storage.getContacts();
      let contact = contacts.find(c => 
        (validated.email && c.email === validated.email) ||
        (validated.phone && c.phone === validated.phone)
      );
      
      if (!contact) {
        contact = await storage.createContact({
          name: validated.name || null,
          email: validated.email || null,
          phone: validated.phone || null,
        });
        
        if (validated.message) {
          await storage.createNote({
            title: "Widget Lead Message",
            content: validated.message,
            entityType: "contact",
            entityId: contact.id,
          });
        }
      }
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "widget_lead_capture",
        entityType: "contact",
        entityId: contact.id,
        details: validated,
      });
      
      res.json({ 
        success: true, 
        message: "Lead captured",
        leadId: contact.id,
        contactId: contact.id,
        contactCreated: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to capture lead";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/widget/upload", async (_req, res) => {
    // File upload requires Supabase Storage or S3 integration — not yet configured
    res.status(501).json({
      error: "File upload not yet configured",
      message: "Connect Supabase Storage or S3 to enable file attachments",
    });
  });

  // ========================================
  // AI MEMORY & REFLECTION
  // ========================================

  app.get("/api/memory/entries", async (_req, res) => {
    try {
      const entries = await storage.getMemoryEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch memory entries" });
    }
  });

  app.get("/api/ai/reflections", async (_req, res) => {
    try {
      const reflections = await storage.getAiReflections();
      res.json(reflections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI reflections" });
    }
  });

  app.get("/api/ai/tasks", async (_req, res) => {
    try {
      const tasks = await storage.getAiTasks();
      res.json(tasks);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch AI tasks";
      res.status(500).json({ error: message });
    }
  });

  /** @deprecated Master Architect removed. Endpoint retained for backward compatibility. */
  app.get("/api/master-architect/tasks", async (_req, res) => {
    try {
      // Fetch all three data sources
      const [stagedProposals, aiTasks, allAuditLog] = await Promise.all([
        storage.listStagedProposals({ status: ["pending", "approved", "rejected", "completed"] }),
        storage.getAiTasks(),
        storage.getAuditLog(),
      ]);

      // Limit audit log to recent entries (last 100)
      const auditLog = allAuditLog.slice(-100);

      interface UnifiedTask {
        id: string;
        type: "staged_proposal" | "ai_task" | "n8n_event";
        status: string;
        title: string;
        description: string;
        userRequest?: string;
        agentResponse?: string;
        context?: Record<string, unknown>;
        toolsCalled?: unknown[];
        toolResults?: unknown[];
        createdAt: Date;
        completedAt?: Date;
        error?: string;
      }

      // Transform staged proposal entries
      const proposalTasks: UnifiedTask[] = stagedProposals.map(item => {
        const actions = typeof item.actions === "string" ? JSON.parse(item.actions) : item.actions || [];
        const firstAction = actions[0] || {};
        const title = firstAction.tool 
          ? String(firstAction.tool).replace(/_/g, " ").toUpperCase()
          : "AI Action";

        return {
          id: item.id,
          type: "staged_proposal" as const,
          status: item.status,
          title,
          description: item.userRequest || item.summary || "AI-suggested action",
          userRequest: item.userRequest || undefined,
          agentResponse: item.reasoning || undefined,
          toolsCalled: actions,
          toolResults: undefined,
          createdAt: item.createdAt,
          completedAt: item.completedAt || undefined,
          error: item.rejectionReason || undefined,
        };
      });

      // Transform AI tasks
      const automationTasks: UnifiedTask[] = aiTasks.map(item => ({
        id: item.id,
        type: "ai_task" as const,
        status: item.status,
        title: item.taskType.replace(/_/g, " ").toUpperCase(),
        description: `Delegated to ${item.delegatedTo}`,
        context: item.payload as Record<string, unknown>,
        createdAt: item.createdAt,
        completedAt: item.completedAt || undefined,
        error: item.error || undefined,
      }));

      // Transform N8N events from audit log (only recent, valid events)
      const n8nEvents: UnifiedTask[] = auditLog
        .filter(entry => {
          if (entry.action !== "neo8_event_result") return false;
          const details = entry.details as Record<string, unknown>;
          // Only include entries with valid status and eventType
          return details?.status && details?.eventType;
        })
        .map(entry => {
          const details = entry.details as Record<string, unknown>;
          const status = details.status === "success" ? "completed" : 
                        details.status === "error" ? "failed" : "pending";
          
          return {
            id: entry.id,
            type: "n8n_event" as const,
            status,
            title: String(details.eventType || "N8N Event").replace(/_/g, " ").toUpperCase(),
            description: `N8N automation: ${details.eventType || "unknown"}`,
            context: details.result as Record<string, unknown>,
            createdAt: entry.timestamp,
            completedAt: status === "completed" || status === "failed" ? entry.timestamp : undefined,
            error: status === "failed" && details.result && typeof details.result === 'object' && 'error' in details.result 
              ? String(details.result.error) 
              : undefined,
          };
        });

      // Combine and sort by creation date (newest first)
      const allTasks = [...proposalTasks, ...automationTasks, ...n8nEvents]
        .filter(task => task.createdAt) // Filter out tasks without createdAt
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(task => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt?.toISOString(),
        }));

      res.json(allTasks);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch master architect tasks";
      res.status(500).json({ error: message });
    }
  });

  // ========================================
  // PIPELINE OPERATIONS
  // ========================================

  app.post("/api/estimates/:id/accept", async (req, res) => {
    try {
      const result = await acceptEstimate(req.params.id);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept estimate";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/estimates/:id/reject", async (req, res) => {
    try {
      const estimate = await rejectEstimate(req.params.id);
      res.json(estimate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject estimate";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/estimates/:id/send", async (req, res) => {
    try {
      const estimate = await sendEstimate(req.params.id);
      res.json(estimate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send estimate";
      res.status(400).json({ error: message });
    }
  });

  // POST /api/estimates/:id/convert-to-invoice
  app.post("/api/estimates/:id/convert-to-invoice", async (req, res) => {
    try {
      const estimateId = req.params.id;
      const estimate = await storage.getEstimate(estimateId);

      if (!estimate) {
        return res.status(404).json({ error: "Estimate not found" });
      }

      // Must be approved status to convert
      if (estimate.status !== "accepted" && estimate.status !== "approved") {
        return res.status(400).json({ error: "Estimate must be approved before converting to invoice" });
      }

      // Create invoice from estimate data
      const invoice = await storage.createInvoice({
        contactId: estimate.contactId,
        jobId: estimate.jobId,
        estimateId: estimate.id,
        lineItems: estimate.lineItems as any,
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        totalAmount: estimate.totalAmount,
        status: "draft",
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Log to automation ledger
      await storage.createAutomationLedgerEntry({
        agentName: "system",
        actionType: "estimate_converted_to_invoice",
        entityType: "estimate",
        entityId: estimateId,
        status: "recorded",
        mode: "auto",
        diffJson: { invoiceId: invoice.id, estimateId },
        reason: "Estimate converted to invoice",
      });

      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to convert estimate to invoice" });
    }
  });

  app.post("/api/jobs/:id/start", async (req, res) => {
    try {
      const job = await startJob(req.params.id);
      res.json(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start job";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/jobs/:id/complete", async (req, res) => {
    try {
      const job = await completeJob(req.params.id);
      res.json(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete job";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/jobs/:id/assign-technician", async (req, res) => {
    try {
      const validated = assignTechnicianSchema.parse(req.body);
      const job = await assignTechnician(req.params.id, validated.technicianId);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to assign technician";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/jobs/:id/update-status", async (req, res) => {
    try {
      const validated = updateStatusSchema.parse(req.body);
      const job = await updateJobStatus(req.params.id, validated.status);
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to update job status";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const invoice = await sendInvoice(req.params.id);
      res.json(invoice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invoice";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/invoices/:id/record-payment", async (req, res) => {
    try {
      const validated = recordPaymentSchema.parse(req.body);
      const invoice = await recordPayment(req.params.id, validated.amount.toString(), validated.method, validated.transactionRef);
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to record payment";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/ai/tools", async (_req, res) => {
    try {
      res.json({ tools: aiToolDefinitions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI tools" });
    }
  });

  app.post("/api/ai/execute-tool", requireInternalToken, async (req, res) => {
    try {
      // P0 HARDENING: Check kill switch BEFORE tool execution
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        return res.status(503).json({ 
          success: false, 
          error: "AI execution is currently disabled by kill switch" 
        });
      }

      const validated = executeToolSchema.parse(req.body);
      const result = await executeAITool(validated.toolName, validated.args, {});
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to execute AI tool";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/jobs/update-status", requireInternalToken, async (req, res) => {
    try {
      const validated = updateJobStatusSchema.parse(req.body);
      const job = await storage.updateJob(validated.jobId, { status: validated.status });
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_job_status",
        entityType: "job",
        entityId: validated.jobId,
        details: { status: validated.status, source: "n8n_webhook" },
      });
      res.json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to update job status" });
    }
  });

  app.post("/api/estimates/send", requireInternalToken, async (req, res) => {
    try {
      const validated = sendEstimateN8NSchema.parse(req.body);
      const estimate = await sendEstimate(validated.estimateId);
      res.json(estimate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to send estimate";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/invoices/send", requireInternalToken, async (req, res) => {
    try {
      const validated = sendInvoiceN8NSchema.parse(req.body);
      const invoice = await sendInvoice(validated.invoiceId);
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to send invoice";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/invoices/mark-paid", requireInternalToken, async (req, res) => {
    try {
      const validated = markInvoicePaidSchema.parse(req.body);
      const invoice = await storage.getInvoice(validated.invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const updated = await storage.updateInvoice(validated.invoiceId, {
        status: "paid",
        paidAt: new Date(),
      });
      await storage.createAuditLogEntry({
        userId: null,
        action: "mark_invoice_paid",
        entityType: "invoice",
        entityId: validated.invoiceId,
        details: { source: "n8n_webhook" },
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(400).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // N8N dispatch endpoint - DISABLED (use /api/agent/callback for external agent integration)
  app.post("/api/n8n/dispatch", async (_req, res) => {
    res.status(501).json({ success: false, error: "N8N dispatch disabled. Use /api/agent/callback for external agent integration." });
  });

  app.post("/api/events/update", requireInternalToken, async (req, res) => {
    try {
      // Simple validation for agent callback format
      const { eventId, eventType, status } = req.body;
      if (!eventId || !eventType) {
        return res.status(400).json({ error: "eventId and eventType are required" });
      }
      
      const body = req.body;
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "agent_event_result",
        entityType: "automation",
        entityId: body.eventId || body.proposalId,
        details: {
          eventType: body.eventType,
          status: body.status,
          result: body.result,
          timestamp: body.timestamp,
        },
      });

      // Create AI task record for tracking
      const aiTaskStatus = body.status === "success" || body.status === "completed" ? "completed" : "failed";
      await storage.createAiTask({
        taskType: `agent_${body.eventType || "callback"}`,
        delegatedTo: "external_agent",
        payload: {
          eventId: body.eventId || body.proposalId,
          eventType: body.eventType,
          result: body.result,
          timestamp: body.timestamp,
        },
        status: aiTaskStatus,
        completedAt: new Date(),
        error: body.status === "error" || body.status === "failed" ? (body.result?.error as string | undefined) : null,
      });


      if (body.status === "error" || body.status === "failed") {
        return res.json({ 
          success: false, 
          error: body.result?.error || body.errorMessage || "Unknown error from agent",
          eventId: body.eventId || body.proposalId,
        });
      }

      const result = body.result || {};
      let persistedData = null;

      switch (body.eventType) {
        case "invoice_created":
        case "create_payment_link": {
          if (result.paymentLink) {
            const invoice = await storage.getInvoice(body.eventId);
            if (invoice) {
              await storage.updateInvoice(body.eventId, {
                notes: `${invoice.notes || ""}\nPayment Link: ${result.paymentLink}`.trim(),
              });
              persistedData = { invoiceId: body.eventId, paymentLink: result.paymentLink };
            }
          }
          break;
        }
        
        case "send_email": {
          await storage.createAuditLogEntry({
            userId: null,
            action: "email_status_update",
            entityType: "communication",
            entityId: body.eventId,
            details: { 
              emailSent: result.emailSent,
              status: result.emailSent ? "sent" : "failed",
            },
          });
          persistedData = { emailSent: result.emailSent };
          break;
        }
        
        case "send_sms": {
          await storage.createAuditLogEntry({
            userId: null,
            action: "sms_status_update",
            entityType: "communication",
            entityId: body.eventId,
            details: { 
              smsSent: result.smsSent,
              status: result.smsSent ? "sent" : "failed",
            },
          });
          persistedData = { smsSent: result.smsSent };
          break;
        }
        
        case "new_lead": {
          if (result.aiGeneratedText) {
            await storage.createNote({
              title: "AI Lead Response",
              content: result.aiGeneratedText,
              entityType: "contact",
              entityId: body.eventId,
            });
            persistedData = { noteCreated: true, aiText: result.aiGeneratedText };
          }
          break;
        }

        case "job_updated": {
          const job = await storage.getJob(body.eventId);
          if (job && result.aiGeneratedText) {
            await storage.createNote({
              title: "Job Update Notification",
              content: result.aiGeneratedText,
              entityType: "job",
              entityId: job.id,
            });
            persistedData = { jobId: job.id, noteCreated: true };
          }
          break;
        }

        case "missed_call": {
          if (result.aiGeneratedText) {
            await storage.createNote({
              title: "Missed Call Follow-up",
              content: result.aiGeneratedText,
              entityType: "contact",
              entityId: body.eventId,
            });
            persistedData = { noteCreated: true, followUpCreated: true };
          }
          break;
        }
      }

      res.json({ 
        success: true, 
        eventId: body.eventId || body.proposalId,
        eventType: body.eventType,
        result: body.result,
        persistedData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process Neo8 event";
      await storage.createAuditLogEntry({
        userId: null,
        action: "neo8_event_error",
        entityType: "automation",
        entityId: "unknown",
        details: { error: message, body: req.body },
      });
      res.status(400).json({ error: message });
    }
  });

  const chatRequestSchema = z.object({
    message: z.string().min(1, "Message is required"),
    mode: z.enum(["draft", "assist", "auto"]).default("assist"),
    conversationHistory: z.array(z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })).optional().default([]),
  });

  app.post("/api/chat", requireInternalToken, async (req, res) => {
    try {
      const validated = chatRequestSchema.parse(req.body);
      const userId = (req as unknown as { userId?: string }).userId || null;
      const mode = validated.mode as AgentMode;
      
      // TODO: Process chat through external agent pipeline
      // For now, return a placeholder response
      const response = {
        message: "Chat message received. Processing through external agent.",
        toolCalls: [],
        mode,
      };

      await storage.createAuditLogEntry({
        userId,
        action: "ai_chat",
        entityType: "chat",
        entityId: "session",
        details: { 
          mode: validated.mode,
          message: validated.message,
          toolCalls: 0,
        },
      });

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      res.status(400).json({ error: message });
    }
  });

  // Assist Queue endpoints removed - migrated to proposals


  const createContactSchema = z.object({
    phone: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    company: z.string().optional(),
  }).refine(data => data.phone || data.email || data.name, {
    message: "At least one of phone, email, or name must be provided",
  });

  // N8N callback endpoint: Create or update contact
  app.post("/api/contacts/create", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/contacts/create", "POST", req.body);
      const validated = createContactSchema.parse(req.body);
      
      if (validated.phone) {
        const existing = await storage.getContactByPhone(validated.phone);
        if (existing) {
          const updates: Partial<typeof validated> = {};
          if (validated.name !== undefined) updates.name = validated.name;
          if (validated.email !== undefined) updates.email = validated.email;
          if (validated.company !== undefined) updates.company = validated.company;

          if (Object.keys(updates).length === 0) {
            const error = { error: "No fields provided for update" };
            logN8NResponse("/api/contacts/create", 400, error);
            return res.status(400).json(error);
          }

          const updated = await storage.updateContact(existing.id, updates);

          await storage.createAuditLogEntry({
            userId: null,
            action: "contact_upsert_update",
            entityType: "contact",
            entityId: existing.id,
            details: { source: "n8n_api", phone: validated.phone, action: "updated_existing", fieldsUpdated: Object.keys(updates) },
          });

          logN8NResponse("/api/contacts/create", 200, { ...updated, _action: "updated" });
          return res.json(updated);
        }
      }

      const newContact: Partial<InsertContact> = {};
      if (validated.phone !== undefined) newContact.phone = validated.phone;
      if (validated.name !== undefined) newContact.name = validated.name;
      if (validated.email !== undefined) newContact.email = validated.email;
      if (validated.company !== undefined) newContact.company = validated.company;

      const contact = await storage.createContact(newContact as InsertContact);

      await storage.createAuditLogEntry({
        userId: null,
        action: "contact_upsert_create",
        entityType: "contact",
        entityId: contact.id,
        details: { source: "n8n_api", action: "created_new", fieldsProvided: Object.keys(newContact).filter(k => k !== 'status') },
      });

      logN8NResponse("/api/contacts/create", 200, { ...contact, _action: "created" });
      res.json(contact);
    } catch (error) {
      logN8NError("/api/contacts/create", error);
      const message = error instanceof Error ? error.message : "Failed to create contact";
      const errorResponse = { error: message };
      logN8NResponse("/api/contacts/create", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const updateContactSchema = z.object({
    id: z.string().min(1, "Contact ID is required"),
    name: z.string().optional(),
    email: z.string().email().optional(),
    company: z.string().optional(),
    status: z.string().optional(),
  });

  // N8N callback endpoint: Update contact
  app.post("/api/contacts/update", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/contacts/update", "POST", req.body);
      const validated = updateContactSchema.parse(req.body);
      
      const updates: Partial<Omit<typeof validated, 'id'>> = {};
      if (validated.name !== undefined) updates.name = validated.name;
      if (validated.email !== undefined) updates.email = validated.email;
      if (validated.company !== undefined) updates.company = validated.company;
      if (validated.status !== undefined) updates.status = validated.status;

      if (Object.keys(updates).length === 0) {
        const error = { error: "No fields provided for update" };
        logN8NResponse("/api/contacts/update", 400, error);
        return res.status(400).json(error);
      }

      const updated = await storage.updateContact(validated.id, updates);

      if (!updated) {
        const error = { error: "Contact not found" };
        logN8NResponse("/api/contacts/update", 404, error);
        return res.status(404).json(error);
      }

      await storage.createAuditLogEntry({
        userId: null,
        action: "contact_update",
        entityType: "contact",
        entityId: updated.id,
        details: { source: "n8n_api", fieldsUpdated: Object.keys(updates) },
      });

      logN8NResponse("/api/contacts/update", 200, updated);
      res.json(updated);
    } catch (error) {
      logN8NError("/api/contacts/update", error);
      const message = error instanceof Error ? error.message : "Failed to update contact";
      const errorResponse = { error: message };
      logN8NResponse("/api/contacts/update", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const createLeadSchema = z.object({
    contactId: z.string().min(1, "Contact ID is required"),
    reason: z.string().optional(),
    summary: z.string().optional(),
    status: z.string().default("lead_intake"),
  });

  // N8N callback endpoint: Create lead
  app.post("/api/leads/create", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/leads/create", "POST", req.body);
      const validated = createLeadSchema.parse(req.body);
      
      const contact = await storage.getContact(validated.contactId);
      if (!contact) {
        const error = { error: "Contact not found" };
        logN8NResponse("/api/leads/create", 404, error);
        return res.status(404).json(error);
      }

      const lead = await storage.createJob({
        clientId: validated.contactId,
        status: validated.status,
        title: "New Lead",
        jobType: "lead",
      });

      if (validated.reason || validated.summary) {
        await storage.createNote({
          title: "Lead Notes",
          content: `${validated.reason ? `Reason: ${validated.reason}\n` : ""}${validated.summary || ""}`.trim(),
          entityType: "job",
          entityId: lead.id,
        });
      }

      await storage.createAuditLogEntry({
        userId: null,
        action: "lead_create",
        entityType: "job",
        entityId: lead.id,
        details: { source: "n8n_api", contactId: validated.contactId, jobType: "lead" },
      });

      logN8NResponse("/api/leads/create", 200, lead);
      res.json(lead);
    } catch (error) {
      logN8NError("/api/leads/create", error);
      const message = error instanceof Error ? error.message : "Failed to create lead";
      const errorResponse = { error: message };
      logN8NResponse("/api/leads/create", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const createJobSchema = z.object({
    contactId: z.string().min(1, "Contact ID is required"),
    jobType: z.string().optional(),
    propertyType: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    budget: z.string().optional(),
    preferredTime: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().default("lead_intake"),
  });

  // N8N callback endpoint: Create job
  app.post("/api/jobs/create", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/jobs/create", "POST", req.body);
      const validated = createJobSchema.parse(req.body);
      
      const contact = await storage.getContact(validated.contactId);
      if (!contact) {
        const error = { error: "Contact not found" };
        logN8NResponse("/api/jobs/create", 404, error);
        return res.status(404).json(error);
      }

      const job = await storage.createJob({
        clientId: validated.contactId,
        status: validated.status,
        title: validated.jobType || "New Job",
        scope: validated.notes || undefined,
        estimatedValue: validated.budget || undefined,
        jobType: validated.jobType || "general",
      });

      if (validated.notes || validated.jobType || validated.budget) {
        const noteContent = [
          validated.jobType ? `Job Type: ${validated.jobType}` : "",
          validated.propertyType ? `Property Type: ${validated.propertyType}` : "",
          validated.address ? `Address: ${validated.address}` : "",
          validated.city ? `City: ${validated.city}` : "",
          validated.budget ? `Budget: ${validated.budget}` : "",
          validated.preferredTime ? `Preferred Time: ${validated.preferredTime}` : "",
          validated.notes ? `Notes: ${validated.notes}` : "",
        ].filter(Boolean).join("\n");

        await storage.createNote({
          title: "Job Details",
          content: noteContent,
          entityType: "job",
          entityId: job.id,
        });
      }

      await storage.createAuditLogEntry({
        userId: null,
        action: "job_create",
        entityType: "job",
        entityId: job.id,
        details: { source: "n8n_api", contactId: validated.contactId },
      });

      logN8NResponse("/api/jobs/create", 200, job);
      res.json(job);
    } catch (error) {
      logN8NError("/api/jobs/create", error);
      const message = error instanceof Error ? error.message : "Failed to create job";
      const errorResponse = { error: message };
      logN8NResponse("/api/jobs/create", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const writeActivityLogSchema = z.object({
    contactId: z.string().min(1, "Contact ID is required"),
    type: z.string().min(1, "Activity type is required"),
    direction: z.string().optional(),
    summary: z.string().min(1, "Summary is required"),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string().optional(),
  });

  // N8N callback endpoint: Write activity log
  app.post("/api/activity-log/write", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/activity-log/write", "POST", req.body);
      const validated = writeActivityLogSchema.parse(req.body);
      
      const contact = await storage.getContact(validated.contactId);
      if (!contact) {
        const error = { error: "Contact not found" };
        logN8NResponse("/api/activity-log/write", 404, error);
        return res.status(404).json(error);
      }

      const note = await storage.createNote({
        title: `Activity: ${validated.type}`,
        content: `[${validated.type.toUpperCase()}${validated.direction ? ` - ${validated.direction}` : ""}]\n${validated.summary}`,
        entityType: "contact",
        entityId: validated.contactId,
      });

      await storage.createAuditLogEntry({
        userId: null,
        action: "activity_log",
        entityType: "contact",
        entityId: validated.contactId,
        details: { 
          source: "n8n_api", 
          type: validated.type,
          direction: validated.direction,
          metadata: validated.metadata,
        },
      });

      const response = { 
        id: note.id,
        contactId: validated.contactId,
        type: validated.type,
        summary: validated.summary,
        timestamp: note.createdAt,
      };
      logN8NResponse("/api/activity-log/write", 200, response);
      res.json(response);
    } catch (error) {
      logN8NError("/api/activity-log/write", error);
      const message = error instanceof Error ? error.message : "Failed to write activity log";
      const errorResponse = { error: message };
      logN8NResponse("/api/activity-log/write", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const calendarActivitySchema = z.object({
    action: z.enum(["create", "update", "cancel"]),
    eventId: z.string().optional(),
    title: z.string().min(1, "Event title is required"),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
    attendees: z.array(z.string()).optional(),
    calendarId: z.string().optional(),
    contactId: z.string().optional(),
    jobId: z.string().optional(),
    result: z.object({
      success: z.boolean(),
      googleEventId: z.string().optional(),
      error: z.string().optional(),
    }).optional(),
  });

  // N8N callback endpoint: Log calendar activity
  app.post("/api/calendar/log", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/calendar/log", "POST", req.body);
      const validated = calendarActivitySchema.parse(req.body);
      
      const actionLabel = validated.action === "create" ? "Created" : 
                          validated.action === "update" ? "Updated" : "Cancelled";
      
      await storage.createAuditLogEntry({
        userId: null,
        action: `google_calendar_${validated.action}`,
        entityType: "google_workspace",
        entityId: validated.result?.googleEventId || validated.eventId || null,
        details: {
          source: "n8n_callback",
          action: validated.action,
          title: validated.title,
          startDateTime: validated.startDateTime,
          endDateTime: validated.endDateTime,
          attendees: validated.attendees,
          calendarId: validated.calendarId,
          contactId: validated.contactId,
          jobId: validated.jobId,
          result: validated.result,
        },
      });

      if (validated.contactId) {
        await storage.createNote({
          title: `Calendar: ${actionLabel} Event`,
          content: `[CALENDAR - ${validated.action.toUpperCase()}]\nEvent: ${validated.title}\n${validated.startDateTime ? `Start: ${validated.startDateTime}` : ""}\n${validated.endDateTime ? `End: ${validated.endDateTime}` : ""}\n${validated.attendees?.length ? `Attendees: ${validated.attendees.join(", ")}` : ""}`,
          entityType: "contact",
          entityId: validated.contactId,
        });
      }

      if (validated.jobId) {
        await storage.createNote({
          title: `Calendar: ${actionLabel} Event`,
          content: `[CALENDAR - ${validated.action.toUpperCase()}]\nEvent: ${validated.title}\n${validated.startDateTime ? `Start: ${validated.startDateTime}` : ""}\n${validated.endDateTime ? `End: ${validated.endDateTime}` : ""}`,
          entityType: "job",
          entityId: validated.jobId,
        });
      }

      const response = {
        logged: true,
        action: validated.action,
        title: validated.title,
        eventId: validated.result?.googleEventId || validated.eventId,
        timestamp: new Date().toISOString(),
      };
      logN8NResponse("/api/calendar/log", 200, response);
      res.json(response);
    } catch (error) {
      logN8NError("/api/calendar/log", error);
      const message = error instanceof Error ? error.message : "Failed to log calendar activity";
      const errorResponse = { error: message };
      logN8NResponse("/api/calendar/log", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  const emailActivitySchema = z.object({
    action: z.enum(["send", "reply"]),
    to: z.string().min(1, "Recipient email is required"),
    from: z.string().optional(),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().optional(),
    threadId: z.string().optional(),
    messageId: z.string().optional(),
    contactId: z.string().optional(),
    jobId: z.string().optional(),
    result: z.object({
      success: z.boolean(),
      gmailMessageId: z.string().optional(),
      error: z.string().optional(),
    }).optional(),
  });

  // N8N callback endpoint: Log email activity
  app.post("/api/email/log", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/email/log", "POST", req.body);
      const validated = emailActivitySchema.parse(req.body);
      
      const actionLabel = validated.action === "send" ? "Sent" : "Replied";
      
      await storage.createAuditLogEntry({
        userId: null,
        action: `google_gmail_${validated.action}`,
        entityType: "google_workspace",
        entityId: validated.result?.gmailMessageId || validated.messageId || null,
        details: {
          source: "n8n_callback",
          action: validated.action,
          to: validated.to,
          from: validated.from,
          subject: validated.subject,
          threadId: validated.threadId,
          messageId: validated.messageId,
          contactId: validated.contactId,
          jobId: validated.jobId,
          result: validated.result,
        },
      });

      if (validated.contactId) {
        await storage.createNote({
          title: `Email: ${actionLabel}`,
          content: `[EMAIL - ${validated.action.toUpperCase()}]\nTo: ${validated.to}\nSubject: ${validated.subject}\n${validated.threadId ? `Thread: ${validated.threadId}` : ""}`,
          entityType: "contact",
          entityId: validated.contactId,
        });
      }

      if (validated.jobId) {
        await storage.createNote({
          title: `Email: ${actionLabel}`,
          content: `[EMAIL - ${validated.action.toUpperCase()}]\nTo: ${validated.to}\nSubject: ${validated.subject}`,
          entityType: "job",
          entityId: validated.jobId,
        });
      }

      const response = {
        logged: true,
        action: validated.action,
        to: validated.to,
        subject: validated.subject,
        messageId: validated.result?.gmailMessageId || validated.messageId,
        timestamp: new Date().toISOString(),
      };
      logN8NResponse("/api/email/log", 200, response);
      res.json(response);
    } catch (error) {
      logN8NError("/api/email/log", error);
      const message = error instanceof Error ? error.message : "Failed to log email activity";
      const errorResponse = { error: message };
      logN8NResponse("/api/email/log", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  // N8N callback endpoint: Link Google Workspace file to CRM
  const workspaceFileSchema = z.object({
    googleFileId: z.string(),
    name: z.string(),
    type: z.enum(["doc", "sheet", "drive"]),
    url: z.string().url(),
    jobId: z.string().optional(),
    contactId: z.string().optional(),
    lastModifiedBy: z.string().optional(),
    lastModifiedTime: z.string().optional(),
  });

  app.post("/api/workspace/files/link", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/workspace/files/link", "POST", req.body);
      const validated = workspaceFileSchema.parse(req.body);

      // Check if file already exists
      const existing = await storage.getWorkspaceFileByGoogleId(validated.googleFileId);
      
      if (existing) {
        // Update existing file
        const updated = await storage.updateWorkspaceFile(existing.id, {
          name: validated.name,
          url: validated.url,
          jobId: validated.jobId || existing.jobId,
          contactId: validated.contactId || existing.contactId,
          lastModifiedBy: validated.lastModifiedBy,
          lastModifiedTime: validated.lastModifiedTime ? new Date(validated.lastModifiedTime) : null,
          status: "active",
        });

        const response = {
          linked: true,
          action: "updated",
          fileId: existing.id,
          googleFileId: validated.googleFileId,
          timestamp: new Date().toISOString(),
        };
        logN8NResponse("/api/workspace/files/link", 200, response);
        return res.json(response);
      }

      // Create new file link
      const file = await storage.createWorkspaceFile({
        googleFileId: validated.googleFileId,
        name: validated.name,
        type: validated.type,
        url: validated.url,
        jobId: validated.jobId || null,
        contactId: validated.contactId || null,
        lastModifiedBy: validated.lastModifiedBy || null,
        lastModifiedTime: validated.lastModifiedTime ? new Date(validated.lastModifiedTime) : null,
        status: "active",
      });

      await storage.createAuditLogEntry({
        userId: null,
        action: `google_${validated.type}_linked`,
        entityType: "workspace_file",
        entityId: file.id,
        details: {
          source: "n8n_callback",
          googleFileId: validated.googleFileId,
          name: validated.name,
          type: validated.type,
          jobId: validated.jobId,
          contactId: validated.contactId,
        },
      });

      const response = {
        linked: true,
        action: "created",
        fileId: file.id,
        googleFileId: validated.googleFileId,
        timestamp: new Date().toISOString(),
      };
      logN8NResponse("/api/workspace/files/link", 201, response);
      res.status(201).json(response);
    } catch (error) {
      logN8NError("/api/workspace/files/link", error);
      const message = error instanceof Error ? error.message : "Failed to link workspace file";
      const errorResponse = { error: message };
      logN8NResponse("/api/workspace/files/link", 400, errorResponse);
      res.status(400).json(errorResponse);
    }
  });

  // Google Drive folder creation endpoints - DISABLED (Neo8 removed)
  app.post("/api/workspace/folders/contact/:contactId", n8nWebhookRateLimiter, requireInternalToken, async (_req, res) => {
    res.status(501).json({ error: "Google Drive integration disabled (Neo8 removed)" });
  });

  app.post("/api/workspace/folders/job/:jobId", n8nWebhookRateLimiter, requireInternalToken, async (_req, res) => {
    res.status(501).json({ error: "Google Drive integration disabled (Neo8 removed)" });
  });

  // ============================================================================
  // DEAD CODE: Chat endpoints disabled - stub services deleted during system purge
  // These endpoints will be rebuilt with proper AI integration
  // Lines 6584-7032 temporarily commented out
  // ============================================================================
  /*
  app.post("/api/chat/conversations", async (req, res) => {
    try {
      const validated = createConversationSchema.parse(req.body);
      const conversation = await chatService.getOrCreateConversation(
        validated.contactId || null,
        validated.channel
      );
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/chat/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      logger.error("Failed to fetch conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await chatService.getConversationHistory(req.params.id);
      res.json(messages);
    } catch (error) {
      logger.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/message", async (req, res) => {
    try {
      const validated = sendMessageSchema.parse(req.body);

      const response = await chatService.sendMessage({
        conversationId: validated.conversationId,
        contactId: validated.contactId || null,
        userMessage: validated.message,
        systemPrompt: validated.systemPrompt,
      });

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/chat/identify", async (req, res) => {
    try {
      const validated = identifyContactSchema.parse(req.body);

      const contact = await chatService.identifyContact({
        conversationId: validated.conversationId,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
      });

      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to identify contact:", error);
      res.status(500).json({ error: "Failed to identify contact" });
    }
  });

  app.post("/api/chat/conversations/:id/close", async (req, res) => {
    try {
      await chatService.closeConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to close conversation:", error);
      res.status(500).json({ error: "Failed to close conversation" });
    }
  });

  // ========================================
  // ADMIN CHAT ENDPOINTS (Internal CRM Bot)
  // ========================================
  // These endpoints are for the internal admin chatbot (Master Architect removed; now direct CRM access)
  // with FULL CRM access. Completely separate from public customer widget.
  
  const adminChatMessageSchema = z.object({
    message: z.string().min(1, "message is required"),
    contactId: z.string().optional(),
  });

  const adminChatModeSchema = z.object({
    mode: z.enum(["draft", "assist", "auto"]),
  });

  // Get or create admin conversation for current user
  app.post("/api/admin-chat/conversations", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      
      // TODO: Get userId from session/auth when implemented
      const userId = (req as any).userId || "admin-user";
      
      const adminChat = createAdminChatService({ 
        userId, 
        mode: "assist" // Default mode
      });
      
      const conversation = await adminChat.getOrCreateConversation();
      res.status(201).json(conversation);
    } catch (error) {
      logger.error("Failed to create admin conversation:", error);
      res.status(500).json({ error: "Failed to create admin conversation" });
    }
  });

  // Get admin conversation messages
  app.get("/api/admin-chat/conversations/:id/messages", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = (req as any).userId || "admin-user";
      const conversationId = req.params.id;

      // SECURITY: Validate conversation ownership before returning messages
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check userId exists (reject legacy conversations)
      const conversationUserId = (conversation.metadata as Record<string, unknown>)?.userId;
      if (!conversationUserId) {
        return res.status(403).json({ 
          error: "Unauthorized: Conversation ownership cannot be verified" 
        });
      }

      // Validate userId matches authenticated user
      if (conversationUserId !== userId) {
        return res.status(403).json({ error: "Unauthorized: You cannot access this conversation" });
      }
      
      const adminChat = createAdminChatService({ userId, mode: "assist" });
      const messages = await adminChat.getConversationHistory(conversationId);
      res.json(messages);
    } catch (error) {
      logger.error("Failed to fetch admin messages:", error);
      res.status(500).json({ error: "Failed to fetch admin messages" });
    }
  });

  // Send message to admin chatbot (Master Architect)
  app.post("/api/admin-chat/message", async (req, res) => {
    try {
      const validated = adminChatMessageSchema.parse(req.body);
      const { createAdminChatService } = await import("./admin-chat-service");
      
      const userId = (req as any).userId || "admin-user";
      const conversationId = req.body.conversationId;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }

      // Get conversation and validate ownership
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // SECURITY: Validate ownership - prevent users from messaging other users' conversations
      const conversationUserId = (conversation.metadata as Record<string, unknown>)?.userId;
      
      // Handle missing userId (legacy conversations or malformed data)
      if (!conversationUserId) {
        // OPTION 1: Reject access to legacy conversations without userId (most secure)
        return res.status(403).json({ 
          error: "Unauthorized: Conversation ownership cannot be verified" 
        });
        
        // OPTION 2: Backfill userId for legacy conversations (if migration needed)
        // await storage.updateConversation(conversationId, {
        //   metadata: { ...(conversation.metadata || {}), userId },
        // });
      }
      
      // Validate userId matches authenticated user
      if (conversationUserId !== userId) {
        return res.status(403).json({ error: "Unauthorized: You cannot access this conversation" });
      }

      // Get mode from conversation metadata or default to assist
      const mode = ((conversation.metadata as Record<string, unknown>)?.mode as "draft" | "assist" | "auto") || "assist";

      const adminChat = createAdminChatService({ userId, mode });
      
      const response = await adminChat.sendMessage({
        conversationId,
        message: validated.message,
        contactId: validated.contactId,
      });

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to send admin message:", error);
      res.status(500).json({ error: "Failed to send admin message" });
    }
  });

  // Update admin chatbot mode
  app.post("/api/admin-chat/mode", async (req, res) => {
    try {
      const validated = adminChatModeSchema.parse(req.body);
      const conversationId = req.body.conversationId;
      
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }

      // Get existing conversation to merge metadata
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Validate ownership (when auth is implemented, check userId matches)
      const userId = (req as any).userId || "admin-user";
      if ((conversation.metadata as Record<string, unknown>)?.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Merge new mode into existing metadata
      const updatedMetadata = {
        ...(conversation.metadata || {}),
        mode: validated.mode,
      };

      // Update conversation with merged metadata
      await storage.updateConversation(conversationId, {
        metadata: updatedMetadata,
      });

      // Get updated conversation to confirm
      const updated = await storage.getConversation(conversationId);

      res.json({ 
        success: true, 
        mode: validated.mode,
        conversation: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update admin chat mode:", error);
      res.status(500).json({ error: "Failed to update admin chat mode" });
    }
  });

  // Get all active admin conversations
  app.get("/api/admin-chat/conversations", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = (req as any).userId || "admin-user";
      
      const adminChat = createAdminChatService({ userId, mode: "assist" });
      const conversations = await adminChat.getActiveConversations();
      res.json(conversations);
    } catch (error) {
      logger.error("Failed to fetch admin conversations:", error);
      res.status(500).json({ error: "Failed to fetch admin conversations" });
    }
  });

  // Close admin conversation
  app.post("/api/admin-chat/conversations/:id/close", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = (req as any).userId || "admin-user";
      
      const adminChat = createAdminChatService({ userId, mode: "assist" });
      await adminChat.closeConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to close admin conversation:", error);
      res.status(500).json({ error: "Failed to close admin conversation" });
    }
  });

  // ========================================
  // PUBLIC CHAT WIDGET API (unauthenticated)
  // ========================================

  // Rate limiting for public endpoints
  const publicChatRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per IP per 15 minutes
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const publicChatSessionRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Max 10 sessions per IP per 15 minutes
    message: "Too many sessions created, please try again later",
  });

  const publicChatSessionSchema = z.object({
    metadata: z.record(z.unknown()).optional(),
    welcomeMessage: z.string().optional(),
  });

  const publicChatMessageSchema = z.object({
    sessionToken: z.string().min(1, "sessionToken is required"),
    message: z.string().min(1, "message is required"),
  });

  const publicChatIdentifySchema = z.object({
    sessionToken: z.string().min(1, "sessionToken is required"),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    message: z.string().optional(),
  });

  // Create new public chat session
  app.post("/api/public-chat/sessions", publicChatSessionRateLimiter, async (req, res) => {
    try {
      const validated = publicChatSessionSchema.parse(req.body);
      const { PublicChatService } = await import("./public-chat-service");
      
      const publicChat = new PublicChatService({
        welcomeMessage: validated.welcomeMessage || "Hi! How can I help you today?",
      });

      const result = await publicChat.createSession({
        metadata: validated.metadata,
      });

      res.json({
        sessionToken: result.sessionToken,
        conversationId: result.conversation.id,
        welcomeMessage: result.welcomeMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create public chat session:", error);
      res.status(500).json({ error: "Failed to create public chat session" });
    }
  });

  // Send message in public chat
  app.post("/api/public-chat/messages", publicChatRateLimiter, async (req, res) => {
    try {
      const validated = publicChatMessageSchema.parse(req.body);
      const { PublicChatService } = await import("./public-chat-service");
      
      const publicChat = new PublicChatService();
      const result = await publicChat.sendMessage({
        sessionToken: validated.sessionToken,
        message: validated.message,
      });

      res.json({
        userMessage: result.userMessage,
        aiResponse: result.aiResponse,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      if (error instanceof Error && error.message === "Invalid session") {
        return res.status(401).json({ error: "Invalid session" });
      }
      logger.error("Failed to send public chat message:", error);
      res.status(500).json({ error: "Failed to send public chat message" });
    }
  });

  // Identify lead in public chat
  app.post("/api/public-chat/identify", publicChatRateLimiter, async (req, res) => {
    try {
      const validated = publicChatIdentifySchema.parse(req.body);
      const { PublicChatService } = await import("./public-chat-service");
      
      const publicChat = new PublicChatService();
      const result = await publicChat.identifyLead({
        sessionToken: validated.sessionToken,
        lead: {
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
          company: validated.company,
          message: validated.message,
        },
      });

      res.json({
        contact: result.contact,
        conversationId: result.conversation.id,
        success: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      if (error instanceof Error && error.message === "Invalid session") {
        return res.status(401).json({ error: "Invalid session" });
      }
      logger.error("Failed to identify lead:", error);
      res.status(500).json({ error: "Failed to identify lead" });
    }
  });

  // Get messages for public chat session
  app.get("/api/public-chat/messages/:sessionToken", publicChatRateLimiter, async (req, res) => {
    try {
      const { PublicChatService } = await import("./public-chat-service");
      const publicChat = new PublicChatService();
      
      const messages = await publicChat.getSessionMessages(req.params.sessionToken);
      res.json({ messages });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid session") {
        return res.status(401).json({ error: "Invalid session" });
      }
      logger.error("Failed to get public chat messages:", error);
      res.status(500).json({ error: "Failed to get public chat messages" });
    }
  });
  */ // END DEAD CODE: Chat endpoints disabled
  // ============================================================================

  // ========== EMAIL ACCOUNTS ==========
  // Helper to redact sensitive credentials from email account responses
  const redactEmailCredentials = (account: any) => {
    const { encryptedPassword, username, ...safeAccount } = account;
    return {
      ...safeAccount,
      hasCredentials: !!(encryptedPassword || username),
    };
  };

  app.get("/api/email-accounts", async (_req, res) => {
    try {
      const accounts = await storage.getEmailAccounts();
      res.json(accounts.map(redactEmailCredentials));
    } catch (error) {
      logger.error("Failed to get email accounts:", error);
      res.status(500).json({ error: "Failed to get email accounts" });
    }
  });

  app.get("/api/email-accounts/:id", async (req, res) => {
    try {
      const account = await storage.getEmailAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }
      res.json(redactEmailCredentials(account));
    } catch (error) {
      logger.error("Failed to get email account:", error);
      res.status(500).json({ error: "Failed to get email account" });
    }
  });

  app.post("/api/email-accounts", async (req, res) => {
    try {
      const validated = insertEmailAccountSchema.parse(req.body);
      const account = await storage.createEmailAccount(validated);
      res.status(201).json(redactEmailCredentials(account));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create email account:", error);
      res.status(500).json({ error: "Failed to create email account" });
    }
  });

  app.patch("/api/email-accounts/:id", async (req, res) => {
    try {
      const validated = insertEmailAccountSchema.partial().parse(req.body);
      const account = await storage.updateEmailAccount(req.params.id, validated);
      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }
      res.json(redactEmailCredentials(account));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update email account:", error);
      res.status(500).json({ error: "Failed to update email account" });
    }
  });

  app.delete("/api/email-accounts/:id", async (req, res) => {
    try {
      const success = await storage.deleteEmailAccount(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Email account not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete email account:", error);
      res.status(500).json({ error: "Failed to delete email account" });
    }
  });

  // ========== EMAILS ==========
  app.get("/api/emails", async (req, res) => {
    try {
      const filters = {
        accountId: req.query.accountId as string | undefined,
        direction: req.query.direction as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      const emails = await storage.getEmails(filters);
      
      // Enrich emails with account info for identity/provider detection
      const emailAccounts = await storage.getEmailAccounts();
      const accountMap = new Map(emailAccounts.map(a => [a.id, a]));
      
      const enrichedEmails = emails.map(email => {
        const account = accountMap.get(email.accountId);
        const accountName = account?.displayName?.toLowerCase() || '';
        // Infer provider from account displayName (set during mirror creation)
        const provider = accountName.includes('sendgrid') ? 'sendgrid' : 'gmail';
        return {
          ...email,
          accountDisplayName: account?.displayName || 'Unknown',
          provider,
        };
      });
      
      res.json(enrichedEmails);
    } catch (error) {
      logger.error("Failed to get emails:", error);
      res.status(500).json({ error: "Failed to get emails" });
    }
  });

  app.get("/api/emails/:id", async (req, res) => {
    try {
      const email = await storage.getEmail(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.json(email);
    } catch (error) {
      logger.error("Failed to get email:", error);
      res.status(500).json({ error: "Failed to get email" });
    }
  });

  app.post("/api/emails", async (req, res) => {
    try {
      const validated = insertEmailSchema.parse(req.body);
      const email = await storage.createEmail(validated);
      res.status(201).json(email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create email:", error);
      res.status(500).json({ error: "Failed to create email" });
    }
  });

  app.patch("/api/emails/:id", async (req, res) => {
    try {
      const validated = insertEmailSchema.partial().parse(req.body);
      const email = await storage.updateEmail(req.params.id, validated);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.json(email);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update email:", error);
      res.status(500).json({ error: "Failed to update email" });
    }
  });

  app.delete("/api/emails/:id", async (req, res) => {
    try {
      const success = await storage.deleteEmail(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete email:", error);
      res.status(500).json({ error: "Failed to delete email" });
    }
  });

  // Email Dispatch - Authorizes and queues email for Neo8 Engine
  // Per README: CRM never sends directly, all dispatch goes through Neo8
  app.post("/api/emails/dispatch", async (req, res) => {
    try {
      const { identity, to, subject, body, templateId, contactId } = req.body;
      
      // Validate required fields
      if (!identity || !to) {
        return res.status(400).json({ error: "Missing required fields: identity, to" });
      }
      
      if (identity === "personal" && (!subject || !body)) {
        return res.status(400).json({ error: "Personal emails require subject and body" });
      }
      
      if (identity === "company" && !templateId) {
        return res.status(400).json({ error: "Company emails require templateId" });
      }

      // Generate correlation ID for tracing
      const correlationId = crypto.randomUUID();

      // Write EMAIL_DISPATCH_AUTHORIZED to ledger
      const dispatchId = `dispatch-${Date.now()}`;
      await storage.createAutomationLedgerEntry({
        agentName: identity === "personal" ? "Human Operator" : "System Dispatch",
        actionType: "EMAIL_DISPATCH_AUTHORIZED",
        entityType: "email",
        entityId: dispatchId,
        mode: "auto",
        status: "authorized",
        diffJson: {
          identity_provider: identity === "personal" ? "gmail" : "sendgrid",
          target: to,
          subject: identity === "personal" ? subject : undefined,
          body: identity === "personal" ? body : undefined,
          template_id: identity === "company" ? templateId : undefined,
          contact_id: contactId,
        },
        reason: `Email dispatch authorized via ${identity} identity to ${to}`,
        correlationId,
        executionTraceId: dispatchId,
        idempotencyKey: `email-auth-${dispatchId}`,
      });

      logger.info("[Email Dispatch] Authorized:", { to, identity, correlationId });

      // MIGRATION: Use unified agent dispatcher instead of direct N8N webhook
      const { dispatchEmail } = await import('./agent-dispatcher');
      
      try {
        const dispatchResult = await dispatchEmail({
          type: "email",
          correlationId,
          to,
          subject: identity === "personal" ? subject : "Template Email",
          body: identity === "personal" ? body : `Template: ${templateId}`,
          identity: identity === "personal" ? "personal" : "system",
          contactId,
        });

        logger.info("[Email Dispatch] Dispatched via agent gateway:", dispatchResult);

        res.status(200).json({ 
          success: true, 
          message: `Email dispatched via ${identity === "personal" ? "Gmail" : "SendGrid"}`,
          dispatchId,
          correlationId: dispatchResult.correlationId,
        });
      } catch (dispatchError) {
        logger.error("[Email Dispatch] Agent dispatch failed:", dispatchError);
        
        // Write EMAIL_DISPATCH_FAILED to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "agent_dispatcher",
          actionType: "EMAIL_DISPATCH_FAILED",
          entityType: "email",
          entityId: dispatchId,
          mode: "auto",
          status: "failed",
          diffJson: {
            error: dispatchError instanceof Error ? dispatchError.message : "Unknown error",
            failedAt: new Date().toISOString(),
          },
          reason: `Email dispatch failed: ${dispatchError instanceof Error ? dispatchError.message : "Unknown error"}`,
          correlationId,
          executionTraceId: dispatchId,
        });
        
        return res.status(502).json({ 
          error: "Email dispatch failed", 
          details: dispatchError instanceof Error ? dispatchError.message : "Unknown error" 
        });
      }
    } catch (error) {
      logger.error("Failed to dispatch email:", error);
      res.status(500).json({ error: "Failed to dispatch email" });
    }
  });

  // Email Mirror - n8n callback to save inbound/outbound emails to the emails table
  // Helper to extract email from "Name <email>" format or plain email
  function extractEmail(input: string): string {
    const match = input.match(/<([^>]+)>/);
    if (match) return match[1].trim();
    // If no angle brackets, assume it's already a plain email
    return input.trim();
  }

  // Helper to decode HTML entities
  function decodeHtmlEntities(text: string): string {
    if (!text) return text;
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  // Helper to strip Gmail quoted reply blocks and clean up email body
  function cleanEmailBody(body: string): string {
    if (!body) return body;
    
    // Decode HTML entities first
    let cleaned = decodeHtmlEntities(body);
    
    // Remove Gmail quoted reply pattern: "On [date] [name] <email> wrote:"
    // This pattern catches the start of quoted content
    const quotePatterns = [
      /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^]*?wrote:\s*/gi,
      /On\s+\d{1,2}\/\d{1,2}\/\d{2,4}[^]*?wrote:\s*/gi,
      /On\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^]*?wrote:\s*/gi,
    ];
    
    for (const pattern of quotePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        // Keep only the content before the quoted section
        const index = cleaned.indexOf(match[0]);
        if (index > 0) {
          cleaned = cleaned.substring(0, index).trim();
        }
      }
    }
    
    // Remove leading/trailing whitespace and extra newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    
    return cleaned;
  }

  const emailMirrorSchema = z.object({
    contactId: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]),
    provider: z.enum(["gmail", "sendgrid"]),
    from: z.string().min(1),
    to: z.string().min(1),
    subject: z.string().optional(),
    body: z.string().optional(),
    bodyHtml: z.string().optional(),
    threadId: z.string().optional(),
    messageId: z.string().optional(),
    timestamp: z.string().optional(),
  });

  app.post("/api/emails/mirror", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/emails/mirror", "POST", req.body);
      const validated = emailMirrorSchema.parse(req.body);
      
      // Extract clean email addresses (strip "Name <email>" format)
      const fromEmail = extractEmail(validated.from);
      const toEmail = extractEmail(validated.to);
      
      // Debug logging to trace from/to extraction
      logger.info(`[Email Mirror] Raw from: "${validated.from}" → Extracted: "${fromEmail}"`);
      logger.info(`[Email Mirror] Raw to: "${validated.to}" → Extracted: "${toEmail}"`);
      logger.info(`[Email Mirror] Direction: ${validated.direction}`);
      
      // Find or create a system email account for this provider
      let emailAccount = await storage.getEmailAccountByAddress(
        validated.direction === "inbound" ? toEmail : fromEmail
      );
      
      if (!emailAccount) {
        // Create a system email account for this provider
        const systemEmail = validated.direction === "inbound" ? toEmail : fromEmail;
        emailAccount = await storage.createEmailAccount({
          displayName: `${validated.provider.charAt(0).toUpperCase() + validated.provider.slice(1)} Mirror`,
          emailAddress: systemEmail,
          status: "connected",
          direction: "send_receive",
        });
        logger.info(`[Email Mirror] Created system email account for ${systemEmail}`);
      }

      // Validate contactId if provided
      let linkedContact = null;
      if (validated.contactId) {
        linkedContact = await storage.getContact(validated.contactId);
        if (!linkedContact) {
          const error = { error: "Contact not found", contactId: validated.contactId };
          logN8NResponse("/api/emails/mirror", 404, error);
          return res.status(404).json(error);
        }
      }

      // Parse timestamp - handle both ISO strings and Unix timestamps
      let emailTimestamp: Date | null = null;
      if (validated.timestamp) {
        // Try parsing as number first (Unix timestamp in ms), then as ISO string
        const numTs = Number(validated.timestamp);
        emailTimestamp = !isNaN(numTs) ? new Date(numTs) : new Date(validated.timestamp);
        // Validate the date
        if (isNaN(emailTimestamp.getTime())) {
          emailTimestamp = new Date();
        }
      } else {
        emailTimestamp = new Date();
      }

      // Clean plain text body only - decode HTML entities and strip quoted reply blocks
      // Leave HTML body untouched to preserve valid markup
      const cleanedBodyText = validated.body ? cleanEmailBody(validated.body) : null;
      
      logger.info(`[Email Mirror] Original body length: ${validated.body?.length || 0}, Cleaned: ${cleanedBodyText?.length || 0}`);
      
      // Save email to the emails table
      const emailRecord = await storage.createEmail({
        accountId: emailAccount.id,
        messageId: validated.messageId || null,
        threadId: validated.threadId || null,
        direction: validated.direction === "inbound" ? "incoming" : "outgoing",
        fromAddress: fromEmail,
        toAddresses: [toEmail],
        subject: validated.subject || "(No Subject)",
        bodyHtml: validated.bodyHtml || null,
        bodyText: cleanedBodyText,
        status: "synced",
        contactId: validated.contactId || null,
        receivedAt: validated.direction === "inbound" ? emailTimestamp : null,
        sentAt: validated.direction === "outbound" ? emailTimestamp : null,
        isRead: validated.direction === "outbound",
      });

      // Create lightweight activity log entry
      const activitySummary = validated.direction === "inbound"
        ? `Email received from ${fromEmail}: ${validated.subject || "(No Subject)"}`
        : `Email sent to ${toEmail}: ${validated.subject || "(No Subject)"}`;

      if (validated.contactId) {
        await storage.createNote({
          title: validated.direction === "inbound" ? "Email Received" : "Email Sent",
          content: activitySummary,
          entityType: "contact",
          entityId: validated.contactId,
        });
      }

      // Also log to audit
      await storage.createAuditLogEntry({
        userId: null,
        action: `email_${validated.direction}`,
        entityType: "email",
        entityId: emailRecord.id,
        details: {
          source: "n8n_mirror",
          provider: validated.provider,
          from: validated.from,
          to: validated.to,
          subject: validated.subject,
          threadId: validated.threadId,
          messageId: validated.messageId,
          contactId: validated.contactId,
        },
      });

      const response = {
        id: emailRecord.id,
        emailId: emailRecord.id,
        direction: validated.direction,
        provider: validated.provider,
        from: fromEmail,
        to: toEmail,
        subject: validated.subject,
        contactId: validated.contactId,
        contactName: linkedContact?.name || null,
        timestamp: emailRecord.createdAt,
        activityLogged: !!validated.contactId,
      };
      
      logN8NResponse("/api/emails/mirror", 200, response);
      logger.info(`[Email Mirror] Saved ${validated.direction} email: ${validated.subject}`);
      res.json(response);
    } catch (error) {
      logN8NError("/api/emails/mirror", error);
      if (error instanceof z.ZodError) {
        const errorResponse = { error: "Invalid request data", details: error.errors };
        logN8NResponse("/api/emails/mirror", 400, errorResponse);
        return res.status(400).json(errorResponse);
      }
      const message = error instanceof Error ? error.message : "Failed to mirror email";
      const errorResponse = { error: message };
      logN8NResponse("/api/emails/mirror", 500, errorResponse);
      res.status(500).json(errorResponse);
    }
  });

  // ========== WHATSAPP MESSAGES ==========
  app.get("/api/whatsapp", async (req, res) => {
    try {
      const filters = {
        contactId: req.query.contactId as string | undefined,
        direction: req.query.direction as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      const messages = await storage.getWhatsappMessages(filters);
      res.json(messages);
    } catch (error) {
      logger.error("Failed to get WhatsApp messages:", error);
      res.status(500).json({ error: "Failed to get WhatsApp messages" });
    }
  });

  app.get("/api/whatsapp/:id", async (req, res) => {
    try {
      const message = await storage.getWhatsappMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "WhatsApp message not found" });
      }
      res.json(message);
    } catch (error) {
      logger.error("Failed to get WhatsApp message:", error);
      res.status(500).json({ error: "Failed to get WhatsApp message" });
    }
  });

  app.post("/api/whatsapp", async (req, res) => {
    try {
      const validated = insertWhatsappMessageSchema.parse(req.body);
      const message = await storage.createWhatsappMessage(validated);
      
      // Determine channel based on country code
      const { getPreferredChannel } = await import("@shared/utils/channel-decision");
      
      // Get contact's country code if available
      let countryCode: string | null = null;
      if (message.contactId) {
        const contact = await storage.getContact(message.contactId);
        countryCode = contact?.countryCode || null;
      }
      
      const channel = getPreferredChannel(message.toPhone, countryCode);
      
      // MIGRATION: Use unified agent dispatcher instead of N8N webhook
      const correlationId = crypto.randomUUID();
      try {
        const { dispatchWhatsApp } = await import("./agent-dispatcher");
        await dispatchWhatsApp({
          correlationId,
          contactId: message.contactId || "unknown",
          conversationId: message.conversationId || "unknown",
          message: message.body || null,
          templateId: null,
          channel,
          approvedBy: "human_operator",
          approvedAt: new Date().toISOString(),
        });
        
        // Write WHATSAPP_DISPATCHED to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "system",
          actionType: "WHATSAPP_DISPATCHED",
          entityType: "whatsapp_message",
          entityId: message.id,
          mode: "executed",
          status: "dispatched",
          diffJson: {
            messageId: message.id,
            to: message.toPhone,
            channel,
            dispatchedAt: new Date().toISOString(),
          },
          correlationId,
          executionTraceId: message.id,
          idempotencyKey: `whatsapp-${message.id}-${Date.now()}`,
        });
      } catch (dispatchError) {
        logger.error("Failed to dispatch WhatsApp message:", dispatchError);
        // Write failure to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "system",
          actionType: "WHATSAPP_DISPATCH_FAILED",
          entityType: "whatsapp_message",
          entityId: message.id,
          mode: "executed",
          status: "failed",
          diffJson: {
            messageId: message.id,
            error: dispatchError instanceof Error ? dispatchError.message : "Unknown error",
          },
          correlationId,
          executionTraceId: message.id,
        });
      }
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "send_whatsapp",
        entityType: "whatsapp_message",
        entityId: message.id,
        details: { to: message.toPhone },
      });
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create WhatsApp message:", error);
      res.status(500).json({ error: "Failed to create WhatsApp message" });
    }
  });

  app.patch("/api/whatsapp/:id", async (req, res) => {
    try {
      const validated = insertWhatsappMessageSchema.partial().parse(req.body);
      const message = await storage.updateWhatsappMessage(req.params.id, validated);
      if (!message) {
        return res.status(404).json({ error: "WhatsApp message not found" });
      }
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update WhatsApp message:", error);
      res.status(500).json({ error: "Failed to update WhatsApp message" });
    }
  });

  app.delete("/api/whatsapp/:id", async (req, res) => {
    try {
      const success = await storage.deleteWhatsappMessage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "WhatsApp message not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete WhatsApp message:", error);
      res.status(500).json({ error: "Failed to delete WhatsApp message" });
    }
  });

  // WhatsApp Dispatch Authorization (Phase 1: UI + Wiring only)
  // CRM NEVER sends directly - all dispatch goes to Neo8 after human approval
  app.post("/api/whatsapp/dispatch", async (req, res) => {
    try {
      const { clientId, conversationId, message, channel, templateId } = req.body;
      
      // Validate Client ID is present (NON-NEGOTIABLE)
      if (!clientId) {
        return res.status(400).json({ 
          error: "Client ID is mandatory", 
          detail: "No Client ID = No dispatch. This is non-negotiable." 
        });
      }
      
      // Validate Conversation ID
      if (!conversationId) {
        return res.status(400).json({ 
          error: "Conversation ID is required", 
          detail: "All messages must be tied to a conversation lifecycle." 
        });
      }
      
      // Validate message content
      if (!message && !templateId) {
        return res.status(400).json({ 
          error: "Message or template required", 
          detail: "Either a message body or templateId must be provided." 
        });
      }

      // Generate correlation ID for tracing
      const correlationId = crypto.randomUUID();

      // Write WHATSAPP_DISPATCH_AUTHORIZED to ledger
      await storage.createAutomationLedgerEntry({
        agentName: "Human Operator",
        actionType: "WHATSAPP_DISPATCH_AUTHORIZED",
        entityType: "whatsapp",
        entityId: conversationId,
        mode: "manual",
        status: "authorized",
        diffJson: {
          client_id: clientId,
          conversation_id: conversationId,
          message,
          channel: channel || "whatsapp",
          template_id: templateId,
        },
        reason: `WhatsApp dispatch authorized for client ${clientId}`,
        correlationId,
        executionTraceId: conversationId,
        idempotencyKey: `whatsapp-auth-${conversationId}-${Date.now()}`,
      });

      logger.info("[WhatsApp Dispatch] Authorized:", { clientId, conversationId, correlationId });

      // MIGRATION: Use unified agent dispatcher instead of logging only
      const { dispatchWhatsApp } = await import('./agent-dispatcher');
      
      try {
        const dispatchResult = await dispatchWhatsApp({
          correlationId,
          contactId: clientId,
          conversationId,
          message: message || null,
          templateId: templateId || null,
          channel: channel || "whatsapp",
          approvedBy: "human_operator",
          approvedAt: new Date().toISOString(),
        });

        logger.info("[WhatsApp Dispatch] Dispatched via agent gateway:", dispatchResult);

        res.status(200).json({ 
          success: true, 
          message: "WhatsApp dispatch authorized and sent to agent gateway",
          correlationId: dispatchResult.correlationId,
        });
      } catch (dispatchError) {
        logger.error("[WhatsApp Dispatch] Agent dispatch failed:", dispatchError);
        
        // Write WHATSAPP_DISPATCH_FAILED to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "agent_dispatcher",
          actionType: "WHATSAPP_DISPATCH_FAILED",
          entityType: "whatsapp",
          entityId: conversationId,
          mode: "manual",
          status: "failed",
          diffJson: {
            error: dispatchError instanceof Error ? dispatchError.message : "Unknown error",
            failedAt: new Date().toISOString(),
          },
          reason: `WhatsApp dispatch failed: ${dispatchError instanceof Error ? dispatchError.message : "Unknown error"}`,
          correlationId,
          executionTraceId: conversationId,
        });
        
        return res.status(502).json({ 
          error: "WhatsApp dispatch failed", 
          details: dispatchError instanceof Error ? dispatchError.message : "Unknown error" 
        });
      }
    } catch (error) {
      logger.error("Failed to authorize WhatsApp dispatch:", error);
      res.status(500).json({ error: "Failed to authorize WhatsApp dispatch" });
    }
  });

  // Inbound WhatsApp webhook (receives messages from n8n/Twilio)
  app.post("/api/whatsapp/inbound", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      logN8NRequest("/api/whatsapp/inbound", "POST", req.body);
      
      const { from, to, body, messageSid, mediaUrl } = req.body;
      
      if (!from || !to || !body) {
        const error = { error: "from, to, and body are required" };
        logN8NResponse("/api/whatsapp/inbound", 400, error);
        return res.status(400).json(error);
      }
      
      // Try to find contact by phone
      const contact = await storage.getContactByPhone(from);
      
      const message = await storage.createWhatsappMessage({
        contactId: contact?.id || null,
        messageSid: messageSid || null,
        direction: "incoming",
        fromPhone: from,
        toPhone: to,
        body: body,
        mediaUrl: mediaUrl || null,
        status: "received",
      });
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "receive_whatsapp",
        entityType: "whatsapp_message",
        entityId: message.id,
        details: { from, contactId: contact?.id },
      });
      
      logN8NResponse("/api/whatsapp/inbound", 201, message);
      res.status(201).json(message);
    } catch (error) {
      logN8NError("/api/whatsapp/inbound", error);
      res.status(500).json({ error: "Failed to process inbound WhatsApp message" });
    }
  });

  // ========== INTAKES ==========
  app.get("/api/intakes", async (_req, res) => {
    try {
      const intakes = await storage.getIntakes();
      res.json(intakes);
    } catch (error) {
      logger.error("Failed to get intakes:", error);
      res.status(500).json({ error: "Failed to get intakes" });
    }
  });

  app.get("/api/intakes/:id", async (req, res) => {
    try {
      const intake = await storage.getIntake(req.params.id);
      if (!intake) {
        return res.status(404).json({ error: "Intake not found" });
      }
      res.json(intake);
    } catch (error) {
      logger.error("Failed to get intake:", error);
      res.status(500).json({ error: "Failed to get intake" });
    }
  });

  app.post("/api/intakes", async (req, res) => {
    try {
      const validated = insertIntakeSchema.parse(req.body);
      const intake = await storage.createIntake(validated);
      res.status(201).json(intake);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create intake:", error);
      res.status(500).json({ error: "Failed to create intake" });
    }
  });

  app.patch("/api/intakes/:id", async (req, res) => {
    try {
      const validated = insertIntakeSchema.partial().parse(req.body);
      const intake = await storage.updateIntake(req.params.id, validated);
      if (!intake) {
        return res.status(404).json({ error: "Intake not found" });
      }
      res.json(intake);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update intake:", error);
      res.status(500).json({ error: "Failed to update intake" });
    }
  });

  app.delete("/api/intakes/:id", async (req, res) => {
    try {
      const success = await storage.deleteIntake(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Intake not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete intake:", error);
      res.status(500).json({ error: "Failed to delete intake" });
    }
  });

  // ========== INTAKE FIELDS ==========
  app.get("/api/intakes/:intakeId/fields", async (req, res) => {
    try {
      const fields = await storage.getIntakeFields(req.params.intakeId);
      res.json(fields);
    } catch (error) {
      logger.error("Failed to get intake fields:", error);
      res.status(500).json({ error: "Failed to get intake fields" });
    }
  });

  app.post("/api/intakes/:intakeId/fields", async (req, res) => {
    try {
      const validated = insertIntakeFieldSchema.parse({
        ...req.body,
        intakeId: req.params.intakeId,
      });
      const field = await storage.createIntakeField(validated);
      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to create intake field:", error);
      res.status(500).json({ error: "Failed to create intake field" });
    }
  });

  app.patch("/api/intake-fields/:id", async (req, res) => {
    try {
      const validated = insertIntakeFieldSchema.partial().parse(req.body);
      const field = await storage.updateIntakeField(req.params.id, validated);
      if (!field) {
        return res.status(404).json({ error: "Intake field not found" });
      }
      res.json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      logger.error("Failed to update intake field:", error);
      res.status(500).json({ error: "Failed to update intake field" });
    }
  });

  app.delete("/api/intake-fields/:id", async (req, res) => {
    try {
      const success = await storage.deleteIntakeField(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Intake field not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete intake field:", error);
      res.status(500).json({ error: "Failed to delete intake field" });
    }
  });

  // ========== INTAKE SUBMISSIONS ==========
  app.get("/api/intake-submissions", async (req, res) => {
    try {
      const intakeId = req.query.intakeId as string | undefined;
      const submissions = await storage.getIntakeSubmissions(intakeId);
      res.json(submissions);
    } catch (error) {
      logger.error("Failed to get intake submissions:", error);
      res.status(500).json({ error: "Failed to get intake submissions" });
    }
  });

  app.get("/api/intake-submissions/:id", async (req, res) => {
    try {
      const submission = await storage.getIntakeSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Intake submission not found" });
      }
      res.json(submission);
    } catch (error) {
      logger.error("Failed to get intake submission:", error);
      res.status(500).json({ error: "Failed to get intake submission" });
    }
  });

  // Update intake submission status (verify/reject)
  app.patch("/api/intake-submissions/:id", requireAuth, async (req: any, res) => {
    try {
      const { status, reviewNote } = req.body;
      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }
      const allowed = ["pending", "verified", "rejected", "archived"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      }
      const updated = await storage.updateIntakeSubmission(req.params.id, {
        status,
        ...(reviewNote !== undefined ? { reviewNote } : {}),
      });
      if (!updated) {
        return res.status(404).json({ error: "Intake submission not found" });
      }
      res.json(updated);
    } catch (error) {
      logger.error("Failed to update intake submission:", error);
      res.status(500).json({ error: "Failed to update intake submission" });
    }
  });

  // Public webhook endpoint for intake submissions
  app.post("/api/webhook/intake/:token", intakeWebhookRateLimiter, async (req, res) => {
    try {
      // Find intake by webhook token
      const intake = await storage.getIntakeByWebhookToken(req.params.token);
      if (!intake) {
        return res.status(404).json({ error: "Invalid intake webhook token" });
      }
      if (!intake.active) {
        return res.status(403).json({ error: "Intake is disabled" });
      }

      // Create submission
      const submission = await storage.createIntakeSubmission({
        intakeId: intake.id,
        payload: req.body,
        status: 'pending',
      });

      // TODO: Process submission (create contact/job based on intake settings)
      // For now, just return the submission
      res.status(201).json({ 
        success: true, 
        submissionId: submission.id,
        message: "Submission received and queued for processing"
      });
    } catch (error) {
      logger.error("Failed to process intake webhook:", error);
      res.status(500).json({ error: "Failed to process intake submission" });
    }
  });

  // ========== LEAD INTAKE API (Neo8Flow Integration) ==========
  // Public endpoint for lead intake with idempotency support
  app.post("/api/intake/lead", intakeWebhookRateLimiter, async (req, res) => {
    try {
      // 1. Validate request body against canonical schema
      const validationResult = leadIntakeEventSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        });
      }
      const validated = validationResult.data;

      // 2. Validate at least ONE identifier is present
      const hasEmail = validated.payload.email && validated.payload.email.length > 0;
      const hasPhone = validated.payload.phone && validated.payload.phone.length > 0;
      const hasContactId = validated.payload.contact_id && validated.payload.contact_id.length > 0;
      const hasRecordingUrl = validated.recording_url && validated.recording_url.length > 0;
      
      if (!hasEmail && !hasPhone && !hasContactId && !hasRecordingUrl) {
        return res.status(400).json({
          error: "At least one identifier required",
          message: "Must provide email, phone, contact_id, or recording_url",
        });
      }

      // 3. Check idempotency - return existing if already processed
      const existing = await storage.getEventsOutboxByIdempotencyKey(
        validated.tenant_id,
        validated.idempotency_key
      );
      if (existing) {
        return res.status(200).json({
          status: 'duplicate',
          outbox_id: existing.id,
          message: 'Existing lead',
        });
      }

      // 4. Generate server timestamp if not provided in request
      const timestamp = new Date().toISOString();

      // 5. Add source IP from request if not provided
      const sourceIp = validated.source_ip || 
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
        req.socket.remoteAddress || 
        'unknown';

      // 6. Add correlation ID for tracing across systems
      const correlationId = crypto.randomUUID();

      // 7. Insert into events_outbox (map snake_case API fields to camelCase storage)
      const eventEntry = await storage.createEventsOutbox({
        tenantId: validated.tenant_id,
        idempotencyKey: validated.idempotency_key,
        schemaVersion: validated.schema_version,
        eventType: validated.event_type,
        channel: validated.channel,
        sourceId: validated.source_id || null,
        sourceIp,
        recordingUrl: validated.recording_url || null,
        leadScore: validated.lead_score || null,
        payload: { ...validated.payload, timestamp, correlationId },
        status: 'pending',
      });

      // GOVERNANCE FIX: Removed automatic dispatch to Neo8Flow
      // External dispatch only happens after: instruction → approval → dispatch
      // The event is stored in events_outbox and will be processed through approval workflow
      // dispatchIntakeToNeo8Flow call removed - violates governance rules

      // 8. Log to audit log
      await storage.createAuditLogEntry({
        action: 'lead.intake.received',
        entityType: 'events_outbox',
        entityId: eventEntry.id,
        details: {
          tenant_id: validated.tenant_id,
          channel: validated.channel,
          event_type: validated.event_type,
          idempotency_key: validated.idempotency_key,
          recording_url: validated.recording_url,
          lead_score: validated.lead_score,
          correlationId,
        },
      });
      
      // 9. CRITICAL: Write INTAKE_RECEIVED to automation ledger for governance traceability
      await storage.createAutomationLedgerEntry({
        agentName: "System",
        actionType: "INTAKE_RECEIVED",
        entityType: "events_outbox",
        entityId: eventEntry.id,
        mode: "intake",
        status: "received",
        diffJson: {
          source: validated.channel,
          tenantId: validated.tenant_id,
          eventType: validated.event_type,
          payload: validated.payload,
        },
        reason: null,
        correlationId,
        executionTraceId: eventEntry.id,
        idempotencyKey: `intake-${validated.idempotency_key}`,
      });

      // 6. Return success response
      res.status(201).json({
        success: true,
        eventId: eventEntry.id,
        status: eventEntry.status,
        message: "Lead intake event received and queued for processing",
        createdAt: eventEntry.createdAt,
      });
    } catch (error) {
      logger.error("Failed to process lead intake:", error);
      res.status(500).json({ error: "Failed to process lead intake" });
    }
  });

  // CRM Sync Callback - N8N / agent callback after processing a lead intake event
  app.post("/api/intake/sync", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const validationResult = crmSyncSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        });
      }

      const { outbox_id, tenant_id, status, payload, recording_url, lead_score, channel, error_message } = validationResult.data;
      const syncedFields: Record<string, any> = {};

      // Find the outbox entry by ID
      const allOutbox = await storage.getEventsOutbox();
      const outboxEntry = allOutbox.find(e => e.id === outbox_id);

      if (!outboxEntry) {
        return res.status(404).json({ error: "Outbox entry not found" });
      }

      // ERROR path — N8N reports failure
      if (status === "error") {
        await storage.updateEventsOutboxStatus(outbox_id, "failed", error_message);
        await storage.createAuditLogEntry({
          action: "lead.sync.failed",
          entityType: "events_outbox",
          entityId: outbox_id,
          details: { error_message, tenant_id },
        });
        return res.status(200).json({ success: false, error: error_message || "Sync failed" });
      }

      // SUCCESS path — resolve contact
      const p = payload as Record<string, any>;
      const { contact_id, email, phone, name, company, tags, message } = p;

      let contact: any = null;

      // 1. Try contact_id first
      if (contact_id) {
        contact = await storage.getContact(contact_id);
      }

      // 2. Fall back to email lookup
      if (!contact && email) {
        contact = await storage.getContactByEmail(email);
      }

      if (contact) {
        // Merge tags with deduplication
        const mergedTags = tags
          ? Array.from(new Set([...((contact.tags as string[]) || []), ...tags]))
          : contact.tags;

        await storage.updateContact(contact.id, {
          name: name || contact.name,
          email: email || contact.email,
          phone: phone || contact.phone,
          company: company || contact.company,
          tags: mergedTags,
        });
        // Re-fetch to get updated version
        contact = await storage.getContact(contact.id) || contact;
      } else {
        // Create new contact
        contact = await storage.createContact({
          name: name || null,
          email: email || null,
          phone: phone || null,
          company: company || null,
          customerType: "lead",
          status: "new",
          tags: tags || [],
        });
      }

      syncedFields.contact_id = contact.id;

      // 3. Create conversation if message was provided
      let conversation: any = null;
      if (message || channel) {
        conversation = await storage.createConversation({
          contactId: contact.id,
          status: "active",
          channel: channel || outboxEntry.channel || "widget",
          leadScore: lead_score || null,
          metadata: { syncSource: "intake_sync", tenant_id },
        });
        syncedFields.conversation_id = conversation.id;
      }

      // 4. Apply lead_score
      if (lead_score != null) {
        syncedFields.lead_score = lead_score;
        if (conversation) {
          await storage.updateConversation(conversation.id, { leadScore: lead_score });
        }
      }

      // 5. Attach recording if provided
      if (recording_url) {
        const fileRecord = await storage.createFile({
          name: `recording-${outbox_id}.mp3`,
          url: recording_url,
          type: "recording",
          size: 0,
          entityType: "contact",
          entityId: contact.id,
        });
        syncedFields.file_id = fileRecord.id;
      }

      // 6. Mark outbox as synced
      await storage.updateEventsOutboxStatus(outbox_id, "synced");

      // 7. Audit log
      await storage.createAuditLogEntry({
        action: "lead.sync.completed",
        entityType: "events_outbox",
        entityId: outbox_id,
        details: { contact_id: contact.id, tenant_id, ...syncedFields },
      });

      return res.status(200).json({ success: true, synced: syncedFields });
    } catch (error) {
      logger.error("CRM Sync processing failed", error);
      res.status(500).json({ error: "Internal processing error" });
    }
  });

  // Reconciliation Audit: Sync Verification
  app.get("/api/audit/sync", requireInternalToken, async (req, res) => {
    try {
      const { correlationId, idempotencyKey, limit } = req.query;
      
      const entries = await storage.getAutomationLedgerEntries({
        correlationId: correlationId as string,
        actionType: idempotencyKey ? undefined : "SYNC_CALLBACK_RECEIVED", // Broad search if no specific key
        limit: limit ? parseInt(limit as string) : 50
      });

      // If idempotencyKey is provided, we filter more specifically
      let result = entries;
      if (idempotencyKey) {
        result = entries.filter(e => e.idempotencyKey === idempotencyKey);
      }

      res.json({
        total: result.length,
        entries: result
      });
    } catch (error) {
      logger.error("Audit sync query failed", error);
      res.status(500).json({ error: "Failed to query sync audit" });
    }
  });

  // Reconciliation Audit: Error Tracking
  app.get("/api/audit/errors", requireInternalToken, async (req, res) => {
    try {
      const { limit, agentName } = req.query;
      
      const entries = await storage.getAutomationLedgerEntries({
        status: "failed",
        agentName: agentName as string,
        limit: limit ? parseInt(limit as string) : 50
      });

      res.json({
        total: entries.length,
        entries
      });
    } catch (error) {
      logger.error("Audit error query failed", error);
      res.status(500).json({ error: "Failed to query error audit" });
    }
  });

  // Reconciliation Audit: State Audit (Contact History)
  app.get("/api/contacts/audit/:id", requireInternalToken, async (req, res) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const history = await storage.getAutomationLedgerEntries({
        entityId: contactId,
        entityType: "contact",
        limit: 100
      });

      res.json({
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          status: contact.customerType,
          createdAt: contact.createdAt
        },
        audit_history: history
      });
    } catch (error) {
      logger.error("Contact state audit failed", error);
      res.status(500).json({ error: "Failed to perform state audit" });
    }
  });

  // ========== LOCATIONS ==========
  app.get("/api/locations", async (req, res) => {
    try {
      const contactId = req.query.contactId as string | undefined;
      const locations = await storage.getLocations(contactId);
      res.json(locations);
    } catch (error) {
      logger.error("Failed to get locations:", error);
      res.status(500).json({ error: "Failed to get locations" });
    }
  });

  app.get("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      logger.error("Failed to get location:", error);
      res.status(500).json({ error: "Failed to get location" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const location = await storage.createLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      logger.error("Failed to create location:", error);
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  app.patch("/api/locations/:id", async (req, res) => {
    try {
      const location = await storage.updateLocation(req.params.id, req.body);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      logger.error("Failed to update location:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", async (req, res) => {
    try {
      const success = await storage.deleteLocation(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete location:", error);
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // ========== EQUIPMENT ==========
  app.get("/api/equipment", async (req, res) => {
    try {
      const locationId = req.query.locationId as string | undefined;
      const equipment = await storage.getEquipment(locationId);
      res.json(equipment);
    } catch (error) {
      logger.error("Failed to get equipment:", error);
      res.status(500).json({ error: "Failed to get equipment" });
    }
  });

  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const equip = await storage.getEquipmentItem(req.params.id);
      if (!equip) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json(equip);
    } catch (error) {
      logger.error("Failed to get equipment:", error);
      res.status(500).json({ error: "Failed to get equipment" });
    }
  });

  app.post("/api/equipment", async (req, res) => {
    try {
      const equip = await storage.createEquipment(req.body);
      res.status(201).json(equip);
    } catch (error) {
      logger.error("Failed to create equipment:", error);
      res.status(500).json({ error: "Failed to create equipment" });
    }
  });

  app.patch("/api/equipment/:id", async (req, res) => {
    try {
      const equip = await storage.updateEquipment(req.params.id, req.body);
      if (!equip) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json(equip);
    } catch (error) {
      logger.error("Failed to update equipment:", error);
      res.status(500).json({ error: "Failed to update equipment" });
    }
  });

  app.delete("/api/equipment/:id", async (req, res) => {
    try {
      const success = await storage.deleteEquipment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete equipment:", error);
      res.status(500).json({ error: "Failed to delete equipment" });
    }
  });

  // ========== PRICEBOOK ==========
  app.get("/api/pricebook", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string | undefined,
        tier: req.query.tier as string | undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };
      const items = await storage.getPricebookItems(filters);
      res.json(items);
    } catch (error) {
      logger.error("Failed to get pricebook items:", error);
      res.status(500).json({ error: "Failed to get pricebook items" });
    }
  });

  app.get("/api/pricebook/:id", async (req, res) => {
    try {
      const item = await storage.getPricebookItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Pricebook item not found" });
      }
      res.json(item);
    } catch (error) {
      logger.error("Failed to get pricebook item:", error);
      res.status(500).json({ error: "Failed to get pricebook item" });
    }
  });

  app.post("/api/pricebook", async (req, res) => {
    try {
      const item = await storage.createPricebookItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      logger.error("Failed to create pricebook item:", error);
      res.status(500).json({ error: "Failed to create pricebook item" });
    }
  });

  app.patch("/api/pricebook/:id", async (req, res) => {
    try {
      const item = await storage.updatePricebookItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Pricebook item not found" });
      }
      res.json(item);
    } catch (error) {
      logger.error("Failed to update pricebook item:", error);
      res.status(500).json({ error: "Failed to update pricebook item" });
    }
  });

  app.delete("/api/pricebook/:id", async (req, res) => {
    try {
      const success = await storage.deletePricebookItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Pricebook item not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete pricebook item:", error);
      res.status(500).json({ error: "Failed to delete pricebook item" });
    }
  });

  // ========== TAGS ==========
  app.get("/api/tags", async (_req, res) => {
    try {
      const tagsList = await storage.getTags();
      res.json(tagsList);
    } catch (error) {
      logger.error("Failed to get tags:", error);
      res.status(500).json({ error: "Failed to get tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const tag = await storage.createTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      logger.error("Failed to create tag:", error);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const success = await storage.deleteTag(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete tag:", error);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // ========== STORED PAYMENT METHODS ==========
  app.get("/api/contacts/:contactId/payment-methods", async (req, res) => {
    try {
      const methods = await storage.getStoredPaymentMethods(req.params.contactId);
      res.json(methods);
    } catch (error) {
      logger.error("Failed to get payment methods:", error);
      res.status(500).json({ error: "Failed to get payment methods" });
    }
  });

  app.post("/api/contacts/:contactId/payment-methods", async (req, res) => {
    try {
      const method = await storage.createStoredPaymentMethod({
        ...req.body,
        contactId: req.params.contactId,
      });
      res.status(201).json(method);
    } catch (error) {
      logger.error("Failed to create payment method:", error);
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  app.delete("/api/payment-methods/:id", async (req, res) => {
    try {
      const success = await storage.deleteStoredPaymentMethod(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.status(204).send();
    } catch (error) {
      logger.error("Failed to delete payment method:", error);
      res.status(500).json({ error: "Failed to delete payment method" });
    }
  });

  // ========== DUPLICATE DETECTION ==========
  app.get("/api/contacts/duplicates/search", async (req, res) => {
    try {
      const { name, email, phone } = req.query as { name?: string; email?: string; phone?: string };
      const duplicates = await storage.findDuplicateContacts(name, email, phone);
      res.json(duplicates);
    } catch (error) {
      logger.error("Failed to search for duplicates:", error);
      res.status(500).json({ error: "Failed to search for duplicates" });
    }
  });

  // ========== STRIPE INTEGRATION ==========
  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      logger.error("Failed to get Stripe publishable key:", error);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  app.post("/api/stripe/create-payment-intent", async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const { amount, contactId, invoiceId } = req.body;
      
      // Validate amount is a positive number
      const requestedAmount = parseFloat(amount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      // Server-side validation: cap amount at invoice outstanding balance
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) {
          return res.status(404).json({ error: "Invoice not found" });
        }
        
        // Calculate amount already paid
        const payments = await storage.getPayments();
        const invoicePayments = payments.filter(p => p.invoiceId === invoiceId);
        const paidAmount = invoicePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const outstandingBalance = Number(invoice.totalAmount) - paidAmount;
        
        if (requestedAmount > outstandingBalance + 0.01) { // Allow 1 cent tolerance for rounding
          return res.status(400).json({ 
            error: "Payment amount exceeds invoice balance",
            maxAmount: outstandingBalance,
          });
        }
      }

      // Get contact's Stripe customer ID or create one
      let customerId: string | undefined;
      if (contactId) {
        const contact = await storage.getContact(contactId);
        if (contact?.stripeCustomerId) {
          customerId = contact.stripeCustomerId;
        } else if (contact) {
          // Create Stripe customer
          const customer = await stripe.customers.create({
            email: contact.email || undefined,
            name: contact.name || undefined,
            phone: contact.phone || undefined,
            metadata: { contactId },
          });
          await storage.updateContact(contactId, { stripeCustomerId: customer.id });
          customerId = customer.id;
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(requestedAmount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId,
        metadata: { invoiceId: invoiceId || '', contactId: contactId || '' },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      logger.error("Failed to create payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  app.post("/api/stripe/setup-intent", async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const { contactId } = req.body;
      
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      let customerId = contact.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: contact.email || undefined,
          name: contact.name || undefined,
          phone: contact.phone || undefined,
          metadata: { contactId },
        });
        await storage.updateContact(contactId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error) {
      logger.error("Failed to create setup intent:", error);
      res.status(500).json({ error: "Failed to create setup intent" });
    }
  });

  // ========== AI VOICE DISPATCH ==========
  
  app.get("/api/voice/dispatch-logs", async (_req, res) => {
    try {
      const logs = await storage.getVoiceDispatchLogs();
      res.json(logs);
    } catch (error) {
      logger.error("Failed to get voice dispatch logs:", error);
      res.status(500).json({ error: "Failed to get dispatch logs" });
    }
  });

  app.post("/api/voice/dispatch", async (req, res) => {
    try {
      const { contactId, contactName, intent, contextNotes, engine } = req.body;

      if (!contactName || !intent || !engine) {
        return res.status(400).json({ error: "Missing required fields: contactName, intent, engine" });
      }

      // Step 1: Write HUMAN_DISPATCH_INITIATED ledger event
      const initLedgerEntry = await storage.createAutomationLedgerEntry({
        agentName: "human_operator",
        actionType: "human_dispatch_initiated",
        entityType: "voice_dispatch",
        entityId: null,
        mode: "execute",
        status: "pending",
        diffJson: { contactId, contactName, intent, contextNotes, engine },
        reason: "Human operator initiated voice dispatch",
      });

      // Step 2: Write HUMAN_AUTHORIZATION_CONFIRMED ledger event
      await storage.createAutomationLedgerEntry({
        agentName: "human_operator",
        actionType: "human_authorization_confirmed",
        entityType: "voice_dispatch",
        entityId: initLedgerEntry.id,
        mode: "execute",
        status: "completed",
        diffJson: { authorizedAt: new Date().toISOString() },
        reason: "Human operator confirmed authorization for voice dispatch",
      });

      // Step 3: Create voice dispatch log entry
      const dispatchLog = await storage.createVoiceDispatchLog({
        contactId: contactId || null,
        contactName,
        intent,
        contextNotes: contextNotes || null,
        engine,
        status: "in_progress",
        originType: "human",
        summary: "Handshake successful. AI Voice Server spinning up instance...",
        ledgerId: initLedgerEntry.id,
        dispatchedAt: new Date(),
      });

      // Step 4: Write DISPATCH_SENT ledger event
      await storage.createAutomationLedgerEntry({
        agentName: "human_operator",
        actionType: "dispatch_sent",
        entityType: "voice_dispatch",
        entityId: dispatchLog.id,
        mode: "execute",
        status: "completed",
        diffJson: { dispatchLogId: dispatchLog.id, sentAt: new Date().toISOString() },
        reason: "Voice dispatch sent to AI Voice Server",
      });

      // Log audit entry
      await storage.createAuditLogEntry({
        action: "voice_dispatch_initiated",
        entityType: "voice_dispatch",
        entityId: dispatchLog.id,
        details: { contactId, contactName, intent, engine, ledgerId: initLedgerEntry.id },
      });

      res.json({ 
        success: true, 
        dispatchId: dispatchLog.id,
        ledgerId: initLedgerEntry.id,
        message: "Voice dispatch sent successfully" 
      });
    } catch (error) {
      logger.error("Failed to dispatch voice call:", error);
      res.status(500).json({ error: "Failed to dispatch voice call" });
    }
  });

  // Callback endpoint for AI Voice Server results (via Neo8)
  // GOVERNANCE: All inbound agent data must be validated before updating CRM
  app.post("/api/voice/dispatch/:id/result", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // 1. VALIDATE inbound data structure
      const inboundResultSchema = z.object({
        status: z.enum(["success", "failed", "error", "completed", "transferred", "voicemail"]).optional(),
        summary: z.string().max(2000).optional(),
        transcriptUrl: z.string().url().optional().or(z.literal("")),
      });
      
      const validated = inboundResultSchema.parse(req.body);

      // 2. Verify dispatch log exists
      const log = await storage.getVoiceDispatchLog(id);
      if (!log) {
        return res.status(404).json({ error: "Dispatch log not found" });
      }

      // 3. DECISION: Validate this is a legitimate result (not malicious)
      if (validated.status === "failed" || validated.status === "error") {
        // Log failure for review
        await storage.createAuditLogEntry({
          userId: null,
          action: "voice_dispatch_result_failed",
          entityType: "voice_dispatch",
          entityId: id,
          details: { 
            status: validated.status,
            summary: validated.summary,
            source: "external_agent",
            requiresReview: true,
          },
        });
      }

      // 4. UPDATE with validated data only
      await storage.updateVoiceDispatchLog(id, {
        status: validated.status || "success",
        summary: validated.summary || log.summary,
        transcriptUrl: validated.transcriptUrl || null,
        completedAt: new Date(),
      });

      // 5. AUDIT LOG all inbound updates
      await storage.createAutomationLedgerEntry({
        agentName: "ai_voice_server",
        actionType: "execution_result_recorded",
        entityType: "voice_dispatch",
        entityId: id,
        mode: "execute",
        status: "completed",
        diffJson: { 
          status: validated.status, 
          summary: validated.summary, 
          transcriptUrl: validated.transcriptUrl,
          completedAt: new Date().toISOString(),
          validated: true,
        },
        reason: "AI Voice Server returned execution result - validated and recorded",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to record dispatch result:", error);
      res.status(500).json({ error: "Failed to record dispatch result" });
    }
  });

  // ========================================
  // CAMPAIGN ROUTES - Bulk Email System
  // ========================================

  // Create and send campaign
  app.post("/api/campaigns", requireAuth, async (req: any, res) => {
    try {
      const validated = insertCampaignSchema.parse(req.body);
      const campaign = await campaignService.createCampaign({
        name: validated.name,
        subject: validated.subject,
        body: validated.body,
        filters: (validated.filters || {}) as any,
        createdBy: req.user?.id,
      });
      res.status(201).json(campaign);
    } catch (error: any) {
      logger.error("Failed to create campaign:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // List all campaigns
  app.get("/api/campaigns", requireAuth, async (req: any, res) => {
    try {
      const campaigns = await campaignService.listCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get campaign details with stats
  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    try {
      const campaign = await campaignService.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  // Email templates CRUD
  app.post("/api/email-templates", requireAuth, async (req: any, res) => {
    try {
      const validated = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.createEmailTemplate({
        ...validated,
        createdBy: req.user?.id,
      });
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/email-templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // ========================================
  // EMAIL WEBHOOK - Resend Event Tracking
  // ========================================

  // Webhook endpoint for email events (no auth required - verified by signature)
  app.post("/webhooks/email-events", express.json(), async (req, res) => {
    try {
      const event = req.body;
      await emailWebhookHandler.handleEvent(event);
      res.json({ success: true });
    } catch (error: any) {
      logger.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // CAMPAIGN ANALYTICS
  // ========================================

  // Get campaign analytics
  app.get("/api/campaigns/:id/analytics", requireAuth, async (req, res) => {
    try {
      const analytics = await campaignAnalyticsService.getCampaignAnalytics(req.params.id);
      if (!analytics) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get all campaigns summary
  app.get("/api/campaigns/analytics/summary", requireAuth, async (req, res) => {
    try {
      const summary = await campaignAnalyticsService.getAllCampaignsAnalytics();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // Get recipient details for campaign
  app.get("/api/campaigns/:id/recipients", requireAuth, async (req, res) => {
    try {
      const recipients = await campaignAnalyticsService.getRecipientDetails(req.params.id);
      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch recipients" });
    }
  });

  // ========================================
  // PROSPECT POOL ROUTES
  // Agent-facing endpoints use requireInternalToken.
  // CRM-user-facing endpoints use requireAuth.
  // ========================================

  // Agent dedup check — call BEFORE reaching out to anyone
  // GET /api/prospects/check?phone=xxx&email=yyy
  app.get("/api/prospects/check", async (req: any, res) => {
    // Allow both internal token (agent) and session auth (CRM user)
    const token = (req.headers["x-internal-token"] || req.headers["authorization"]?.replace("Bearer ", "")) as string;
    const sessionUserId = req.session?.userId;
    if (!sessionUserId && !verifyInternalToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { phone, email } = req.query as { phone?: string; email?: string };
      if (!phone && !email) {
        return res.status(400).json({ error: "phone or email required" });
      }

      let prospectMatch: any = null;
      let contactMatch: any = null;

      if (phone) {
        prospectMatch = await storage.findProspectByPhone(phone as string);
        contactMatch = await storage.getContactByPhone(phone as string);
      }
      if (email && !prospectMatch) {
        prospectMatch = await storage.findProspectByEmail(email as string);
      }
      if (email && !contactMatch) {
        contactMatch = await storage.getContactByEmail(email as string);
      }

      res.json({
        known: !!(prospectMatch || contactMatch),
        inProspectPool: !!prospectMatch,
        inCRM: !!contactMatch,
        prospect: prospectMatch || null,
        contact: contactMatch ? { id: contactMatch.id, name: contactMatch.name } : null,
      });
    } catch (error) {
      logger.error("Prospect check failed:", error);
      res.status(500).json({ error: "Check failed" });
    }
  });

  // Agent adds a new prospect to the pool
  // POST /api/prospects (internal token)
  app.post("/api/prospects", async (req: any, res) => {
    const token = (req.headers["x-internal-token"] || req.headers["authorization"]?.replace("Bearer ", "")) as string;
    const sessionUserId = req.session?.userId;
    if (!sessionUserId && !verifyInternalToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { phone, email, name, company, source, agentId, metadata, notes } = req.body;
      if (!phone && !email) {
        return res.status(400).json({ error: "At least phone or email required" });
      }

      // Dedup check
      if (phone) {
        const existing = await storage.findProspectByPhone(phone);
        if (existing) {
          return res.status(200).json({ created: false, prospect: existing, reason: "already_in_pool" });
        }
      }
      if (email) {
        const existing = await storage.findProspectByEmail(email);
        if (existing) {
          return res.status(200).json({ created: false, prospect: existing, reason: "already_in_pool" });
        }
      }

      const prospect = await storage.createProspect({
        phone: phone || null,
        email: email || null,
        name: name || null,
        company: company || null,
        source: source || "agent",
        agentId: agentId || null,
        metadata: metadata || null,
        notes: notes || null,
        status: "new",
      });

      res.status(201).json({ created: true, prospect });
    } catch (error) {
      logger.error("Failed to create prospect:", error);
      res.status(500).json({ error: "Failed to create prospect" });
    }
  });

  // CRM user: list prospects
  app.get("/api/prospects", requireAuth, async (req: any, res) => {
    try {
      const { status, agentId, source, limit, offset } = req.query;
      const prospects = await storage.getProspects({
        status: status as string | undefined,
        agentId: agentId as string | undefined,
        source: source as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });
      const total = await storage.countProspects(status ? { status: status as string } : undefined);
      res.json({ data: prospects, total });
    } catch (error) {
      logger.error("Failed to get prospects:", error);
      res.status(500).json({ error: "Failed to get prospects" });
    }
  });

  // Update prospect status (outreached, responded, do_not_outreach)
  app.patch("/api/prospects/:id", async (req: any, res) => {
    const token = (req.headers["x-internal-token"] || req.headers["authorization"]?.replace("Bearer ", "")) as string;
    const sessionUserId = req.session?.userId;
    if (!sessionUserId && !verifyInternalToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { status, notes } = req.body;
      const allowed = ["new", "outreached", "responded", "converted", "do_not_outreach"];
      if (status && !allowed.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      }

      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (status === "outreached") updates.outreachedAt = new Date();
      if (status === "responded") updates.respondedAt = new Date();

      const updated = await storage.updateProspect(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: "Prospect not found" });
      res.json(updated);
    } catch (error) {
      logger.error("Failed to update prospect:", error);
      res.status(500).json({ error: "Failed to update prospect" });
    }
  });

  // Convert prospect → CRM contact
  app.post("/api/prospects/:id/convert", requireAuth, async (req: any, res) => {
    try {
      const prospect = await storage.getProspect(req.params.id);
      if (!prospect) return res.status(404).json({ error: "Prospect not found" });
      if (prospect.status === "converted") {
        return res.status(400).json({ error: "Already converted", contactId: prospect.convertedContactId });
      }

      const contact = await storage.createContact({
        name: prospect.name || "Unknown",
        phone: prospect.phone || null,
        email: prospect.email || null,
        company: prospect.company || null,
        source: prospect.source || "prospect_pool",
        tags: ["prospect"],
        customerType: "lead",
      } as any);

      await storage.updateProspect(prospect.id, {
        status: "converted",
        convertedContactId: contact.id,
        convertedAt: new Date(),
      });

      res.json({ contact, prospectId: prospect.id });
    } catch (error) {
      logger.error("Failed to convert prospect:", error);
      res.status(500).json({ error: "Failed to convert prospect" });
    }
  });

  // Mark as do_not_outreach (person said they're already a customer / opt out)
  app.post("/api/prospects/:id/do-not-outreach", async (req: any, res) => {
    const token = (req.headers["x-internal-token"] || req.headers["authorization"]?.replace("Bearer ", "")) as string;
    const sessionUserId = req.session?.userId;
    if (!sessionUserId && !verifyInternalToken(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { reason } = req.body;
      const updated = await storage.updateProspect(req.params.id, {
        status: "do_not_outreach",
        notes: reason || "Opted out of automated outreach",
        respondedAt: new Date(),
      });
      if (!updated) return res.status(404).json({ error: "Prospect not found" });
      res.json(updated);
    } catch (error) {
      logger.error("Failed to mark do_not_outreach:", error);
      res.status(500).json({ error: "Failed to update prospect" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
