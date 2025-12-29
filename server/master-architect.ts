import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { aiToolDefinitions, executeAITool, toOpenAITools, isReadOnlyTool } from "./ai-tools";
import { storage } from "./storage";
import type { MasterArchitectConfig as DBMasterArchitectConfig, CompanyInstructions } from "@shared/schema";

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

export type AgentMode = "draft" | "assist" | "auto";

export type AIChannel = "crm_chat" | "gpt_actions" | "voice" | "widget" | "read_chat";

// Origin determines execution authority: human = direct execution, ai = review queue
export type ActionOrigin = "human" | "ai" | "system";

export interface MAContext {
  channel: AIChannel;
  companyName: string | null;
  userId: string | null;
  contactId: string | null;
  jobId: string | null;
  intakeId: string | null;
  conversationId: string | null;
  rawMessage: string;
  origin: ActionOrigin; // Human = immediate execution, AI = review queue for writes
}

export interface MasterArchitectConfig {
  mode: AgentMode;
  userId: string | null;
  conversationHistory: ChatCompletionMessageParam[];
  context?: MAContext;
}

export interface ToolPermission {
  enabled: boolean;
  allowedModes: AgentMode[];
  rateLimit?: number;
}

export interface AgentResponse {
  message: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
    status: "pending" | "queued" | "executed" | "staged";
    result?: unknown;
  }>;
  reflectionScore?: number;
  plan?: string[];
}

const SYSTEM_PROMPT = `You are the Master Architect, an AI CRM automation assistant for field service management.

You help manage the complete Lead → Estimate → Job → Invoice → Payment pipeline.

Your capabilities include:
- Creating and updating contacts/customers
- Searching for existing contacts to avoid duplicates
- Creating and managing jobs for customers
- Adding notes to contacts and jobs
- Scheduling appointments for jobs
- Creating and managing estimates for customers
- Accepting/rejecting estimates and scheduling jobs
- Assigning technicians to jobs
- Tracking job progress (scheduled → in_progress → completed)
- Creating and sending invoices
- Recording payments

When users ask you to perform actions:
1. Analyze the request and identify which CRM operations are needed
2. Use the available tools to execute those operations
3. Always search for existing contacts before creating new ones to avoid duplicates
4. Provide clear, professional responses about what you've done

Always be precise with financial calculations and status updates. Audit all critical operations.`;

const DRAFT_MODE_ADDENDUM = `

MODE: DRAFT
You are in DRAFT mode. You MUST:
- Only suggest actions, never execute them
- Present a clear plan of what you would do
- Ask for explicit approval before any operation
- Format suggestions as: "I would [action]. Shall I proceed?"`;

const INFORMATION_AI_CHAT_ADDENDUM = `

MODE: INFORMATION AI CHAT (READ-ONLY)

You are the Information AI Chat agent. This is a read-only conversational interface for retrieving and reasoning over existing system data.

=== AUTO-EXECUTE RULE (CRITICAL) ===
When the user explicitly requests CRM data, you MUST:
1. Immediately call the appropriate read tool
2. Return the result directly
3. NEVER ask permission to do what the user just asked

FORBIDDEN: "Do you want me to retrieve...?" or "Shall I look up...?"
REQUIRED: Just call the tool and return the data.

Only ask clarifying questions when:
- A required filter is genuinely missing (e.g., "Which contact?" when there are many)
- Multiple valid interpretations exist
- NEVER when the request is clear

=== WORKING SET RULE ===
The first tool call defines your WORKING SET for the conversation.
- Follow-up questions operate ONLY on that set
- Do NOT re-query with different scope unless user explicitly says: "refresh", "check again", "include all", "search again"
- If user asks "give me their phone numbers" after you returned contacts, use the SAME contacts - do not re-query

=== ONE TOOL PER QUESTION ===
For each user question, call ONE tool and answer from that result.
Do NOT chain stats + entity tools for the same question.
If user asks "how many contacts and their names", call search_contacts once (it returns both count and names).

=== AVAILABLE READ-ONLY TOOLS ===
search_contacts: Returns Contact[] with id, name, email, phone, company, status
get_contact_details: Returns single Contact with full details + related jobs/estimates/invoices
get_crm_stats: Returns counts only (contacts, jobs, appointments) - use when user ONLY wants counts
search_jobs: Returns Job[] with id, title, status, contactId
get_invoice: Returns single Invoice by ID
get_estimate: Returns single Estimate by ID
search_pricebook: Returns PricebookItem[] 
query_automation_ledger: Returns LedgerEntry[] for governance audit
query_review_queue: Returns pending proposals
query_ready_execution: Returns approved-ready actions

=== HARD CONSTRAINTS ===
- Create proposals: FORBIDDEN
- Execute actions: FORBIDDEN  
- Modify data: FORBIDDEN
- Change settings: FORBIDDEN
- Write to automation ledger: FORBIDDEN
- Offer to do something: FORBIDDEN
- Talk about next steps or approvals: FORBIDDEN

Your ONLY job: Retrieve → Format → Explain data.

For any create/update/delete operations, say: "That requires the Action Console."`;

