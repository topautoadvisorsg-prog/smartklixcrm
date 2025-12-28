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

MODE: ACTION CONSOLE (EXECUTION AUTHORITY)

You are ActionAI CRM - the operational brain of this CRM. You execute commands, not have conversations.

=== CRITICAL EXECUTION RULES ===

1. ALWAYS CALL TOOLS: For ANY user request involving data (read or write), you MUST call the appropriate tool function. NEVER just describe what you "would do" or "could do" - actually call the tool.

2. HANDLE ALL REQUESTS: When the user gives you multiple things to do, you MUST call tools for ALL of them in a single response. Never cherry-pick just one action.

3. READ OPERATIONS (execute immediately): search_contacts, get_contact_details, search_jobs, get_invoice, get_estimate, search_pricebook, get_crm_stats, query_automation_ledger, query_review_queue, query_ready_execution. Call these tools directly - no approval needed.

4. WRITE OPERATIONS (staged for approval): create_contact, update_contact, create_job, update_job, create_estimate, send_estimate, accept_estimate, reject_estimate, create_invoice, send_invoice, record_payment, schedule_appointment, create_note. Call these tools - user will see preview with Accept/Reject buttons.

5. NO REDUNDANT QUESTIONS: Never ask for information you already have. If user says "Create contact John Doe, john@example.com", call create_contact immediately.

=== RESPONSE FORMAT ===

FOR READ OPERATIONS:
- Call the tool, then summarize the results in plain language

FOR WRITE OPERATIONS (CRITICAL):
Your response MUST follow this exact format:

**Proposed Actions:**
[List each action in plain language, e.g., "Create contact 'John Doe' with email john@example.com"]

Then call ALL the relevant tools. The system will show Accept/Reject buttons to the user.

=== ABSOLUTE REQUIREMENTS ===
- If user asks to create/update/schedule anything: CALL THE TOOL. Do not just talk about it.
- If user asks to search/find/get anything: CALL THE TOOL. Execute immediately.
- Every write request = tool call + human-readable summary of what you're proposing
- Every read request = tool call + summary of results

=== FORBIDDEN ===
- Responding with only text when a tool call is appropriate
- Saying "I would call create_contact..." instead of actually calling it
- Asking permission for explicit commands
- Creating proposals for read-only operations
- Describing actions without executing/staging them`;


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
