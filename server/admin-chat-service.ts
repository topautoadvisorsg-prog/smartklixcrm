/**
 * Admin Chat Service - Master Architect with Validator Integration
 * 
 * This service handles AI chat interactions for the admin panel.
 * CRITICAL: All tool executions MUST go through reviewProposal() from validator.ts
 * before being executed or queued.
 */

import { reviewProposal, ValidationProposal, type ValidationDecision } from "./validator";
import { aiToolDefinitions, toOpenAITools, isReadOnlyTool } from "./ai-tools";
import { storage } from "./storage";
import { buildSystemInstructions } from "./ai-prompts";
import { nanoid } from "nanoid";
import type { Message, InsertMessage, Conversation } from "../shared/schema";
import type { InsertStagedProposal } from "../shared/schema";

// OpenAI client is initialized lazily to avoid issues if OPENAI_API_KEY is not set
let openaiClient: import("openai").OpenAI | null = null;

function getOpenAIClient(): import("openai").OpenAI {
  if (!openaiClient) {
    const OpenAI = require("openai").OpenAI;
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "__SET_AT_DEPLOY__",
    });
  }
  return openaiClient!;
}

interface AdminChatConfig {
  userId: string;
  mode: "draft" | "assist" | "auto";
}

interface SendMessageParams {
  conversationId: string;
  message: string;
  contactId?: string;
}

interface SendMessageResponse {
  message: Message;
  actions?: Array<{
    tool: string;
    status: "executed" | "queued" | "rejected";
    result?: unknown;
    reason?: string;
  }>;
}

// Tool name mapping for validator
function mapToolToValidatorAction(toolName: string): string {
  // Map tool names to validator action names
  const mapping: Record<string, string> = {
    create_contact: "create_contact",
    update_contact: "update_contact",
    search_contacts: "search_contacts",
    get_contact_details: "view_contact",
    create_job: "create_job",
    update_job: "update_job",
    add_note: "add_note",
    create_estimate: "create_estimate",
    create_invoice: "create_invoice",
    schedule_appointment: "schedule_appointment",
    send_email: "send_email",
    send_sms: "send_sms",
  };
  return mapping[toolName] || toolName;
}

// Determine target entity from tool name and args
function getTargetFromTool(toolName: string, args: Record<string, unknown>): { target: string; targetId?: string } {
  if (toolName.includes("contact")) {
    return { target: "contact", targetId: (args.contactId as string) || (args.id as string) };
  }
  if (toolName.includes("job")) {
    return { target: "job", targetId: (args.jobId as string) || (args.id as string) };
  }
  if (toolName.includes("invoice")) {
    return { target: "invoice", targetId: (args.invoiceId as string) || (args.id as string) };
  }
  if (toolName.includes("estimate")) {
    return { target: "estimate", targetId: (args.estimateId as string) || (args.id as string) };
  }
  if (toolName.includes("appointment")) {
    return { target: "appointment", targetId: (args.appointmentId as string) };
  }
  if (toolName.includes("note")) {
    return { target: "note", targetId: (args.entityId as string) };
  }
  return { target: "crm" };
}