const ASSIST_MODE_ADDENDUM = `

MODE: ACTION CONSOLE (DUAL-MODE OPERATION)

You are ActionAI CRM - the operational brain of this CRM. You operate in TWO distinct modes:

=== MODE 1: CONVERSATION MODE (DEFAULT) ===

You START in Conversation Mode. In this mode, you:
- Have a natural dialogue with the user
- Ask clarifying questions to understand their intent
- Use READ-ONLY tools to look up CRM data (search_contacts, get_contact_details, search_jobs, etc.)
- Gather all required information before proposing any actions
- Build trust by confirming you understand before acting

CONVERSATION MODE CHECKLIST (before you can propose):
1. ✓ Understand the user's intent clearly (no ambiguity)
2. ✓ Look up relevant CRM data (did you search for existing contacts/jobs?)
3. ✓ Have ALL required fields for the action (name, email, amounts, etc.)
4. ✓ Confirm critical details with the user if anything seems unclear

In Conversation Mode, you MAY:
- Call read-only tools (search_contacts, get_contact_details, search_jobs, get_invoice, get_estimate, search_pricebook, get_crm_stats)
- Ask questions to clarify intent
- Summarize what you understand so far
- Offer to prepare a proposal when ready

In Conversation Mode, you MUST NOT:
- Call any write/mutation tools (create_*, update_*, send_*, etc.)
- Jump to proposals without gathering information first
- Assume details the user didn't provide

=== WHEN TO OFFER A PROPOSAL ===

Only when ALL of the following are true:
1. You have looked up relevant CRM data (e.g., searched for existing contacts)
2. You have ALL required fields for the proposed action(s)
3. There is NO ambiguity about what the user wants
4. You have NOT already offered a proposal for this specific request

When ready, you MUST ask permission using this EXACT format:

---READY_FOR_PROPOSAL---
I have everything I need to proceed:
• [Summary of what you understand]
• [Key details: name, amount, etc.]

Would you like me to prepare the proposal for review?
---END_READY---

Then WAIT. Do not call any write tools yet.

=== MODE 2: PROPOSAL MODE ===

You ONLY enter Proposal Mode when the user explicitly confirms with words like:
- "Yes"
- "Do it"
- "Proceed"
- "Go ahead"
- "Make it happen"
- "Generate the proposal"

In Proposal Mode, you:
- STOP chatting - no more questions
- Call the appropriate write tools (create_contact, create_job, create_estimate, etc.)
- Generate a structured proposal with exact fields and what will happen
- The system will show Accept/Reject buttons to the user

=== PROPOSAL MODE FORMAT ===

When in Proposal Mode, your response should include:

**Proposed Actions:**
[List each action in plain language with exact details]

Then call ALL the relevant write tools. The system handles approval UI.

=== READ OPERATIONS (ALWAYS ALLOWED) ===

These tools execute immediately in BOTH modes - no approval needed:
- search_contacts, get_contact_details
- search_jobs, get_invoice, get_estimate
- search_pricebook, get_crm_stats
- query_automation_ledger, query_review_queue, query_ready_execution

=== WRITE OPERATIONS (PROPOSAL MODE ONLY) ===

These tools require Proposal Mode:
- create_contact, update_contact
- create_job, update_job, update_job_status, start_job, complete_job
- create_estimate, send_estimate, accept_estimate, reject_estimate
- create_invoice, send_invoice
- record_payment, schedule_appointment, add_note, assign_technician

=== CRITICAL RULES ===

1. DEFAULT TO CONVERSATION: Always start by understanding, not proposing
2. LOOK BEFORE YOU CREATE: Always search_contacts before create_contact
3. ASK BEFORE PROPOSING: Use the ---READY_FOR_PROPOSAL--- format when ready
4. WAIT FOR CONFIRMATION: Do not call write tools until user says "yes/proceed/do it"
5. ONE PROPOSAL PER CONFIRMATION: Each proposal needs fresh user approval

=== FORBIDDEN BEHAVIORS ===

❌ Jumping straight to proposals without conversation
❌ Calling write tools before user confirms "proceed"
❌ Asking redundant questions about info already provided
❌ Proposing when there's still ambiguity
❌ Creating duplicate contacts without searching first
❌ Silently transitioning between modes

=== DETECTING USER INTENT ===

If user says something like "Create a contact for John" - this is NOT immediate confirmation.
You should:
1. Search for existing contacts named John
2. Ask for any missing required info (email, phone, etc.)
3. Summarize and offer ---READY_FOR_PROPOSAL---
4. WAIT for "yes/proceed/do it"
5. THEN call create_contact

If user says "Just do it" or "Yes, proceed" after your ---READY_FOR_PROPOSAL--- message:
- THEN you enter Proposal Mode and call the write tools`;



