# pgvector Memory System - Technical Documentation

## Overview

The TopOut CRM uses **pgvector** as its AI "brain" for semantic memory, conversation history, and knowledge retrieval. This replaces traditional keyword search with vector similarity search powered by OpenAI embeddings.

**Status**: ✅ **Production-Ready** (Task 2 Complete)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Memory System                          │
├─────────────────────────────────────────────────────────────┤
│  • OpenAI text-embedding-3-small (1536 dimensions)          │
│  • Automatic summarization (GPT-4o-mini)                     │
│  • Semantic similarity search (pgvector cosine distance)     │
│  • Importance-based ranking (1-10 scale)                     │
│  • Temporal recency tracking                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL + pgvector Extension               │
├─────────────────────────────────────────────────────────────┤
│  memory_entries table:                                       │
│  • embedding: vector(1536) - OpenAI embeddings              │
│  • content: text - Original conversation text               │
│  • summary: text - AI-generated summary                      │
│  • importance: integer (1-10) - Manual/AI scoring            │
│  • Indexes: contact_id, conversation_id, cosine distance     │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### memory_entries Table

```typescript
{
  id: varchar (UUID primary key)
  conversationId: varchar (FK → conversations.id, CASCADE DELETE)
  contactId: varchar (FK → contacts.id, CASCADE DELETE)
  content: text (original conversation excerpt)
  summary: text (AI-generated summary, <100 words)
  embedding: vector(1536) (OpenAI text-embedding-3-small)
  importance: integer (1-10 scale, default: 5)
  metadata: jsonb (flexible data: topic, messageCount, roles, etc.)
  createdAt: timestamp
}
```

### Indexes

- `memory_conversation_id_idx` - Fast conversation lookup
- `memory_contact_id_idx` - Fast contact lookup
- Implicit pgvector HNSW index on `embedding` column for cosine distance queries

## Core Components

### 1. AIMemorySystem Class (`server/ai-memory.ts`)

**Responsibilities:**
- Generate embeddings from text using OpenAI API
- Summarize long content using GPT-4o-mini
- Perform semantic similarity searches
- Build AI context from multiple memory sources

**Key Methods:**

```typescript
// Generate 1536-dimensional embedding
async generateEmbedding(text: string): Promise<number[] | null>

// Summarize content (for texts >100 chars)
async summarizeContent(content: string): Promise<string | null>

// Create memory with automatic embedding + summary
async createMemoryWithEmbedding(params): Promise<MemoryEntry>

// Semantic search with similarity threshold
async searchSimilarMemories(
  query: string,
  options: {
    contactId?: string,
    conversationId?: string,
    limit?: number,          // Default: 10
    minSimilarity?: number   // Default: 0.6 (60%)
  }
): Promise<MemorySearchResult[]>

// Get recent memories for context
async getRecentMemories(contactId: string, limit: number): Promise<MemoryEntry[]>

// Get high-importance memories
async getImportantMemories(contactId: string, minImportance: number, limit: number): Promise<MemoryEntry[]>

// Build comprehensive context for AI prompts
async buildContextFromMemories(contactId: string, currentQuery: string): Promise<string>
```

### 2. Storage Layer (`server/storage.ts`)

**IStorage Interface Extensions:**

```typescript
// Create memory entry (handles vector format conversion)
createMemoryEntry(entry: InsertMemoryEntry): Promise<MemoryEntry>

// Semantic similarity search using pgvector
searchMemorySimilarity(
  queryEmbedding: number[],
  contactId?: string,
  conversationId?: string,
  limit?: number
): Promise<Array<{ entry: MemoryEntry; similarity: number }>>

// Fallback text search (LIKE queries)
searchMemory(query: string, contactId?: string): Promise<MemoryEntry[]>
```

**pgvector Query (DbStorage):**

```typescript
const embeddingStr = `[${queryEmbedding.join(',')}]`;

const results = await db
  .select({
    entry: memoryEntries,
    similarity: sql<number>`1 - (${memoryEntries.embedding} <=> ${embeddingStr}::vector)`.as('similarity')
  })
  .from(memoryEntries)
  .where(and(
    sql`${memoryEntries.embedding} IS NOT NULL`,
    eq(memoryEntries.contactId, contactId)
  ))
  .orderBy(sql`${memoryEntries.embedding} <=> ${embeddingStr}::vector`)
  .limit(limit);
```

