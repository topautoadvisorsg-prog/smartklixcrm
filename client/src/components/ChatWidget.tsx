import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  contactId: string | null;
  status: string;
}

interface ChatWidgetProps {
  embedded?: boolean;
  className?: string;
}

export function ChatWidget({ embedded = true, className }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(!embedded);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [message, setMessage] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "" });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] as Message[], refetch } = useQuery({
    queryKey: ["/api/chat/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 3000,
  }) as { data: Message[]; refetch: () => void };

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/conversations", { channel: "widget" });
      return await res.json() as Conversation;
    },
    onSuccess: (data) => {
      setConversationId(data.id);
      setContactId(data.contactId);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/message", {
        conversationId,
        contactId,
        message: content,
      });
      return await res.json();
    },
    onSuccess: () => {
      refetch();
      setMessage("");
    },
  });

  const identifyContactMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/chat/identify", {
        conversationId,
        ...data,
      });
      return await res.json() as { id: string };
    },
    onSuccess: (data) => {
      setContactId(data.id);
      setShowContactForm(false);
      setContactForm({ name: "", email: "", phone: "" });
    },
  });

  useEffect(() => {
    if (isOpen && !conversationId) {
      createConversationMutation.mutate();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversationId) return;
    sendMessageMutation.mutate(message);
  };

  const handleIdentifyContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversationId) return;
    identifyContactMutation.mutate(contactForm);
  };

  if (embedded && !isOpen) {
    return (
      <div className={cn("fixed bottom-4 right-4 z-50", className)}>
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className="rounded-full h-14 w-14 shadow-lg"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        embedded
          ? "fixed bottom-4 right-4 z-50 w-[380px]"
          : "w-full max-w-2xl mx-auto",
        className
      )}
    >
      <Card className="flex flex-col h-[600px] shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Chat with us</h3>
              <p className="text-xs text-muted-foreground">We're here to help</p>
            </div>
          </div>
          <div className="flex gap-1">
            {embedded && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                data-testid="button-minimize-chat"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
            {embedded && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8" data-testid="text-welcome">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">Welcome! How can we help you today?</p>
              <p className="text-xs mt-1">Send a message to get started</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
              data-testid={`message-${msg.role}-${msg.id}`}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex justify-start" data-testid="indicator-typing">
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {showContactForm && (
          <div className="border-t p-4 bg-muted/30">
            <form onSubmit={handleIdentifyContact} className="space-y-3">
              <p className="text-sm font-medium">Help us assist you better</p>
              <Input
                placeholder="Your name"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                data-testid="input-contact-name"
              />
              <Input
                type="email"
                placeholder="Email address"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                data-testid="input-contact-email"
              />
              <Input
                type="tel"
                placeholder="Phone number"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                data-testid="input-contact-phone"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={identifyContactMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowContactForm(false)}
                  data-testid="button-cancel-contact"
                >
                  Skip
                </Button>
              </div>
            </form>
          </div>
        )}

        <CardFooter className="p-3 border-t">
          {!contactId && messages.length >= 2 && !showContactForm && (
            <div className="mb-2 w-full">
              <Badge
                variant="secondary"
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setShowContactForm(true)}
                data-testid="button-show-contact-form"
              >
                Share your contact info for faster service
              </Badge>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="min-h-[44px] max-h-[120px] resize-none"
              data-testid="input-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
