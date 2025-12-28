import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Lock, Bot, User, Clock, Search, AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ConversationHistoryItem {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function InformationAIChat() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-1",
      role: "system",
      content: "Information AI Chat Online. I have read-only access to your CRM data. Ask me about contacts, jobs, pipeline status, queue status, ledger entries, or any business insights. I cannot create, update, or delete any records.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory: ConversationHistoryItem[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      
      conversationHistory.push({ role: "user", content: message });

      const res = await apiRequest("POST", "/api/ai/chat/internal", {
        message,
        conversationHistory,
        context: "read_chat",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to process your query." }));
        throw new Error(errorData.message || "Failed to process your query.");
      }
      
      return res.json() as Promise<{ message: string; actions?: unknown[]; mode?: string }>;
    },
    onSuccess: (response) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.message || "I've analyzed your query. Here's what I found in the system.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to process your query.", 
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
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMutation.mutate(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6" data-testid="page-information-ai-chat">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" data-testid="text-page-title">
            <Info className="w-6 h-6 text-primary" />
            Information AI Chat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only conversational interface for CRM data retrieval
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
          <Lock className="w-3 h-3 mr-2" />
          READ-ONLY
        </Badge>
      </div>

      <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-warning shrink-0" />
        <p className="text-sm text-warning">
          <span className="font-semibold">Governance Lock:</span> Information AI Chat is permanently read-only. 
          No action execution. No proposals. No approvals. No ledger writes.
        </p>
      </div>

      <Card className="bg-glass-surface border-glass-border h-[calc(100vh-280px)] flex flex-col">
        <CardHeader className="pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Information AI Chat Interface
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px]">
                Read-Only Access
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl p-4 ${
                      msg.role === "user"
                        ? "bg-muted border border-border"
                        : msg.role === "system"
                        ? "bg-muted/50 border border-warning/20"
                        : "bg-muted/30 border border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {msg.role === "user" ? (
                        <User className="w-3 h-3" />
                      ) : (
                        <Bot className="w-3 h-3" />
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Information AI"}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {msg.timestamp}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {sendMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted/30 border border-border rounded-2xl p-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your CRM data (e.g., 'How many pending proposals?', 'Show contacts with open jobs')..."
                className="pl-10 pr-4 py-6"
                data-testid="input-information-query"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
