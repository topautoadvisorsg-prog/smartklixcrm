import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User as UserIcon, Loader2, Settings, Sparkles } from "lucide-react";
import type { Message, Contact } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

type AgentMode = "draft" | "assist" | "auto";

interface AdminChatPanelProps {
  contactId?: string | null;
}

export default function AdminChatPanel({ contactId }: AdminChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<AgentMode>("assist");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(contactId || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch or create conversation
  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ["/api/admin-chat/conversations"],
    queryFn: async () => {
      const response = await fetch("/api/admin-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    staleTime: Infinity,
  });

  // Set conversation ID when loaded
  useEffect(() => {
    if (conversation?.id) {
      setConversationId(conversation.id);
      // Set mode from conversation metadata
      if (conversation.metadata?.mode) {
        setMode(conversation.metadata.mode as AgentMode);
      }
    }
  }, [conversation]);

  // Fetch messages for conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/admin-chat/conversations", conversationId, "messages"],
    queryFn: async () => {
      if (!conversationId) return [];
      const response = await fetch(`/api/admin-chat/conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!conversationId,
  });

  // Fetch contacts for context selector
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!conversationId) throw new Error("No conversation");
      
      // Build payload - omit contactId if null
      const payload: { conversationId: string; message: string; contactId?: string } = {
        conversationId,
        message: text,
      };
      
      if (selectedContactId) {
        payload.contactId = selectedContactId;
      }
      
      const response = await apiRequest("POST", "/api/admin-chat/message", payload);
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin-chat/conversations", conversationId, "messages"] });
      
      // Check for queued proposals in response
      if (data?.actions && Array.isArray(data.actions)) {
        const queuedActions = data.actions.filter(
          (action: any) => action.status === "queued"
        );
        
        if (queuedActions.length > 0) {
          // Show toast notification with proposal info
          toast({
            title: `${queuedActions.length} proposal(s) created`,
            description: "Check Review Queue to approve and execute",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/review-queue";
                }}
              >
                View Queue
              </Button>
            ),
          });
          
          // Force refresh of proposals data
          queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mode mutation
  const updateModeMutation = useMutation({
    mutationFn: async (newMode: AgentMode) => {
      if (!conversationId) throw new Error("No conversation");
      const response = await apiRequest("POST", "/api/admin-chat/mode", {
        conversationId,
        mode: newMode,
      });
      const data = await response.json();
      return { mode: newMode, data };
    },
    onSuccess: (result) => {
      toast({
        title: "Mode updated",
        description: `Proposal Agent now in ${result.mode.toUpperCase()} mode`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin-chat/conversations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update mode",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle mode change
  const handleModeChange = (newMode: string) => {
    const modeValue = newMode as AgentMode;
    setMode(modeValue);
    updateModeMutation.mutate(modeValue);
  };

  // Handle send message
  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getModeInfo = (mode: AgentMode) => {
    switch (mode) {
      case "draft":
        return { color: "bg-blue-500", label: "Draft", desc: "Suggests only" };
      case "assist":
        return { color: "bg-yellow-500", label: "Assist", desc: "Queues for approval" };
      case "auto":
        return { color: "bg-green-500", label: "Auto", desc: "Executes automatically" };
    }
  };

  const modeInfo = getModeInfo(mode);

  if (loadingConversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode selector */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Proposal Agent</CardTitle>
              <p className="text-xs text-muted-foreground">Proposal Agent with full CRM access</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger className="w-32 h-8" data-testid="select-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft" data-testid="mode-draft">Draft</SelectItem>
                  <SelectItem value="assist" data-testid="mode-assist">Assist</SelectItem>
                  <SelectItem value="auto" data-testid="mode-auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary" className="gap-1">
              <div className={`w-2 h-2 rounded-full ${modeInfo.color}`} />
              {modeInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-3 pb-3">
          <p className="text-xs text-muted-foreground flex-1">{modeInfo.desc}</p>
          {contacts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Context:</span>
              <Select value={selectedContactId || "none"} onValueChange={(val) => setSelectedContactId(val === "none" ? null : val)}>
                <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-contact-context">
                  <SelectValue placeholder="No contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.slice(0, 20).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name || contact.email || contact.phone || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Start a conversation</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask me to manage contacts, schedule jobs, send invoices, or anything else!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="w-4 h-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col gap-1 max-w-[70%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-lg px-4 py-2.5 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${msg.role}-${msg.id}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {msg.role === "user" && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-secondary">
                        <UserIcon className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask Proposal Agent anything..."
              disabled={sendMessageMutation.isPending}
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isPending}
              size="icon"
              data-testid="button-send-message"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