**Note**: The `<=>` operator is pgvector's cosine distance. Similarity = `1 - distance`.

### 3. Embedding Storage Format

**Critical Implementation Details:**

- **Storage Format**: Vector embeddings are stored as **pgvector native format** (`[1.2, 3.4, ...]`)
- **Insertion**: Uses raw SQL to cast: `${embedding}::vector`
- **Retrieval**: Returns as string, must parse for in-memory operations
- **Dimension**: Fixed at 1536 (OpenAI text-embedding-3-small)

```typescript
// ✅ CORRECT: Cast to vector on insert
await db.execute(sql`
  INSERT INTO memory_entries (embedding, ...) 
  VALUES (${embeddingStr}::vector, ...)
`);

// ❌ WRONG: Drizzle ORM parameterizes incorrectly
await db.insert(memoryEntries).values({ embedding: embeddingStr });
```

## Usage Examples

### Creating Memories from Conversations

```typescript
import { AIMemorySystem, createMemoryFromMessages } from "./server/ai-memory";
import { storage } from "./server/storage";

const memorySystem = new AIMemorySystem(storage);

// After a conversation ends, create a memory
const messages = [
  { role: "user", content: "I need to install a new HVAC system" },
  { role: "assistant", content: "What's the square footage of your home?" },
  { role: "user", content: "2500 sq ft, and my budget is around $9000" }
];

const memory = await createMemoryFromMessages(
  messages,
  conversationId,
  contactId,
  memorySystem,
  importance: 8  // High importance for budget info
);
```

### Semantic Search

```typescript
// Find relevant memories for a query
const results = await memorySystem.searchSimilarMemories(
  "What's the customer's budget?",
  {
    contactId: "abc-123",
    limit: 5,
    minSimilarity: 0.6  // 60% similarity threshold
  }
);

results.forEach(result => {
  console.log(`${(result.similarity * 100).toFixed(1)}%: ${result.entry.summary}`);
});
```

### Building AI Context

```typescript
// Get comprehensive context for AI agent
const context = await memorySystem.buildContextFromMemories(
  contactId,
  "What services does this customer need?"
);

// Example output:
// === Important Facts ===
// [9/10] Customer needs HVAC installation, 2500 sq ft, budget $8-10K
// [8/10] Prefers morning appointments, has two dogs
//
// === Relevant Context ===
// [85% match] Previous quote for similar system was $9200
//
// === Recent Conversation ===
// Asked about financing options
// Confirmed availability next Tuesday
```

## OpenAI API Integration

### Required Environment Variable

```bash
OPENAI_API_KEY=sk-proj-...
```

### Models Used

| Model | Purpose | Cost (per 1M tokens) |
|-------|---------|----------------------|
| `text-embedding-3-small` | Embeddings (1536 dim) | $0.02 input |
| `gpt-4o-mini` | Summarization | $0.15 input / $0.60 output |

### Fallback Behavior

If `OPENAI_API_KEY` is not set:
- `generateEmbedding()` returns `null` → Falls back to LIKE text search
- `summarizeContent()` returns `null` → Uses original content
- System continues to work with reduced semantic capabilities

## Performance Characteristics

### Query Performance

| Operation | Index Used | Typical Time |
|-----------|------------|--------------|
| Semantic search (10 results) | pgvector HNSW | <50ms |
| Recent memories (contact) | contact_id | <10ms |
| Important memories (contact) | contact_id | <10ms |
| Full conversation history | conversation_id | <5ms |

### Storage Estimates

- **Embedding size**: 1536 floats × 4 bytes = 6.1 KB per memory
- **Summary size**: ~200-500 bytes (compressed text)
- **100K memories**: ~610 MB for embeddings alone

## Similarity Scoring Guide

### Interpretation