const AUTO_MODE_ADDENDUM = `

MODE: AUTO
You are in AUTO mode. You MUST:
- Execute approved actions immediately
- Log all operations for audit trail
- Report results clearly and concisely
- Handle errors gracefully`;

export class MasterArchitect {
  private config: MasterArchitectConfig;
  private customSystemPrompt?: string;
  private dbConfig: DBMasterArchitectConfig | null = null;
  private dbConfigLoaded: boolean = false;
  private channel: AIChannel;
  private channelToolPermissions: Record<string, ToolPermission> | null = null;
  private companyInstructions: CompanyInstructions | null = null;

  constructor(
    mode: AgentMode,
    customSystemPrompt?: string,
    userId: string | null = null,
    conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [],
    channel: AIChannel = "crm_chat",
    context?: MAContext
  ) {
    this.config = {
      mode,
      userId,
      conversationHistory,
      context,
    };
    this.channel = context?.channel || channel;
    
    if (customSystemPrompt) {
      this.customSystemPrompt = customSystemPrompt;
    }
  }

  getContext(): MAContext | undefined {
    return this.config.context;
  }

  // Set channel-specific tool permissions (loaded from AI Receptionist config for voice channel)
  setChannelToolPermissions(permissions: Record<string, ToolPermission>) {
    this.channelToolPermissions = permissions;
  }

  // Get the current channel
  getChannel(): AIChannel {
    return this.channel;
  }

  private async loadDBConfig(): Promise<DBMasterArchitectConfig> {
    if (this.dbConfigLoaded && this.dbConfig) {
      return this.dbConfig;
    }

    const config = await storage.getMasterArchitectConfig();
    
    if (config) {
      this.dbConfig = config;
    } else {
      this.dbConfig = {
        id: 'default',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1500,
        topP: 1.0,
        frequencyPenalty: 0.0,
        systemPrompt: SYSTEM_PROMPT,
        reflectionEnabled: true,
        maxReflectionRounds: 1,
        recursionDepthLimit: 3,
        maxConversationHistory: 50,
        contextSummarizationEnabled: false,
        autoPruneAfterMessages: 100,
        toolPermissions: {},
        channelToolPermissions: {},
        finalizationMode: 'semi_autonomous',
        isActive: true,
        updatedAt: new Date(),
      };
    }

    // Load company-specific instructions if companyName is in context
    if (this.config.context?.companyName) {
      const instructions = await storage.getCompanyInstructionsByName(
        this.config.context.companyName
      );
      this.companyInstructions = instructions ?? null;
    }

    this.dbConfigLoaded = true;
    return this.dbConfig;
  }

