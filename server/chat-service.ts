/**
 * Chat Service - TEMPORARY STUB
 * 
 * TODO: Reimplement with proper AI integration
 * This stub exists to prevent build errors during refactoring
 */
import { storage } from "./storage";
import type { Conversation, Message } from "@shared/schema";

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

  async sendMessage(
    conversationId: string,
    contactId: string | null,
    content: string
  ): Promise<ChatResponse> {
    // TODO: Implement with OpenAI API + validator
    const message = await storage.createMessage({
      conversationId,
      role: "assistant",
      content: "AI chat is temporarily disabled during system refactoring.",
    });

    return { message, conversationId };
  }
}

export const chatService = new ChatService();