// Execute a tool directly (for approved low-risk actions)
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (toolName) {
      case "create_contact": {
        const contact = await storage.createContact({
          name: String(args.name),
          email: args.email ? String(args.email) : null,
          phone: args.phone ? String(args.phone) : null,
          company: args.company ? String(args.company) : null,
          status: (args.status as string) || "new",
        });
        await storage.createAuditLogEntry({
          userId,
          action: "create_contact",
          entityType: "contact",
          entityId: contact.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: contact };
      }

      case "update_contact": {
        const contactId = String(args.contactId);
        const existing = await storage.getContact(contactId);
        if (!existing) {
          return { success: false, error: "Contact not found" };
        }
        const updates: Record<string, unknown> = {};
        if (args.name !== undefined) updates.name = String(args.name);
        if (args.email !== undefined) updates.email = String(args.email);
        if (args.phone !== undefined) updates.phone = String(args.phone);
        if (args.company !== undefined) updates.company = String(args.company);
        if (args.status !== undefined) updates.status = String(args.status);
        
        const contact = await storage.updateContact(contactId, updates);
        await storage.createAuditLogEntry({
          userId,
          action: "update_contact",
          entityType: "contact",
          entityId: contactId,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: contact };
      }

      case "search_contacts": {
        const allContacts = await storage.getContacts();
        const query = String(args.query || "").toLowerCase().trim();
        if (!query) {
          return { success: true, data: allContacts };
        }
        const filtered = allContacts.filter(c => {
          const nameMatch = c.name?.toLowerCase().includes(query) ?? false;
          const emailMatch = c.email?.toLowerCase().includes(query) ?? false;
          const phoneMatch = c.phone?.includes(query) ?? false;
          return nameMatch || emailMatch || phoneMatch;
        });
        return { success: true, data: filtered };
      }

      case "get_contact_details": {
        const contactId = String(args.contactId);
        const contact = await storage.getContact(contactId);
        if (!contact) {
          return { success: false, error: "Contact not found" };
        }
        const [jobs, estimates, invoices] = await Promise.all([
          storage.getJobs(),
          storage.getEstimates(),
          storage.getInvoices(),
        ]);
        return {
          success: true,
          data: {
            contact,
            jobs: jobs.filter(j => j.clientId === contactId),
            estimates: estimates.filter(e => e.contactId === contactId),
            invoices: invoices.filter(i => i.contactId === contactId),
          },
        };
      }

      case "create_job": {
        const job = await storage.createJob({
          title: String(args.title),
          description: args.description ? String(args.description) : null,
          status: (args.status as string) || "lead_intake",
          clientId: String(args.contactId),
        });
        await storage.createAuditLogEntry({
          userId,
          action: "create_job",
          entityType: "job",
          entityId: job.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: job };
      }

      case "update_job": {
        const jobId = String(args.jobId);
        const existing = await storage.getJob(jobId);
        if (!existing) {
          return { success: false, error: "Job not found" };
        }
        const updates: Record<string, unknown> = {};
        if (args.title !== undefined) updates.title = String(args.title);
        if (args.description !== undefined) updates.description = String(args.description);
        if (args.status !== undefined) updates.status = String(args.status);
        if (args.value !== undefined) updates.value = String(args.value);
        
        const job = await storage.updateJob(jobId, updates);
        await storage.createAuditLogEntry({
          userId,
          action: "update_job",
          entityType: "job",
          entityId: jobId,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: job };
      }

      case "add_note": {
        const note = await storage.createNote({
          title: String(args.title || "Note"),
          entityType: String(args.entityType) as "contact" | "job",
          entityId: String(args.entityId),
          content: String(args.content),
        });
        await storage.createAuditLogEntry({
          userId,
          action: "add_note",
          entityType: "note",
          entityId: note.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: note };
      }

      case "create_estimate": {
        const estimate = await storage.createEstimate({
          contactId: String(args.contactId),
          jobId: args.jobId ? String(args.jobId) : null,
          lineItems: args.lineItems as Array<{
            description: string;
            quantity: number;
            unit_price: number;
            total: number;
          }>,
          subtotal: String(args.subtotal),
          taxTotal: String(args.taxAmount),
          totalAmount: String(args.totalAmount),
          validUntil: args.validUntil ? new Date(String(args.validUntil)) : null,
          notes: args.notes ? String(args.notes) : null,
          status: "draft",
        });
        await storage.createAuditLogEntry({
          userId,
          action: "create_estimate",
          entityType: "estimate",
          entityId: estimate.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: estimate };
      }

      case "create_invoice": {
        const invoice = await storage.createInvoice({
          jobId: String(args.jobId),
          contactId: String(args.contactId),
          lineItems: args.lineItems as Array<{
            description: string;
            quantity: number;
            unit_price: number;
            total: number;
          }>,
          subtotal: String(args.subtotal),
          taxTotal: String(args.taxAmount),
          totalAmount: String(args.totalAmount),
          dueAt: args.dueDate ? new Date(String(args.dueDate)) : null,
          notes: args.notes ? String(args.notes) : null,
          status: "draft",
        });
        await storage.createAuditLogEntry({
          userId,
          action: "create_invoice",
          entityType: "invoice",
          entityId: invoice.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: invoice };
      }

      case "schedule_appointment": {
        const appointment = await storage.createAppointment({
          title: String(args.title || "Appointment"),
          contactId: args.contactId ? String(args.contactId) : null,
          scheduledAt: new Date(String(args.scheduledAt)),
          duration: (args.duration as number) || 60,
          notes: args.notes ? String(args.notes) : null,
          status: "scheduled",
        });
        await storage.createAuditLogEntry({
          userId,
          action: "schedule_appointment",
          entityType: "appointment",
          entityId: appointment.id,
          details: { source: "admin_chat_ai", args },
        });
        return { success: true, data: appointment };
      }

      default:
        return { success: false, error: `Tool "${toolName}" execution not implemented` };
    }
  } catch (error) {
    console.error(`[AdminChat] Tool execution error for ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Queue a tool for human approval
async function queueToolForApproval(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  conversationId: string,
  validationDecision: ValidationDecision
): Promise<string> {
  const { target, targetId } = getTargetFromTool(toolName, args);
  
  // Generate correlation ID for tracing across systems
  const correlationId = crypto.randomUUID();
  
  const proposalData: InsertStagedProposal = {
    status: "pending",
    actions: [{ tool: toolName, args }],
    reasoning: validationDecision.reason || `AI requested to execute: ${toolName}`,
    riskLevel: validationDecision.riskLevel || "medium",
    summary: `Admin chat: ${toolName}`,
    relatedEntity: { type: target, id: targetId || null },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    userId,
    origin: "admin_chat",
    userRequest: `AI requested to execute: ${toolName}`,
    validatorDecision: validationDecision.decision,
    validatorReason: validationDecision.reason,
    requiresApproval: true,
    mode: "assist",
    correlationId,
  };

  const queueEntry = await storage.createStagedProposal(proposalData);

  await storage.createAuditLogEntry({
    userId,
    action: "ai_action_queued",
    entityType: "admin_chat",
    entityId: conversationId,
    details: {
      toolName,
      args,
      proposalId: queueEntry.id,
      correlationId,
      validationResult: validationDecision,
      reason: "Action requires human approval",
    },
  });

  return queueEntry.id;
}

export function createAdminChatService(config: AdminChatConfig) {
  const { userId, mode } = config;

  return {
    async getOrCreateConversation(): Promise<Conversation> {
      // Look for existing active conversation for this user
      const allConversations = await storage.getConversations();
      const userConversation = allConversations.find(c => {
        const metadata = (c.metadata as Record<string, unknown>) || {};
        return metadata.userId === userId && c.status === "active";
      });

      if (userConversation) {
        return userConversation;
      }

      // Create new conversation
      const newConversation = await storage.createConversation({
        status: "active",
        channel: "widget",
        metadata: {
          userId,
          mode: mode || "assist",
          type: "admin_chat",
        },
      });

      return newConversation;
    },

    async getActiveConversations(): Promise<Conversation[]> {
      const allConversations = await storage.getConversations();
      return allConversations.filter(c => {
        const metadata = (c.metadata as Record<string, unknown>) || {};
        return metadata.userId === userId && c.status === "active";
      });
    },

    async getConversationHistory(conversationId: string): Promise<Message[]> {
      return storage.getMessages(conversationId);
    },

    async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
      const { conversationId, message, contactId } = params;

      // P0 HARDENING: Check kill switch BEFORE any AI execution
      const aiSettings = await storage.getAiSettings();
      if (aiSettings?.killSwitchActive) {
        throw new Error("AI execution is currently disabled by kill switch");
      }

      // 1. Store user message
      const userMessage = await storage.createMessage({
        conversationId,
        role: "user",
        content: message,
        senderType: "operator",
        metadata: contactId ? { contactId } : {},
      });

      // 2. Get conversation history for context
      const history = await storage.getMessages(conversationId);
      const recentMessages = history.slice(-20); // Last 20 messages for context

      // 3. Build system prompt
      // Use action AI base prompt for admin chat (full CRM capabilities)
      const systemPrompt = buildSystemInstructions("crm_agent", null) + 
        `\n\n## CURRENT MODE\nYou are operating in "${mode}" mode. ` +
        (mode === "draft" 
          ? "Suggest actions but do not execute them automatically."
          : mode === "assist"
          ? "Execute low-risk actions automatically, but queue medium/high-risk actions for approval."
          : "Execute all approved actions automatically.");

      // 4. Prepare messages for OpenAI
      const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
        ...recentMessages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // 5. Get available tools (only internal CRM tools)
      const availableTools = aiToolDefinitions.filter(tool => {
        // Only include immediate-tier tools for admin chat
        // Gated tools should go through validator
        return tool.tier === "immediate" || tool.tier === "gated";
      });

      // 6. Call OpenAI
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools: toOpenAITools(availableTools),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 2000,
      });

      const assistantMessage = completion.choices[0].message;

      // 7. Handle tool calls
      const actionResults: Array<{
        tool: string;
        status: "executed" | "queued" | "rejected";
        result?: unknown;
        reason?: string;
      }> = [];

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Process each tool call through validator
        for (const toolCall of assistantMessage.tool_calls) {
          // Type assertion for function property which exists at runtime
          const toolFunction = (toolCall as unknown as { function: { name: string; arguments: string } }).function;
          const toolName = toolFunction.name;
          let toolArgs: Record<string, unknown>;
          
          try {
            toolArgs = JSON.parse(toolFunction.arguments);
          } catch {
            actionResults.push({
              tool: toolName,
              status: "rejected",
              reason: "Invalid tool arguments",
            });
            continue;
          }

          // Determine if tool is read-only
          const isReadOnly = isReadOnlyTool(toolName);

          // Build validation proposal
          const { target, targetId } = getTargetFromTool(toolName, toolArgs);
          const validationAction = mapToolToValidatorAction(toolName);
          
          const proposal: ValidationProposal = {
            action: validationAction,
            target,
            targetId,
            summary: `AI requested to ${toolName.replace(/_/g, " ")} via admin chat`,
            payload: toolArgs,
            reasoning: `User request: "${message}"`,
            requestedBy: "ai_admin_chat",
          };

          // Run validator
          const validationResult = reviewProposal(proposal);

          // Handle based on validation result and mode
          if (validationResult.decision === "reject") {
            // Tool rejected by validator
            actionResults.push({
              tool: toolName,
              status: "rejected",
              reason: validationResult.reason,
            });
            
            await storage.createAuditLogEntry({
              userId,
              action: "ai_action_rejected",
              entityType: "admin_chat",
              entityId: conversationId,
              details: {
                toolName,
                args: toolArgs,
                reason: validationResult.reason,
              },
            });
          } else if (isReadOnly || (validationResult.decision === "approve" && !validationResult.requiresHumanApproval)) {
            // Low-risk or read-only tool - execute immediately
            const result = await executeTool(toolName, toolArgs, userId);
            
            if (result.success) {
              actionResults.push({
                tool: toolName,
                status: "executed",
                result: result.data,
              });
            } else {
              actionResults.push({
                tool: toolName,
                status: "rejected",
                reason: result.error,
              });
            }
          } else {
            // Medium/high risk or needs approval - queue it
            const queueId = await queueToolForApproval(
              toolName,
              toolArgs,
              userId,
              conversationId,
              validationResult
            );
            
            actionResults.push({
              tool: toolName,
              status: "queued",
              reason: `Queued for approval (Proposal ID: ${queueId})`,
            });
          }
        }

        // Generate follow-up message based on action results
        const executedCount = actionResults.filter(a => a.status === "executed").length;
        const queuedCount = actionResults.filter(a => a.status === "queued").length;
        const rejectedCount = actionResults.filter(a => a.status === "rejected").length;

        let followUpContent = "";
        if (executedCount > 0 && queuedCount === 0 && rejectedCount === 0) {
          followUpContent = `I've completed the requested action(s).`;
        } else if (queuedCount > 0) {
          followUpContent = `I've queued ${queuedCount} action(s) for your approval. Please check the Review Queue to review and approve them.`;
        } else if (rejectedCount > 0) {
          followUpContent = `I wasn't able to complete the action(s). ${actionResults.find(a => a.status === "rejected")?.reason || ""}`;
        } else {
          followUpContent = assistantMessage.content || "I've processed your request.";
        }

        // Store assistant response
        const assistantResponse = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: followUpContent,
          senderType: "operator",
          metadata: {
            actions: actionResults,
            hasToolCalls: true,
          },
        });

        return {
          message: assistantResponse,
          actions: actionResults,
        };
      }

      // No tool calls - regular response
      const assistantResponse = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: assistantMessage.content || "I'm not sure how to help with that.",
        senderType: "operator",
        metadata: {},
      });

      return {
        message: assistantResponse,
      };
    },

    async closeConversation(conversationId: string): Promise<void> {
      // Update conversation status to closed
      await storage.updateConversation(conversationId, {
        status: "closed",
        metadata: { closedAt: new Date().toISOString(), closedBy: userId },
      });
    },
  };
}