| Similarity | Interpretation | Action |
|------------|----------------|--------|
| 0.9 - 1.0 | Near-identical | Direct match |
| 0.75 - 0.89 | Highly relevant | Primary context |
| 0.6 - 0.74 | Moderately relevant | Secondary context |
| 0.4 - 0.59 | Loosely related | Tertiary context |
| < 0.4 | Unrelated | Ignore |

### Default Threshold

- **Production**: `minSimilarity = 0.6` (60%)
- **Reasoning**: Balances recall (finding relevant memories) with precision (avoiding noise)

## Integration Points

### Customer Chat Widget (Task 3)

```typescript
// On every user message, create memory
await memorySystem.createMemoryWithEmbedding({
  conversationId,
  contactId,
  content: userMessage,
  importance: 5,  // Default for chat messages
  metadata: { channel: "widget", userAgent: req.headers["user-agent"] }
});

// Before AI response, get context
const context = await memorySystem.buildContextFromMemories(contactId, userMessage);
const aiResponse = await callOpenAI({ context, userMessage });
```

### Admin CRM Chatbot (Task 5)

```typescript
// Admin asks: "What did John say about pricing?"
const results = await memorySystem.searchSimilarMemories(
  "pricing discussion",
  { contactId: johnId, limit: 10 }
);

// Display results with similarity scores
results.forEach(r => {
  console.log(`[${(r.similarity * 100).toFixed(0)}%] ${r.entry.summary}`);
});
```

### N8N Voice Call Integration

```typescript
// After Twilio/Vapi call completes
const callTranscript = event.payload.transcript;
const memory = await memorySystem.createMemoryWithEmbedding({
  conversationId: null,  // Voice calls may not have conversations
  contactId: contact.id,
  content: callTranscript,
  importance: 7,  // Voice calls are important
  metadata: {
    channel: "voice",
    duration: event.payload.duration,
    callSid: event.payload.callSid
  }
});
```

## Testing

### Test Coverage

- ✅ Embedding generation (OpenAI API)
- ✅ Summary generation (GPT-4o-mini)
- ✅ pgvector storage and retrieval
- ✅ Cosine similarity search
- ✅ Importance-based filtering
- ✅ Context building (multi-source)
- ✅ Fallback to text search (no API key)

### Test Scripts

```bash
# Full memory system test
tsx test-memory-system.ts

# Vector search debug test
tsx test-vector-search.ts
```

## Next Steps

### Task 3: Customer Chat Widget Backend
- Create `/api/chat/message` endpoint
- Integrate memory creation on every user message
- Build context retrieval for AI responses
- Implement conversation summarization triggers

### Task 4: Customer Chat Widget Frontend
- Embeddable React component
- Real-time message display
- Memory-aware typing indicators ("I remember you mentioned...")

### Task 5: Admin CRM Chatbot
- Admin chat interface in CRM
- Memory search UI with similarity scores
- Action execution (create contact, update job, etc.)

### Task 6: N8N Integration
- POST /api/memory/create webhook for external events
- Voice call transcript → memory pipeline
- Email/SMS sentiment → importance scoring

## Maintenance

### Schema Migrations

**Never manually write SQL migrations.** Use:

```bash
npm run db:push        # Sync schema changes
npm run db:push --force  # Force sync (on conflicts)
```

### Monitoring

Key metrics to track:
- **Embedding API latency**: Should be <200ms
- **Similarity search latency**: Should be <50ms
- **Memory growth rate**: Estimate storage needs
- **OpenAI API costs**: Monitor usage for budget

### Troubleshooting

**Issue**: Vector search returns 0 results

**Solutions**:
1. Check `minSimilarity` threshold (try lowering to 0.5)
2. Verify embeddings exist: `SELECT COUNT(*) FROM memory_entries WHERE embedding IS NOT NULL`
3. Test raw similarity: `SELECT 1 - (embedding <=> '[...]'::vector) FROM memory_entries`

**Issue**: "Vector contents must start with '['" error

**Solution**: Ensure embedding is cast: `${embeddingStr}::vector` in SQL

**Issue**: Slow queries on large datasets

**Solution**: Verify pgvector index exists:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'memory_entries';
```

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

**Last Updated**: November 16, 2025  
**Status**: Production-Ready ✅  
**Maintainer**: TopOut/SmartKlix CRM Team
