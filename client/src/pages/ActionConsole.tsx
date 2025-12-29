import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Send, Bot, User, Clock, Eye, Check, X, CheckCircle, AlertCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ActionItem {
  tool: string;
  status: string;
  args: unknown;
  result?: unknown;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  proposalId?: string;
  proposalStatus?: "pending" | "approved" | "rejected" | "staged" | "queued";
  actions?: Array<ActionItem>;
  stagedActions?: Array<ActionItem>;
  executedActions?: Array<ActionItem>;
  stagedBundleId?: string;
  queueEntryId?: string;
  readyForProposal?: boolean;
}

interface ConversationHistoryItem {
  role: "user" | "assistant" | "system";
  content: string;
  toolResults?: string;
  stagedActions?: string;
}

function formatActionDescription(tool: string, args: unknown): string {
  const a = args as Record<string, unknown>;
  switch (tool) {
    case "create_contact":
      return `Create contact "${a.name || "Unknown"}"${a.email ? ` (${a.email})` : ""}${a.phone ? ` - ${a.phone}` : ""}`;
    case "update_contact":
      return `Update contact #${a.contactId}${a.name ? ` - set name to "${a.name}"` : ""}`;
    case "create_job":
      return `Create job "${a.title || "Untitled"}" for contact #${a.contactId}`;
    case "update_job":
      return `Update job #${a.jobId}${a.status ? ` - status: ${a.status}` : ""}`;
    case "create_estimate":
      return `Create estimate for job #${a.jobId}`;
    case "send_estimate":
      return `Send estimate #${a.estimateId} to customer`;
    case "accept_estimate":
      return `Mark estimate #${a.estimateId} as accepted`;
    case "reject_estimate":
      return `Mark estimate #${a.estimateId} as rejected`;
    case "create_invoice":
      return `Create invoice for job #${a.jobId}`;
    case "send_invoice":
      return `Send invoice #${a.invoiceId} to customer`;
    case "record_payment":
      return `Record payment of $${a.amount || 0} for invoice #${a.invoiceId}`;
    case "schedule_appointment":
      return `Schedule appointment "${a.title || "Meeting"}" on ${a.scheduledDate || "TBD"}`;
    case "create_note":
      return `Add note to ${a.entityType} #${a.entityId}`;
    default:
      return `${tool.replace(/_/g, " ")}`;
  }
}

function getToolIcon(tool: string): string {
  if (tool.startsWith("create_")) return "➕";
  if (tool.startsWith("update_")) return "✏️";
  if (tool.startsWith("send_")) return "📤";
  if (tool.startsWith("schedule_")) return "📅";
  if (tool.includes("accept")) return "✅";
  if (tool.includes("reject")) return "❌";
  if (tool.includes("payment")) return "💰";
  if (tool.includes("note")) return "📝";
  return "⚡";
}

// PROPOSAL COMPLETENESS CHECK - Detects if user requested items that aren't staged
interface ExpectedAction {
  keywords: string[];
  tool: string;
  label: string;
}

const EXPECTED_ACTIONS: ExpectedAction[] = [
  { keywords: ["contact", "customer", "client"], tool: "create_contact", label: "Contact" },
  { keywords: ["estimate", "quote", "$", "price", "cost"], tool: "create_estimate", label: "Estimate" },
  { keywords: ["payment link", "pay link", "payment url"], tool: "stripe_create_payment_link", label: "Payment Link" },
  { keywords: ["email", "send email", "email them", "email him", "email her"], tool: "send_email", label: "Email" },
  { keywords: ["invoice", "bill"], tool: "create_invoice", label: "Invoice" },
  { keywords: ["job", "work order"], tool: "create_job", label: "Job" },
];

// Resolution tools - if these were executed, the corresponding create action may not be needed
const RESOLUTION_TOOLS: Record<string, string[]> = {
  "create_contact": ["search_contacts"], // If search_contacts was executed, contact creation may be resolved
};

// Check if an intent was resolved through prior tool execution + user confirmation
function isIntentResolved(
  tool: string,
  conversationContext: ChatMessage[]
): boolean {
  const resolutionTools = RESOLUTION_TOOLS[tool];
  if (!resolutionTools) return false;
  
  // Check if any resolution tool was executed in the conversation
  for (const msg of conversationContext) {
    if (msg.role === "assistant" && msg.executedActions) {
      const hasResolutionTool = msg.executedActions.some(action => 
        resolutionTools.includes(action.tool)
      );
      
      if (hasResolutionTool) {
        // Check if there was a subsequent user confirmation (yes, ok, confirm, use, etc.)
        const msgIndex = conversationContext.findIndex(m => m.id === msg.id);
        for (let i = msgIndex + 1; i < conversationContext.length; i++) {
          const nextMsg = conversationContext[i];
          if (nextMsg.role === "user") {
            const content = nextMsg.content.toLowerCase().trim();
            // Short affirmative responses indicate user confirmed using existing entity
            if (["yes", "ok", "okay", "sure", "yep", "yeah", "confirm", "use", "that one", "1", "2"].some(
              affirm => content === affirm || content.startsWith(affirm + " ") || content.startsWith(affirm + ",")
            )) {
              return true; // Intent was resolved via search + user confirmation
            }
          }
          // Stop at assistant response with staged actions (new workflow)
          if (nextMsg.role === "assistant" && nextMsg.stagedActions && nextMsg.stagedActions.length > 0) {
            break;
          }
        }
      }
    }
  }
  
  return false;
}

