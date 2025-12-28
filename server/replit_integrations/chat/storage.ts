import { db } from "../../db";
import { conversations, messages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Conversation, Message } from "@shared/schema";

export interface IChatStorage {
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(conversationId: string, role: string, content: string): Promise<Message>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: string) {
    if (!db) throw new Error("Database not initialized");
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getAllConversations() {
    if (!db) throw new Error("Database not initialized");
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string) {
    if (!db) throw new Error("Database not initialized");
    const [conversation] = await db.insert(conversations).values({ 
      channel: "crm_chat",
      status: "active",
    }).returning();
    return conversation;
  },

  async deleteConversation(id: string) {
    if (!db) throw new Error("Database not initialized");
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: string) {
    if (!db) throw new Error("Database not initialized");
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: string, role: string, content: string) {
    if (!db) throw new Error("Database not initialized");
    const [message] = await db.insert(messages).values({ 
      conversationId, 
      role, 
      content 
    }).returning();
    return message;
  },
};