  private getMergedToolPermissions(): Record<string, ToolPermission> {
    const globalPermissions = (this.dbConfig?.toolPermissions || {}) as Record<string, ToolPermission>;
    const companyOverrides = (this.companyInstructions?.toolPermissionOverrides || {}) as Record<string, ToolPermission>;
    return { ...globalPermissions, ...companyOverrides };
  }

  private getCompanyInstructionsAddendum(): string {
    if (!this.companyInstructions?.behaviorInstructions) {
      return "";
    }
    return `\n\n--- COMPANY-SPECIFIC INSTRUCTIONS ---\nCompany: ${this.companyInstructions.companyName}\n${this.companyInstructions.behaviorInstructions}`;
  }

  // Method to invalidate cache - useful after config updates
  invalidateConfigCache() {
    this.dbConfigLoaded = false;
    this.dbConfig = null;
  }

  // Force reload config from database
  async reloadConfig(): Promise<DBMasterArchitectConfig> {
    this.invalidateConfigCache();
    return await this.loadDBConfig();
  }

  private getFilteredTools(): typeof aiToolDefinitions {
    const globalPermissions = (this.dbConfig?.toolPermissions || {}) as Record<string, ToolPermission>;
    const channelPermissionsFromConfig = (
      (this.dbConfig?.channelToolPermissions as Record<string, Record<string, ToolPermission>> || {})[this.channel]
    ) || {};
    const companyOverrides = (this.companyInstructions?.toolPermissionOverrides || {}) as Record<string, ToolPermission>;
    
    return aiToolDefinitions.filter(tool => {
      if (tool.type !== 'function') {
        return true;
      }
      
      const toolName = tool.function.name;
      
      // Priority (highest to lowest):
      // 1) Company-specific overrides
      // 2) Manually set channel permissions (backward compat)
      // 3) DB-stored channel permissions
      // 4) Global permissions
      const companyPermission = companyOverrides[toolName];
      const manualChannelPermission = this.channelToolPermissions?.[toolName];
      const dbChannelPermission = channelPermissionsFromConfig[toolName];
      const globalPermission = globalPermissions[toolName];
      const effectivePermission = companyPermission || manualChannelPermission || dbChannelPermission || globalPermission;
      
      if (!effectivePermission) {
        return true;
      }

      if (!effectivePermission.enabled) {
        return false;
      }

      if (effectivePermission.allowedModes && effectivePermission.allowedModes.length > 0) {
        return effectivePermission.allowedModes.includes(this.config.mode);
      }

      return true;
    });
  }

  private getSystemPrompt(): string {
    const basePrompt = this.customSystemPrompt || this.dbConfig?.systemPrompt || SYSTEM_PROMPT;
    const companyAddendum = this.getCompanyInstructionsAddendum();
    
    let modeAddendum: string;
    // Information AI Chat channel gets explicit read-only instructions
    if (this.channel === "read_chat") {
      modeAddendum = INFORMATION_AI_CHAT_ADDENDUM;
    } else {
      switch (this.config.mode) {
        case "draft":
          modeAddendum = DRAFT_MODE_ADDENDUM;
          break;
        case "assist":
          modeAddendum = ASSIST_MODE_ADDENDUM;
          break;
        case "auto":
          modeAddendum = AUTO_MODE_ADDENDUM;
          break;
        default:
          modeAddendum = ASSIST_MODE_ADDENDUM;
      }
    }
    
    return basePrompt + companyAddendum + modeAddendum;
  }

