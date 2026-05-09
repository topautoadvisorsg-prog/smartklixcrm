import type { Express } from "express";
import { storage } from "../storage";
import { dispatchEmail, dispatchWhatsApp } from "../agent-dispatcher";
import { z } from "zod";

export function registerCommunicationsRoutes(app: Express) {
  // ========== EMAIL ACCOUNTS ==========
  app.get("/api/email-accounts", async (req, res) => {
    try {
      const accounts = await storage.getEmailAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Failed to get email accounts:", error);
      res.status(500).json({ error: "Failed to get email accounts" });
    }
  });

  app.post("/api/email-accounts", async (req, res) => {
    try {
      const validated = z.object({
        emailAddress: z.string().email(),
        displayName: z.string(),
      }).parse(req.body);
      
      const account = await storage.createEmailAccount({
        ...validated,
        status: "active",
      });
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to create email account:", error);
      res.status(500).json({ error: "Failed to create email account" });
    }
  });

  // ========== EMAILS ==========
  app.get("/api/emails", async (req, res) => {
    try {
      const emails = await storage.getEmails();
      res.json(emails);
    } catch (error) {
      console.error("Failed to get emails:", error);
      res.status(500).json({ error: "Failed to get emails" });
    }
  });

  // Email Dispatch - Uses unified agent dispatcher
  app.post("/api/emails/dispatch", async (req, res) => {
    try {
      const { identity, to, subject, body, templateId, contactId } = req.body;
      
      if (!identity || !to) {
        return res.status(400).json({ error: "Missing required fields: identity, to" });
      }
      
      if (identity === "personal" && (!subject || !body)) {
        return res.status(400).json({ error: "Personal emails require subject and body" });
      }
      
      if (identity === "company" && !templateId) {
        return res.status(400).json({ error: "Company emails require templateId" });
      }

      const correlationId = crypto.randomUUID();
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

      console.log("[Email Dispatch] Authorized:", { to, identity, correlationId });

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

        console.log("[Email Dispatch] Dispatched via agent gateway:", dispatchResult);

        res.status(200).json({ 
          success: true, 
          message: `Email dispatched via ${identity === "personal" ? "Gmail" : "SendGrid"}`,
          dispatchId,
          correlationId: dispatchResult.correlationId,
        });
      } catch (dispatchError) {
        console.error("[Email Dispatch] Agent dispatch failed:", dispatchError);
        
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
      console.error("Failed to dispatch email:", error);
      res.status(500).json({ error: "Failed to dispatch email" });
    }
  });

  // ========== WHATSAPP MESSAGES ==========
  app.get("/api/whatsapp", async (req, res) => {
    try {
      const messages = await storage.getWhatsappMessages();
      res.json(messages);
    } catch (error) {
      console.error("Failed to get WhatsApp messages:", error);
      res.status(500).json({ error: "Failed to get WhatsApp messages" });
    }
  });

  // WhatsApp Dispatch - Uses unified agent dispatcher
  app.post("/api/whatsapp/dispatch", async (req, res) => {
    try {
      const { clientId, conversationId, message, channel, templateId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ 
          error: "Client ID is mandatory", 
          detail: "No Client ID = No dispatch. This is non-negotiable." 
        });
      }
      
      if (!conversationId) {
        return res.status(400).json({ 
          error: "Conversation ID is required", 
          detail: "All messages must be tied to a conversation lifecycle." 
        });
      }
      
      if (!message && !templateId) {
        return res.status(400).json({ 
          error: "Message or template required", 
          detail: "Either a message body or templateId must be provided." 
        });
      }

      const correlationId = crypto.randomUUID();

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

      console.log("[WhatsApp Dispatch] Authorized:", { clientId, conversationId, correlationId });

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

        console.log("[WhatsApp Dispatch] Dispatched via agent gateway:", dispatchResult);

        res.status(200).json({ 
          success: true, 
          message: "WhatsApp dispatch authorized and sent to agent gateway",
          correlationId: dispatchResult.correlationId,
        });
      } catch (dispatchError) {
        console.error("[WhatsApp Dispatch] Agent dispatch failed:", dispatchError);
        
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
      console.error("Failed to authorize WhatsApp dispatch:", error);
      res.status(500).json({ error: "Failed to authorize WhatsApp dispatch" });
    }
  });

  // Inbound WhatsApp webhook
  app.post("/api/whatsapp/inbound", async (req, res) => {
    try {
      const { From, Body, MessageSid } = req.body;
      
      console.log("[WhatsApp Inbound] Message received:", { From, Body, MessageSid });
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Failed to process inbound WhatsApp:", error);
      res.status(500).json({ error: "Failed to process inbound WhatsApp" });
    }
  });
}
