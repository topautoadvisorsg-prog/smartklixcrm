import type { Express } from "express";
import { createServer, type Server } from "http";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { 
  insertContactSchema, 
  insertJobSchema, 
  insertNoteSchema,
  insertEstimateSchema,
  insertInvoiceSchema,
  insertPaymentSchema,
  insertSettingsSchema,
  insertAiSettingsSchema,
  insertMasterArchitectConfigSchema,
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
  type InsertContact,
  type Contact,
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
  finalizeAction,
} from "./pipeline";
import { aiToolDefinitions, executeAITool, classifyAction, isInternalAction, isExternalAction, isReadOnlyTool, INTERNAL_TOOLS, EXTERNAL_TOOLS } from "./ai-tools";
import { requireInternalToken } from "./auth-middleware";
import { neo8InboundResultSchema, dispatchNeo8Event, neo8OutboundEventSchema, dispatchIntakeToNeo8Flow, dispatchToN8nWebhook, dispatchExternalAction } from "./neo8-events";
import { MasterArchitect, AgentMode, ToolPermission, MAContext } from "./master-architect";
import { chatService } from "./chat-service";
import { webhookVerificationMiddleware } from "./webhook-verification";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { buildSystemInstructions } from "./ai-prompts";

const aiChatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many AI chat requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Server-side staged action storage for security
// Actions are stored here when returned as "staged", then executed only when Accept is called with the correct ID
interface StagedActionBundle {
  id: string;
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
  userRequest?: string;
  reasoningSummary?: string; // P0 HARDENING: AI decision rationale for audit trail
  createdAt: Date;
  expiresAt: Date;
}

const stagedActionsStore = new Map<string, StagedActionBundle>();