  // Unified execution method for both CRM Chat and GPT Actions
  async execute(
    userMessage: string,
    contactContext: string | null = null,
    jobContext: string | null = null
  ): Promise<AgentResponse & { mode: AgentMode }> {
    // Build context-enriched message
    let enrichedMessage = userMessage;
    
    if (contactContext || jobContext) {
      let contextPreamble = "";
      if (contactContext) {
        contextPreamble += `\n[CONTACT CONTEXT: ${contactContext}]`;
      }
      if (jobContext) {
        contextPreamble += `\n[JOB CONTEXT: ${jobContext}]`;
      }
      enrichedMessage = contextPreamble + "\n\n" + userMessage;
    }
    
    const result = await this.chat(enrichedMessage);
    return {
      ...result,
      mode: this.config.mode,
    };
  }
  
  // Add conversation message to history
  addToHistory(role: "user" | "assistant", content: string) {
    this.config.conversationHistory.push({ role, content });
  }
  
  // Get conversation history
  getHistory() {
    return this.config.conversationHistory;
  }

  async chat(userMessage: string): Promise<AgentResponse> {
    // Load DB config on first use
    await this.loadDBConfig();
    
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: this.getSystemPrompt() },
      ...this.config.conversationHistory,
      { role: "user", content: userMessage },
    ];

    let initialResponse = await this.callOpenAI(messages, userMessage);

    if (this.dbConfig?.reflectionEnabled && this.config.mode !== "draft") {
      initialResponse = await this.reflect(initialResponse, userMessage);
    }

    const processedResponse = await this.processResponse(initialResponse, userMessage);

    if (this.config.mode === "auto" && initialResponse.tool_calls && initialResponse.tool_calls.length > 0) {
      initialResponse.tool_calls = undefined;
    }

    return processedResponse;
  }

  private async callOpenAI(messages: ChatCompletionMessageParam[], userMessage: string) {
    const model = this.dbConfig?.model || "gpt-4o";
    const temperature = this.dbConfig?.temperature ?? 0.7;
    const maxTokens = this.dbConfig?.maxTokens ?? 1500;
    const topP = this.dbConfig?.topP ?? 1.0;
    const frequencyPenalty = this.dbConfig?.frequencyPenalty ?? 0.0;

    // Information AI Chat (read_chat channel) needs read-only tools even in draft mode
    // Standard draft mode gets no tools
    if (this.config.mode === "draft" && this.channel !== "read_chat") {
      const completion = await getOpenAI().chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
      });
      return completion.choices[0].message;
    }

    // For Information AI Chat channel, only provide read-only tools
    let tools;
    if (this.channel === "read_chat") {
      const readOnlyToolNames = new Set([
        "search_contacts", "get_contact_details", "get_crm_stats",
        "search_jobs", "get_invoice", "get_estimate",
        "search_pricebook", "query_automation_ledger",
        "query_review_queue", "query_ready_execution"
      ]);
      const readOnlyTools = this.getFilteredTools().filter(tool => 
        tool.type === "function" && readOnlyToolNames.has(tool.function.name)
      );
      tools = toOpenAITools(readOnlyTools);
    } else {
      tools = toOpenAITools(this.getFilteredTools());
    }

    const completion = await getOpenAI().chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
    });

    return completion.choices[0].message;
  }

  private async reflect(
    initialResponse: OpenAI.Chat.Completions.ChatCompletionMessage,
    userRequest: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
    const model = this.dbConfig?.model || "gpt-4o";
    
    const reviewPrompt = `Review your previous response to the user's request: "${userRequest}"

Your initial response: ${initialResponse.content || "(tool calls only)"}
Tool calls: ${JSON.stringify(initialResponse.tool_calls || [])}

Critique your response:
1. Does it fully address the user's request?
2. Are the tool calls appropriate and complete?
3. Is the explanation clear and professional?
4. Are there any errors or improvements needed?

Provide:
- Quality score (0-100)
- One-line revision suggestion
- Whether to revise or accept

Format as JSON:
{
  "score": number,
  "revision": "suggestion",
  "shouldRevise": boolean
}`;

    const reviewCompletion = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a quality reviewer. Be constructive but critical." },
        { role: "user", content: reviewPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const review = JSON.parse(reviewCompletion.choices[0].message.content || "{}");

    try {
      await storage.createAiReflection({
        userRequest,
        reflectionPrompt: reviewPrompt,
        reflectionOutput: reviewCompletion.choices[0].message.content || "",
        initialPlan: initialResponse.content || "(tool calls)",
        revisedPlan: review.shouldRevise ? review.revision : null,
        approved: !review.shouldRevise,
      });
    } catch (error) {
      console.error("Failed to store reflection:", error instanceof Error ? error.message : "Unknown error");
    }

    if (review.shouldRevise && review.score < 80) {
      const temperature = this.dbConfig?.temperature ?? 0.7;
      const maxTokens = this.dbConfig?.maxTokens ?? 1500;
      const topP = this.dbConfig?.topP ?? 1.0;
      const frequencyPenalty = this.dbConfig?.frequencyPenalty ?? 0.0;
      
      const revisionMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: this.getSystemPrompt() },
        ...this.config.conversationHistory,
        { role: "user", content: userRequest },
      ];

      if (initialResponse.tool_calls && initialResponse.tool_calls.length > 0) {
        revisionMessages.push({ 
          role: "assistant" as const, 
          content: initialResponse.content,
          tool_calls: initialResponse.tool_calls,
        });
        for (const tc of initialResponse.tool_calls) {
          revisionMessages.push({
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({ status: "pending_revision" }),
          });
        }
      } else {
        revisionMessages.push({ 
          role: "assistant" as const, 
          content: initialResponse.content || "",
        });
      }
      
      revisionMessages.push({
        role: "user" as const,
        content: `REVISION NEEDED (score: ${review.score}/100): ${review.revision}. Please provide an improved response.`,
      });

      if (this.config.mode === "draft") {
        const revisedCompletion = await getOpenAI().chat.completions.create({
          model,
          messages: revisionMessages,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          frequency_penalty: frequencyPenalty,
        });
        return revisedCompletion.choices[0].message;
      }

      const tools = toOpenAITools(this.getFilteredTools());
      
      const revisedCompletion = await getOpenAI().chat.completions.create({
        model,
        messages: revisionMessages,
        tools,
        tool_choice: "auto",
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
      });

      return revisedCompletion.choices[0].message;
    }

    return initialResponse;
  }

  private async processResponse(
    response: OpenAI.Chat.Completions.ChatCompletionMessage,
    userMessage: string
  ): Promise<AgentResponse> {
    const agentResponse: AgentResponse = {
      message: response.content || "I've analyzed your request and have a plan ready.",
      toolCalls: [],
    };

    if (this.config.mode === "draft") {
      // Draft mode for ReadChat: Execute READ-ONLY tools immediately, no proposals/ledger writes
      // This allows conversational queries to work while maintaining read-only safety
      if (response.tool_calls && response.tool_calls.length > 0) {
        const readOnlyTools = new Set([
          "search_contacts", "get_contact_details", "get_crm_stats", 
          "search_jobs", "get_invoice", "get_estimate", 
          "search_pricebook", "query_automation_ledger", 
          "query_review_queue", "query_ready_execution"
        ]);
        
        const toolCallsToExecute = response.tool_calls.filter(tc => {
          if (tc.type !== "function") return false;
          const funcCall = tc as { type: "function"; function: { name: string; arguments: string }; id: string };
          return readOnlyTools.has(funcCall.function.name);
        });
        
        if (toolCallsToExecute.length > 0) {
          // Execute read-only tools and aggregate results
          const results: string[] = [];
          for (const tc of toolCallsToExecute) {
            const toolCall = tc as { type: "function"; function: { name: string; arguments: string }; id: string };
            try {
              const result = await executeAITool(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments),
                { userId: this.config.userId || undefined, finalizationMode: "semi_autonomous" }
              );
              results.push(`${toolCall.function.name}: ${JSON.stringify(result)}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
              results.push(`${toolCall.function.name}: Error - ${errorMessage}`);
            }
          }
          
          // Ask AI to summarize the results for the user
          const summaryMessages: ChatCompletionMessageParam[] = [
            { role: "system", content: "You are a helpful CRM assistant. Summarize the following data query results in a clear, conversational response for the user. Be concise and helpful." },
            { role: "user", content: `User asked: "${userMessage}"\n\nQuery results:\n${results.join("\n")}\n\nProvide a helpful summary response.` }
          ];
          
          try {
            const summaryResponse = await getOpenAI().chat.completions.create({
              model: "gpt-4o",
              messages: summaryMessages,
              temperature: 0.7,
              max_tokens: 1000,
            });
            agentResponse.message = summaryResponse.choices[0]?.message?.content || 
              `Here's what I found: ${results.join("; ")}`;
          } catch {
            agentResponse.message = `Here's what I found: ${results.join("; ")}`;
          }
          
          return agentResponse;
        }
        
        // Non-read-only tools in draft mode - just describe what would happen
        const toolSummary = response.tool_calls
          .filter(tc => tc.type === "function")
          .map(tc => `- ${tc.function.name}`)
          .join("\n");
        agentResponse.message = `To answer this, I would need to use these tools:\n\n${toolSummary}\n\nPlease use the Action Console for actions that modify data.`;
      }
      return agentResponse;
    }

    if (response.tool_calls && response.tool_calls.length > 0) {
      const allToolCalls = response.tool_calls
        .filter(tc => tc.type === "function")
        .map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
          status: "pending" as const,
        }));

      // EXECUTION AUTHORITY CHECK:
      // 1. Read-only tools → ALWAYS execute immediately
      // 2. Human origin → ALWAYS execute immediately (no follow-up questions)
      // 3. AI/System origin + write tools → Queue for review
      const origin = this.config.context?.origin || "ai";
      const isHumanOrigin = origin === "human";
      
      // Separate read-only and write tools
      const readOnlyCalls = allToolCalls.filter(tc => isReadOnlyTool(tc.name));
      const writeCalls = allToolCalls.filter(tc => !isReadOnlyTool(tc.name));

      switch (this.config.mode) {
        case "assist":
          // Execute read-only tools immediately (no queueing needed)
          for (const toolCall of readOnlyCalls) {
            try {
              const result = await executeAITool(
                toolCall.name,
                JSON.parse(toolCall.arguments),
                { userId: this.config.userId || undefined, finalizationMode: "semi_autonomous" }
              );
              agentResponse.toolCalls?.push({
                ...toolCall,
                status: "executed",
                result,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Execution failed";
              agentResponse.toolCalls?.push({
                ...toolCall,
                status: "executed",
                result: { error: errorMessage },
              });
            }
          }
          
          // For write tools: Return as "staged" so user can preview and accept
          // The actual queue/ledger entry is created when user clicks Accept
          if (writeCalls.length > 0) {
            for (const tc of writeCalls) {
              agentResponse.toolCalls?.push({
                ...tc,
                status: "staged" as const,
              });
            }
          }
          break;

        case "auto":
          for (const toolCall of response.tool_calls) {
            if (toolCall.type !== "function") continue;

            const toolCallInfo = {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
              status: "pending" as const,
            };

            try {
              const result = await executeAITool(
                toolCall.function.name,
                JSON.parse(toolCall.function.arguments),
                { userId: this.config.userId || undefined, finalizationMode: "semi_autonomous" }
              );
              agentResponse.toolCalls?.push({
                ...toolCallInfo,
                status: "executed",
                result,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Execution failed";
              agentResponse.toolCalls?.push({
                ...toolCallInfo,
                status: "pending",
                result: { error: errorMessage },
              });
            }
          }
          break;
      }
    }

    return agentResponse;
  }

  /**
   * Auto-review an AI proposal when it enters the queue.
   * If valid, approve and execute immediately. Only flag for human review if issues found.
   */
  private async autoReviewProposal(
    assistQueueId: string,
    toolCalls: Array<{ id: string; name: string; arguments: string; status: "pending" }>
  ): Promise<void> {
    try {
      // Simple validation: check all required fields are present for each tool
      let allValid = true;
      const validationResults: Array<{ tool: string; valid: boolean; reason?: string }> = [];
      
      for (const tc of toolCalls) {
        const args = JSON.parse(tc.arguments);
        const toolDef = aiToolDefinitions.find(t => t.function.name === tc.name);
        
        if (!toolDef) {
          validationResults.push({ tool: tc.name, valid: false, reason: "Unknown tool" });
          allValid = false;
          continue;
        }
        
        // Check required fields
        const required = toolDef.function.parameters.required || [];
        const missingFields = required.filter(f => args[f] === undefined || args[f] === null || args[f] === "");
        
        if (missingFields.length > 0) {
          validationResults.push({ tool: tc.name, valid: false, reason: `Missing required fields: ${missingFields.join(", ")}` });
          allValid = false;
        } else {
          validationResults.push({ tool: tc.name, valid: true });
        }
      }
      
      if (allValid) {
        // Auto-approve and execute
        await storage.updateAssistQueueEntry(assistQueueId, {
          status: "approved",
          architectApprovedAt: new Date(),
        });
        
        // Execute the approved tools
        for (const tc of toolCalls) {
          try {
            await executeAITool(
              tc.name,
              JSON.parse(tc.arguments),
              { userId: this.config.userId || undefined, finalizationMode: "semi_autonomous", assistQueueId }
            );
          } catch (error) {
            console.error(`[AutoReview] Tool ${tc.name} execution failed:`, error);
          }
        }
        
        // Mark as executed
        await storage.updateAssistQueueEntry(assistQueueId, {
          status: "executed",
          executedAt: new Date(),
        });
        
        // Log auto-approval to ledger
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: "AI_PROPOSAL_AUTO_APPROVED",
          entityType: "assist_queue",
          entityId: assistQueueId,
          mode: "auto",
          status: "executed",
          diffJson: {
            validationResults,
            autoApproved: true,
          },
          reason: "All validations passed",
          assistQueueId,
        });
      } else {
        // Flag for human review
        await storage.createAutomationLedgerEntry({
          agentName: "Master Architect",
          actionType: "AI_PROPOSAL_NEEDS_REVIEW",
          entityType: "assist_queue",
          entityId: assistQueueId,
          mode: "assist",
          status: "pending_review",
          diffJson: {
            validationResults,
            autoApproved: false,
          },
          reason: "Validation failed - requires human review",
          assistQueueId,
        });
      }
    } catch (error) {
      console.error("[AutoReview] Error during auto-review:", error);
    }
  }

  async *streamChat(userMessage: string): AsyncGenerator<string, void, unknown> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: this.getSystemPrompt() },
      ...this.config.conversationHistory,
      { role: "user", content: userMessage },
    ];

    if (this.config.mode === "draft") {
      const stream = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield delta.content;
        }
      }
      return;
    }

    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: toOpenAITools(aiToolDefinitions),
      tool_choice: "auto",
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield delta.content;
      }
    }
  }

  async analyzePlan(userRequest: string): Promise<string[]> {
    const planPrompt = `User request: "${userRequest}"

Analyze this request and create a structured plan for the field service CRM.

Identify:
1. Which CRM entities are involved (contacts, jobs, estimates, invoices, payments)
2. What operations are needed in sequence
3. What data needs to be created or updated
4. What validations are required

Provide a step-by-step plan as a JSON array of strings.

Example format:
["Step 1: Retrieve contact ID for customer John", "Step 2: Create estimate with line items", "Step 3: Mark estimate as sent"]`;

    const planCompletion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a planning assistant. Be specific and actionable." },
        { role: "user", content: planPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const planResponse = JSON.parse(planCompletion.choices[0].message.content || "{}");
    return planResponse.plan || [];
  }
}
