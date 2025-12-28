import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MessageCircle, Send, Search, Info, Clock, AlertTriangle, User, Briefcase, X, Check, ChevronRight, Sparkles, RefreshCw } from "lucide-react";
import type { Contact, Job, Conversation as DbConversation, Message as DbMessage } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type SessionStatus = "active" | "expiring" | "expired";
type FilterType = "all" | "unread" | "assigned" | "expired" | "failed";
type SenderType = "customer" | "operator" | "system" | "ai_draft";

interface ConversationView {
  id: string;
  clientId: string;
  conversationId: string;
  contactName: string;
  phone: string;
  jobId?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  sessionStatus: SessionStatus;
  urgencyScore: number;
  assignedToMe: boolean;
  hasFailedMessage?: boolean;
}

interface MessageView {
  id: string;
  sender: SenderType;
  content: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read" | "failed";
}

const DEMO_CONVERSATIONS: ConversationView[] = [
  { id: "demo-1", clientId: "marcus_4837", conversationId: "marcus_4837-1", contactName: "Marcus Vane", phone: "+1 650 555-0192", jobId: "JOB-9021", lastMessage: "Technician is running 15m late, FYI.", timestamp: "2m ago", unreadCount: 1, sessionStatus: "active", urgencyScore: 95, assignedToMe: true },
  { id: "demo-2", clientId: "ayla_9021", conversationId: "ayla_9021-1", contactName: "Ayla Tech CEO", phone: "+1 415 555-2281", jobId: "JOB-8842", lastMessage: "System check complete. All nodes green.", timestamp: "1h ago", unreadCount: 0, sessionStatus: "expiring", urgencyScore: 60, assignedToMe: true },
  { id: "demo-3", clientId: "james_1174", conversationId: "james_1174-1", contactName: "James Miller", phone: "+1 212 555-9012", lastMessage: "When can we reschedule?", timestamp: "Yesterday", unreadCount: 0, sessionStatus: "expired", urgencyScore: 30, assignedToMe: false },
  { id: "demo-4", clientId: "global_4422", conversationId: "global_4422-1", contactName: "Global Build Support", phone: "+1 312 555-4422", jobId: "JOB-9102", lastMessage: "Attachment: Site_Layout_Draft.pdf", timestamp: "5m ago", unreadCount: 3, sessionStatus: "active", urgencyScore: 88, assignedToMe: false },
  { id: "demo-5", clientId: "unknown_9912", conversationId: "unknown_9912-1", contactName: "Unknown Node", phone: "+1 555 010-9912", lastMessage: "Delivery Failed", timestamp: "3h ago", unreadCount: 0, sessionStatus: "expired", urgencyScore: 90, assignedToMe: true, hasFailedMessage: true },
];

const DEMO_MESSAGES: MessageView[] = [
  { id: "m1", sender: "customer", content: "Hello, is Dave on his way yet?", timestamp: "10:00 AM", status: "read" },
  { id: "m2", sender: "system", content: "Automated Dispatch: Technician Dave Miller checked into route.", timestamp: "10:02 AM" },
  { id: "m3", sender: "operator", content: "Hi Marcus, yes Dave is currently 4 mins out. He will enter via the side gate as requested.", timestamp: "10:05 AM", status: "read" },
  { id: "m4", sender: "customer", content: "Great, thanks. I have the power panel open for him.", timestamp: "10:10 AM", status: "read" },
  { id: "m5", sender: "ai_draft", content: "Confirmed. Dave will start with the panel inspection. Do you have any specific safety protocols we should note?", timestamp: "10:11 AM" },
  { id: "m6", sender: "customer", content: "Actually, Technician is running 15m late, FYI. Just saw his truck pull over for gas.", timestamp: "10:42 AM" },
];

const TEMPLATES = [
  { id: "T1", name: "Appointment Reminder", body: "Hello {{1}}, this is a reminder for your scheduled service on {{2}}." },
  { id: "T2", name: "Maintenance Follow-up", body: "Hi {{1}}, we noticed your system is due for its Q4 overhaul. Would you like to {{2}}?" },
  { id: "T3", name: "Payment Overdue", body: "URGENT: Invoice {{1}} for ${{2}} is currently past due. Please resolve at {{3}}." },
];

function computeSessionStatus(conv: DbConversation): SessionStatus {
  if (conv.sessionStatus === "expired") return "expired";
  if (conv.sessionStatus === "expiring") return "expiring";
  if (conv.sessionExpiresAt) {
    const now = new Date();
    const expiry = new Date(conv.sessionExpiresAt);
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursRemaining <= 0) return "expired";
    if (hoursRemaining <= 4) return "expiring";
  }
  return "active";
}

