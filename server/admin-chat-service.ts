/**
 * Admin Chat Service - TEMPORARY STUB
 * 
 * TODO: Reimplement with proper AI integration + validator
 */
import { storage } from "./storage";
import type { Conversation, Message } from "@shared/schema";

export interface AdminChatResponse {
  message: Message;
  conversationId: string;
}

export function createAdminChatService() {
  return {
    async sendMessage(
      conversationId: string,
      userId: string,
      content: string
    ): Promise<AdminChatResponse> {
      // TODO: Implement with OpenAI API + validator
      const message = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: "AI assistant is temporarily disabled during system refactoring.",
      });

      return { message, conversationId };
    },
  };
}
