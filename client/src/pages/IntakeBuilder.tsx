import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Globe, FileText, ChevronDown, X, AlertTriangle, Eye, Check, XCircle, Send, Mail, MessageSquare, Link2, Copy, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

type IntakeView = "triage" | "outbound";

type Intake = {
  id: string;
  name: string;
  company: string | null;
  channelType: string;
  active: boolean;
  defaultPipelineStage: string;
  defaultContactTags: string[];
  defaultJobTags: string[];
  contactMatchBehavior: string;
  createJobBehavior: string;
  webhookToken: string;
  createdAt: string;
  updatedAt: string;
};

type IntakeSubmission = {
  id: string;
  intakeId: string;
  payload: Record<string, unknown>;
  contactId: string | null;
  jobId: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
};

interface NormalizedData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  intent: string;
  proposedObject: "Lead" | "Contact" | "Deal" | "Ticket";
}

function extractContactName(payload: Record<string, unknown>): string {
  const firstName = (payload.firstName || payload.first_name || payload.fname || "") as string;
  const lastName = (payload.lastName || payload.last_name || payload.lname || "") as string;
  const name = (payload.name || payload.full_name || payload.fullName || "") as string;
  if (firstName || lastName) return `${firstName} ${lastName}`.trim();
  if (name) return name;
  return "Unknown";
}

function normalizePayload(payload: Record<string, unknown>): NormalizedData {
  return {
    firstName: (payload.firstName || payload.first_name || payload.fname || "") as string,
    lastName: (payload.lastName || payload.last_name || payload.lname || "") as string,
    email: (payload.email || payload.work_email || payload.businessEmail || "") as string,
    phone: (payload.phone || payload.phone_raw || payload.phoneNumber || "") as string,
    intent: (payload.intent || payload.intent_blob || payload.message || payload.notes || "") as string,
    proposedObject: "Lead",
  };
}

function checkDedupeWarning(payload: Record<string, unknown>): string | null {
  const email = payload.email || payload.work_email || payload.businessEmail;
  const phone = payload.phone || payload.phone_raw || payload.phoneNumber;
  
  if (!email && !phone) {
    return "Missing contact identifiers. Cannot perform duplicate check.";
  }
  
  return null;
}

