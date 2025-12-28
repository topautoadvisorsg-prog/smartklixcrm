import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: Array<{
    name: string;
    status: "pending" | "approved" | "executed";
  }>;
};

export default function CRMAgentChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your CRM Agent AI. I can help you manage contacts, create jobs, send communications, and handle various CRM tasks. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const { data: config } = useQuery<any>({
    queryKey: ["/api/ai/crm-agent/config"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory = messages
        .filter(m => m.id !== "welcome")
        .map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
      
      return await apiRequest("POST", "/api/ai/chat/internal", {
        message,
        context: "crm_agent",
        conversationHistory,
      });
    },
    onSuccess: (response: any) => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: response.message || response.response || "Action completed successfully.",
        timestamp: new Date(),
        actions: response.actions?.map((action: any) => ({
          name: action.tool || action.name,
          status: action.status || "executed",
        })),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (response.actions && response.actions.length > 0) {
        toast({
          title: "Actions Logged",
          description: `${response.actions.length} action(s) have been logged in GPT Actions.`,
        });
      }
    },
    onError: (error: any) => {
      const errorContent = error.message || "Something went wrong. Please try again.";
      
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `I'm sorry, I couldn't complete that request. ${errorContent}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: "Message Failed",
        description: errorContent,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(inputValue);
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              CRM Agent Chat
            </h1>
            <p className="text-sm text-muted-foreground">
              Internal chat interface for CRM Agent AI - test actions, manage CRM data, and communicate with AI
            </p>
          </div>
          <Badge variant={config?.globalEnabled ? "default" : "secondary"} data-testid="status-agent">
            {config?.globalEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <Alert className="mb-4">
        <MessageSquare className="w-4 h-4" />
        <AlertDescription>
          All actions triggered through this chat are logged in <strong>GPT Actions</strong> and subject to <strong>Master Architect</strong> approval when required.
        </AlertDescription>
      </Alert>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversation</CardTitle>
          <CardDescription>
            Chat with CRM Agent using the configured internal context and behavior rules
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.role}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === "assistant" && (
                        <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.actions && message.actions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium opacity-70">Actions:</p>
                            {message.actions.map((action, idx) => (
                              <Badge
                                key={idx}
                                variant={
                                  action.status === "executed"
                                    ? "default"
                                    : action.status === "approved"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="mr-1"
                              >
                                {action.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <p className="text-sm">CRM Agent is thinking...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message here... (Shift+Enter for new line)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                className="resize-none min-h-[60px]"
                disabled={sendMessageMutation.isPending}
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || sendMessageMutation.isPending}
                size="icon"
                className="h-[60px] w-[60px]"
                data-testid="button-send"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
