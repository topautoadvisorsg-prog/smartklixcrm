import { storage } from "./storage";
import { MasterArchitect, AgentMode, AgentResponse } from "./master-architect";
import { AIMemorySystem } from "./ai-memory";
import type { Message, Conversation, Contact } from "@shared/schema";

// Type for conversation history that matches MasterArchitect's expected format
type ConversationMessage = { role: "system" | "user" | "assistant"; content: string };

const memorySystem = new AIMemorySystem(storage);

export interface AdminChatConfig {
  userId: string;
  mode: AgentMode;
}

export class AdminChatService {
  private userId: string;
  private mode: AgentMode;

  constructor(config: AdminChatConfig) {
    this.userId = config.userId;
    this.mode = config.mode;
  }

  /**
   * Get or create admin conversation for the current user
   * SECURITY: Always filters by userId to prevent cross-user conversation access
   */
  async getOrCreateConversation(): Promise<Conversation> {
    const existing = await storage.getConversations();
    
    // CRITICAL: Must check all three conditions to prevent cross-user access
    const adminConv = existing.find(
      (c) => 
        c.channel === "admin_chat" && 
        c.status === "active" &&
        (c.metadata as Record<string, unknown>)?.userId === this.userId
    );

    if (adminConv) {
      return adminConv;
    }

    // SECURITY: Always create with userId in metadata
    return await storage.createConversation({
      contactId: null,
      channel: "admin_chat",
      status: "active",
      metadata: { 
        userId: this.userId,
        createdVia: "admin_dashboard" 
      },
    });
  }

  /**
   * Send a message to the admin chatbot and get AI response
   */
  async sendMessage(params: {
    conversationId: string;
    message: string;
    contactId?: string | null;
  }): Promise<{ message: Message; aiResponse: AgentResponse }> {
    const { conversationId, message: userMessage, contactId } = params;

    // Store user message
    const userMessageRecord = await storage.createMessage({
      conversationId,
      role: "user",
      content: userMessage,
      metadata: { source: "admin_dashboard", userId: this.userId },
    });

    // Get conversation history for context
    const history = await this.getConversationHistory(conversationId);

    // Build memory context if we have a contact
    let memoryContext = "";
    if (contactId) {
      try {
        const contact = await storage.getContact(contactId);
        if (contact) {
          memoryContext = await this.buildMemoryContext(contact, userMessage);
        }
      } catch (error) {
        console.error("Failed to build memory context:", error);
      }
    }

    // Build conversation history for Master Architect (typed to match expected format)
    const conversationHistory: ConversationMessage[] = history
      .slice(-10) // Last 10 messages for context
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Augment user message with memory context if available
    const augmentedMessage = memoryContext
      ? `${userMessage}\n\n=== Customer Context ===\n${memoryContext}`
      : userMessage;

    // Call Master Architect with positional args: (mode, systemPrompt, userId, history, channel)
    const architect = new MasterArchitect(
      this.mode,
      undefined, // Use default system prompt from DB config
      this.userId,
      conversationHistory,
      "crm_chat" // Admin chat uses CRM chat channel
    );

    const aiResponse = await architect.chat(augmentedMessage);

    // Store AI response
    const assistantMessageRecord = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: aiResponse.message,
      metadata: {
        source: "master_architect",
        mode: this.mode,
        toolCalls: aiResponse.toolCalls,
        reflectionScore: aiResponse.reflectionScore,
        plan: aiResponse.plan,
      },
    });

    // Create memory from this interaction if we have a contact
    if (contactId && history.length >= 4) {
      const recentMessages = [...history.slice(-5), userMessageRecord, assistantMessageRecord];
      await this.createMemoryFromConversation(
        recentMessages,
        conversationId,
        contactId
      ).catch((error) => {
        console.error("Failed to create memory:", error);
      });
    }

    return {
      message: assistantMessageRecord,
      aiResponse,
    };
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId: string): Promise<Message[]> {
    return await storage.getMessages(conversationId);
  }

  /**
   * Build memory context for a contact
   */
  private async buildMemoryContext(contact: Contact, query: string): Promise<string> {
    try {
      // Search for relevant memories
      const relevantMemories = await memorySystem.searchSimilarMemories(query, {
        contactId: contact.id,
        limit: 5,
        minSimilarity: 0.6,
      });

      if (relevantMemories.length === 0) {
        return "";
      }

      // Build context from memories
      const memoryLines = relevantMemories.map((result) => {
        const mem = result.entry;
        const importance = "⭐".repeat(Math.ceil(mem.importance / 2));
        const summary = mem.summary || mem.content.substring(0, 100);
        return `${importance} [${new Date(mem.createdAt).toLocaleDateString()}] ${summary}`;
      });

      return `Customer: ${contact.name || contact.email || contact.phone}
${memoryLines.join("\n")}`;
    } catch (error) {
      console.error("Error building memory context:", error);
      return "";
    }
  }

  /**
   * Create a memory from conversation
   */
  private async createMemoryFromConversation(
    messages: Message[],
    conversationId: string,
    contactId: string,
    importance: number = 5
  ): Promise<void> {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    await memorySystem.createMemoryWithEmbedding({
      contactId,
      conversationId,
      content: conversationText,
      importance,
      metadata: {
        source: "admin_chat",
        messageCount: messages.length,
      },
    });
  }

  /**
   * Get all active admin conversations
   */
  async getActiveConversations(): Promise<Conversation[]> {
    const conversations = await storage.getConversations();
    return conversations.filter(
      (c) => c.channel === "admin_chat" && c.status === "active"
    );
  }

  /**
   * Close a conversation
   */
  async closeConversation(conversationId: string): Promise<void> {
    await storage.updateConversation(conversationId, {
      status: "closed",
    });
  }

  /**
   * Update agent mode for this session
   */
  setMode(mode: AgentMode): void {
    this.mode = mode;
  }

  /**
   * Get current agent mode
   */
  getMode(): AgentMode {
    return this.mode;
  }
}

/**
 * Create admin chat service instance
 */
export function createAdminChatService(config: AdminChatConfig): AdminChatService {
  return new AdminChatService(config);
}