export default function IntakeBuilder() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<IntakeView>("triage");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSourceConfigOpen, setIsSourceConfigOpen] = useState(false);
  const [normalizedForm, setNormalizedForm] = useState<NormalizedData | null>(null);

  const { data: intakes, isLoading: intakesLoading } = useQuery<Intake[]>({
    queryKey: ["/api/intakes"],
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<IntakeSubmission[]>({
    queryKey: ["/api/intake-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/intake-submissions");
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      return apiRequest("PATCH", `/api/intake-submissions/${submissionId}`, {
        status: "processed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-submissions"] });
      toast({ title: "Submission committed to ActionAI CRM" });
      setSelectedSubmissionId(null);
      setNormalizedForm(null);
    },
    onError: () => {
      toast({ title: "Failed to commit submission", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      return apiRequest("PATCH", `/api/intake-submissions/${submissionId}`, {
        status: "failed",
        errorMessage: "Rejected by operator",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-submissions"] });
      toast({ title: "Submission rejected and archived" });
      setSelectedSubmissionId(null);
      setNormalizedForm(null);
    },
    onError: () => {
      toast({ title: "Failed to reject submission", variant: "destructive" });
    },
  });

  const pendingSubmissions = submissions?.filter((s) => s.status === "pending") || [];
  const dedupeWatchCount = pendingSubmissions.filter((s) => 
    checkDedupeWarning(s.payload as Record<string, unknown>) !== null
  ).length;
  const selectedSubmission = submissions?.find((s) => s.id === selectedSubmissionId);

  const handleSelectSubmission = (sub: IntakeSubmission) => {
    setSelectedSubmissionId(sub.id);
    setNormalizedForm(normalizePayload(sub.payload as Record<string, unknown>));
  };

  const handleCommit = () => {
    if (!selectedSubmissionId) return;
    commitMutation.mutate(selectedSubmissionId);
  };

  const handleReject = () => {
    if (!selectedSubmissionId) return;
    rejectMutation.mutate(selectedSubmissionId);
  };

  const getIntakeName = (intakeId: string) => {
    const intake = intakes?.find((i) => i.id === intakeId);
    return intake?.name || "Unknown Form";
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/webhook/lead-intake`;
    navigator.clipboard.writeText(url);
    toast({ title: "Webhook URL copied to clipboard" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-4 border-b border-border bg-glass-surface shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black uppercase tracking-tight">Intake Hub</h1>
            <Badge variant="muted" className="text-[10px] font-black uppercase tracking-widest">
              Ingress Firewall
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
              <Button
                variant={activeView === "triage" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView("triage")}
                className="text-[10px] font-black uppercase tracking-widest"
                data-testid="tab-triage-queue"
              >
                Triage Queue
              </Button>
              <Button
                variant={activeView === "outbound" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView("outbound")}
                className="text-[10px] font-black uppercase tracking-widest"
                data-testid="tab-active-intake"
              >
                Active Intake (Outbound)
              </Button>
            </div>

            <div className="relative">
              <Button
                variant={isSourceConfigOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsSourceConfigOpen(!isSourceConfigOpen)}
                className="text-[10px] font-black uppercase tracking-widest gap-2"
                data-testid="button-source-config"
              >
                <Settings2 className="w-3 h-3" />
                Source Configuration
                <ChevronDown className={`w-3 h-3 transition-transform ${isSourceConfigOpen ? "rotate-180" : ""}`} />
              </Button>

              {isSourceConfigOpen && (
                <Card className="absolute top-full right-0 mt-2 w-80 bg-glass-surface border-glass-border z-50 overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Ingress Sources
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSourceConfigOpen(false)}
                      data-testid="button-close-source-config"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="p-3 rounded-xl hover-elevate flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-500">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-tight">Website Widget</div>
                          <div className="text-[9px] text-muted-foreground truncate w-32">/webhook/lead-intake</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={copyWebhookUrl} className="text-[9px]">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-3 rounded-xl hover-elevate flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-tight">Typeform Connect</div>
                          <div className="text-[9px] text-muted-foreground">Source: Enabled</div>
                        </div>
                      </div>
                      <div className="w-8 h-4 bg-primary rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 border-t border-border text-center">
                    <Button variant="ghost" size="sm" className="text-[9px] font-black text-primary uppercase tracking-widest">
                      + Add New Source
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </header>

      {activeView === "triage" ? (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-80 flex flex-col border-r border-border bg-glass-surface shrink-0">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Pending ({pendingSubmissions.length})
              </span>
              <span className={`text-[9px] font-bold ${dedupeWatchCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                Dedupe Watch ({dedupeWatchCount})
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {submissionsLoading && (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-background">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </>
                )}
                {!submissionsLoading && pendingSubmissions.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No pending submissions.
                    <br />
                    <span className="text-xs">New intake data will appear here.</span>
                  </div>
                )}
                {pendingSubmissions.map((sub) => {
                  const contactName = extractContactName(sub.payload as Record<string, unknown>);
                  const dedupeWarning = checkDedupeWarning(sub.payload as Record<string, unknown>);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleSelectSubmission(sub)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all relative ${
                        selectedSubmissionId === sub.id
                          ? "bg-primary/10 border-primary/30"
                          : "bg-background border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid={`triage-item-${sub.id}`}
                    >
                      {selectedSubmissionId === sub.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dedupeWarning ? "bg-amber-500" : "bg-amber-500"}`} />
                          <span className="text-[11px] font-bold truncate">{getIntakeName(sub.intakeId)}</span>
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="pl-4">
                        <div className="text-xs font-black text-muted-foreground mb-1">{contactName}</div>
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3 text-muted-foreground/50" />
                          <Badge variant="muted" className="text-[9px] font-mono">
                            #{sub.id.slice(0, 8)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <main className="flex-1 flex flex-col border-r border-border bg-background overflow-hidden">
            {selectedSubmission ? (
              <>
                <div className="p-6 border-b border-border flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight mb-1">Processing Stage</h2>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                      <span>ID: {selectedSubmission.id.slice(0, 12)}</span>
                      <span>|</span>
                      <span className="uppercase">Source: {getIntakeName(selectedSubmission.intakeId)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase gap-1">
                    <Eye className="w-3 h-3" />
                    Observation Mode
                  </Badge>
                </div>

                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-2 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Raw Ingress Payload [Read-Only System Data]
                    </span>
                  </div>
                  <Card className="bg-muted/30 border-border p-6 font-mono text-xs overflow-x-auto relative group">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[9px] uppercase font-black"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedSubmission.payload, null, 2));
                          toast({ title: "JSON copied to clipboard" });
                        }}
                      >
                        Copy JSON
                      </Button>
                    </div>
                    <pre className="text-emerald-500 leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(selectedSubmission.payload, null, 2)}
                    </pre>
                  </Card>

                  <div className="mt-8 pt-8 border-t border-border">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-4 bg-glass-surface border-glass-border">
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">
                          Ingress Timestamp
                        </span>
                        <span className="text-xs font-mono">
                          {new Date(selectedSubmission.createdAt).toLocaleString()}
                        </span>
                      </Card>
                      <Card className="p-4 bg-glass-surface border-glass-border">
                        <span className="text-[9px] font-black uppercase text-muted-foreground block mb-1">
                          Source Form ID
                        </span>
                        <Badge variant="muted" className="font-mono text-xs">
                          {selectedSubmission.intakeId.slice(0, 8)}
                        </Badge>
                      </Card>
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest text-xs">
                Select a submission
              </div>
            )}
          </main>

          <aside className="w-[450px] flex flex-col bg-glass-surface shrink-0 overflow-hidden">
            {selectedSubmission && normalizedForm ? (
              <>
                <ScrollArea className="flex-1">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-4">
                      Normalized Staging [Editable CRM Objects]
                    </h2>

                    {checkDedupeWarning(selectedSubmission.payload as Record<string, unknown>) && (
                      <Card className="mb-6 p-3 bg-amber-500/10 border-amber-500/20 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-wide">Dedupe Watch</p>
                          <p className="text-[10px] text-amber-400/80 leading-tight mt-1">
                            Potential match found in existing records.
                          </p>
                        </div>
                      </Card>
                    )}

                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                            First Name
                          </Label>
                          <Input
                            value={normalizedForm.firstName}
                            onChange={(e) => setNormalizedForm({ ...normalizedForm, firstName: e.target.value })}
                            className="text-xs font-bold"
                            data-testid="input-first-name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                            Last Name
                          </Label>
                          <Input
                            value={normalizedForm.lastName}
                            onChange={(e) => setNormalizedForm({ ...normalizedForm, lastName: e.target.value })}
                            className="text-xs font-bold"
                            data-testid="input-last-name"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                          Email (Business)
                        </Label>
                        <Input
                          value={normalizedForm.email}
                          onChange={(e) => setNormalizedForm({ ...normalizedForm, email: e.target.value })}
                          className="text-xs font-bold"
                          data-testid="input-email"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                          Phone (Normalized)
                        </Label>
                        <Input
                          value={normalizedForm.phone}
                          onChange={(e) => setNormalizedForm({ ...normalizedForm, phone: e.target.value })}
                          className="text-xs font-mono font-bold"
                          data-testid="input-phone"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                          Intent Summary
                        </Label>
                        <Textarea
                          value={normalizedForm.intent}
                          onChange={(e) => setNormalizedForm({ ...normalizedForm, intent: e.target.value })}
                          className="text-xs font-medium min-h-[80px] resize-none"
                          data-testid="input-intent"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                          Proposed CRM Object
                        </Label>
                        <Select
                          value={normalizedForm.proposedObject}
                          onValueChange={(v) => setNormalizedForm({ ...normalizedForm, proposedObject: v as NormalizedData["proposedObject"] })}
                        >
                          <SelectTrigger className="text-xs font-bold" data-testid="select-proposed-object">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lead">Lead</SelectItem>
                            <SelectItem value="Contact">Contact</SelectItem>
                            <SelectItem value="Deal">Deal</SelectItem>
                            <SelectItem value="Ticket">Ticket</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 border-t border-border space-y-3 shrink-0">
                  <Button
                    className="w-full py-6 text-[11px] font-black uppercase tracking-[0.2em] gap-2"
                    onClick={handleCommit}
                    disabled={commitMutation.isPending}
                    data-testid="button-verify-commit"
                  >
                    <Check className="w-4 h-4" />
                    {commitMutation.isPending ? "Committing..." : "Verify & Commit to ActionAI CRM"}
                  </Button>
                  <p className="text-[9px] text-muted-foreground text-center leading-relaxed px-4">
                    Triggering this action passes authority to ActionAI for reasoning and proposal generation.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full py-3 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                    data-testid="button-reject"
                  >
                    <XCircle className="w-4 h-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject & Archive"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest text-xs opacity-50">
                Waiting for selection...
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-lg w-full bg-glass-surface border-glass-border p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">Active Intake (Outbound)</h2>
              <p className="text-sm text-muted-foreground">
                Send structured intake requests to contacts for data collection.
              </p>
              <Badge variant="muted" className="mt-2 text-[9px] font-black uppercase">
                Version 1 Preview
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Recipient
                </Label>
                <Input placeholder="Contact email or phone" data-testid="input-outbound-recipient" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Intake Type
                </Label>
                <Select defaultValue="lead">
                  <SelectTrigger data-testid="select-outbound-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead Information</SelectItem>
                    <SelectItem value="job">Job Details</SelectItem>
                    <SelectItem value="qualification">Qualification Form</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Delivery Channel
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" data-testid="button-channel-email">
                    <Mail className="w-4 h-4" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-2" data-testid="button-channel-sms">
                    <MessageSquare className="w-4 h-4" />
                    SMS
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-2" data-testid="button-channel-link">
                    <Link2 className="w-4 h-4" />
                    Link
                  </Button>
                </div>
              </div>

              <Button className="w-full mt-4 gap-2" disabled data-testid="button-send-intake-request">
                <Send className="w-4 h-4" />
                Send Intake Request
              </Button>

              <p className="text-[9px] text-muted-foreground text-center mt-4">
                Outbound intake requests route through Neo8 workflows. Responses return to the Triage Queue.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
