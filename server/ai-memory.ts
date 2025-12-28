import OpenAI from "openai";
import type { MemoryEntry, InsertMemoryEntry } from "@shared/schema";
import { IStorage } from "./storage";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.");
    }
    openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openai;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export class AIMemorySystem {
  constructor(private storage: IStorage) {}

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not set, skipping embedding generation");
      return null;
    }

    try {
      const response = await getOpenAI().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      return null;
    }
  }

  async summarizeContent(content: string): Promise<string | null> {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      return null;
    }

    if (content.length < 100) {
      return content;
    }

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates concise summaries of conversation excerpts. Keep summaries under 100 words and preserve key facts, names, and context.",
          },
          {
            role: "user",
            content: `Summarize this conversation excerpt:\n\n${content}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error("Error generating summary:", error);
      return null;
    }
  }

  async createMemoryWithEmbedding(
    params: Omit<InsertMemoryEntry, "embedding" | "summary">
  ): Promise<MemoryEntry> {
    const embedding = await this.generateEmbedding(params.content);
    const summary = await this.summarizeContent(params.content);

    return await this.storage.createMemoryEntry({
      ...params,
      embedding: (embedding ? `[${embedding.join(',')}]` : null) as any,
      summary,
    });
  }

  async searchSimilarMemories(
    query: string,
    options: {
      contactId?: string;
      conversationId?: string;
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<MemorySearchResult[]> {
    const { contactId, conversationId, limit = 10, minSimilarity = 0.6 } = options;
    
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) {
      console.warn("Could not generate query embedding, falling back to text search");
      const textResults = await this.storage.searchMemory(query, contactId);
      return textResults.map(entry => ({ entry, similarity: 0.5 }));
    }

    const results = await this.storage.searchMemorySimilarity(
      queryEmbedding,
      contactId,
      conversationId,
      limit
    );

    return results.filter(r => r.similarity >= minSimilarity);
  }

  async getRecentMemories(
    contactId: string,
    limit: number = 20
  ): Promise<MemoryEntry[]> {
    const allMemories = await this.storage.getMemoryEntries(undefined, contactId);
    return allMemories
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getImportantMemories(
    contactId: string,
    minImportance: number = 7,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    const allMemories = await this.storage.getMemoryEntries(undefined, contactId);
    return allMemories
      .filter(m => m.importance >= minImportance)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async buildContextFromMemories(
    contactId: string,
    currentQuery: string
  ): Promise<string> {
    const [similar, recent, important] = await Promise.all([
      this.searchSimilarMemories(currentQuery, { contactId, limit: 5 }),
      this.getRecentMemories(contactId, 10),
      this.getImportantMemories(contactId, 7, 5),
    ]);

    const recentIds = new Set(recent.map(m => m.id));
    const importantIds = new Set(important.map(m => m.id));
    
    const contextParts: string[] = [];

    if (important.length > 0) {
      contextParts.push("=== Important Facts ===");
      important.forEach(m => {
        contextParts.push(`[${m.importance}/10] ${m.summary || m.content}`);
      });
    }

    if (similar.length > 0) {
      contextParts.push("\n=== Relevant Context ===");
      similar
        .filter(s => !importantIds.has(s.entry.id) && !recentIds.has(s.entry.id))
        .forEach(s => {
          contextParts.push(`[${(s.similarity * 100).toFixed(0)}% match] ${s.entry.summary || s.entry.content}`);
        });
    }

    if (recent.length > 0) {
      contextParts.push("\n=== Recent Conversation ===");
      recent
        .filter(m => !importantIds.has(m.id))
        .slice(0, 5)
        .forEach(m => {
          contextParts.push(`${m.summary || m.content}`);
        });
    }

    return contextParts.join("\n");
  }
}

export async function createMemoryFromMessages(
  messages: Array<{ role: string; content: string }>,
  conversationId: string,
  contactId: string | null,
  memorySystem: AIMemorySystem,
  importance: number = 5
): Promise<MemoryEntry | null> {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  if (conversationText.length < 50) {
    return null;
  }

  return await memorySystem.createMemoryWithEmbedding({
    conversationId,
    contactId,
    content: conversationText,
    importance,
    metadata: {
      messageCount: messages.length,
      roles: Array.from(new Set(messages.map(m => m.role))),
    },
  });
}
