/**
 * Chat Service - Widget AI Integration
 * 
 * This service handles the public chat widget endpoints. All AI calls route through
 * the Master Architect with "widget" channel for unified execution and tool permissions.
 * 
 * NOTE: The public-chat-service.ts provides a more secure session-based approach.
 * Consider migrating the ChatWidget to use /api/public-chat/* endpoints in the future.
 */
import { storage } from "./storage";
import { MasterArchitect } from "./master-architect";
import { AIMemorySystem, createMemoryFromMessages } from "./ai-memory";
import type { Conversation, Message, Contact } from "@shared/schema";

const memorySystem = new AIMemorySystem(storage);

// Type for conversation history that matches MasterArchitect's expected format
type ConversationMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: Message;
  conversationId: string;
}

export class ChatService {
  async getOrCreateConversation(
    contactId: string | null,
    channel: string = "widget"
  ): Promise<Conversation> {
    if (contactId) {
      const existing = await storage.getConversationByContact(contactId);
      const active = existing.find(c => c.status === "active" && c.channel === channel);
      if (active) {
        return active;
      }
    }

    return await storage.createConversation({
      contactId,
      channel,
      status: "active",
      metadata: { createdVia: "chat_widget" },
    });
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    return await storage.getMessages(conversationId);
  }

  /**
   * Send a message in the chat widget, routing through Master Architect
   * Uses "widget" channel with restricted tool permissions for public safety
   */
  async sendMessage(params: {
    conversationId: string;
    contactId: string | null;
    userMessage: string;
    systemPrompt?: string;
  }): Promise<ChatResponse> {
    const { conversationId, contactId, userMessage, systemPrompt } = params;

    const userMessageRecord = await storage.createMessage({
      conversationId,
      role: "user",
      content: userMessage,
      metadata: { source: "chat_widget" },
    });

    const history = await this.getConversationHistory(conversationId);

    // Build memory context if we have a contact
    let memoryContext = "";
    if (contactId) {
      try {
        memoryContext = await memorySystem.buildContextFromMemories(contactId, userMessage);
      } catch (error) {
        console.error("Failed to build memory context:", error);
      }
    }

    // Build conversation history for Master Architect
    const conversationHistory: ConversationMessage[] = history
      .slice(-10)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Augment user message with memory context if available
    const augmentedMessage = memoryContext
      ? `${userMessage}\n\n=== Customer Context ===\n${memoryContext}`
      : userMessage;

    // Build widget-specific system prompt
    const widgetSystemPrompt = systemPrompt || this.getDefaultSystemPrompt("");

    let aiResponse: string;
    try {
      // Route through Master Architect with "widget" channel for unified execution
      // Widget channel has restricted tool permissions (read-only, no CRM mutations)
      const architect = new MasterArchitect(
        "draft", // Widget always uses draft mode (suggestions only)
        widgetSystemPrompt,
        null, // No userId for public widget
        conversationHistory,
        "widget" // Widget channel with restricted permissions
      );

      const response = await architect.chat(augmentedMessage);
      aiResponse = response.message;
    } catch (error) {
      console.error("Master Architect error in chat widget:", error);
      aiResponse = "I'm experiencing technical difficulties. Please try again in a moment.";
    }

    const assistantMessageRecord = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: aiResponse,
      metadata: { source: "master_architect", channel: "widget" },
    });

    // Create memory from conversation if we have a contact
    if (contactId && history.length >= 4) {
      const recentMessages = history.slice(-6);
      await createMemoryFromMessages(
        recentMessages.map((m) => ({ role: m.role, content: m.content })),
        conversationId,
        contactId,
        memorySystem,
        5
      ).catch((error) => {
        console.error("Failed to create memory:", error);
      });
    }

    return {
      message: assistantMessageRecord,
      conversationId,
    };
  }

  async identifyContact(params: {
    conversationId: string;
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<Contact> {
    const { conversationId, name, email, phone } = params;

    let contact: Contact | undefined;
    
    if (phone) {
      contact = await storage.getContactByPhone(phone);
    }
    
    if (!contact && email) {
      const allContacts = await storage.getContacts();
      contact = allContacts.find(c => c.email === email);
    }

    if (!contact) {
      contact = await storage.createContact({
        name: name || null,
        email: email || null,
        phone: phone || null,
        status: "new",
        avatar: null,
      });
    } else if (name || email || phone) {
      const updates: { name?: string; email?: string; phone?: string } = {};
      if (name && !contact.name) updates.name = name;
      if (email && !contact.email) updates.email = email;
      if (phone && !contact.phone) updates.phone = phone;
      
      if (Object.keys(updates).length > 0) {
        const updated = await storage.updateContact(contact.id, updates);
        if (updated) contact = updated;
      }
    }

    await storage.updateConversation(conversationId, {
      contactId: contact.id,
    });

    return contact;
  }

  private getDefaultSystemPrompt(context: string): string {
    return `You are a helpful customer service assistant for a field service business. You help customers with HVAC, plumbing, electrical, and general home service needs.

Be friendly, professional, and concise. Ask clarifying questions when needed. If the customer needs to schedule service, collect:
- Type of service needed
- Brief description of the issue
- Preferred date/time
- Contact information (name, phone, email)

${context ? `\n=== Customer History ===\n${context}\n` : ""}

Keep responses under 100 words unless providing detailed instructions.`;
  }

  async closeConversation(conversationId: string): Promise<void> {
    await storage.updateConversation(conversationId, {
      status: "closed",
    });
  }

  async getActiveConversations(contactId: string): Promise<Conversation[]> {
    const conversations = await storage.getConversationByContact(contactId);
    return conversations.filter(c => c.status === "active");
  }
}

export const chatService = new ChatService();
