/**
 * Public Chat Service - TEMPORARY STUB
 * 
 * TODO: Reimplement with proper AI integration + validator
 */
import { storage } from "./storage";
import type { Conversation, Message } from "@shared/schema";

export interface PublicChatResponse {
  message: Message;
  conversationId: string;
}

export class PublicChatService {
  async sendMessage(
    sessionId: string,
    content: string
  ): Promise<PublicChatResponse> {
    // TODO: Implement with OpenAI API + validator
    // For now, create a temporary conversation and return stub response
    const conversation = await storage.createConversation({
      contactId: null,
      channel: "public",
      status: "active",
      metadata: { sessionId },
    });

    const message = await storage.createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "AI chat is temporarily disabled during system refactoring.",
    });

    return { message, conversationId: conversation.id };
  }
}
