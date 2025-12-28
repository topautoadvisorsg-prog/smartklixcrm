import { storage } from "./storage";
import { randomBytes } from "crypto";
import { MasterArchitect, AIChannel, ToolPermission, MAContext } from "./master-architect";
import type { Message, Conversation, Contact } from "@shared/schema";

const WIDGET_SYSTEM_PROMPT = `You are a friendly customer service assistant for a field service business.

Your role is to:
1. Greet customers warmly
2. Answer common questions about services
3. Help collect lead information (name, email, phone, service needed)
4. Schedule appointments or consultations
5. Provide helpful information about the business

IMPORTANT LIMITATIONS:
- You CANNOT access customer records or CRM data
- You CANNOT create estimates or invoices
- You CANNOT schedule actual appointments (just collect interest)
- You CAN ask qualifying questions and gather lead information

Be helpful, professional, and guide the conversation toward collecting lead information.`;

export interface PublicChatConfig {
  widgetId?: string;
  welcomeMessage?: string;
}

export interface LeadIdentification {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
}

export class PublicChatService {
  private config: PublicChatConfig;

  constructor(config: PublicChatConfig = {}) {
    this.config = config;
  }

  /**
   * Create a new public chat session
   * Returns session token for anonymous access
   */
  async createSession(params?: { contactId?: string; metadata?: Record<string, unknown> }): Promise<{ 
    conversation: Conversation; 
    sessionToken: string;
    welcomeMessage?: Message;
  }> {
    const sessionToken = this.generateSessionToken();

    const conversation = await storage.createConversation({
      contactId: params?.contactId || null,
      channel: "public_widget",
      status: "active",
      sessionToken,
      metadata: {
        widgetId: this.config.widgetId,
        source: "public_widget",
        ...params?.metadata,
      },
    });

    let welcomeMessage: Message | undefined;
    if (this.config.welcomeMessage) {
      welcomeMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: this.config.welcomeMessage,
        metadata: { type: "welcome" },
      });
    }

    return { conversation, sessionToken, welcomeMessage };
  }

  /**
   * Send a message in a public chat session
   * Routes through Master Architect for unified AI processing
   */
  async sendMessage(params: {
    sessionToken: string;
    message: string;
  }): Promise<{ userMessage: Message; aiResponse: Message }> {
    const { sessionToken, message: userMessage } = params;

    const conversations = await storage.getConversations();
    const conversation = conversations.find(
      (c) => c.sessionToken === sessionToken && c.channel === "public_widget"
    );

    if (!conversation) {
      throw new Error("Invalid session");
    }

    const userMessageRecord = await storage.createMessage({
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
      metadata: { source: "public_widget" },
    });

    const messages = await storage.getMessages(conversation.id);
    
    const aiResponseText = await this.generateResponse(messages, conversation);

    const aiMessage = await storage.createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: aiResponseText,
      metadata: { source: "master_architect", channel: "widget" },
    });

    await storage.updateConversation(conversation.id, {
      lastMessageAt: new Date(),
    });

    await storage.createAuditLogEntry({
      userId: null,
      action: "public_widget_message",
      entityType: "conversation",
      entityId: conversation.id,
      details: {
        sessionToken: sessionToken.substring(0, 10) + "...",
        userMessage,
        aiResponse: aiResponseText,
        channel: "widget",
      },
    });

    return { userMessage: userMessageRecord, aiResponse: aiMessage };
  }

  /**
   * Identify a lead - convert anonymous session to known contact
   * Creates or updates contact record
   */
  async identifyLead(params: {
    sessionToken: string;
    lead: LeadIdentification;
  }): Promise<{ contact: Contact; conversation: Conversation }> {
    const { sessionToken, lead } = params;

    const conversations = await storage.getConversations();
    const conversation = conversations.find(
      (c) => c.sessionToken === sessionToken && c.channel === "public_widget"
    );

    if (!conversation) {
      throw new Error("Invalid session");
    }

    const allContacts = await storage.getContacts();
    let contact: Contact | undefined;
    
    if (lead.phone) {
      contact = allContacts.find((c) => c.phone === lead.phone);
    }
    
    if (!contact && lead.email) {
      contact = allContacts.find((c) => c.email === lead.email);
    }

    let finalContact: Contact;
    if (contact) {
      const updated = await storage.updateContact(contact.id, {
        name: lead.name || contact.name,
        email: lead.email || contact.email,
        phone: lead.phone || contact.phone,
        company: lead.company || contact.company,
      });
      if (!updated) throw new Error("Failed to update contact");
      finalContact = updated;
    } else {
      finalContact = await storage.createContact({
        name: lead.name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        company: lead.company || null,
        status: "new",
      });
    }

    const updatedConversation = await storage.updateConversation(conversation.id, {
      contactId: finalContact.id,
      status: "identified",
      metadata: {
        ...(conversation.metadata as Record<string, unknown>),
        identifiedAt: new Date().toISOString(),
        leadMessage: lead.message,
      },
    });
    
    if (!updatedConversation) {
      throw new Error("Failed to update conversation");
    }

    if (lead.message) {
      await storage.createJob({
        title: `New lead from ${finalContact.name || finalContact.email || finalContact.phone || "website"}`,
        clientId: finalContact.id,
        description: lead.message,
        status: "lead_intake",
        jobType: "lead",
      });
    }

    return { contact: finalContact, conversation: updatedConversation };
  }

  /**
   * Generate AI response using Master Architect
   * Routes through unified pipeline with widget channel and restricted tools
   */
  private async generateResponse(
    messages: Message[],
    conversation: Conversation
  ): Promise<string> {
    try {
      const conversationHistory = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      // Build structured context for Master Architect
      const lastUserMessage = messages.filter(m => m.role === "user").pop();
      const maContext: MAContext = {
        channel: "widget",
        companyName: null, // Widget doesn't have company context by default
        userId: null,
        contactId: conversation.contactId?.toString() || null,
        jobId: null,
        intakeId: null,
        conversationId: conversation.id.toString(),
        rawMessage: lastUserMessage?.content || "",
        origin: "system", // Widget chat is system-originated (external visitor)
      };

      // Get edgeAgentPrompt from AI Settings if available
      const aiSettings = await storage.getAiSettings();
      const systemPrompt = aiSettings?.edgeAgentPrompt || WIDGET_SYSTEM_PROMPT;

      const architect = new MasterArchitect(
        "auto",
        systemPrompt,
        null,
        conversationHistory,
        "widget" as AIChannel,
        maContext
      );

      const restrictedToolPermissions: Record<string, ToolPermission> = {
        create_contact: { enabled: false, allowedModes: [] },
        update_contact: { enabled: false, allowedModes: [] },
        search_contacts: { enabled: false, allowedModes: [] },
        get_contact_details: { enabled: false, allowedModes: [] },
        create_job: { enabled: false, allowedModes: [] },
        update_job_status: { enabled: false, allowedModes: [] },
        search_jobs: { enabled: false, allowedModes: [] },
        add_note: { enabled: false, allowedModes: [] },
        schedule_appointment: { enabled: false, allowedModes: [] },
        create_estimate: { enabled: false, allowedModes: [] },
        accept_estimate: { enabled: false, allowedModes: [] },
        reject_estimate: { enabled: false, allowedModes: [] },
        send_estimate: { enabled: false, allowedModes: [] },
        create_invoice: { enabled: false, allowedModes: [] },
        send_invoice: { enabled: false, allowedModes: [] },
        record_payment: { enabled: false, allowedModes: [] },
        assign_technician: { enabled: false, allowedModes: [] },
        start_job: { enabled: false, allowedModes: [] },
        complete_job: { enabled: false, allowedModes: [] },
      };

      architect.setChannelToolPermissions(restrictedToolPermissions);

      const response = await architect.chat(lastUserMessage?.content || "");

      return response.message;
    } catch (error) {
      console.error("Public chat AI error:", error);
      return this.getFallbackResponse(messages);
    }
  }

  /**
   * Fallback response when AI is not available
   */
  private getFallbackResponse(messages: Message[]): string {
    const lastMessage = messages[messages.length - 1];
    const text = lastMessage?.content.toLowerCase() || "";

    if (text.includes("hello") || text.includes("hi")) {
      return "Hello! Thanks for reaching out. How can I help you today?";
    }
    if (text.includes("price") || text.includes("cost")) {
      return "I'd be happy to help you get pricing information! To provide an accurate quote, could you share some details about what service you're interested in?";
    }
    if (text.includes("schedule") || text.includes("appointment")) {
      return "I can help you schedule a consultation! Please share your name, phone number, and preferred time, and someone from our team will contact you shortly.";
    }
    
    return "Thanks for your message! To better assist you, could you share your name and contact information? Someone from our team will get back to you right away.";
  }

  /**
   * Generate secure session token
   */
  private generateSessionToken(): string {
    return `pub_${randomBytes(32).toString("hex")}`;
  }

  /**
   * Get session by token (for validation)
   */
  async getSessionByToken(sessionToken: string): Promise<Conversation | null> {
    const conversations = await storage.getConversations();
    return conversations.find(
      (c) => c.sessionToken === sessionToken && c.channel === "public_widget"
    ) || null;
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(sessionToken: string): Promise<Message[]> {
    const conversation = await this.getSessionByToken(sessionToken);
    if (!conversation) {
      throw new Error("Invalid session");
    }
    return storage.getMessages(conversation.id);
  }
}
