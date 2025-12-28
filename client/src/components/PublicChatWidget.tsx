import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface PublicChatWidgetProps {
  welcomeMessage?: string;
  companyName?: string;
  themeColor?: string;
  position?: "bottom-right" | "bottom-left";
}

export function PublicChatWidget({
  welcomeMessage = "Hi! How can we help you today?",
  companyName = "Support",
  themeColor = "hsl(var(--primary))",
  position = "bottom-right",
}: PublicChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactIdentified, setContactIdentified] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session on first open
  useEffect(() => {
    const storedToken = localStorage.getItem("publicChatSessionToken");
    if (storedToken) {
      setSessionToken(storedToken);
      loadSessionMessages(storedToken);
    }
  }, []);

  // Load messages for existing session
  async function loadSessionMessages(token: string) {
    try {
      const response = await fetch(`/api/public-chat/messages/${token}`);
      if (!response.ok) {
        // Invalid session, reset state completely
        resetSession();
        return;
      }
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to load messages:", error);
      resetSession();
    }
  }

  // Reset session state (used for invalid sessions)
  function resetSession() {
    localStorage.removeItem("publicChatSessionToken");
    setSessionToken(null);
    setMessages([]);
    setContactIdentified(false);
  }

  // Create new session
  async function createSession() {
    try {
      const res = await apiRequest("POST", "/api/public-chat/sessions", {
        welcomeMessage,
      });
      
      const response = (await res.json()) as {
        sessionToken: string;
        conversationId: string;
        welcomeMessage: Message;
      };

      setSessionToken(response.sessionToken);
      localStorage.setItem("publicChatSessionToken", response.sessionToken);

      // Add welcome message
      if (response.welcomeMessage) {
        setMessages([response.welcomeMessage]);
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  }

  // Handle opening the widget
  async function handleOpen() {
    setIsOpen(true);
    if (!sessionToken) {
      await createSession();
    }
  }

  // Send message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || !sessionToken) return;

    const userMessageContent = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/public-chat/messages", {
        sessionToken,
        message: userMessageContent,
      });
      
      const response = (await res.json()) as {
        userMessage: Message;
        aiResponse: Message;
      };

      // Add both user message and AI response
      setMessages((prev) => [
        ...prev,
        response.userMessage,
        response.aiResponse,
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Re-add the input value on error
      setInputValue(userMessageContent);
    } finally {
      setIsLoading(false);
    }
  }

  // Submit contact form
  async function handleSubmitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/public-chat/identify", {
        sessionToken,
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        company: contactForm.company,
        message: "Contact identified via widget",
      });

      setContactIdentified(true);
      setShowContactForm(false);

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Thanks ${contactForm.name}! We've received your information and will get back to you shortly.`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Failed to identify lead:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const positionClasses = position === "bottom-right" 
    ? "bottom-4 right-4" 
    : "bottom-4 left-4";

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      {!isOpen ? (
        // Chat bubble (minimized)
        <Button
          size="icon"
          onClick={handleOpen}
          className="h-14 w-14 rounded-full shadow-lg"
          style={{ backgroundColor: themeColor }}
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      ) : (
        // Chat window (expanded)
        <Card className="w-[380px] h-[600px] flex flex-col shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-white" />
              <h3 className="font-semibold text-white">{companyName}</h3>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-white hover:bg-white/20"
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                data-testid={`message-${message.role}-${message.id}`}
              >
                <div className="flex gap-2 max-w-[80%]">
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Contact Form */}
          {showContactForm && !contactIdentified && (
            <div className="border-t p-4 space-y-3">
              <h4 className="font-semibold text-sm">
                Let us know how to reach you
              </h4>
              <form onSubmit={handleSubmitContact} className="space-y-2">
                <Input
                  placeholder="Name"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                  required
                  data-testid="input-contact-name"
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, email: e.target.value })
                  }
                  required
                  data-testid="input-contact-email"
                />
                <Input
                  type="tel"
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, phone: e.target.value })
                  }
                  data-testid="input-contact-phone"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading}
                    data-testid="button-submit-contact"
                  >
                    Submit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowContactForm(false)}
                    data-testid="button-cancel-contact"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Message Input */}
          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                data-testid="input-message"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {!contactIdentified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContactForm(true)}
                className="mt-2 text-xs"
                data-testid="button-show-contact-form"
              >
                Let us know how to reach you
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