export default function WhatsApp() {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<MessageView[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: dbConversations = [], isLoading: convLoading, refetch: refetchConversations } = useQuery<DbConversation[]>({
    queryKey: ["/api/conversations", { channel: "whatsapp" }],
    queryFn: async () => {
      const res = await fetch("/api/conversations?channel=whatsapp");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: selectedConvDetail } = useQuery<{ messages: DbMessage[] }>({
    queryKey: ["/api/conversations", selectedId],
    queryFn: async () => {
      if (!selectedId || selectedId.startsWith("demo-")) return { messages: [] };
      const res = await fetch(`/api/conversations/${selectedId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!selectedId && !selectedId.startsWith("demo-"),
  });

  const conversations: ConversationView[] = useMemo(() => {
    if (dbConversations.length === 0) {
      return DEMO_CONVERSATIONS;
    }
    return dbConversations.map((conv): ConversationView => {
      const contact = contacts.find(c => c.id === conv.contactId);
      return {
        id: conv.id,
        clientId: conv.clientId || `client_${conv.id.slice(0, 4)}`,
        conversationId: conv.conversationId || `${conv.clientId || "unknown"}-1`,
        contactName: contact?.name || "Unknown Contact",
        phone: contact?.phone || "",
        jobId: conv.jobId || undefined,
        lastMessage: "",
        timestamp: conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : "No messages",
        unreadCount: 0,
        sessionStatus: computeSessionStatus(conv),
        urgencyScore: conv.urgencyScore || 50,
        assignedToMe: !!conv.assignedUserId,
        hasFailedMessage: false,
      };
    });
  }, [dbConversations, contacts]);

  const messages: MessageView[] = useMemo(() => {
    if (selectedId?.startsWith("demo-")) {
      return DEMO_MESSAGES;
    }
    if (selectedConvDetail?.messages?.length) {
      return selectedConvDetail.messages.map((msg): MessageView => ({
        id: msg.id,
        sender: (msg.senderType as SenderType) || (msg.role === "user" ? "customer" : "operator"),
        content: msg.content,
        timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: (msg.messageStatus as "sent" | "delivered" | "read" | "failed") || "sent",
      }));
    }
    return localMessages;
  }, [selectedId, selectedConvDetail, localMessages]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (conversations.length > 0 && !selectedId) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedId]);

  const dispatchMutation = useMutation({
    mutationFn: async (data: { clientId: string; conversationId: string; message: string; channel: string; templateId?: string }) => {
      return apiRequest("POST", "/api/whatsapp/dispatch", data);
    },
    onSuccess: () => {
      toast({
        title: "Dispatch Authorized",
        description: "Message queued for Neo8 delivery. CRM does not send directly.",
      });
      setMessageInput("");
    },
    onError: (error) => {
      toast({
        title: "Dispatch Failed",
        description: error instanceof Error ? error.message : "Failed to authorize dispatch",
        variant: "destructive",
      });
    },
  });

  const handleDispatch = () => {
    if (!selectedConv || !messageInput.trim()) return;
    if (selectedConv.sessionStatus === "expired") {
      toast({
        title: "Session Expired",
        description: "Use a template message to re-engage this contact.",
        variant: "destructive",
      });
      return;
    }

    dispatchMutation.mutate({
      clientId: selectedConv.clientId,
      conversationId: selectedConv.conversationId,
      message: messageInput,
      channel: "whatsapp",
    });
  };

  const handleTemplateDispatch = () => {
    if (!selectedConv || !selectedTemplate) return;
    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return;

    dispatchMutation.mutate({
      clientId: selectedConv.clientId,
      conversationId: selectedConv.conversationId,
      message: template.body,
      channel: "whatsapp",
      templateId: selectedTemplate,
    });
    setIsTemplateModalOpen(false);
    setSelectedTemplate(null);
  };

  const handleEditAiDraft = (draft: MessageView) => {
    setMessageInput(draft.content);
    if (selectedId?.startsWith("demo-")) {
      setLocalMessages(DEMO_MESSAGES.filter((m) => m.id !== draft.id));
    } else {
      setLocalMessages(localMessages.filter((m) => m.id !== draft.id));
    }
  };

  const handleDiscardAiDraft = (draftId: string) => {
    if (selectedId?.startsWith("demo-")) {
      setLocalMessages(DEMO_MESSAGES.filter((m) => m.id !== draftId));
    } else {
      setLocalMessages(localMessages.filter((m) => m.id !== draftId));
    }
  };

  const getSessionRingClass = (status: SessionStatus) => {
    switch (status) {
      case "active":
        return "border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
      case "expiring":
        return "border-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]";
      case "expired":
        return "border-muted-foreground/30";
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return c.unreadCount > 0;
    if (activeFilter === "assigned") return c.assignedToMe;
    if (activeFilter === "expired") return c.sessionStatus === "expired";
    if (activeFilter === "failed") return c.hasFailedMessage;
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Pane A: Triage Rail (Left) */}
      <aside className="w-80 min-w-[280px] flex flex-col border-r border-border bg-card/50">
        <header className="p-4 space-y-4 border-b border-border">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-primary">Triage Rail</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Secure</span>
            </div>
          </div>

          <div className="flex bg-muted p-1 rounded-lg gap-1 overflow-x-auto">
            {(["all", "unread", "assigned", "expired", "failed"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all whitespace-nowrap ${
                  activeFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border/50">
            {filteredConversations
              .sort((a, b) => b.urgencyScore - a.urgencyScore)
              .map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-4 cursor-pointer transition-all hover:bg-muted/50 flex gap-3 border-l-4 ${
                    selectedId === c.id ? "bg-muted/70 border-l-primary" : "border-l-transparent"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-muted ${getSessionRingClass(c.sessionStatus)}`}>
                      <span className="text-xs font-bold text-muted-foreground uppercase">{c.contactName.slice(0, 2)}</span>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {c.unreadCount}
                      </span>
                    )}
                    {c.hasFailedMessage && (
                      <span className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground w-4 h-4 flex items-center justify-center rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`text-sm font-semibold truncate ${selectedId === c.id ? "text-primary" : "text-foreground"}`}>{c.contactName}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">{c.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      {c.jobId && (
                        <span className="text-[9px] font-semibold bg-muted px-1.5 py-0.5 rounded text-primary/70 uppercase">{c.jobId}</span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground truncate">{c.clientId}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic line-clamp-1">"{c.lastMessage}"</p>
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Pane B: Active Thread (Center) */}
      <main className="flex-1 flex flex-col bg-background">
        {selectedConv ? (
          <>
            <header className="p-4 border-b border-border bg-card/50 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center bg-muted ${getSessionRingClass(selectedConv.sessionStatus)}`}>
                  <span className="text-xs font-bold text-muted-foreground uppercase">{selectedConv.contactName.slice(0, 2)}</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold">{selectedConv.contactName}</h2>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedConv.sessionStatus === "active" ? "bg-emerald-500" : selectedConv.sessionStatus === "expiring" ? "bg-amber-500" : "bg-muted-foreground/50"}`} />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {selectedConv.sessionStatus === "active" ? "Session Active" : selectedConv.sessionStatus === "expiring" ? "Session Expiring" : "Session Expired"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant={isContextCollapsed ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsContextCollapsed(!isContextCollapsed)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-center">
                <Badge variant="outline" className="text-[10px] font-medium px-3 py-1">
                  Archive Snapshot: Today
                </Badge>
              </div>

              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === "operator" ? "items-end" : m.sender === "system" ? "items-center" : "items-start"}`}>
                  {m.sender === "system" ? (
                    <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide text-center max-w-md border-y border-border/50">
                      {m.content}
                    </div>
                  ) : (
                    <div className="group relative max-w-[70%]">
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          m.sender === "operator"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : m.sender === "ai_draft"
                            ? "bg-muted border-2 border-dashed border-primary/40 text-primary italic rounded-bl-sm"
                            : "bg-card border border-border rounded-bl-sm"
                        }`}
                      >
                        {m.sender === "ai_draft" && (
                          <Badge variant="secondary" className="absolute -top-2 -left-2 text-[9px] px-1.5 py-0.5">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI Draft
                          </Badge>
                        )}
                        {m.content}
                        <div className={`flex items-center gap-1.5 mt-2 text-[10px] opacity-60 ${m.sender === "operator" ? "justify-end" : "justify-start"}`}>
                          <span>{m.timestamp}</span>
                          {m.status && m.sender === "operator" && (
                            <Check className={`w-3 h-3 ${m.status === "read" ? "text-primary-foreground" : ""}`} />
                          )}
                        </div>
                      </div>
                      {m.sender === "ai_draft" && (
                        <div className="flex gap-3 mt-2 ml-1">
                          <button onClick={() => handleEditAiDraft(m)} className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline">
                            Edit and Dispatch
                          </button>
                          <span className="text-muted-foreground">/</span>
                          <button onClick={() => handleDiscardAiDraft(m.id)} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-destructive">
                            Discard
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Composer */}
            <footer className="p-4 border-t border-border bg-card/50">
              {selectedConv.sessionStatus === "expired" ? (
                <div className="p-6 bg-muted rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center border border-border">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Session Expired</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      WhatsApp Business API restricts free-form input after 24h. Template required.
                    </p>
                  </div>
                  <Button onClick={() => setIsTemplateModalOpen(true)}>
                    Send Template Message
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wide shrink-0">AI Suggestions:</span>
                    {["Apologize for lateness", "Confirm arrival window", "Send location link"].map((s, i) => (
                      <Button key={i} variant="outline" size="sm" className="text-[10px] h-7 whitespace-nowrap" onClick={() => setMessageInput(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 bg-muted rounded-xl p-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleDispatch()}
                      placeholder={`Message ${selectedConv.contactName}...`}
                      className="flex-1 bg-transparent border-none focus-visible:ring-0"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-2">
                        <span className="text-[9px] font-medium text-muted-foreground uppercase block">TTL</span>
                        <span className="text-[11px] font-mono font-semibold text-emerald-500">14:42:01</span>
                      </div>
                      <Button onClick={handleDispatch} disabled={!messageInput.trim() || dispatchMutation.isPending} size="icon">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                    <MessageCircle className="w-3 h-3" />
                    <span>Dispatch handled by Neo8 Engine. CRM does not send directly.</span>
                  </div>
                </div>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium">Select a conversation for triage</p>
          </div>
        )}
      </main>

      {/* Pane C: Context Deck (Right) */}
      {!isContextCollapsed && selectedConv && (
        <aside className="w-80 min-w-[280px] bg-card border-l border-border flex flex-col">
          <ScrollArea className="flex-1 p-4 space-y-6">
            {/* Identity Widget */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identity Deck</h4>
                <Button variant="ghost" size="sm" className="text-[10px] h-auto p-0 text-primary hover:text-primary/80">Inspect Profile</Button>
              </div>
              <div className="p-4 bg-muted rounded-xl flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary/60" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedConv.contactName}</h3>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{selectedConv.clientId}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedConv.phone}</p>
                </div>
              </div>
            </section>

            {/* Active Job Widget */}
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Operations Node</h4>
              <div className="p-4 bg-muted rounded-xl space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">Active Dispatch</span>
                  <span className="text-xs font-mono font-semibold text-primary">{selectedConv.jobId || "UNLINKED"}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Pipeline</span>
                    <Badge variant="secondary" className="text-[9px]">In Progress</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Tech</span>
                    <span className="text-[11px] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      Dave Miller
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* AI Analysis Widget */}
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary">AI Narrative Analysis</h4>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "Marcus is exhibiting high-urgency signals regarding technician arrival. Mentioned pre-opened access points. Tone detected: Frustrated (+15m delay recorded). Suggested action: Issue service fee credit (5%) to protect LTV."
                </p>
                <div className="pt-3 mt-3 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Refined 2m ago
                  </div>
                  <div className="flex gap-2">
                    <button className="hover:text-primary transition-colors">👍</button>
                    <button className="hover:text-destructive transition-colors">👎</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Notes Widget */}
            <section className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</h4>
              <textarea
                className="w-full bg-muted border border-border rounded-xl p-3 text-xs text-muted-foreground outline-none focus:border-primary min-h-[100px] resize-none"
                placeholder="Add internal notes..."
              />
            </section>
          </ScrollArea>
        </aside>
      )}

      {/* Template Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Authorized Templates</DialogTitle>
            <DialogDescription>Select a template to re-engage this expired session</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplate === template.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">{template.name}</span>
                  <Badge variant="outline" className="text-[9px]">META_AUTH</Badge>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  {template.body.split(/({{[0-9]}})/).map((part, i) =>
                    part.match(/{{[0-9]}}/) ? (
                      <span key={i} className="text-primary bg-primary/10 px-1 rounded mx-0.5 not-italic">
                        {part}
                      </span>
                    ) : (
                      part
                    )
                  )}
                </p>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTemplateDispatch} disabled={!selectedTemplate || dispatchMutation.isPending}>
              Dispatch Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
