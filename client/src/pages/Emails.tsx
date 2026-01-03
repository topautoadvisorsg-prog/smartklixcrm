import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Mail, Search, Send, Plus, User, Building2, 
  CheckCircle, Eye, MousePointer, AlertCircle, Clock,
  Shield, FileText, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type IdentityType = "personal" | "company";
type EmailStatus = "sent" | "delivered" | "opened" | "clicked" | "failed" | "scheduled" | "synced";

interface EmailRecord {
  id: string;
  identity: IdentityType;
  senderName: string;
  recipient: string;
  subject: string;
  preview: string;
  timestamp: string;
  status: EmailStatus;
  templateId?: string;
  contactId?: string;
  direction?: "incoming" | "outgoing";
}

interface APIEmail {
  id: string;
  accountId: string;
  messageId: string | null;
  threadId: string | null;
  direction: "incoming" | "outgoing";
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  status: string;
  contactId: string | null;
  jobId: string | null;
  company: string | null;
  receivedAt: string | null;
  sentAt: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  accountDisplayName?: string;
  provider?: "gmail" | "sendgrid";
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: "invoice" | "onboarding" | "notification" | "service";
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function transformAPIEmail(email: APIEmail): EmailRecord {
  const isIncoming = email.direction === "incoming";
  const isCompany = email.provider === "sendgrid";
  return {
    id: email.id,
    identity: isCompany ? "company" : "personal",
    senderName: isIncoming ? email.fromAddress : (isCompany ? "System Dispatch" : "You"),
    recipient: email.toAddresses?.[0] || "Unknown",
    subject: email.subject || "(No Subject)",
    preview: email.bodyText?.slice(0, 200) || email.bodyHtml?.replace(/<[^>]*>/g, '').slice(0, 200) || "",
    timestamp: formatTimeAgo(isIncoming ? email.receivedAt : email.sentAt || email.createdAt),
    status: email.status as EmailStatus,
    contactId: email.contactId || undefined,
    direction: email.direction,
  };
}

const emailTemplates: EmailTemplate[] = [
  { id: "INV_OVERDUE_V2", name: "Invoice Overdue Warning (v2)", description: "Automated overdue invoice reminder", category: "invoice" },
  { id: "ONBOARD_V1", name: "Welcome Onboarding Flow", description: "New user welcome sequence", category: "onboarding" },
  { id: "PWD_RESET", name: "Password Reset Instructions", description: "Security password reset flow", category: "notification" },
  { id: "SVC_CONFIRM", name: "Service Appointment Confirmation", description: "Job scheduling confirmation", category: "service" },
];

export default function Emails() {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<"all" | "personal" | "company" | "failed">("all");
  const [activeTab, setActiveTab] = useState<"emails" | "accounts">("emails");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityType>("personal");
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("INV_OVERDUE_V2");
  
  // Friction Rule Dialog
  const [showFrictionDialog, setShowFrictionDialog] = useState(false);
  const [pendingIdentity, setPendingIdentity] = useState<IdentityType | null>(null);

  // Fetch real emails from API
  const { data: apiEmails = [], isLoading, error } = useQuery<APIEmail[]>({
    queryKey: ["/api/emails"],
    refetchInterval: 30000,
  });

  // Transform API emails to display format
  const emails: EmailRecord[] = apiEmails.map(transformAPIEmail);

  // Filter emails based on active filter and search
  const filteredEmails = emails.filter(email => {
    const matchesFilter = 
      activeFilter === "all" ||
      (activeFilter === "personal" && email.identity === "personal") ||
      (activeFilter === "company" && email.identity === "company") ||
      (activeFilter === "failed" && email.status === "failed");
    
    const matchesSearch = 
      !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.senderName.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Stats
  const stats = {
    total: emails.length,
    personal: emails.filter(e => e.identity === "personal").length,
    company: emails.filter(e => e.identity === "company").length,
    failed: emails.filter(e => e.status === "failed").length,
  };

  // Identity switching with friction rule
  const handleIdentityChange = (newIdentity: IdentityType) => {
    if (newIdentity === selectedIdentity) return;
    
    // Only show friction dialog if there's content to lose
    if (draftBody || draftSubject) {
      setPendingIdentity(newIdentity);
      setShowFrictionDialog(true);
    } else {
      setSelectedIdentity(newIdentity);
    }
  };

  const confirmIdentitySwitch = () => {
    if (pendingIdentity) {
      setSelectedIdentity(pendingIdentity);
      setDraftBody("");
      setDraftSubject("");
      setPendingIdentity(null);
    }
    setShowFrictionDialog(false);
  };

  // Dispatch handler - sends to backend which writes to ledger and forwards to Neo8
  const handleDispatch = async () => {
    try {
      const payload = {
        identity: selectedIdentity,
        to: draftTo,
        subject: selectedIdentity === "personal" ? draftSubject : undefined,
        body: selectedIdentity === "personal" ? draftBody : undefined,
        templateId: selectedIdentity === "company" ? selectedTemplate : undefined,
      };

      const response = await apiRequest("POST", "/api/emails/dispatch", payload);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Dispatch Authorized",
          description: `Email queued for delivery via ${selectedIdentity === "personal" ? "Gmail" : "SendGrid"} through Neo8 Engine.`,
        });
      } else {
        throw new Error(result.error || "Dispatch failed");
      }

      setIsComposeOpen(false);
      resetComposeForm();
    } catch (error) {
      toast({
        title: "Dispatch Failed",
        description: error instanceof Error ? error.message : "Failed to dispatch email",
        variant: "destructive",
      });
    }
  };