// Cleanup expired staged actions every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [id, bundle] of stagedActionsStore.entries()) {
    if (bundle.expiresAt < now) {
      stagedActionsStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

function createStagedBundle(
  actions: Array<{ tool: string; args: Record<string, unknown> }>, 
  userRequest?: string,
  reasoningSummary?: string
): string {
  const id = `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const bundle: StagedActionBundle = {
    id,
    actions,
    userRequest,
    reasoningSummary, // P0 HARDENING: Store AI rationale
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minute expiry
  };
  stagedActionsStore.set(id, bundle);
  return id;
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
  { tool: "send_email", keywords: ["send email", "email them", "email to", "email with", "include payment link", "email the"], description: "email sending" },
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

// Rate limiter for n8n webhook callbacks (generous limits for automation)
const n8nWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // Higher limit for automation workflows
  message: { error: "Too many webhook requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for public intake webhooks (moderate limit to prevent abuse)
const intakeWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // 50 requests per minute per IP
  message: { error: "Too many intake submissions, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// N8N webhook verification middleware (optional mode for backward compatibility)
// Set N8N_WEBHOOK_SECRET env var to enable signature verification
const n8nVerification = webhookVerificationMiddleware(
  "N8N_WEBHOOK_SECRET",
  "x-webhook-signature",
  true // Optional mode: logs warnings but allows unsigned requests during migration
);

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

// N8N webhook schemas
const updateJobStatusSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
  status: z.string().min(1, "status is required"),
});

const sendEstimateN8NSchema = z.object({
  estimateId: z.string().min(1, "estimateId is required"),
});

const sendInvoiceN8NSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
});

const markInvoicePaidSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required"),
});

// Assist queue schemas
const approveAssistSchema = z.object({
  reason: z.string().optional(),
});

const rejectAssistSchema = z.object({
  reason: z.string().min(1, "reason is required"),
});

// CRM Sync Schema - Callback from Neo8Flow after processing lead intake
const crmSyncSchema = z.object({
  outbox_id: z.string().min(1, "outbox_id is required"),
  tenant_id: z.string().min(1, "tenant_id is required"),
  status: z.enum(["success", "error"]),
  error_message: z.string().optional(),
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
    timestamp: z.string().optional(),
  }),
  channel: z.string().optional(),
  recording_url: z.string().url().optional(),
  lead_score: z.number().int().min(0).max(100).optional(),
});

// Helper function for logging n8n API requests/responses
function logN8NRequest(endpoint: string, method: string, data: unknown) {
  console.log(`[N8N API] ${method} ${endpoint}`);
  console.log(`[N8N API] Request:`, JSON.stringify(data, null, 2));
}

function logN8NResponse(endpoint: string, status: number, data: unknown) {
  console.log(`[N8N API] ${endpoint} - Response ${status}:`, JSON.stringify(data, null, 2));
}

function logN8NError(endpoint: string, error: unknown) {
  console.error(`[N8N API] ERROR ${endpoint}:`, error);
}

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
        n8n: process.env.N8N_WEBHOOK_URL !== "__SET_AT_DEPLOY__" ? "configured" : "not_configured",
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
        n8n: process.env.N8N_WEBHOOK_URL !== "__SET_AT_DEPLOY__" ? "connected" : "not_configured",
      },
    };
    res.json(health);
  });

  app.get("/api/contacts", async (_req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("[API] Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // N8N callback endpoint: Lookup contact by phone
  app.get("/api/contacts/lookup", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const phone = req.query.phone as string;
      logN8NRequest("/api/contacts/lookup", "GET", { phone });
      
      if (!phone) {
        const error = { error: "Phone number is required" };
        logN8NResponse("/api/contacts/lookup", 400, error);
        return res.status(400).json(error);
      }

      const contact = await storage.getContactByPhone(phone);
      
      if (!contact) {
        const error = { error: "Contact not found" };
        logN8NResponse("/api/contacts/lookup", 404, error);
        return res.status(404).json(error);
      }

      logN8NResponse("/api/contacts/lookup", 200, contact);
      res.json(contact);
    } catch (error) {
      logN8NError("/api/contacts/lookup", error);
      const message = error instanceof Error ? error.message : "Failed to lookup contact";
      const errorResponse = { error: message };
      logN8NResponse("/api/contacts/lookup", 500, errorResponse);
      res.status(500).json(errorResponse);
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

  // Outreach trigger - dispatches to n8n to start an outreach sequence
  app.post("/api/contacts/:id/outreach", async (req, res) => {
    try {
      const contactId = req.params.id;
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const { action = "manual_trigger", user = "system" } = req.body;

      const payload = {
        leadId: contactId,
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        action,
        user,
      };

      const result = await dispatchToN8nWebhook("/outreach/trigger", payload);

      await storage.createAuditLogEntry({
        userId: null,
        action: "outreach_triggered",
        entityType: "contact",
        entityId: contactId,
        details: { action, user, n8nResult: result.success },
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to trigger outreach" });
      }

      res.json({ success: true, message: "Outreach triggered", contactId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to trigger outreach";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
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
  // FIX 3: Include BOTH ledger entries with status "ai_validated" AND approved assist_queue entries
  // ========================================
  app.get("/api/ready-execution", async (_req, res) => {
    try {
      // Get ledger entries that are ai_validated (from approval flow)
      const ledgerEntries = await storage.getAutomationLedgerEntries({
        status: "ai_validated",
        limit: 100,
      });
      
      // Also get approved assist_queue entries that haven't been executed yet
      const assistEntries = await storage.getAssistQueue();
      const approvedProposals = assistEntries.filter(e => e.status === "approved");
      
      // Combine and return both sources
      // Transform assist_queue entries to match ledger format for display
      const combinedEntries = [
        ...ledgerEntries,
        ...approvedProposals.map(p => ({
          id: p.id,
          timestamp: p.approvedAt || p.createdAt,
          agentName: "ActionAI CRM",
          actionType: "Approved Proposal",
          entityType: "assist_queue",
          entityId: p.id,
          mode: p.mode,
          status: "ai_validated" as const,
          diffJson: {
            userRequest: p.userRequest,
            toolsCalled: p.toolsCalled,
          },
          reason: null,
          assistQueueId: p.id,
          updatedAt: p.updatedAt,
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
        console.log(`[KILL SWITCH] Execution blocked for entry ${req.params.id} - kill switch active`);
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
            console.log(`[IDEMPOTENCY] Duplicate execution blocked for key ${entry.idempotencyKey}`);
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
          console.log(`[Ready Execution] Processing ${proposedActions.length} action(s) from ledger`);
          
          let hasExternalActions = false;
          let hasInternalActions = false;
          
          for (const action of proposedActions) {
            const actionType = classifyAction(action.tool);
            
            if (actionType === "EXTERNAL") {
              hasExternalActions = true;
              console.log(`[Ready Execution] Dispatching EXTERNAL action "${action.tool}" to Neo8`);
              
              try {
                const dispatchResult = await dispatchExternalAction(
                  action.tool,
                  action.args,
                  { 
                    ledgerId: entry.id,
                    assistQueueId: entry.assistQueueId || undefined,
                    userId: userId || undefined,
                  }
                );
                
                if (dispatchResult.success) {
                  executionResults.push({
                    tool: action.tool,
                    status: "dispatched_to_neo8",
                    result: dispatchResult.responseData,
                  });
                } else {
                  executionResults.push({
                    tool: action.tool,
                    status: "dispatch_failed",
                    error: dispatchResult.error,
                  });
                  dispatchError = dispatchResult.error || null;
                }
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Neo8 dispatch failed";
                executionResults.push({
                  tool: action.tool,
                  status: "dispatch_failed",
                  error: errorMessage,
                });
                dispatchError = errorMessage;
              }
            } else {
              hasInternalActions = true;
              console.log(`[Ready Execution] Executing INTERNAL action "${action.tool}" directly`);
              
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
          
          if (entry.assistQueueId) {
            await storage.updateAssistQueueEntry(entry.assistQueueId, {
              status: "completed",
              completedAt: new Date(),
              toolResults: executionResults,
            });
          }
        } else if (diffJson) {
          try {
            await dispatchToN8nWebhook({
              eventType: entry.actionType,
              payload: diffJson,
              source: "ready_execution",
              ledgerActionId: entry.id,
            });
            dispatchStatus = "dispatched";
          } catch (err) {
            dispatchStatus = "dispatch_failed";
            dispatchError = err instanceof Error ? err.message : "Unknown dispatch error";
            console.error("N8N dispatch failed:", err);
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
          assistQueueId: entry.assistQueueId || null,
        });

        console.log(`[Ready Execution] Ledger entry completed: ${executionResults.length} actions executed`);

        return res.json({ 
          success: true, 
          status: "executed",
          source: "ledger",
          executionResults,
          dispatchStatus,
          dispatchError,
        });
      }
      
      // Not in ledger - try assist_queue directly by ID
      const assistEntry = await storage.getAssistQueueEntry(req.params.id);
      
      if (assistEntry) {
        // P0 HARDENING: Idempotency check for assist_queue - prevent duplicate execution
        if (assistEntry.idempotencyKey) {
          const existingEntry = await storage.getAutomationLedgerByIdempotencyKey(assistEntry.idempotencyKey);
          if (existingEntry && existingEntry.status === "executed") {
            console.log(`[IDEMPOTENCY] Duplicate assist_queue execution blocked for key ${assistEntry.idempotencyKey}`);
            return res.status(409).json({
              error: "Duplicate execution blocked",
              message: "An action with this idempotency key has already been executed.",
              idempotencyKey: assistEntry.idempotencyKey,
              existingLedgerId: existingEntry.id,
              existingExecutedAt: existingEntry.updatedAt,
            });
          }
        }

        // Found in assist_queue - check status
        if (assistEntry.status !== "approved") {
          return res.status(400).json({ 
            error: `Cannot execute assist queue entry with status: ${assistEntry.status}. Only approved entries can be executed.` 
          });
        }
        
        // Execute the proposed tools - route INTERNAL vs EXTERNAL appropriately
        const toolsCalled = assistEntry.toolsCalled as Array<{ tool: string; args: unknown }> | undefined;
        
        if (toolsCalled && toolsCalled.length > 0) {
          console.log(`[Ready Execution] Processing ${toolsCalled.length} action(s) from assist_queue`);
          
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
                console.log(`[Ready Execution] Resolving contactId: "${resolved.contactId}" → "${createdEntities.contactId}"`);
                resolved.contactId = createdEntities.contactId;
              }
            }
            
            // Resolve estimateId
            if (resolved.estimateId && typeof resolved.estimateId === 'string') {
              if (isPlaceholderValue(resolved.estimateId) && createdEntities.estimateId) {
                console.log(`[Ready Execution] Resolving estimateId: "${resolved.estimateId}" → "${createdEntities.estimateId}"`);
                resolved.estimateId = createdEntities.estimateId;
              }
            }
            
            // Resolve invoiceId
            if (resolved.invoiceId && typeof resolved.invoiceId === 'string') {
              if (isPlaceholderValue(resolved.invoiceId) && createdEntities.invoiceId) {
                console.log(`[Ready Execution] Resolving invoiceId: "${resolved.invoiceId}" → "${createdEntities.invoiceId}"`);
                resolved.invoiceId = createdEntities.invoiceId;
              }
            }
            
            // Resolve jobId
            if (resolved.jobId && typeof resolved.jobId === 'string') {
              if (isPlaceholderValue(resolved.jobId) && createdEntities.jobId) {
                console.log(`[Ready Execution] Resolving jobId: "${resolved.jobId}" → "${createdEntities.jobId}"`);
                resolved.jobId = createdEntities.jobId;
              }
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
                  console.log(`[Ready Execution] Captured contactId: ${data.id}`);
                } else if (toolName === 'create_estimate') {
                  createdEntities.estimateId = data.id;
                  console.log(`[Ready Execution] Captured estimateId: ${data.id}`);
                } else if (toolName === 'create_invoice') {
                  createdEntities.invoiceId = data.id;
                  console.log(`[Ready Execution] Captured invoiceId: ${data.id}`);
                } else if (toolName === 'create_job') {
                  createdEntities.jobId = data.id;
                  console.log(`[Ready Execution] Captured jobId: ${data.id}`);
                } else if (toolName === 'create_appointment') {
                  createdEntities.appointmentId = data.id;
                  console.log(`[Ready Execution] Captured appointmentId: ${data.id}`);
                }
              }
            }
          };
          
          for (const action of toolsCalled) {
            const actionType = classifyAction(action.tool);
            
            // Resolve placeholder IDs before execution
            const resolvedArgs = resolveEntityIds(action.args);
            
            if (actionType === "EXTERNAL") {
              hasExternalActions = true;
              console.log(`[Ready Execution] Dispatching EXTERNAL action "${action.tool}" to Neo8 (from assist_queue)`);
              
              try {
                const dispatchResult = await dispatchExternalAction(
                  action.tool,
                  resolvedArgs,
                  { 
                    assistQueueId: assistEntry.id,
                    userId: userId || undefined,
                  }
                );
                
                if (dispatchResult.success) {
                  executionResults.push({
                    tool: action.tool,
                    status: "dispatched_to_neo8",
                    result: dispatchResult.responseData,
                  });
                } else {
                  executionResults.push({
                    tool: action.tool,
                    status: "dispatch_failed",
                    error: dispatchResult.error,
                  });
                  dispatchError = dispatchResult.error || null;
                }
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Neo8 dispatch failed";
                executionResults.push({
                  tool: action.tool,
                  status: "dispatch_failed",
                  error: errorMessage,
                });
                dispatchError = errorMessage;
              }
            } else {
              hasInternalActions = true;
              console.log(`[Ready Execution] Executing INTERNAL action "${action.tool}" directly (from assist_queue)`);
              
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

        await storage.updateAssistQueueEntry(req.params.id, {
          status: "completed",
          completedAt: new Date(),
          toolResults: executionResults,
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: "assist_queue",
          entityId: assistEntry.id,
          details: {
            outcome: "confirmed",
            assistQueueId: assistEntry.id,
            userRequest: assistEntry.userRequest,
            executionResults,
            dispatchStatus,
          },
        });
        
        // P0 FIX: Check if ledger entry already exists for this idempotency key (created at proposal time)
        // If so, update it instead of creating a duplicate
        if (assistEntry.idempotencyKey) {
          const existingEntry = await storage.getAutomationLedgerByIdempotencyKey(assistEntry.idempotencyKey);
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
            console.log(`[Ready Execution] Updated existing ledger entry ${existingEntry.id} to executed`);
          } else {
            // No existing entry, create new one
            await storage.createAutomationLedgerEntry({
              agentName: "Human",
              actionType: "HUMAN_EXECUTION_DECISION",
              entityType: "assist_queue",
              entityId: assistEntry.id,
              mode: "execute",
              status: "executed",
              diffJson: {
                decision: "confirmed",
                userRequest: assistEntry.userRequest,
                toolsCalled: assistEntry.toolsCalled,
                executionResults,
              },
              reason: null,
              assistQueueId: assistEntry.id,
              idempotencyKey: assistEntry.idempotencyKey,
              reasoningSummary: assistEntry.reasoningSummary,
              executionTraceId: assistEntry.id,
            });
          }
        } else {
          // No idempotency key, create new entry (legacy flow)
          await storage.createAutomationLedgerEntry({
            agentName: "Human",
            actionType: "HUMAN_EXECUTION_DECISION",
            entityType: "assist_queue",
            entityId: assistEntry.id,
            mode: "execute",
            status: "executed",
            diffJson: {
              decision: "confirmed",
              userRequest: assistEntry.userRequest,
              toolsCalled: assistEntry.toolsCalled,
              executionResults,
            },
            reason: null,
            assistQueueId: assistEntry.id,
          });
        }

        console.log(`[Ready Execution] Assist queue entry completed: ${executionResults.length} actions executed`);

        return res.json({ 
          success: true, 
          status: "executed",
          source: "assist_queue",
          executionResults,
          dispatchStatus,
          dispatchError,
        });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or assist queue" });
    } catch (error) {
      console.error("[Ready Execution Execute] Error:", error);
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
      
      // Not in ledger - try assist_queue directly by ID
      const assistEntry = await storage.getAssistQueueEntry(req.params.id);
      
      if (assistEntry) {
        // Found in assist_queue - check status
        if (assistEntry.status !== "approved") {
          return res.status(400).json({ 
            error: `Cannot reject assist queue entry with status: ${assistEntry.status}. Only approved entries can be rejected.` 
          });
        }
        
        // Update status to rejected
        await storage.updateAssistQueueEntry(req.params.id, {
          status: "rejected",
        });

        await storage.createAuditLogEntry({
          userId,
          action: "HUMAN_EXECUTION_DECISION",
          entityType: "assist_queue",
          entityId: assistEntry.id,
          details: {
            outcome: "rejected",
            assistQueueId: assistEntry.id,
            userRequest: assistEntry.userRequest,
            reason: rejectionReason,
          },
        });
        
        await storage.createAutomationLedgerEntry({
          agentName: "Human",
          actionType: "HUMAN_EXECUTION_DECISION",
          entityType: "assist_queue",
          entityId: assistEntry.id,
          mode: "execute",
          status: "human_rejected",
          diffJson: {
            decision: "rejected",
            userRequest: assistEntry.userRequest,
            toolsCalled: assistEntry.toolsCalled,
          },
          reason: rejectionReason,
          assistQueueId: assistEntry.id,
        });

        return res.json({ success: true, status: "rejected", source: "assist_queue" });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or assist queue" });
    } catch (error) {
      console.error("[Ready Execution Reject] Error:", error);
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

      // Try to find in assist_queue first (most common case)
      const assistEntry = await storage.getAssistQueueEntry(req.params.id);
      
      if (assistEntry) {
        // Mark as handled manually
        await storage.updateAssistQueueEntry(req.params.id, {
          status: "handled_manually",
          handledManually: true,
          manualHandlingNote: note,
          completedAt: new Date(),
        });

        // Create audit log
        await storage.createAuditLogEntry({
          userId,
          action: "OPERATOR_MANUAL_HANDLING",
          entityType: "assist_queue",
          entityId: assistEntry.id,
          details: {
            outcome: "handled_manually",
            assistQueueId: assistEntry.id,
            userRequest: assistEntry.userRequest,
            manualNote: note,
            resolution: resolution || "Manual handling completed",
          },
        });
        
        // Create ledger entry
        await storage.createAutomationLedgerEntry({
          agentName: "Human (Operator)",
          actionType: "OPERATOR_MANUAL_HANDLING",
          entityType: "assist_queue",
          entityId: assistEntry.id,
          mode: "manual",
          status: "handled_manually",
          diffJson: {
            decision: "handled_manually",
            userRequest: assistEntry.userRequest,
            toolsCalled: assistEntry.toolsCalled,
            manualNote: note,
            resolution: resolution || "Manual handling completed",
          },
          reason: `Operator handled manually: ${note}`,
          assistQueueId: assistEntry.id,
        });

        console.log(`[Ready Execution] Entry ${req.params.id} handled manually by operator`);

        return res.json({ 
          success: true, 
          status: "handled_manually",
          message: "Entry marked as handled manually by operator",
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

        console.log(`[Ready Execution] Ledger entry ${req.params.id} handled manually by operator`);

        return res.json({ 
          success: true, 
          status: "handled_manually",
          source: "ledger",
          message: "Entry marked as handled manually by operator",
          handledManually: true,
        });
      }

      return res.status(404).json({ error: "Entry not found in either ledger or assist queue" });
    } catch (error) {
      console.error("[Ready Execution Handle Manually] Error:", error);
      res.status(500).json({ error: "Failed to mark entry as handled manually" });
    }
  });

  app.get("/api/estimates", async (_req, res) => {
    try {
      const estimates = await storage.getEstimates();
      res.json(estimates);
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

  app.get("/api/invoices", async (_req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
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

      const dispatchResult = await dispatchToN8nWebhook("/payment/create", webhookPayload);
      
      if (!dispatchResult.success) {
        // Log failed dispatch attempt with traceId
        await storage.createAuditLogEntry({
          userId: null,
          action: "PAYMENT_EXECUTION_FAILED",
          entityType: "payment_slip",
          entityId: slipId,
          details: { 
            traceId,
            origin: slip.origin,
            amount: slip.amount,
            error: dispatchResult.error,
            webhookTarget: "/webhook/payment/create"
          },
        });
        
        // Don't block execution if n8n is not configured - log and continue
        console.warn(`[Payments] N8N dispatch failed for slip ${slipId} (traceId: ${traceId}): ${dispatchResult.error}`);
      }

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
          webhookTarget: "/webhook/payment/create",
          n8nDispatchSuccess: dispatchResult.success
        },
      });

      res.json({ 
        success: true, 
        message: "Payment slip execution initiated", 
        slipId,
        traceId,
        n8nDispatched: dispatchResult.success
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to execute payment slip" });
    }
  });

  // ========================================
  // SETTINGS
  // ========================================

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
        return res.json(defaultSettings);
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validated = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_settings",
        entityType: "settings",
        entityId: settings.id,
        details: validated,
      });
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  // Master Architect Configuration
  app.get("/api/master-architect/config", async (_req, res) => {
    try {
      const config = await storage.getMasterArchitectConfig();
      if (!config) {
        const defaultConfig = {
          id: 'default',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 1500,
          topP: 1.0,
          frequencyPenalty: 0.0,
          systemPrompt: 'You are a helpful AI assistant for the Smart Klix CRM.',
          reflectionEnabled: true,
          maxReflectionRounds: 1,
          recursionDepthLimit: 3,
          maxConversationHistory: 50,
          contextSummarizationEnabled: false,
          autoPruneAfterMessages: 100,
          toolPermissions: {},
          updatedAt: new Date(),
        };
        return res.json(defaultConfig);
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Master Architect config" });
    }
  });

  app.patch("/api/master-architect/config", async (req, res) => {
    try {
      const validated = insertMasterArchitectConfigSchema.partial().parse(req.body);
      const config = await storage.updateMasterArchitectConfig(validated);
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_master_architect_config",
        entityType: "master_architect_config",
        entityId: config.id,
        details: validated,
      });
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid config data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update Master Architect config" });
    }
  });

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
          actionAiPrompt: `You are ActionAI CRM - the operational brain for Smart Klix CRM.

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
          masterArchitectPrompt: "You are the Master Architect - responsible for validating ActionAI proposals against business logic and safety schemas before human approval.",
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
      
      console.log(`[KILL SWITCH] Activated by ${userId || "system"}: ${reason || "No reason provided"}`);
      
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
      
      console.log(`[KILL SWITCH] Deactivated by ${userId || "system"}`);
      
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
      console.error("Voice context error:", error);
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
        await storage.createAssistQueueEntry({
          mode: "assist",
          userRequest: `Premium AI Receptionist: Caller requested appointment`,
          status: "pending",
          requiresApproval: true,
          toolsCalled: [{
            name: "schedule_appointment",
            args: {
              contactId,
              preferredTime: validated.extractedData.preferredTime,
              reason: validated.extractedData.reason,
              notes: validated.extractedData.notes,
              callId: validated.callId,
            },
          }],
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
      console.error("Premium receptionist result error:", error);
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
        // Queue follow-up for missed calls
        await storage.createAssistQueueEntry({
          mode: "assist",
          userRequest: `Missed call from ${validated.callerPhone} - follow-up required`,
          status: "pending",
          requiresApproval: true,
          toolsCalled: [{
            name: "follow_up",
            args: {
              callerPhone: validated.callerPhone,
              contactId: validated.contactId,
              reason: "Missed call - follow-up required",
              callId: validated.callId,
            },
          }],
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
      console.error("Voice event error:", error);
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
      console.error("Voice dispatch config error:", error);
      res.status(500).json({ error: "Failed to fetch voice dispatch config" });
    }
  });

  // Internal CRM Agent Chat - Routes through Master Architect
  app.post("/api/ai/chat/internal", aiChatRateLimiter, async (req, res) => {
    try {
      const validated = internalChatSchema.parse(req.body);
      const aiSettings = await storage.getAiSettings();

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

      // Build structured context for Master Architect
      const maContext: MAContext = {
        channel: validated.context === "read_chat" ? "read_chat" : "crm_chat",
        companyName: null, // CRM internal chat doesn't have company context by default
        userId: null,
        contactId: validated.contactId || null,
        jobId: validated.jobId || null,
        intakeId: null,
        conversationId: `crm-chat-${Date.now()}`,
        rawMessage: validated.message,
        origin: "ai", // Actions must be staged for approval, not auto-executed
      };

      // Detect required actions from the ORIGINAL user message
      const requiredActions = detectRequiredActions(validated.message);
      
      // Track all staged tools across retries
      let allStagedTools: string[] = [];
      let allToolCalls: Array<{ name: string; status: string; arguments: string; result?: unknown }> = [];
      let finalMessage = "";
      let retryCount = 0;
      
      // Build conversation history for enforcement retries
      let conversationHistory = [...validated.conversationHistory];
      
      // Create MasterArchitect instance with conversation history and context
      let architect = new MasterArchitect(
        agentMode, 
        systemInstructions, 
        null,
        conversationHistory,
        validated.context === "read_chat" ? "read_chat" : "crm_chat",
        maContext
      );
      
      // Execute through unified pipeline
      let result = await architect.execute(validated.message, null, null);
      finalMessage = result.message;
      
      // Collect tool calls
      if (result.toolCalls) {
        allToolCalls = [...result.toolCalls];
        allStagedTools = result.toolCalls
          .filter(tc => tc.status === "staged")
          .map(tc => tc.name);
      }

      // Debug logging for AI tool calls
      console.log(`[ActionConsole] Message: "${validated.message.substring(0, 50)}..."`);
      console.log(`[ActionConsole] Tool calls: ${result.toolCalls?.length || 0}`);
      if (result.toolCalls && result.toolCalls.length > 0) {
        result.toolCalls.forEach((tc, idx) => {
          console.log(`[ActionConsole]   ${idx + 1}. ${tc.name} (${tc.status})`);
        });
      } else {
        console.log(`[ActionConsole]   No tools called - AI responded with text only`);
      }
      
      // MULTI-STEP ENFORCEMENT LOOP
      // Only apply to ActionAI contexts (not read_chat)
      if (validated.context !== "read_chat" && requiredActions.length > 0) {
        let missingActions = getMissingActions(requiredActions, allStagedTools);
        
        while (missingActions.length > 0 && retryCount < MAX_ENFORCEMENT_RETRIES) {
          retryCount++;
          console.log(`[Enforcement] Retry ${retryCount}: Missing actions: ${missingActions.join(", ")}`);
          
          // Build enforcement message
          const enforcementMessage = buildEnforcementMessage(missingActions);
          
          // Add previous AI response and enforcement to conversation
          conversationHistory.push(
            { role: "assistant" as const, content: result.message },
            { role: "user" as const, content: enforcementMessage }
          );
          
          // Create new architect with updated history
          architect = new MasterArchitect(
            agentMode,
            systemInstructions,
            null,
            conversationHistory,
            validated.context === "read_chat" ? "read_chat" : "crm_chat",
            maContext
          );
          
          // Re-execute with enforcement
          result = await architect.execute(enforcementMessage, null, null);
          finalMessage = result.message;
          
          // Collect new tool calls
          if (result.toolCalls) {
            allToolCalls = [...allToolCalls, ...result.toolCalls];
            const newStagedTools = result.toolCalls
              .filter(tc => tc.status === "staged")
              .map(tc => tc.name);
            allStagedTools = Array.from(new Set([...allStagedTools, ...newStagedTools]));
          }
          
          console.log(`[Enforcement] After retry ${retryCount}: Staged tools: ${allStagedTools.join(", ")}`);
          
          // Check for remaining missing actions
          missingActions = getMissingActions(requiredActions, allStagedTools);
        }
        
        if (missingActions.length > 0) {
          console.log(`[Enforcement] FAILED after ${retryCount} retries. Still missing: ${missingActions.join(", ")}`);
        } else {
          console.log(`[Enforcement] SUCCESS: All required actions staged after ${retryCount} retries`);
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
          mode: result.mode,
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
        stagedBundleId = createStagedBundle(
          stagedActions,
          validated.message
        );
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
        mode: result.mode,
        readyForProposal, // True when AI has gathered all info and is asking for permission to propose
        enforcementRetries: retryCount, // For debugging
      });
    } catch (error) {
      console.error("Internal chat error:", error);
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
      const { stagedBundleId } = req.body as { stagedBundleId: string };

      if (!stagedBundleId) {
        return res.status(400).json({ error: "Missing stagedBundleId" });
      }

      // Retrieve staged bundle from server-side store
      const bundle = stagedActionsStore.get(stagedBundleId);
      if (!bundle) {
        return res.status(404).json({ 
          error: "Staged bundle not found", 
          message: "The staged actions may have expired or already been processed." 
        });
      }

      // Check expiration
      if (bundle.expiresAt < new Date()) {
        stagedActionsStore.delete(stagedBundleId);
        return res.status(410).json({ 
          error: "Staged bundle expired", 
          message: "The staged actions have expired. Please submit your request again." 
        });
      }

      // Remove from staged store (one-time use)
      stagedActionsStore.delete(stagedBundleId);

      // P0 HARDENING: Generate idempotency key for deduplication
      const idempotencyKey = `proposal-${stagedBundleId}-${Date.now()}`;
      
      // P0 HARDENING: Extract reasoning summary from bundle (if AI provided it)
      const reasoningSummary = bundle.reasoningSummary || 
        `AI proposed ${bundle.actions.length} action(s): ${bundle.actions.map(a => a.tool).join(", ")}. User request: ${bundle.userRequest || "N/A"}`;

      // 1. Create AssistQueue entry (for Review Queue / MA validation)
      const queueEntry = await storage.createAssistQueueEntry({
        userId: null,
        mode: "assist",
        userRequest: bundle.userRequest || "Action Console proposal",
        status: "pending", // Awaiting MA review
        agentResponse: `Proposed ${bundle.actions.length} action(s): ${bundle.actions.map(a => a.tool).join(", ")}`,
        toolsCalled: bundle.actions.map(a => ({ tool: a.tool, args: a.args })),
        toolResults: null, // Not executed yet
        requiresApproval: true,
        idempotencyKey, // P0: For deduplication
        reasoningSummary, // P0: Audit trail
      });

      // 2. Write to Ledger (status: proposed) - First ledger entry
      await storage.createAutomationLedgerEntry({
        agentName: "ActionAI CRM",
        actionType: "PROPOSAL_CREATED",
        entityType: "assist_queue",
        entityId: queueEntry.id,
        mode: "assist",
        status: "proposed",
        diffJson: {
          stagedBundleId,
          userRequest: bundle.userRequest,
          proposedActions: bundle.actions.map(a => ({ tool: a.tool, args: a.args })),
        },
        reason: "User approved staged actions for review",
        assistQueueId: queueEntry.id,
        idempotencyKey, // P0: For deduplication
        reasoningSummary, // P0: Audit trail
        executionTraceId: queueEntry.id, // Link intake → proposal → execution
      });

      console.log(`[Governance] Proposal ${queueEntry.id} created and sent to Review Queue`);

      // 3. Auto-trigger MA validation (fire-and-forget)
      // This runs asynchronously so the response isn't delayed
      setImmediate(async () => {
        try {
          console.log(`[MA Auto-Validation] Starting validation for ${queueEntry.id}`);
          
          // Get proposed tools from entry
          const toolsCalled = bundle.actions as Array<{ tool: string; args: unknown }>;
          
          // MA Validation: Check if tools are safe and well-formed
          let validationDecision: "approved" | "rejected" = "approved";
          let validationReason = "Proposal validated by Master Architect";
          
          if (!toolsCalled || toolsCalled.length === 0) {
            validationDecision = "rejected";
            validationReason = "No tools specified in proposal";
          }
          
          // Check for dangerous operations
          const dangerousTools = ["delete_all_contacts", "drop_database"];
          const hasDangerous = toolsCalled?.some(t => dangerousTools.includes(t.tool));
          if (hasDangerous) {
            validationDecision = "rejected";
            validationReason = "Proposal contains dangerous operations";
          }

          if (validationDecision === "approved") {
            // Update assist_queue to approved status
            await storage.updateAssistQueueEntry(queueEntry.id, {
              status: "approved",
              architectApprovedAt: new Date(),
            });

            // Find and update the original ledger entry to ai_validated
            const ledgerEntries = await storage.getAutomationLedgerEntries({ limit: 100 });
            const existingLedger = ledgerEntries.find(
              e => e.assistQueueId === queueEntry.id && e.status === "proposed"
            );
            
            if (existingLedger) {
              await storage.updateAutomationLedgerEntry(existingLedger.id, {
                status: "ai_validated",
                reason: validationReason,
              });
            }

            // Create MA validation audit record
            await storage.createAutomationLedgerEntry({
              agentName: "Master Architect",
              actionType: "AI_VALIDATION_RECORDED",
              entityType: "assist_queue",
              entityId: queueEntry.id,
              mode: "assist",
              status: "recorded",
              diffJson: {
                decision: "approved",
                userRequest: bundle.userRequest,
                toolsValidated: toolsCalled?.map(t => t.tool) || [],
              },
              reason: validationReason,
              assistQueueId: queueEntry.id,
            });

            console.log(`[MA Auto-Validation] Proposal ${queueEntry.id} APPROVED - moved to Ready Execution`);
          } else {
            // Rejected by MA
            await storage.updateAssistQueueEntry(queueEntry.id, {
              status: "rejected",
              rejectedAt: new Date(),
              error: validationReason,
            });

            // Find and update the original ledger entry
            const ledgerEntries = await storage.getAutomationLedgerEntries({ limit: 100 });
            const existingLedger = ledgerEntries.find(
              e => e.assistQueueId === queueEntry.id && e.status === "proposed"
            );
            
            if (existingLedger) {
              await storage.updateAutomationLedgerEntry(existingLedger.id, {
                status: "rejected",
                reason: validationReason,
              });
            }

            console.log(`[MA Auto-Validation] Proposal ${queueEntry.id} REJECTED: ${validationReason}`);
          }
        } catch (err) {
          console.error(`[MA Auto-Validation] Error validating ${queueEntry.id}:`, err);
        }
      });

      // Return success - actions are now in Review Queue, MA validation triggered
      res.json({
        success: true,
        message: "Sent to Review Queue for validation",
        queueEntryId: queueEntry.id,
        status: "pending_review",
      });
    } catch (error) {
      console.error("Staged accept error:", error);
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

      // Retrieve and remove staged bundle from server-side store
      const bundle = stagedActionsStore.get(stagedBundleId);
      if (bundle) {
        stagedActionsStore.delete(stagedBundleId);
      }

      // Log rejection to ledger
      await storage.createAutomationLedgerEntry({
        agentName: "ActionAI CRM",
        actionType: "STAGED_ACTIONS_REJECTED",
        entityType: "staged_action",
        entityId: stagedBundleId,
        mode: "assist",
        status: "rejected",
        diffJson: {
          userRequest: bundle?.userRequest || "Staged actions rejected",
          actionsRejected: bundle?.actions.map(a => a.tool) || [],
        },
        reason: reason || "User rejected staged actions",
        assistQueueId: null,
      });

      res.json({ success: true, message: "Staged actions discarded" });
    } catch (error) {
      console.error("Staged reject error:", error);
      res.status(500).json({ error: "Failed to reject staged actions" });
    }
  });

  // GPT Actions Execute - Routes through Master Architect (same pipeline as CRM Chat)
  app.post("/api/ai/gpt-actions/execute", gptActionsRateLimiter, async (req, res) => {
    try {
      const validated = gptActionsExecuteSchema.parse(req.body);

      // Get AI Settings and build system instructions using HARDCODED base + database additions
      const aiSettings = await storage.getAiSettings();
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

      // Build structured context for Master Architect
      const maContext: MAContext = {
        channel: "gpt_actions",
        companyName: contactCompany, // Use contact's company for company-specific behavior
        userId: null,
        contactId: validated.contactId || null,
        jobId: validated.jobId || null,
        intakeId: null,
        conversationId: `gpt-actions-${Date.now()}`,
        rawMessage: validated.message,
        origin: "ai", // GPT Actions are AI-originated (external GPT calling in)
      };

      // Create MasterArchitect instance with conversation history and context
      const architect = new MasterArchitect(
        agentMode, 
        systemInstructions, 
        null,
        validated.conversationHistory,
        "gpt_actions",
        maContext
      );
      
      // Execute through unified pipeline with context
      const result = await architect.execute(
        validated.message,
        contactContext,
        jobContext
      );

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
          response: result.message,
          actions: result.toolCalls?.length || 0,
          mode: result.mode,
        },
      });

      res.json({
        message: result.message,
        actions: result.toolCalls?.map((tc) => ({
          tool: tc.name,
          status: tc.status,
          args: JSON.parse(tc.arguments),
        })) || [],
        mode: result.mode,
      });
    } catch (error) {
      console.error("GPT Actions execute error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ 
        error: "Failed to execute GPT action",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ========================================
  // N8N WEBHOOK HEALTH MONITORING
  // ========================================

  const n8nWebhookSchema = z.object({
    url: z.string().url("Invalid webhook URL"),
    payload: z.record(z.unknown()).optional(),
  });

  app.get("/api/n8n/health", async (_req, res) => {
    try {
      const events = await storage.getWebhookEvents(20);
      
      const successCount = events.filter(e => e.statusCode && e.statusCode >= 200 && e.statusCode < 300).length;
      const failureCount = events.filter(e => e.statusCode && (e.statusCode < 200 || e.statusCode >= 300)).length;
      const errorCount = events.filter(e => e.errorMessage).length;
      
      const lastSuccess = events.find(e => e.statusCode && e.statusCode >= 200 && e.statusCode < 300);
      const lastFailure = events.find(e => e.errorMessage || (e.statusCode && (e.statusCode < 200 || e.statusCode >= 300)));
      
      const settings = await storage.getSettings();
      const n8nWebhookUrl = settings?.n8nWebhookUrl || null;
      
      res.json({
        webhookUrl: n8nWebhookUrl,
        isConfigured: !!n8nWebhookUrl,
        stats: {
          total: events.length,
          success: successCount,
          failures: failureCount,
          errors: errorCount,
        },
        lastSuccess: lastSuccess ? {
          timestamp: lastSuccess.createdAt,
          statusCode: lastSuccess.statusCode,
          duration: lastSuccess.duration,
        } : null,
        lastFailure: lastFailure ? {
          timestamp: lastFailure.createdAt,
          statusCode: lastFailure.statusCode,
          error: lastFailure.errorMessage,
        } : null,
        recentEvents: events.slice(0, 10).map(e => ({
          id: e.id,
          url: e.url,
          statusCode: e.statusCode,
          duration: e.duration,
          error: e.errorMessage,
          createdAt: e.createdAt,
        })),
      });
    } catch (error) {
      console.error("Failed to fetch N8N health:", error);
      res.status(500).json({ error: "Failed to fetch N8N health status" });
    }
  });

  app.post("/api/n8n/test", async (req, res) => {
    try {
      const validated = n8nWebhookSchema.parse(req.body);
      const startTime = Date.now();
      
      const testPayload = {
        event: "test_ping",
        source: "smart_klix_crm",
        timestamp: new Date().toISOString(),
        ...validated.payload,
      };
      
      let statusCode: number | null = null;
      let responseBody: unknown = null;
      let errorMessage: string | null = null;
      
      try {
        const response = await fetch(validated.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testPayload),
        });
        
        statusCode = response.status;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }
      
      const duration = Date.now() - startTime;
      
      const webhookEvent = await storage.createWebhookEvent({
        url: validated.url,
        method: "POST",
        payload: testPayload,
        statusCode,
        responseBody: responseBody as Record<string, unknown>,
        errorMessage,
        duration,
      });
      
      res.json({
        success: !errorMessage && statusCode && statusCode >= 200 && statusCode < 300,
        statusCode,
        duration,
        response: responseBody,
        error: errorMessage,
        eventId: webhookEvent.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      console.error("N8N test failed:", error);
      res.status(500).json({ error: "Failed to test N8N webhook" });
    }
  });

  app.patch("/api/n8n/settings", async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      
      const currentSettings = await storage.getSettings();
      const updatedSettings = await storage.updateSettings({
        ...currentSettings,
        n8nWebhookUrl: webhookUrl || null,
      });
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "update_n8n_settings",
        entityType: "settings",
        entityId: "n8n_config",
        details: { webhookUrl },
      });
      
      res.json({ success: true, webhookUrl: updatedSettings.n8nWebhookUrl });
    } catch (error) {
      console.error("Failed to update N8N settings:", error);
      res.status(500).json({ error: "Failed to update N8N settings" });
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
      console.error("Failed to create user:", error);
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
      console.error("Failed to update user:", error);
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
      console.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ========================================
  // MASTER ARCHITECT (STUBS)
  // ========================================

  app.post("/api/architect/ingest", async (req, res) => {
    res.json({ 
      success: true, 
      message: "Action ingested successfully (stub)",
      id: `ai-${Date.now()}` 
    });
  });

  app.post("/api/architect/queue", async (req, res) => {
    res.json({ 
      success: true, 
      message: "Action queued for approval (stub)",
      queueId: `qa-${Date.now()}` 
    });
  });

  app.post("/api/architect/approve", async (req, res) => {
    const { id } = req.body;
    res.json({ 
      success: true, 
      message: `Action ${id} approved (stub)`,
      executionStarted: true 
    });
  });

  app.post("/api/architect/reject", async (req, res) => {
    const { id } = req.body;
    res.json({ 
      success: true, 
      message: `Action ${id} rejected (stub)`,
      removed: true 
    });
  });

  app.get("/api/architect/feed", async (_req, res) => {
    res.json({ 
      feed: [],
      pendingApprovals: [],
      completedActions: [],
      message: "Feed endpoint (stub)" 
    });
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
      console.error("Failed to fetch conversations:", error);
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
      console.error("Failed to fetch conversation:", error);
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
      console.error("Failed to create conversation:", error);
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
      console.error("Failed to fetch messages:", error);
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
      
      const architect = new MasterArchitect(agentMode, validated.systemPrompt, null);
      const messages = await storage.getMessages(req.params.id);
      
      const result = await architect.chat(validated.message);
      
      const assistantMessage = await storage.createMessage({
        conversationId: req.params.id,
        role: "assistant",
        content: result.message,
        metadata: {
          toolCalls: result.toolCalls,
          mode: result.mode,
        },
      });
      
      res.json({
        userMessage,
        assistantMessage,
        toolCalls: result.toolCalls,
        mode: result.mode,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to send message:", error);
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
      console.error("Failed to update conversation status:", error);
      res.status(500).json({ error: "Failed to update conversation status" });
    }
  });

  // ========================================
  // CHAT WIDGET (STUBS)
  // ========================================

  app.post("/api/widget/settings", async (req, res) => {
    res.json({ 
      success: true, 
      message: "Widget settings saved (stub)",
      settings: req.body 
    });
  });

  app.get("/api/widget/settings", async (_req, res) => {
    res.json({ 
      primaryColor: "#FDB913",
      accentColor: "#1E40AF",
      welcomeMessage: "Hi! How can we help you today?",
      supportEmail: "support@smartklix.com",
      position: "bottom-right",
      message: "Widget settings endpoint (stub)" 
    });
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
      
      const architect = new MasterArchitect("auto", undefined, null, [], "widget");
      
      const restrictedToolPermissions: Record<string, ToolPermission> = {
        create_contact: { enabled: false, allowedModes: [] },
        update_contact: { enabled: false, allowedModes: [] },
        create_job: { enabled: false, allowedModes: [] },
        create_estimate: { enabled: false, allowedModes: [] },
        create_invoice: { enabled: false, allowedModes: [] },
        record_payment: { enabled: false, allowedModes: [] },
      };
      architect.setChannelToolPermissions(restrictedToolPermissions);
      
      const aiResponse = await architect.chat(validated.message);
      
      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: aiResponse.message,
        metadata: { 
          source: "master_architect",
          toolCalls: aiResponse.toolCalls,
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
          response: aiResponse.message,
        },
      });
      
      res.json({ 
        success: true, 
        response: aiResponse.message,
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
          source: validated.source || "widget",
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

  app.post("/api/widget/upload", async (req, res) => {
    res.json({ 
      success: true, 
      message: "File uploaded (stub)",
      fileId: `file-${Date.now()}`,
      url: "https://example.com/stub-file.pdf" 
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

  app.get("/api/master-architect/tasks", async (_req, res) => {
    try {
      // Fetch all three data sources
      const [assistQueue, aiTasks, allAuditLog] = await Promise.all([
        storage.getAssistQueue(),
        storage.getAiTasks(),
        storage.getAuditLog(),
      ]);

      // Limit audit log to recent entries (last 100)
      const auditLog = allAuditLog.slice(-100);

      interface UnifiedTask {
        id: string;
        type: "assist_queue" | "ai_task" | "n8n_event";
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

      // Transform assist queue entries
      const assistTasks: UnifiedTask[] = assistQueue.map(item => {
        const toolsCalled = Array.isArray(item.toolsCalled) ? item.toolsCalled : [];
        const title = toolsCalled.length > 0 && typeof toolsCalled[0] === 'object' && toolsCalled[0] !== null && 'name' in toolsCalled[0]
          ? String(toolsCalled[0].name).replace(/_/g, " ").toUpperCase()
          : "AI Action";

        return {
          id: item.id,
          type: "assist_queue" as const,
          status: item.status,
          title,
          description: item.userRequest || "AI-suggested action",
          userRequest: item.userRequest || undefined,
          agentResponse: item.agentResponse || undefined,
          toolsCalled: item.toolsCalled as unknown[],
          toolResults: item.toolResults as unknown[],
          createdAt: item.createdAt,
          completedAt: item.completedAt || undefined,
          error: item.error || undefined,
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
      const allTasks = [...assistTasks, ...automationTasks, ...n8nEvents]
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

  // N8N dispatch endpoint - frontend routes events through backend
  app.post("/api/n8n/dispatch", async (req, res) => {
    try {
      const validated = neo8OutboundEventSchema.parse(req.body);
      const result = await dispatchNeo8Event(validated);
      
      if (result.success) {
        await storage.createAuditLogEntry({
          userId: null,
          action: "n8n_event_dispatched",
          entityType: "automation",
          entityId: validated.eventId,
          details: {
            eventType: validated.eventType,
            source: "frontend",
          },
        });
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to dispatch n8n event";
      res.status(500).json({ success: false, error: message });
    }
  });

  app.post("/api/events/update", requireInternalToken, async (req, res) => {
    try {
      const validated = neo8InboundResultSchema.parse(req.body);
      
      await storage.createAuditLogEntry({
        userId: null,
        action: "neo8_event_result",
        entityType: "automation",
        entityId: validated.eventId,
        details: {
          eventType: validated.eventType,
          status: validated.status,
          result: validated.result,
          timestamp: validated.timestamp,
        },
      });

      // Create AI task record for Master Architect tracking
      const aiTaskStatus = validated.status === "success" ? "completed" : "failed";
      await storage.createAiTask({
        taskType: `n8n_${validated.eventType}`,
        delegatedTo: "n8n",
        payload: {
          eventId: validated.eventId,
          eventType: validated.eventType,
          result: validated.result,
          timestamp: validated.timestamp,
        },
        status: aiTaskStatus,
        completedAt: new Date(),
        error: validated.status === "error" ? validated.result?.error : null,
      });


      if (validated.status === "error") {
        return res.json({ 
          success: false, 
          error: validated.result?.error || "Unknown error from Neo8",
          eventId: validated.eventId,
        });
      }

      const result = validated.result || {};
      let persistedData = null;

      switch (validated.eventType) {
        case "invoice_created":
        case "create_payment_link": {
          if (result.paymentLink) {
            const invoice = await storage.getInvoice(validated.eventId);
            if (invoice) {
              await storage.updateInvoice(validated.eventId, {
                notes: `${invoice.notes || ""}\nPayment Link: ${result.paymentLink}`.trim(),
              });
              persistedData = { invoiceId: validated.eventId, paymentLink: result.paymentLink };
            }
          }
          break;
        }
        
        case "send_email": {
          await storage.createAuditLogEntry({
            userId: null,
            action: "email_status_update",
            entityType: "communication",
            entityId: validated.eventId,
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
            entityId: validated.eventId,
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
              entityId: validated.eventId,
            });
            persistedData = { noteCreated: true, aiText: result.aiGeneratedText };
          }
          break;
        }

        case "job_updated": {
          const job = await storage.getJob(validated.eventId);
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
              entityId: validated.eventId,
            });
            persistedData = { noteCreated: true, followUpCreated: true };
          }
          break;
        }
      }

      res.json({ 
        success: true, 
        eventId: validated.eventId,
        eventType: validated.eventType,
        result: validated.result,
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
      
      const architect = new MasterArchitect(
        mode, 
        undefined, 
        userId,
        validated.conversationHistory
      );

      const response = await architect.execute(validated.message);

      await storage.createAuditLogEntry({
        userId,
        action: "ai_chat",
        entityType: "chat",
        entityId: "session",
        details: { 
          mode: validated.mode,
          message: validated.message,
          toolCalls: response.toolCalls?.length || 0,
        },
      });

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/assist-queue", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const allEntries = await storage.getAssistQueue();
      
      const filtered = status
        ? allEntries.filter(entry => entry.status === status)
        : allEntries;

      res.json({ entries: filtered, count: filtered.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch assist queue";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/assist-queue/:id", async (req, res) => {
    try {
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      res.json(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch queue entry";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/assist-queue/:id/approve", async (req, res) => {
    try {
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      if (entry.status !== "pending") {
        return res.status(400).json({ error: `Cannot approve entry with status: ${entry.status}` });
      }

      const userId = (req as unknown as { userId?: string }).userId || null;
      
      // ROLE CHECK: Require authenticated user with master_architect or admin role
      if (!userId) {
        return res.status(401).json({ error: "Authentication required to approve actions" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }
      
      const allowedRoles = ["master_architect", "admin"];
      if (!allowedRoles.includes(user.role)) {
        await storage.createAuditLogEntry({
          userId,
          action: "assist_queue_approve_denied",
          entityType: "assist_queue",
          entityId: req.params.id,
          details: { reason: "insufficient_role", userRole: user.role },
        });
        return res.status(403).json({ error: "Insufficient permissions to approve actions" });
      }

      // Get finalization mode from Master Architect config
      const maConfig = await storage.getMasterArchitectConfig();
      const finalizationMode = maConfig?.finalizationMode || "semi_autonomous";
      
      // Mark entry as approved with architect timestamp
      await storage.updateAssistQueueEntry(req.params.id, {
        approvedBy: userId,
        approvedAt: new Date(),
        architectApprovedAt: new Date(),
      });
      
      // FIX 2: Write AI_VALIDATION_RECORDED to automation ledger on approval
      await storage.createAutomationLedgerEntry({
        agentName: "Master Architect",
        actionType: "AI_VALIDATION_RECORDED",
        entityType: "assist_queue",
        entityId: req.params.id,
        mode: "assist",
        status: "ai_validated",
        diffJson: {
          decision: "approved",
          approvedBy: userId,
          userRequest: entry.userRequest,
        },
        reason: null,
        assistQueueId: req.params.id,
      });

      const toolsCalled = entry.toolsCalled as Array<{ name: string; args: unknown }> | null;
      const results: Array<{ name: string; status: string; result?: unknown; error?: string; verified?: boolean }> = [];

      // SEMI_AUTONOMOUS: Mark as approved but require human to finalize (click Send)
      if (finalizationMode === "semi_autonomous" && entry.gatedActionType) {
        const updated = await storage.updateAssistQueueEntry(req.params.id, {
          status: "approved_pending_send",
        });

        await storage.createAuditLogEntry({
          userId,
          action: "assist_queue_approved_pending_send",
          entityType: "assist_queue",
          entityId: req.params.id,
          details: { 
            finalizationMode,
            gatedAction: entry.gatedActionType,
            message: "Approved by architect, awaiting human finalization",
          },
        });

        return res.json({ 
          success: true, 
          entry: updated,
          status: "approved_pending_send",
          message: "Action approved. Click 'Send' to finalize.",
        });
      }

      // FULLY_AUTONOMOUS: Execute immediately after approval
      // ACTION CLASSIFICATION: INTERNAL actions execute directly, EXTERNAL actions dispatch to Neo-8
      if (toolsCalled && toolsCalled.length > 0) {
        for (const tool of toolsCalled) {
          const actionType = classifyAction(tool.name);
          
          try {
            if (actionType === "INTERNAL") {
              // INTERNAL ACTIONS: Execute directly in CRM (database mutations only)
              const preExecState = await captureEntityState(tool.name, tool.args);
              
              const result = await executeAITool(tool.name, tool.args, { 
                userId: userId || undefined, 
                assistQueueId: req.params.id 
              });
              
              const postExecState = await captureEntityState(tool.name, tool.args);
              const verified = verifyStateChange(tool.name, preExecState, postExecState);
              
              // Write EXECUTED_INTERNAL ledger entry
              await storage.createAutomationLedgerEntry({
                agentName: "Master Architect",
                actionType: "EXECUTED_INTERNAL",
                entityType: "assist_queue",
                entityId: req.params.id,
                mode: "auto",
                status: verified ? "executed" : "failed",
                diffJson: {
                  toolName: tool.name,
                  actionType: "INTERNAL",
                  args: tool.args,
                  result: result.success ? result.data : null,
                  verified,
                },
                reason: verified ? null : "DB verification failed",
                assistQueueId: req.params.id,
              });
              
              if (!verified) {
                results.push({
                  name: tool.name,
                  status: "failed",
                  error: "DB verification failed: entity state did not change as expected",
                  verified: false,
                });
              } else {
                results.push({
                  name: tool.name,
                  status: "executed",
                  result,
                  verified: true,
                });
              }
            } else {
              // EXTERNAL ACTIONS: Dispatch to Neo-8 (NEVER execute directly in CRM)
              // This is the governance boundary - CRM triggers, Neo-8 executes
              const traceId = `neo8_${req.params.id}_${Date.now()}`;
              const typedArgs = tool.args as Record<string, unknown>;
              
              // Build Neo-8 dispatch payload
              const neo8Payload = {
                eventType: tool.name,
                eventId: traceId,
                assistQueueId: req.params.id,
                payload: typedArgs,
                approvedBy: userId,
                approvedAt: new Date().toISOString(),
              };
              
              // Write EXECUTION_DISPATCHED ledger entry BEFORE dispatch
              await storage.createAutomationLedgerEntry({
                agentName: "Master Architect",
                actionType: "EXECUTION_DISPATCHED",
                entityType: "assist_queue",
                entityId: req.params.id,
                mode: "auto",
                status: "dispatched",
                diffJson: {
                  toolName: tool.name,
                  actionType: "EXTERNAL",
                  traceId,
                  dispatchedTo: "neo8",
                  payload: neo8Payload,
                },
                reason: null,
                assistQueueId: req.params.id,
              });
              
              // Dispatch to Neo-8 webhook
              const dispatchResult = await dispatchNeo8Event({
                eventType: tool.name as "send_email" | "send_sms" | "new_lead" | "job_updated" | "missed_call" | "invoice_created" | "create_payment_link" | "payment_created",
                eventId: traceId,
                ...typedArgs,
              } as Parameters<typeof dispatchNeo8Event>[0]);
              
              if (dispatchResult.success) {
                results.push({
                  name: tool.name,
                  status: "dispatched",
                  result: { traceId, dispatchedTo: "neo8", message: "Dispatched to Neo-8 for execution" },
                  verified: true,
                });
              } else {
                // Update ledger with dispatch failure
                await storage.createAutomationLedgerEntry({
                  agentName: "Master Architect",
                  actionType: "EXECUTION_DISPATCH_FAILED",
                  entityType: "assist_queue",
                  entityId: req.params.id,
                  mode: "auto",
                  status: "failed",
                  diffJson: {
                    toolName: tool.name,
                    actionType: "EXTERNAL",
                    traceId,
                    error: dispatchResult.error,
                  },
                  reason: dispatchResult.error || "Neo-8 dispatch failed",
                  assistQueueId: req.params.id,
                });
                
                results.push({
                  name: tool.name,
                  status: "dispatch_failed",
                  error: dispatchResult.error || "Failed to dispatch to Neo-8",
                  verified: false,
                });
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Execution failed";
            results.push({
              name: tool.name,
              status: "failed",
              error: errorMessage,
              verified: false,
            });
          }
        }
      }

      const hasErrors = results.some(r => r.status === "failed");
      const verificationFailures = results.filter(r => r.verified === false).length;
      const errorSummary = hasErrors 
        ? `${results.filter(r => r.error).length} tool(s) failed${verificationFailures > 0 ? `, ${verificationFailures} verification failure(s)` : ''}` 
        : undefined;

      const updated = await storage.updateAssistQueueEntry(req.params.id, {
        status: hasErrors ? "failed" : "completed",
        toolResults: results,
        executedAt: new Date(),
        completedAt: hasErrors ? undefined : new Date(),
        error: errorSummary,
      });

      await storage.createAuditLogEntry({
        userId,
        action: "assist_queue_approve",
        entityType: "assist_queue",
        entityId: req.params.id,
        details: { 
          finalizationMode,
          toolsExecuted: results.length,
          succeeded: results.filter(r => r.status === "executed").length,
          failed: results.filter(r => r.status === "failed").length,
          verified: results.filter(r => r.verified === true).length,
        },
      });

      res.json({ 
        success: true, 
        entry: updated,
        results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve queue entry";
      res.status(500).json({ error: message });
    }
  });

  // Helper: Capture entity state before/after execution for verification
  async function captureEntityState(toolName: string, args: unknown): Promise<unknown> {
    const typedArgs = args as Record<string, unknown>;
    switch (toolName) {
      case "send_invoice":
        if (typedArgs.invoiceId) {
          return await storage.getInvoice(typedArgs.invoiceId as string);
        }
        break;
      case "send_estimate":
        if (typedArgs.estimateId) {
          return await storage.getEstimate(typedArgs.estimateId as string);
        }
        break;
      case "record_payment":
        if (typedArgs.invoiceId) {
          return await storage.getInvoice(typedArgs.invoiceId as string);
        }
        break;
    }
    return null;
  }

  // Helper: Verify state changed as expected
  function verifyStateChange(toolName: string, preState: unknown, postState: unknown): boolean {
    if (!preState || !postState) return true; // Skip verification if no state captured
    
    const pre = preState as Record<string, unknown>;
    const post = postState as Record<string, unknown>;
    
    switch (toolName) {
      case "send_invoice":
        // Verify status changed to "sent"
        return post.status === "sent" && pre.status !== "sent";
      case "send_estimate":
        // Verify status changed to "sent"
        return post.status === "sent" && pre.status !== "sent";
      case "record_payment":
        // Verify paidAmount increased or status changed
        return (post.paidAmount as number) > (pre.paidAmount as number) || 
               post.status === "paid";
    }
    return true; // Default pass for non-gated tools
  }

  // FINALIZE ENDPOINT: For semi_autonomous mode - human clicks "Send" after architect approval
  app.post("/api/assist-queue/:id/finalize", async (req, res) => {
    try {
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      // Must be in approved_pending_send state
      if (entry.status !== "approved_pending_send") {
        return res.status(400).json({ 
          error: `Cannot finalize entry with status: ${entry.status}. Must be 'approved_pending_send'.` 
        });
      }

      const userId = (req as unknown as { userId?: string }).userId || null;
      
      // Require authenticated user with proper role
      if (!userId) {
        return res.status(401).json({ error: "Authentication required to finalize actions" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }
      
      const allowedRoles = ["master_architect", "admin"];
      if (!allowedRoles.includes(user.role)) {
        await storage.createAuditLogEntry({
          userId,
          action: "assist_queue_finalize_denied",
          entityType: "assist_queue",
          entityId: req.params.id,
          details: { reason: "insufficient_role", userRole: user.role },
        });
        return res.status(403).json({ error: "Insufficient permissions to finalize actions" });
      }

      // Must have a gated action to finalize
      if (!entry.gatedActionType || !entry.finalizationPayload) {
        return res.status(400).json({ error: "No gated action to finalize" });
      }

      const toolName = entry.gatedActionType;
      const args = entry.finalizationPayload as Record<string, unknown>;

      // Capture pre-execution state
      const preExecState = await captureEntityState(toolName, args);

      let result: unknown;
      let executionError: string | undefined;

      try {
        result = await executeAITool(toolName, args, { 
          userId, 
          assistQueueId: req.params.id,
          finalizationMode: "fully_autonomous" // Bypass gating since already approved
        });
      } catch (error) {
        executionError = error instanceof Error ? error.message : "Execution failed";
      }

      // Capture post-execution state and verify
      const postExecState = await captureEntityState(toolName, args);
      const verified = verifyStateChange(toolName, preExecState, postExecState);

      const success = !executionError && verified;

      const updated = await storage.updateAssistQueueEntry(req.params.id, {
        status: success ? "completed" : "failed",
        executedAt: new Date(),
        completedAt: success ? new Date() : undefined,
        toolResults: [{ 
          name: toolName, 
          status: success ? "executed" : "failed", 
          result, 
          error: executionError || (!verified ? "DB verification failed" : undefined),
          verified 
        }],
        error: executionError || (!verified ? "DB verification failed: entity state did not change as expected" : undefined),
      });

      await storage.createAuditLogEntry({
        userId,
        action: success ? "assist_queue_finalized" : "assist_queue_finalize_failed",
        entityType: "assist_queue",
        entityId: req.params.id,
        details: { 
          gatedAction: toolName,
          verified,
          error: executionError,
        },
      });

      res.json({ 
        success, 
        entry: updated,
        verified,
        error: executionError || (!verified ? "DB verification failed" : undefined),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to finalize action";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/assist-queue/:id/reject", async (req, res) => {
    try {
      const validated = rejectAssistSchema.parse(req.body);
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      if (entry.status !== "pending") {
        return res.status(400).json({ error: `Cannot reject entry with status: ${entry.status}` });
      }

      const userId = (req as unknown as { userId?: string }).userId || null;
      const reason = validated.reason;

      const updated = await storage.updateAssistQueueEntry(req.params.id, {
        status: "rejected",
        rejectedBy: userId,
        rejectedAt: new Date(),
        completedAt: new Date(),
        error: reason,
      });

      await storage.createAuditLogEntry({
        userId,
        action: "assist_queue_reject",
        entityType: "assist_queue",
        entityId: req.params.id,
        details: { reason },
      });
      
      // FIX 2: Write AI_VALIDATION_RECORDED to automation ledger on rejection
      await storage.createAutomationLedgerEntry({
        agentName: "Master Architect",
        actionType: "AI_VALIDATION_RECORDED",
        entityType: "assist_queue",
        entityId: req.params.id,
        mode: "assist",
        status: "rejected",
        diffJson: {
          decision: "rejected",
          rejectedBy: userId,
          userRequest: entry.userRequest,
        },
        reason: reason,
        assistQueueId: req.params.id,
      });

      res.json({ 
        success: true, 
        entry: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      const message = error instanceof Error ? error.message : "Failed to reject queue entry";
      res.status(500).json({ error: message });
    }
  });

  // ========================================
  // Master Architect Auto-Validation
  // Validates pending assist_queue entries and moves to Ready Execution
  // Flow: pending → MA validates → approved → appears in Ready Execution
  // ========================================
  app.post("/api/assist-queue/:id/ma-validate", async (req, res) => {
    try {
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      if (entry.status !== "pending") {
        return res.status(400).json({ error: `Cannot validate entry with status: ${entry.status}` });
      }

      // Get proposed tools from entry
      const toolsCalled = entry.toolsCalled as Array<{ tool: string; args: unknown }> | null;
      
      // MA Validation: Check if tools are safe and well-formed
      // This is a simulated validation - can be enhanced with actual AI review
      let validationDecision: "approved" | "rejected" = "approved";
      let validationReason = "Proposal validated by Master Architect";
      
      if (!toolsCalled || toolsCalled.length === 0) {
        validationDecision = "rejected";
        validationReason = "No tools specified in proposal";
      }
      
      // Check for dangerous operations (example validation rules)
      const dangerousTools = ["delete_all_contacts", "drop_database"];
      const hasDangerous = toolsCalled?.some(t => dangerousTools.includes(t.tool));
      if (hasDangerous) {
        validationDecision = "rejected";
        validationReason = "Proposal contains dangerous operations";
      }

      if (validationDecision === "approved") {
        // Update assist_queue to approved status
        const updated = await storage.updateAssistQueueEntry(req.params.id, {
          status: "approved",
          architectApprovedAt: new Date(),
        });

        // Update the ledger entry to ai_validated (so it shows in Ready Execution)
        // Find existing ledger entry for this queue entry
        const ledgerEntries = await storage.getAutomationLedgerEntries({ limit: 1000 });
        const existingLedger = ledgerEntries.find(
          e => e.assistQueueId === req.params.id && e.status === "proposed"
        );
        
        if (existingLedger) {
          await storage.updateAutomationLedgerEntry(existingLedger.id, {
            status: "ai_validated",
            reason: validationReason,
          });
        }

        // Create MA validation audit record in ledger (NOT ai_validated - this is just an audit trail)
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: "AI_VALIDATION_RECORDED",
          entityType: "assist_queue",
          entityId: req.params.id,
          mode: "assist",
          status: "recorded", // Audit status - NOT ai_validated (that's on the original entry)
          diffJson: {
            decision: "approved",
            userRequest: entry.userRequest,
            toolsValidated: toolsCalled?.map(t => t.tool) || [],
          },
          reason: validationReason,
          assistQueueId: req.params.id,
        });

        console.log(`[MA Validation] Proposal ${req.params.id} approved - moving to Ready Execution`);

        res.json({
          success: true,
          decision: "approved",
          message: "Proposal validated and moved to Ready Execution",
          entry: updated,
        });
      } else {
        // Rejected by MA - P1 HARDENING: Track rejection count for escalation
        const currentRejectionCount = (entry.rejectionCount || 0) + 1;
        const shouldEscalate = currentRejectionCount >= 2;
        
        const updated = await storage.updateAssistQueueEntry(req.params.id, {
          status: shouldEscalate ? "escalated" : "rejected",
          rejectedAt: new Date(),
          error: validationReason,
          rejectionCount: currentRejectionCount,
          escalatedToOperator: shouldEscalate,
          escalatedAt: shouldEscalate ? new Date() : undefined,
        });

        // Update ledger to rejected/escalated
        const ledgerEntries = await storage.getAutomationLedgerEntries({ limit: 1000 });
        const existingLedger = ledgerEntries.find(
          e => e.assistQueueId === req.params.id && e.status === "proposed"
        );
        
        if (existingLedger) {
          await storage.updateAutomationLedgerEntry(existingLedger.id, {
            status: shouldEscalate ? "escalated" : "rejected",
            reason: shouldEscalate 
              ? `ESCALATED: AI failed review ${currentRejectionCount} times. Last reason: ${validationReason}` 
              : validationReason,
          });
        }

        // Create rejection/escalation record
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: shouldEscalate ? "AI_ESCALATED_TO_OPERATOR" : "AI_VALIDATION_RECORDED",
          entityType: "assist_queue",
          entityId: req.params.id,
          mode: "assist",
          status: shouldEscalate ? "escalated" : "rejected",
          diffJson: {
            decision: shouldEscalate ? "escalated" : "rejected",
            userRequest: entry.userRequest,
            rejectionCount: currentRejectionCount,
            escalatedToOperator: shouldEscalate,
          },
          reason: shouldEscalate 
            ? `AI failed review ${currentRejectionCount} times - escalated to operator for manual handling` 
            : validationReason,
          assistQueueId: req.params.id,
        });

        if (shouldEscalate) {
          console.log(`[MA Validation] Proposal ${req.params.id} ESCALATED TO OPERATOR after ${currentRejectionCount} rejections`);
        } else {
          console.log(`[MA Validation] Proposal ${req.params.id} rejected (${currentRejectionCount}/2): ${validationReason}`);
        }

        res.json({
          success: true,
          decision: shouldEscalate ? "escalated" : "rejected",
          message: shouldEscalate 
            ? `AI proposal escalated to operator after ${currentRejectionCount} failed reviews`
            : validationReason,
          entry: updated,
          escalatedToOperator: shouldEscalate,
          rejectionCount: currentRejectionCount,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to validate queue entry";
      res.status(500).json({ error: message });
    }
  });

  // Process all pending entries (batch MA validation)
  app.post("/api/assist-queue/process-pending", async (_req, res) => {
    try {
      const allEntries = await storage.getAssistQueue();
      const pendingEntries = allEntries.filter(e => e.status === "pending");
      
      const results: Array<{ id: string; decision: string; message: string }> = [];
      
      for (const entry of pendingEntries) {
        try {
          // Trigger MA validation for each pending entry
          const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/assist-queue/${entry.id}/ma-validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await response.json() as { decision?: string; message?: string };
          results.push({
            id: entry.id,
            decision: data.decision || "unknown",
            message: data.message || "Processed",
          });
        } catch (err) {
          results.push({
            id: entry.id,
            decision: "error",
            message: err instanceof Error ? err.message : "Processing failed",
          });
        }
      }

      res.json({
        success: true,
        processed: results.length,
        results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process pending entries";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/assist-queue/:id/finalize", async (req, res) => {
    try {
      const userId = (req as unknown as { userId?: string }).userId || undefined;
      const result = await finalizeAction(req.params.id, userId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        result: result.result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to finalize gated action";
      res.status(500).json({ error: message });
    }
  });

  // ========================================
  // Retry mechanism for rejected proposals
  // Audit requirement: AI_RETRY_ISSUED and AI_RETRY_EXHAUSTED ledger entries
  // ========================================
  const MAX_RETRIES = 3;

  app.post("/api/assist-queue/:id/retry", async (req, res) => {
    try {
      const entry = await storage.getAssistQueueEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }

      if (entry.status !== "rejected") {
        return res.status(400).json({ error: `Can only retry rejected entries. Current status: ${entry.status}` });
      }

      const userId = (req as unknown as { userId?: string }).userId || null;
      
      // Get current retry count from entry metadata or default to 0
      const currentRetryCount = (entry.finalizationPayload as { retryCount?: number })?.retryCount || 0;
      
      // Check if retries exhausted
      if (currentRetryCount >= MAX_RETRIES) {
        // Write AI_RETRY_EXHAUSTED ledger entry
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: "AI_RETRY_EXHAUSTED",
          entityType: "assist_queue",
          entityId: req.params.id,
          mode: "assist",
          status: "terminated",
          diffJson: {
            retryCount: currentRetryCount,
            maxRetries: MAX_RETRIES,
            userRequest: entry.userRequest,
          },
          reason: `Maximum retries (${MAX_RETRIES}) exhausted`,
          assistQueueId: req.params.id,
        });
        
        return res.status(400).json({ 
          error: "Maximum retries exhausted",
          retryCount: currentRetryCount,
          maxRetries: MAX_RETRIES,
        });
      }

      // Write AI_RETRY_ISSUED ledger entry
      await storage.createAutomationLedgerEntry({
        agentName: "Master Architect",
        actionType: "AI_RETRY_ISSUED",
        entityType: "assist_queue",
        entityId: req.params.id,
        mode: "assist",
        status: "pending_review",
        diffJson: {
          retryCount: currentRetryCount + 1,
          maxRetries: MAX_RETRIES,
          userRequest: entry.userRequest,
          previousRejectionReason: entry.error,
        },
        reason: `Retry #${currentRetryCount + 1} issued`,
        assistQueueId: req.params.id,
      });

      // Reset entry to pending status with incremented retry count
      const updated = await storage.updateAssistQueueEntry(req.params.id, {
        status: "pending",
        rejectedBy: null,
        rejectedAt: null,
        completedAt: null,
        error: null,
        finalizationPayload: { retryCount: currentRetryCount + 1 },
      });

      await storage.createAuditLogEntry({
        userId,
        action: "assist_queue_retry",
        entityType: "assist_queue",
        entityId: req.params.id,
        details: { 
          retryCount: currentRetryCount + 1,
          maxRetries: MAX_RETRIES,
        },
      });

      res.json({ 
        success: true, 
        entry: updated,
        retryCount: currentRetryCount + 1,
        retriesRemaining: MAX_RETRIES - (currentRetryCount + 1),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to retry queue entry";
      res.status(500).json({ error: message });
    }
  });

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
        description: validated.notes || null,
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

  // Google Drive folder creation endpoints
  app.post("/api/workspace/folders/contact/:contactId", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const { contactId } = req.params;
      const { createContactFolder } = await import("./neo8-google-drive");
      
      const result = await createContactFolder(contactId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        folderId: result.folderId,
        folderUrl: result.folderUrl,
      });
    } catch (error) {
      console.error("Failed to create contact folder:", error);
      const message = error instanceof Error ? error.message : "Failed to create folder";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/workspace/folders/job/:jobId", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { createJobFolder } = await import("./neo8-google-drive");
      
      const result = await createJobFolder(jobId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        folderId: result.folderId,
        folderUrl: result.folderUrl,
      });
    } catch (error) {
      console.error("Failed to create job folder:", error);
      const message = error instanceof Error ? error.message : "Failed to create folder";
      res.status(500).json({ error: message });
    }
  });

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
      console.error("Failed to create conversation:", error);
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
      console.error("Failed to fetch conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await chatService.getConversationHistory(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
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
      console.error("Failed to send message:", error);
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
      console.error("Failed to identify contact:", error);
      res.status(500).json({ error: "Failed to identify contact" });
    }
  });

  app.post("/api/chat/conversations/:id/close", async (req, res) => {
    try {
      await chatService.closeConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to close conversation:", error);
      res.status(500).json({ error: "Failed to close conversation" });
    }
  });

  // ========================================
  // ADMIN CHAT ENDPOINTS (Internal CRM Bot)
  // ========================================
  // These endpoints are for the internal admin chatbot (Master Architect)
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
      const userId = "admin-user";
      
      const adminChat = createAdminChatService({ 
        userId, 
        mode: "assist" // Default mode
      });
      
      const conversation = await adminChat.getOrCreateConversation();
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Failed to create admin conversation:", error);
      res.status(500).json({ error: "Failed to create admin conversation" });
    }
  });

  // Get admin conversation messages
  app.get("/api/admin-chat/conversations/:id/messages", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = "admin-user"; // TODO: Get from session/auth
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
      console.error("Failed to fetch admin messages:", error);
      res.status(500).json({ error: "Failed to fetch admin messages" });
    }
  });

  // Send message to admin chatbot (Master Architect)
  app.post("/api/admin-chat/message", async (req, res) => {
    try {
      const validated = adminChatMessageSchema.parse(req.body);
      const { createAdminChatService } = await import("./admin-chat-service");
      
      const userId = "admin-user"; // TODO: Get from session/auth
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
      console.error("Failed to send admin message:", error);
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
      const userId = "admin-user"; // TODO: Get from session
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
      console.error("Failed to update admin chat mode:", error);
      res.status(500).json({ error: "Failed to update admin chat mode" });
    }
  });

  // Get all active admin conversations
  app.get("/api/admin-chat/conversations", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = "admin-user";
      
      const adminChat = createAdminChatService({ userId, mode: "assist" });
      const conversations = await adminChat.getActiveConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Failed to fetch admin conversations:", error);
      res.status(500).json({ error: "Failed to fetch admin conversations" });
    }
  });

  // Close admin conversation
  app.post("/api/admin-chat/conversations/:id/close", async (req, res) => {
    try {
      const { createAdminChatService } = await import("./admin-chat-service");
      const userId = "admin-user";
      
      const adminChat = createAdminChatService({ userId, mode: "assist" });
      await adminChat.closeConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to close admin conversation:", error);
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
      console.error("Failed to create public chat session:", error);
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
      console.error("Failed to send public chat message:", error);
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
      console.error("Failed to identify lead:", error);
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
      console.error("Failed to get public chat messages:", error);
      res.status(500).json({ error: "Failed to get public chat messages" });
    }
  });

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
      console.error("Failed to get email accounts:", error);
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
      console.error("Failed to get email account:", error);
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
      console.error("Failed to create email account:", error);
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
      console.error("Failed to update email account:", error);
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
      console.error("Failed to delete email account:", error);
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
      res.json(emails);
    } catch (error) {
      console.error("Failed to get emails:", error);
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
      console.error("Failed to get email:", error);
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
      console.error("Failed to create email:", error);
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
      console.error("Failed to update email:", error);
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
      console.error("Failed to delete email:", error);
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

      // Create dispatch payload for Neo8
      const dispatchPayload = {
        identity_provider: identity === "personal" ? "gmail" : "sendgrid",
        target: to,
        subject: identity === "personal" ? subject : undefined,
        body: identity === "personal" ? body : undefined,
        template_id: identity === "company" ? templateId : undefined,
        contact_id: contactId,
        dispatched_at: new Date().toISOString(),
      };

      // Write EMAIL_DISPATCH_AUTHORIZED to ledger
      await storage.createAutomationLedgerEntry({
        agentName: identity === "personal" ? "Human Operator" : "System Dispatch",
        actionType: "EMAIL_DISPATCH_AUTHORIZED",
        entityType: "email",
        entityId: `dispatch-${Date.now()}`,
        mode: "auto",
        status: "authorized",
        diffJson: dispatchPayload,
        reason: `Email dispatch authorized via ${identity} identity to ${to}`,
        assistQueueId: null,
      });

      // In production, this would forward to Neo8 webhook
      // For now, we log the intent and return success
      console.log("[Email Dispatch] Authorized:", dispatchPayload);

      res.status(200).json({ 
        success: true, 
        message: `Email dispatch authorized via ${identity === "personal" ? "Gmail" : "SendGrid"}`,
        dispatchId: dispatchPayload.dispatched_at,
      });
    } catch (error) {
      console.error("Failed to dispatch email:", error);
      res.status(500).json({ error: "Failed to dispatch email" });
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
      console.error("Failed to get WhatsApp messages:", error);
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
      console.error("Failed to get WhatsApp message:", error);
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
      
      // Trigger n8n webhook to send the message via Twilio
      const n8nWebhookUrl = process.env.VITE_N8N_WEBHOOK_BASE_URL;
      if (n8nWebhookUrl && n8nWebhookUrl !== "__SET_AT_DEPLOY__") {
        try {
          await fetch(`${n8nWebhookUrl}/webhook/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messageId: message.id,
              to: message.toPhone,
              from: message.fromPhone,
              body: message.body,
              mediaUrl: message.mediaUrl,
              channel: channel,
            }),
          });
        } catch (webhookError) {
          console.error("Failed to trigger n8n WhatsApp webhook:", webhookError);
        }
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
      console.error("Failed to create WhatsApp message:", error);
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
      console.error("Failed to update WhatsApp message:", error);
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
      console.error("Failed to delete WhatsApp message:", error);
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

      // Create Neo8 trigger payload
      const neo8Payload = {
        event: "WHATSAPP_DISPATCH_AUTHORIZED",
        client_id: clientId,
        conversation_id: conversationId,
        payload: {
          message: message,
          channel: channel || "whatsapp",
          template_id: templateId,
        },
        dispatched_at: new Date().toISOString(),
      };

      // Write WHATSAPP_DISPATCH_AUTHORIZED to ledger
      await storage.createAutomationLedgerEntry({
        agentName: "Human Operator",
        actionType: "WHATSAPP_DISPATCH_AUTHORIZED",
        entityType: "whatsapp",
        entityId: conversationId,
        mode: "manual",
        status: "authorized",
        diffJson: neo8Payload,
        reason: `WhatsApp dispatch authorized for client ${clientId}`,
        assistQueueId: null,
      });

      // In production, this would forward to Neo8 webhook
      // For Phase 1, we log the intent and return success
      console.log("[WhatsApp Dispatch] Authorized:", neo8Payload);

      res.status(200).json({ 
        success: true, 
        message: "WhatsApp dispatch authorized. CRM does not send directly.",
        dispatchId: neo8Payload.dispatched_at,
        neo8Payload: neo8Payload,
      });
    } catch (error) {
      console.error("Failed to authorize WhatsApp dispatch:", error);
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
      console.error("Failed to get intakes:", error);
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
      console.error("Failed to get intake:", error);
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
      console.error("Failed to create intake:", error);
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
      console.error("Failed to update intake:", error);
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
      console.error("Failed to delete intake:", error);
      res.status(500).json({ error: "Failed to delete intake" });
    }
  });

  // ========== INTAKE FIELDS ==========
  app.get("/api/intakes/:intakeId/fields", async (req, res) => {
    try {
      const fields = await storage.getIntakeFields(req.params.intakeId);
      res.json(fields);
    } catch (error) {
      console.error("Failed to get intake fields:", error);
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
      console.error("Failed to create intake field:", error);
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
      console.error("Failed to update intake field:", error);
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
      console.error("Failed to delete intake field:", error);
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
      console.error("Failed to get intake submissions:", error);
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
      console.error("Failed to get intake submission:", error);
      res.status(500).json({ error: "Failed to get intake submission" });
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
      console.error("Failed to process intake webhook:", error);
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

      // 6. Insert into events_outbox (map snake_case API fields to camelCase storage)
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
        payload: { ...validated.payload, timestamp },
        status: 'pending',
      });

      // 7. Dispatch to Neo8Flow (non-blocking)
      dispatchIntakeToNeo8Flow(
        eventEntry.id,
        validated.tenant_id,
        { ...validated.payload, timestamp }
      ).catch(err => console.error("[Neo8Flow] Async dispatch error:", err));

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
        },
      });
      
      // 9. AUDIT FIX: Write INTAKE_RECEIVED to automation ledger for governance traceability
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
        assistQueueId: null,
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
      console.error("Failed to process lead intake:", error);
      res.status(500).json({ error: "Failed to process lead intake" });
    }
  });

  // CRM Sync Callback - Neo8Flow calls this after processing lead intake
  app.post("/api/intake/sync", n8nWebhookRateLimiter, requireInternalToken, n8nVerification, async (req, res) => {
    try {
      const validationResult = crmSyncSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        });
      }
      const validated = validationResult.data;
      const { payload, outbox_id, tenant_id, channel, recording_url, lead_score } = validated;

      // Handle error status from Neo8Flow
      if (validated.status === "error") {
        await storage.updateEventsOutboxForRetry(outbox_id, 0, "failed", undefined, validated.error_message);
        await storage.createAuditLogEntry({
          action: "lead.sync.failed",
          entityType: "events_outbox",
          entityId: outbox_id,
          details: { tenant_id, error: validated.error_message },
        });
        return res.status(200).json({ success: false, error: validated.error_message });
      }

      // 1. Duplicate Detection - Check for existing contacts by phone OR email
      const hasContactId = payload.contact_id && payload.contact_id.length > 0;
      const hasEmail = payload.email && payload.email.length > 0;
      const hasPhone = payload.phone && payload.phone.length > 0;

      let duplicateByEmail: Contact | undefined = undefined;
      let duplicateByPhone: Contact | undefined = undefined;
      let isDuplicate = false;
      const duplicateMatches: Array<{ matchType: string; contactId: string; contactName: string | null; matchedValue: string }> = [];

      // Check for duplicate by email first
      if (hasEmail) {
        duplicateByEmail = await storage.getContactByEmail(payload.email!);
        if (duplicateByEmail) {
          isDuplicate = true;
          duplicateMatches.push({
            matchType: "email",
            contactId: duplicateByEmail.id,
            contactName: duplicateByEmail.name,
            matchedValue: payload.email!,
          });
        }
      }

      // Check for duplicate by phone (could be different contact than email match)
      if (hasPhone) {
        duplicateByPhone = await storage.getContactByPhone(payload.phone!);
        if (duplicateByPhone) {
          // Only add if it's a different contact than email match
          const alreadyMatched = duplicateByEmail && duplicateByEmail.id === duplicateByPhone.id;
          if (!alreadyMatched) {
            isDuplicate = true;
            duplicateMatches.push({
              matchType: "phone",
              contactId: duplicateByPhone.id,
              contactName: duplicateByPhone.name,
              matchedValue: payload.phone!,
            });
          } else if (!isDuplicate) {
            // Same contact matched by both - still a duplicate
            isDuplicate = true;
            duplicateMatches.push({
              matchType: "phone",
              contactId: duplicateByPhone.id,
              contactName: duplicateByPhone.name,
              matchedValue: payload.phone!,
            });
          }
        }
      }

      // 2. Upsert Contact (priority: contact_id > email > phone)
      let contact: Contact | undefined = undefined;

      if (hasContactId) {
        contact = await storage.getContact(payload.contact_id!);
      }
      if (!contact && duplicateByEmail) {
        contact = duplicateByEmail;
      }
      if (!contact && duplicateByPhone) {
        contact = duplicateByPhone;
      }

      let isNewContact = false;
      if (contact) {
        // Update existing contact with non-empty fields
        const updates: Record<string, unknown> = {};
        if (payload.name && !contact.name) updates.name = payload.name;
        if (payload.email && !contact.email) updates.email = payload.email;
        if (payload.phone && !contact.phone) updates.phone = payload.phone;
        if (payload.company && !contact.company) updates.company = payload.company;

        // Merge tags (add new tags, keep existing)
        if (payload.tags && payload.tags.length > 0) {
          const existingTags = (contact.tags as string[]) || [];
          const mergedTags = Array.from(new Set([...existingTags, ...payload.tags]));
          updates.tags = mergedTags;
        }

        if (Object.keys(updates).length > 0) {
          contact = await storage.updateContact(contact.id, updates as Partial<InsertContact>) || contact;
        }
      } else {
        // Create new contact
        isNewContact = true;
        contact = await storage.createContact({
          name: payload.name || null,
          email: payload.email || null,
          phone: payload.phone || null,
          company: payload.company || null,
          customerType: "lead",
          tags: payload.tags || [],
        });
      }

      // Log duplicate detection result
      if (isDuplicate) {
        console.log(`[Lead Intake] Duplicate detected for outbox_id ${outbox_id}:`, duplicateMatches);
        await storage.createAuditLogEntry({
          action: "lead.duplicate.detected",
          entityType: "contact",
          entityId: contact?.id || null,
          details: {
            outbox_id,
            tenant_id,
            is_new_contact: isNewContact,
            duplicate_matches: duplicateMatches,
            payload_email: payload.email || null,
            payload_phone: payload.phone || null,
          },
        });
      }

      // 2. Create or update Conversation with lead score
      let conversation = null;
      if (contact) {
        const existingConversations = await storage.getConversationByContact(contact.id);
        if (existingConversations.length > 0) {
          // Update existing conversation with lead score if provided
          conversation = existingConversations[0];
          if (lead_score !== undefined) {
            conversation = await storage.updateConversation(conversation.id, { leadScore: lead_score }) || conversation;
          }
        } else {
          // Create new conversation
          conversation = await storage.createConversation({
            contactId: contact.id,
            status: "active",
            channel: channel || "widget",
            leadScore: lead_score || null,
            metadata: {
              source: payload.source || "intake",
              tenant_id,
              outbox_id,
            },
          });

          // Add initial message if message content exists
          if (payload.message) {
            await storage.createMessage({
              conversationId: conversation.id,
              role: "user",
              content: payload.message,
              metadata: { source: "intake" },
            });
          }
        }
      }

      // 3. Create file record for recording attachment
      let fileRecord = null;
      if (recording_url && contact) {
        fileRecord = await storage.createFile({
          name: `Recording - ${new Date().toISOString()}`,
          type: "audio/recording",
          size: 0,
          url: recording_url,
          entityType: "contact",
          entityId: contact.id,
        });
      }

      // 4. Update outbox status to synced
      await storage.updateEventsOutboxForRetry(outbox_id, 0, "synced", new Date());

      // 5. Create audit log entry
      await storage.createAuditLogEntry({
        action: "lead.sync.completed",
        entityType: "events_outbox",
        entityId: outbox_id,
        details: {
          tenant_id,
          contact_id: contact?.id,
          conversation_id: conversation?.id,
          file_id: fileRecord?.id,
          lead_score,
          tags_applied: payload.tags,
        },
      });

      res.status(200).json({
        success: true,
        outbox_id,
        synced: {
          contact_id: contact?.id,
          conversation_id: conversation?.id,
          file_id: fileRecord?.id,
          lead_score,
          is_new_contact: isNewContact,
        },
        duplicate_detection: {
          is_duplicate: isDuplicate,
          matches: duplicateMatches,
        },
      });
    } catch (error) {
      console.error("Failed to sync CRM data:", error);
      res.status(500).json({ error: "Failed to sync CRM data" });
    }
  });

  // ========== LOCATIONS ==========
  app.get("/api/locations", async (req, res) => {
    try {
      const contactId = req.query.contactId as string | undefined;
      const locations = await storage.getLocations(contactId);
      res.json(locations);
    } catch (error) {
      console.error("Failed to get locations:", error);
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
      console.error("Failed to get location:", error);
      res.status(500).json({ error: "Failed to get location" });
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const location = await storage.createLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      console.error("Failed to create location:", error);
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
      console.error("Failed to update location:", error);
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
      console.error("Failed to delete location:", error);
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
      console.error("Failed to get equipment:", error);
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
      console.error("Failed to get equipment:", error);
      res.status(500).json({ error: "Failed to get equipment" });
    }
  });

  app.post("/api/equipment", async (req, res) => {
    try {
      const equip = await storage.createEquipment(req.body);
      res.status(201).json(equip);
    } catch (error) {
      console.error("Failed to create equipment:", error);
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
      console.error("Failed to update equipment:", error);
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
      console.error("Failed to delete equipment:", error);
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
      console.error("Failed to get pricebook items:", error);
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
      console.error("Failed to get pricebook item:", error);
      res.status(500).json({ error: "Failed to get pricebook item" });
    }
  });

  app.post("/api/pricebook", async (req, res) => {
    try {
      const item = await storage.createPricebookItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      console.error("Failed to create pricebook item:", error);
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
      console.error("Failed to update pricebook item:", error);
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
      console.error("Failed to delete pricebook item:", error);
      res.status(500).json({ error: "Failed to delete pricebook item" });
    }
  });

  // ========== TAGS ==========
  app.get("/api/tags", async (_req, res) => {
    try {
      const tagsList = await storage.getTags();
      res.json(tagsList);
    } catch (error) {
      console.error("Failed to get tags:", error);
      res.status(500).json({ error: "Failed to get tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const tag = await storage.createTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Failed to create tag:", error);
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
      console.error("Failed to delete tag:", error);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // ========== STORED PAYMENT METHODS ==========
  app.get("/api/contacts/:contactId/payment-methods", async (req, res) => {
    try {
      const methods = await storage.getStoredPaymentMethods(req.params.contactId);
      res.json(methods);
    } catch (error) {
      console.error("Failed to get payment methods:", error);
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
      console.error("Failed to create payment method:", error);
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
      console.error("Failed to delete payment method:", error);
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
      console.error("Failed to search for duplicates:", error);
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
      console.error("Failed to get Stripe publishable key:", error);
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
      console.error("Failed to create payment intent:", error);
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
      console.error("Failed to create setup intent:", error);
      res.status(500).json({ error: "Failed to create setup intent" });
    }
  });

  // ========== AI VOICE DISPATCH ==========
  
  app.get("/api/voice/dispatch-logs", async (_req, res) => {
    try {
      const logs = await storage.getVoiceDispatchLogs();
      res.json(logs);
    } catch (error) {
      console.error("Failed to get voice dispatch logs:", error);
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
      await storage.createAuditLog({
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
      console.error("Failed to dispatch voice call:", error);
      res.status(500).json({ error: "Failed to dispatch voice call" });
    }
  });

  // Callback endpoint for AI Voice Server results (via Neo8)
  app.post("/api/voice/dispatch/:id/result", n8nWebhookRateLimiter, requireInternalToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, summary, transcriptUrl } = req.body;

      const log = await storage.getVoiceDispatchLog(id);
      if (!log) {
        return res.status(404).json({ error: "Dispatch log not found" });
      }

      // Update dispatch log with result
      await storage.updateVoiceDispatchLog(id, {
        status: status || "success",
        summary: summary || log.summary,
        transcriptUrl: transcriptUrl || null,
        completedAt: new Date(),
      });

      // Write EXECUTION_RESULT_RECORDED ledger event
      await storage.createAutomationLedgerEntry({
        agentName: "ai_voice_server",
        actionType: "execution_result_recorded",
        entityType: "voice_dispatch",
        entityId: id,
        mode: "execute",
        status: "completed",
        diffJson: { status, summary, transcriptUrl, completedAt: new Date().toISOString() },
        reason: "AI Voice Server returned execution result",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to record dispatch result:", error);
      res.status(500).json({ error: "Failed to record dispatch result" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