function detectMissingActions(
  userMessages: string[],
  stagedTools: string[],
  conversationContext?: ChatMessage[]
): { missing: string[]; isComplete: boolean } {
  const combinedInput = userMessages.join(" ").toLowerCase();
  const missing: string[] = [];

  for (const expected of EXPECTED_ACTIONS) {
    const isRequested = expected.keywords.some(kw => combinedInput.includes(kw.toLowerCase()));
    const isStaged = stagedTools.some(t => t === expected.tool || t.includes(expected.tool.replace("create_", "")));
    
    // Check if intent was resolved through prior search + user confirmation
    const wasResolved = conversationContext 
      ? isIntentResolved(expected.tool, conversationContext)
      : false;
    
    if (isRequested && !isStaged && !wasResolved) {
      missing.push(expected.label);
    }
  }

  return { missing, isComplete: missing.length === 0 };
}

export default function ActionConsole() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-1",
      role: "system",
      content: "ActionAI Console Online. I am the operational brain. I can propose actions, drafts, and record updates based on your commands. All output requires governance approval.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory: ConversationHistoryItem[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          let content = m.content;
          
          if (m.role === "assistant") {
            if (m.executedActions && m.executedActions.length > 0) {
              const toolSummary = m.executedActions.map(a => {
                const resultStr = a.result ? JSON.stringify(a.result) : "completed";
                return `[TOOL RESULT] ${a.tool}: ${resultStr}`;
              }).join("\n");
              content += "\n\n" + toolSummary;
            }
            
            if (m.stagedActions && m.stagedActions.length > 0) {
              const stagedSummary = m.stagedActions.map(a => {
                return `[STAGED] ${a.tool}(${JSON.stringify(a.args)})`;
              }).join("\n");
              content += "\n\n[PENDING APPROVAL]\n" + stagedSummary;
            }
          }
          
          return { role: m.role, content };
        });
      
      conversationHistory.push({ role: "user", content: message });

      const res = await apiRequest("POST", "/api/ai/chat/internal", {
        message,
        conversationHistory,
        context: "crm_agent",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to process your request." }));
        throw new Error(errorData.message || "Failed to process your request.");
      }
      
      return res.json() as Promise<{ 
        message: string; 
        actions?: Array<{ tool: string; status: string; args: unknown; result?: unknown }>; 
        stagedBundleId?: string;
        mode?: string;
        readyForProposal?: boolean;
      }>;
    },
    onSuccess: (response) => {
      const allActions = response.actions || [];
      
      const executedActions = allActions.filter(a => a.status === "executed");
      const queuedActions = allActions.filter(a => a.status === "queued");
      const stagedActions = allActions.filter(a => a.status === "staged");
      
      const hasQueuedActions = queuedActions.length > 0;
      const hasStagedActions = stagedActions.length > 0;
      const proposalId = hasQueuedActions ? `P-${Date.now().toString().slice(-6)}` : undefined;
      
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.message || "I've analyzed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        proposalId,
        proposalStatus: hasStagedActions ? "staged" : (proposalId ? "pending" : undefined),
        executedActions: executedActions.length > 0 ? executedActions : undefined,
        stagedActions: hasStagedActions ? stagedActions : undefined,
        actions: hasQueuedActions ? queuedActions : undefined,
        stagedBundleId: response.stagedBundleId,
        readyForProposal: response.readyForProposal,
      };
      setMessages((prev) => [...prev, aiMessage]);
      
      if (hasQueuedActions) {
        queryClient.invalidateQueries({ queryKey: ["/api/approval-hub"] });
        queryClient.invalidateQueries({ queryKey: ["/api/assist-queue"] });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to process your request.", 
        variant: "destructive" 
      });
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMutation.mutate(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="page-action-console">
      <header className="px-6 py-4 border-b border-glass-border bg-glass-surface backdrop-blur-xl flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground uppercase tracking-tight" data-testid="text-page-title">
              Action Console
            </h2>
            <p className="text-[10px] text-primary font-semibold uppercase tracking-[0.2em]">
              Direct Brain Interface
            </p>
          </div>
        </div>
        <Badge variant="outline" className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-success mr-2 animate-pulse" />
          System Active
        </Badge>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[70%] p-5 rounded-[1.5rem] relative ${
                    msg.role === "user"
                      ? "bg-glass-surface border border-glass-border text-foreground"
                      : msg.role === "system"
                      ? "bg-muted/30 border border-glass-border text-muted-foreground"
                      : "bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {msg.role === "user" ? (
                        <User className="w-3 h-3 opacity-60" />
                      ) : (
                        <Bot className="w-3 h-3 opacity-60" />
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${
                        msg.role === "assistant" ? "text-primary" : "opacity-60"
                      }`}>
                        {msg.role === "user" ? "Operator" : msg.role === "system" ? "System" : "ActionAI Engine"}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono opacity-40 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {msg.timestamp}
                    </span>
                  </div>

                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.readyForProposal && (
                    <div className="mt-4 pt-4 border-t-2 border-primary/30">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          Ready to Generate Proposal
                        </span>
                        <p className="text-sm text-muted-foreground mt-2 mb-4">
                          I have gathered all the necessary information. Click below to generate the proposal for your review.
                        </p>
                        <Button
                          size="sm"
                          className="h-10 px-6 bg-primary hover:bg-primary/90 font-semibold"
                          onClick={() => {
                            const confirmMessage: ChatMessage = {
                              id: Date.now().toString(),
                              role: "user",
                              content: "Yes, proceed with the proposal.",
                              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            };
                            setMessages((prev) => [...prev, confirmMessage]);
                            sendMutation.mutate("Yes, proceed with the proposal.");
                          }}
                          disabled={sendMutation.isPending}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Generate Proposal
                        </Button>
                      </div>
                    </div>
                  )}

                  {msg.executedActions && msg.executedActions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-glass-border">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-success mb-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Completed:
                      </span>
                      {msg.executedActions.map((action, idx) => (
                        <div key={idx} className="text-xs font-mono bg-success/10 border border-success/20 rounded-lg p-2 mb-1">
                          <span className="text-success">{action.tool}</span>
                          <span className="text-muted-foreground"> (executed)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.stagedActions && msg.stagedActions.length > 0 && msg.proposalStatus === "staged" && (() => {
                    // Check for incomplete proposals - only look at the MOST RECENT user message
                    // that triggered this proposal, not the entire conversation history
                    const msgIndex = messages.findIndex(m => m.id === msg.id);
                    const recentUserMessages: string[] = [];
                    const recentMessages: ChatMessage[] = []; // Only messages in current workflow window
                    let windowStartIndex = 0;
                    
                    // Walk backwards from this message to find the triggering user message(s)
                    // Stop at any previous proposal (staged, queued, approved, OR rejected)
                    for (let i = msgIndex - 1; i >= 0; i--) {
                      const prevMsg = messages[i];
                      if (prevMsg.role === "user") {
                        recentUserMessages.unshift(prevMsg.content);
                      } else if (prevMsg.role === "assistant" && prevMsg.proposalStatus && 
                                 ["staged", "queued", "approved", "rejected"].includes(prevMsg.proposalStatus)) {
                        // Hit a previous proposal (any status) - stop here to avoid old requests
                        windowStartIndex = i + 1;
                        break;
                      }
                    }
                    
                    // Build conversation context for ONLY this workflow window
                    for (let i = windowStartIndex; i <= msgIndex; i++) {
                      recentMessages.push(messages[i]);
                    }
                    
                    const stagedTools = msg.stagedActions?.map(a => a.tool) || [];
                    // Pass only current workflow context to detect resolved intents
                    const { missing, isComplete } = detectMissingActions(recentUserMessages, stagedTools, recentMessages);
                    
                    return (
                    <div className="mt-4 pt-4 border-t-2 border-warning/30">
                      <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-warning mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Pending Approval ({msg.stagedActions.length} action{msg.stagedActions.length > 1 ? "s" : ""})
                        </span>
                        <div className="space-y-2 mt-3">
                          {msg.stagedActions.map((action, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-background/50 border border-glass-border rounded-lg p-3">
                              <span className="text-lg">{getToolIcon(action.tool)}</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {formatActionDescription(action.tool, action.args)}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                                  Tool: {action.tool}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* INCOMPLETE PROPOSAL WARNING */}
                        {!isComplete && (
                          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-destructive">Incomplete Proposal</p>
                                <p className="text-xs text-destructive/80 mt-1">
                                  You requested: <strong>{missing.join(", ")}</strong> but {missing.length === 1 ? "it's" : "they're"} not staged.
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Ask the AI to include all items, or reject and try again.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className={`h-8 px-4 ${isComplete ? "bg-primary hover:bg-primary/90" : "bg-destructive/80 hover:bg-destructive"}`}
                            disabled={!msg.stagedBundleId}
                            onClick={async () => {
                              if (!isComplete) {
                                const confirmSend = window.confirm(
                                  `This proposal is missing: ${missing.join(", ")}. Are you sure you want to send an incomplete proposal to review?`
                                );
                                if (!confirmSend) return;
                              }
                              if (!msg.stagedBundleId) {
                                toast({ title: "Error", description: "No staged bundle ID found.", variant: "destructive" });
                                return;
                              }
                              try {
                                const res = await apiRequest("POST", "/api/ai/staged/accept", {
                                  stagedBundleId: msg.stagedBundleId,
                                });
                                if (res.ok) {
                                  const data = await res.json();
                                  setMessages(prev => prev.map(m => 
                                    m.id === msg.id 
                                      ? { ...m, proposalStatus: "queued" as const, queueEntryId: data.queueEntryId }
                                      : m
                                  ));
                                  toast({ 
                                    title: "Sent to Review Queue", 
                                    description: "Proposal awaiting Master Architect validation." 
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/assist-queue"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/automation-ledger"] });
                                } else {
                                  const errorData = await res.json().catch(() => ({}));
                                  toast({ title: "Error", description: errorData.message || "Failed to send to review.", variant: "destructive" });
                                }
                              } catch {
                                toast({ title: "Error", description: "Failed to send to review.", variant: "destructive" });
                              }
                            }}
                          >
                            <Check className="w-3 h-3 mr-1.5" />
                            {isComplete ? "Send to Review Queue" : "Send Anyway (Incomplete)"}
                          </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-4 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            try {
                              await apiRequest("POST", "/api/ai/staged/reject", {
                                stagedBundleId: msg.stagedBundleId,
                              });
                              setMessages(prev => prev.map(m => 
                                m.id === msg.id 
                                  ? { ...m, proposalStatus: "rejected" as const, stagedActions: undefined }
                                  : m
                              ));
                              toast({ title: "Rejected", description: "Staged actions discarded." });
                            } catch {
                              toast({ title: "Error", description: "Failed to reject actions.", variant: "destructive" });
                            }
                          }}
                          >
                            <X className="w-3 h-3 mr-1.5" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                  })()}

                  {msg.stagedActions && msg.stagedActions.length > 0 && msg.proposalStatus === "approved" && (
                    <div className="mt-3 pt-3 border-t border-glass-border">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-success mb-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Approved & Executed:
                      </span>
                      {msg.stagedActions.map((action, idx) => (
                        <div key={idx} className="text-xs font-mono bg-success/10 border border-success/20 rounded-lg p-2 mb-1">
                          <span className="text-success">{action.tool}</span>
                          <span className="text-muted-foreground"> (executed)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.proposalStatus === "rejected" && (
                    <div className="mt-3 pt-3 border-t border-glass-border">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-destructive mb-2 flex items-center gap-1">
                        <X className="w-3 h-3" />
                        Rejected
                      </span>
                    </div>
                  )}

                  {msg.proposalStatus === "queued" && msg.stagedActions && (
                    <div className="mt-4 pt-4 border-t-2 border-primary/30">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 animate-pulse" />
                          In Review Queue
                        </span>
                        <div className="space-y-2 mt-3">
                          {msg.stagedActions.map((action, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-background/50 border border-glass-border rounded-lg p-3">
                              <span className="text-lg">{getToolIcon(action.tool)}</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {formatActionDescription(action.tool, action.args)}
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                                  Awaiting Master Architect validation
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            This proposal is awaiting validation. Check the <strong>Review Queue</strong> for status.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-glass-border">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2 block">
                        Queued Actions:
                      </span>
                      {msg.actions.map((action, idx) => (
                        <div key={idx} className="text-xs font-mono bg-primary/10 border border-primary/20 rounded-lg p-2 mb-1">
                          <span className="text-primary">{action.tool}</span>
                          <span className="text-muted-foreground"> (queued for review)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.proposalId && msg.proposalStatus === "pending" && (
                    <div className="mt-4 pt-3 border-t border-glass-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Proposal Pending
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-[10px] font-mono font-bold"
                        data-testid={`button-view-proposal-${msg.proposalId}`}
                      >
                        <Eye className="w-3 h-3 mr-1.5" />
                        VIEW {msg.proposalId}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-[1.5rem] p-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 bg-background border-t border-glass-border shrink-0">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative flex items-center bg-glass-surface border-2 border-glass-border rounded-[2rem] p-2 focus-within:border-primary/50 transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Instruct ActionAI (e.g., 'Create a lead for Acme Corp')..."
                className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none px-5 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground"
                data-testid="input-action-message"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                size="icon"
                className="rounded-[1.5rem] w-12 h-12 shadow-lg shadow-primary/20"
                data-testid="button-send-action"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <div className="text-center mt-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Governance Active: All instructions are drafted as proposals for review.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