  const resetComposeForm = () => {
    setDraftTo("");
    setDraftSubject("");
    setDraftBody("");
    setSelectedTemplate("INV_OVERDUE_V2");
    setSelectedIdentity("personal");
  };

  const getStatusIcon = (status: EmailStatus) => {
    switch (status) {
      case "sent": return <Send className="w-3 h-3" />;
      case "delivered": return <CheckCircle className="w-3 h-3" />;
      case "opened": return <Eye className="w-3 h-3" />;
      case "clicked": return <MousePointer className="w-3 h-3" />;
      case "failed": return <AlertCircle className="w-3 h-3" />;
      case "scheduled": return <Clock className="w-3 h-3" />;
      default: return <Mail className="w-3 h-3" />;
    }
  };

  const getStatusBadgeVariant = (status: EmailStatus, identity: IdentityType) => {
    if (status === "failed") return "destructive";
    return "secondary";
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden" data-testid="page-emails">
      {/* Sidebar: Communication Filters */}
      <aside className="w-64 flex flex-col border-r border-border bg-muted/30 p-4 shrink-0">
        <div className="mb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 px-2">
            Communication Filters
          </h2>
          
          <nav className="space-y-1">
            <button
              onClick={() => setActiveFilter("all")}
              className={cn(
                "w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-medium transition-all",
                activeFilter === "all" 
                  ? "bg-accent text-accent-foreground" 
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <span>All Communications</span>
              <Badge variant="secondary" className="text-[10px]">{stats.total}</Badge>
            </button>

            <button
              onClick={() => setActiveFilter("personal")}
              className={cn(
                "w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-medium transition-all",
                activeFilter === "personal"
                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  : "text-muted-foreground hover:text-blue-500"
              )}
            >
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2" />
                Personal (Gmail)
              </span>
              <span className="text-[10px] opacity-60">{stats.personal}</span>
            </button>

            <button
              onClick={() => setActiveFilter("company")}
              className={cn(
                "w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-medium transition-all",
                activeFilter === "company"
                  ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                  : "text-muted-foreground hover:text-purple-500"
              )}
            >
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2" />
                Company (System)
              </span>
              <span className="text-[10px] opacity-60">{stats.company}</span>
            </button>

            <Separator className="my-3" />

            <button
              onClick={() => setActiveFilter("failed")}
              className={cn(
                "w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-medium transition-all",
                activeFilter === "failed"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "text-muted-foreground hover:text-destructive"
              )}
            >
              <span className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Failed
              </span>
              <Badge variant="destructive" className="text-[10px]">{stats.failed}</Badge>
            </button>
          </nav>
        </div>

        {/* Ingress Filter Notice */}
        <div className="mt-auto p-4 border border-border rounded-xl bg-muted/50">
          <div className="flex items-start space-x-3 text-muted-foreground">
            <Shield className="w-5 h-5 shrink-0 text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide">Ingress Filter Active</p>
              <p className="text-[9px] leading-relaxed mt-1">
                Showing only CRM-matched records. Personal emails hidden.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <header className="px-8 py-6 border-b border-border flex justify-between items-center bg-muted/20">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Trail & Dispatch</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
              Unified Communication Feed
            </p>
          </div>
          <Button onClick={() => setIsComposeOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Compose Dispatch
          </Button>
        </header>

        {/* Sub-tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "emails" | "accounts")} className="flex-1 flex flex-col">
          <div className="px-8 pt-4 border-b border-border">
            <TabsList>
              <TabsTrigger value="emails" className="gap-2">
                <User className="w-4 h-4" />
                Emails (Personal)
              </TabsTrigger>
              <TabsTrigger value="accounts" className="gap-2">
                <Building2 className="w-4 h-4" />
                Email Accounts (Company)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="emails" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-8 space-y-4">
                {/* Search Bar */}
                <div className="relative mb-6">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subject, contact, or trace ID..."
                    className="pl-10"
                  />
                </div>

                {/* Email Feed */}
                {isLoading ? (
                  <Card className="p-8 text-center">
                    <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
                    <p className="text-muted-foreground">Loading emails...</p>
                  </Card>
                ) : error ? (
                  <Card className="p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
                    <p className="text-destructive">Failed to load emails</p>
                  </Card>
                ) : filteredEmails.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {emails.length === 0 ? "No emails yet. Send an email or wait for incoming messages." : "No emails match your filters."}
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredEmails.map((email) => (
                      <Card
                        key={email.id}
                        className={cn(
                          "p-5 transition-all hover:bg-accent/50 cursor-pointer",
                          email.status === "failed" && "bg-destructive/5 border-destructive/30",
                          email.identity === "personal" && email.status !== "failed" && "border-l-4 border-l-blue-500",
                          email.identity === "company" && email.status !== "failed" && "border-l-4 border-l-purple-500"
                        )}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center border",
                              email.identity === "personal" && "bg-blue-500/10 border-blue-500/20",
                              email.identity === "company" && email.status !== "failed" && "bg-purple-500/10 border-purple-500/20",
                              email.status === "failed" && "bg-destructive/10 border-destructive/20"
                            )}>
                              {email.identity === "personal" ? (
                                <User className="w-5 h-5 text-blue-500" />
                              ) : email.status === "failed" ? (
                                <AlertCircle className="w-5 h-5 text-destructive" />
                              ) : (
                                <Building2 className="w-5 h-5 text-purple-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-bold">{email.senderName}</span>
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider",
                                  email.identity === "personal" ? "text-blue-500" : "text-purple-500"
                                )}>
                                  (via {email.identity === "personal" ? "Gmail" : "SendGrid"})
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">To: {email.recipient}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={getStatusBadgeVariant(email.status, email.identity)}
                              className={cn(
                                "gap-1",
                                email.status === "failed" && "bg-destructive/10 text-destructive border-destructive/20",
                                email.status !== "failed" && email.identity === "personal" && "text-blue-500",
                                email.status !== "failed" && email.identity === "company" && "text-purple-500"
                              )}
                            >
                              {getStatusIcon(email.status)}
                              {email.status === "failed" ? "Failed: Hard Bounce" : email.status}
                            </Badge>
                            <div className="text-[10px] font-mono text-muted-foreground mt-1">
                              Sent {email.timestamp}
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-13">
                          <h4 className="text-sm font-bold mb-1">{email.subject}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {email.preview}
                          </p>
                          {email.templateId && (
                            <Badge variant="outline" className="mt-2 text-[10px]">
                              <FileText className="w-3 h-3 mr-1" />
                              Template: {email.templateId}
                            </Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="accounts" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-8">
                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <Building2 className="w-8 h-8 text-purple-500 shrink-0" />
                    <div>
                      <h3 className="font-bold text-lg mb-2">Company Email (System Identity)</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Company emails are sent via SendGrid through the Neo8 Engine. These are transactional, 
                        template-based messages for invoices, notifications, and business communications.
                      </p>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-bold mb-2">Available Templates</h4>
                          <div className="grid gap-2">
                            {emailTemplates.map((template) => (
                              <Card key={template.id} className="p-3 bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">{template.name}</p>
                                    <p className="text-xs text-muted-foreground">{template.description}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          Template management is handled in the system configuration. 
                          Contact your administrator to add or modify templates.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>

      {/* Compose Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Compose New Dispatch</DialogTitle>
            <DialogDescription>
              Select your identity and compose your message.
            </DialogDescription>
          </DialogHeader>

          {/* Identity Switcher */}
          <div className="bg-muted p-1.5 rounded-xl flex space-x-1">
            <button
              onClick={() => handleIdentityChange("personal")}
              className={cn(
                "flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2",
                selectedIdentity === "personal"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <User className="w-4 h-4" />
              <span>Personal Identity (Gmail)</span>
            </button>
            <button
              onClick={() => handleIdentityChange("company")}
              className={cn(
                "flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2",
                selectedIdentity === "company"
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>Company Identity (System)</span>
            </button>
          </div>

          {/* Friction Rule Warning */}
          <div className="flex items-center space-x-2 text-[10px] text-warning font-medium bg-warning/10 px-3 py-2 rounded border border-warning/20">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Switching identity clears draft body to prevent cross-contamination.</span>
          </div>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              {/* To Field */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest">To:</Label>
                <Input
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  placeholder="Recipient email..."
                />
              </div>

              {selectedIdentity === "personal" ? (
                /* PERSONAL MODE: Free Text */
                <>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">Subject:</Label>
                    <Input
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      placeholder="Subject line..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">Message Body</Label>
                    <Textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder="Type your message here..."
                      className="min-h-[200px] resize-none"
                    />
                  </div>
                  {/* Signature Block */}
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    <p>--</p>
                    <p className="font-bold">Sarah Architect</p>
                    <p>Senior Solution Architect</p>
                    <p className="text-blue-500">[CRM Profile Link]</p>
                  </div>
                </>
              ) : (
                /* COMPANY MODE: Template Selection */
                <>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">Template (Required)</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Card className="p-4 bg-purple-500/5 border-purple-500/20">
                    <h4 className="text-[10px] font-bold uppercase text-purple-500 tracking-widest mb-2">
                      Payload Preview (Read-Only)
                    </h4>
                    <pre className="font-mono text-[10px] text-purple-400 whitespace-pre-wrap">
{`{
  "template_id": "${selectedTemplate}",
  "dynamic_data": {
    "first_name": "John",
    "account_id": "ACC-9921",
    "link_expiry": "24h"
  }
}`}
                    </pre>
                  </Card>
                  <p className="text-[10px] text-muted-foreground italic text-center">
                    System messages are transactional. Free-text entry is disabled to ensure compliance.
                  </p>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setIsComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDispatch}
              disabled={!draftTo || (selectedIdentity === "personal" && (!draftSubject || !draftBody))}
              className={cn(
                selectedIdentity === "personal" ? "bg-blue-600 hover:bg-blue-500" : "bg-purple-600 hover:bg-purple-500"
              )}
            >
              <span className="flex flex-col items-center">
                <span>Authorize Dispatch</span>
                <span className="text-[8px] font-normal opacity-70">(Sends via Neo8 Engine)</span>
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Friction Rule Confirmation Dialog */}
      <Dialog open={showFrictionDialog} onOpenChange={setShowFrictionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Switching Identity
            </DialogTitle>
            <DialogDescription>
              Switching identity will clear your current draft to prevent cross-contamination 
              between personal and system communication channels.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowFrictionDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmIdentitySwitch}>
              Clear Draft & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
