import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, ShieldAlert, Shield, Play, CheckCircle, CheckCircle2,
  AlertCircle, Clock, User, Zap, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface ProposalAction {
  tool: string;
  args: Record<string, unknown>;
}

interface PendingProposal {
  id: string;
  summary: string;
  actions: ProposalAction[];
  reasoning: string | null;
  riskLevel: "low" | "medium" | "high";
  status: string;
  createdAt: string;
  origin?: string;
  userRequest?: string;
  validatorDecision?: "approve" | "reject";
  validatorReason?: string;
  mode?: string;
}

interface ApprovedProposal {
  id: string;
  summary: string;
  actions: ProposalAction[];
  reasoning: string | null;
  riskLevel: string | null;
  status: string;
  relatedEntity: { type: string; id: string } | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string;
  createdAt: string;
  origin?: string;
  userRequest?: string;
  mode?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const originColors: Record<string, string> = {
  voice:       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  ai_chat:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  admin_chat:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  gpt_actions: "bg-green-500/20 text-green-300 border-green-500/30",
  webhook:     "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const riskClass: Record<string, string> = {
  high:   "bg-red-500/20 text-red-500 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  low:    "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
};

const RiskIcon = ({ level }: { level: string }) => {
  if (level === "high") return <ShieldAlert className="w-3 h-3" />;
  if (level === "medium") return <Shield className="w-3 h-3" />;
  return <ShieldCheck className="w-3 h-3" />;
};

function getEntityLink(e: { type: string; id: string }) {
  switch (e.type.toLowerCase()) {
    case "contact":  return { href: `/contacts/${e.id}`,  label: "Contact" };
    case "job":      return { href: `/jobs/${e.id}`,      label: "Job" };
    case "invoice":  return { href: `/invoices/${e.id}`,  label: "Invoice" };
    case "estimate": return { href: `/estimates/${e.id}`, label: "Estimate" };
    default:         return { href: "#",                  label: e.type };
  }
}

// ─── Review section ───────────────────────────────────────────────────────────

function ReviewSection() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: proposals = [], isLoading } = useQuery<PendingProposal[]>({
    queryKey: ["/api/proposals", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/proposals?status=pending");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/proposals/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal approved — moved to Execute" });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/proposals/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal rejected" });
      setRejectingId(null);
      setRejectReason("");
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
    </div>
  );

  if (proposals.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <CheckCircle className="w-16 h-16 text-emerald-500/50" />
      <p className="text-muted-foreground">No proposals pending review.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {proposals.map(p => (
        <Card key={p.id} className="bg-glass-surface border-glass-border" data-testid={`review-card-${p.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                {p.origin && (
                  <Badge variant="outline" className={`text-[10px] ml-2 ${originColors[p.origin] || ""}`}>
                    {p.origin.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <Badge className={`text-[10px] font-black uppercase tracking-wide ${riskClass[p.riskLevel] || "bg-muted text-muted-foreground"}`}>
                <span className="flex items-center gap-1">
                  <RiskIcon level={p.riskLevel} />
                  {p.riskLevel} risk
                </span>
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {p.userRequest && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">"{p.userRequest}"</p>
            )}
            <p className="font-semibold text-sm">{p.summary}</p>

            {p.validatorDecision && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Policy Agent:</span>
                <Badge variant="outline" className={
                  p.validatorDecision === "approve"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                }>
                  {p.validatorDecision}
                </Badge>
                {p.validatorReason && <span className="text-muted-foreground">— {p.validatorReason}</span>}
              </div>
            )}

            {p.mode && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">{p.mode} mode</Badge>
            )}

            <Collapsible open={expanded.has(p.id)} onOpenChange={() => toggle(p.id)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest gap-1 p-0 h-auto">
                  {expanded.has(p.id) ? <><ChevronUp className="w-3 h-3" />Hide Details</> : <><ChevronDown className="w-3 h-3" />Show Details</>}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                {p.reasoning && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-1">AI Reasoning</p>
                    <p className="text-xs text-muted-foreground">{p.reasoning}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    Proposed Actions ({p.actions.length})
                  </p>
                  {p.actions.map((action, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
                      <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">{action.tool}</code>
                      <pre className="text-[10px] font-mono overflow-auto max-h-32 p-2 rounded bg-muted mt-2">
                        {JSON.stringify(action.args, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {rejectingId === p.id && (
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="text-xs min-h-[80px] resize-none mt-2"
              />
            )}
          </CardContent>

          <CardFooter className="gap-2">
            {rejectingId === p.id ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setRejectingId(null); setRejectReason(""); }}
                  className="text-[10px] font-black uppercase tracking-widest">
                  Cancel
                </Button>
                <Button variant="destructive" size="sm"
                  onClick={() => { if (!rejectReason.trim()) { toast({ title: "Reason required", variant: "destructive" }); return; } rejectMutation.mutate({ id: p.id, reason: rejectReason }); }}
                  disabled={rejectMutation.isPending}
                  className="text-[10px] font-black uppercase tracking-widest">
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => { setRejectingId(p.id); setRejectReason(""); }}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                  Reject
                </Button>
                <Button size="sm"
                  onClick={() => approveMutation.mutate(p.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700">
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// ─── Execute section ──────────────────────────────────────────────────────────

type ExecState = "idle" | "dispatched" | "dispatch_failed";

function ExecuteSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localStates, setLocalStates] = useState<Record<string, ExecState>>({});

  const { data: proposals = [], isLoading } = useQuery<ApprovedProposal[]>({
    queryKey: ["/api/proposals", "ready"],
    queryFn: async () => {
      const [approved, pendingSend] = await Promise.all([
        fetch("/api/proposals?status=approved").then(r => r.json()),
        fetch("/api/proposals?status=approved_pending_send").then(r => r.json()),
      ]);
      return [...(approved || []), ...(pendingSend || [])];
    },
    refetchInterval: 30000,
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/proposals/${id}/execute`);
      return res.json();
    },
    onSuccess: (_, id) => {
      setLocalStates(prev => ({ ...prev, [id]: "dispatched" }));
      toast({ title: "Dispatched to execution agent" });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
    onError: (error: Error, id) => {
      setLocalStates(prev => ({ ...prev, [id]: "dispatch_failed" }));
      toast({ title: "Dispatch failed", description: error.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/proposals/${id}/finalize`);
      if (!res.ok) throw new Error("Finalize failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal finalized and executed" });
    },
    onError: () => toast({ title: "Finalization failed", variant: "destructive" }),
  });

  const getState = (p: ApprovedProposal): ExecState => {
    if (localStates[p.id]) return localStates[p.id];
    if (p.status === "dispatched") return "dispatched";
    if (p.status === "dispatch_failed") return "dispatch_failed";
    return "idle";
  };

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
    </div>
  );

  if (proposals.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <ShieldCheck className="w-16 h-16 text-muted-foreground/30" />
      <p className="text-muted-foreground">No approved proposals awaiting execution.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {proposals.map(p => {
        const state = getState(p);
        const actionCount = Array.isArray(p.actions) ? p.actions.length : 0;

        return (
          <Card key={p.id} className="bg-glass-surface border-glass-border" data-testid={`execute-card-${p.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.summary}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Approved {p.approvedAt ? new Date(p.approvedAt).toLocaleString() : "N/A"}
                  </p>
                  {p.origin && (
                    <Badge variant="outline" className={`text-[10px] mt-2 ${originColors[p.origin] || ""}`}>
                      {p.origin.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="font-mono text-[10px]">{p.id.slice(0, 8)}</Badge>
                  {p.status === "approved_pending_send" && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">Semi-Auto</Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 pb-3">
              {p.userRequest && (
                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">"{p.userRequest}"</p>
              )}
              {p.relatedEntity && (() => {
                const link = getEntityLink(p.relatedEntity);
                return (
                  <div className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                    <Link href={link.href} className="text-primary hover:underline truncate">
                      {link.label}: {p.relatedEntity.id.slice(0, 8)}
                    </Link>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-3 h-3 shrink-0" />
                <span>Approved by: {p.approvedBy || "System"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-3 h-3 shrink-0" />
                <span>{actionCount} action{actionCount !== 1 ? "s" : ""} to execute</span>
              </div>
            </CardContent>

            <CardFooter className="pt-2 border-t border-border">
              {state === "idle" && p.status === "approved" && (
                <Button size="sm" onClick={() => executeMutation.mutate(p.id)} disabled={executeMutation.isPending}>
                  <Play className="w-3 h-3 mr-2" />
                  {executeMutation.isPending ? "Dispatching..." : "Execute"}
                </Button>
              )}
              {state === "idle" && p.status === "approved_pending_send" && (
                <Button size="sm" variant="secondary" onClick={() => finalizeMutation.mutate(p.id)} disabled={finalizeMutation.isPending}>
                  <ShieldCheck className="w-3 h-3 mr-2" />
                  {finalizeMutation.isPending ? "Finalizing..." : "Finalize & Execute"}
                </Button>
              )}
              {state === "dispatched" && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Dispatched</span>
                  </div>
                  <Link href="/automation-ledger">
                    <Button variant="outline" size="sm">View in Ledger</Button>
                  </Link>
                </div>
              )}
              {state === "dispatch_failed" && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">Dispatch failed</span>
                  </div>
                  <Button variant="outline" size="sm"
                    onClick={() => {
                      setLocalStates(prev => { const n = { ...prev }; delete n[p.id]; return n; });
                      executeMutation.mutate(p.id);
                    }}
                    disabled={executeMutation.isPending}>
                    Retry
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Combined page ────────────────────────────────────────────────────────────

export default function ProposalQueue() {
  const { data: pending = [] } = useQuery<PendingProposal[]>({
    queryKey: ["/api/proposals", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/proposals?status=pending");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: approved = [] } = useQuery<ApprovedProposal[]>({
    queryKey: ["/api/proposals", "ready"],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        fetch("/api/proposals?status=approved").then(r => r.json()).catch(() => []),
        fetch("/api/proposals?status=approved_pending_send").then(r => r.json()).catch(() => []),
      ]);
      return [...(a || []), ...(b || [])];
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6" data-testid="page-proposal-queue">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Proposal Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review AI proposals, then dispatch approved actions to the execution agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
            {pending.length} PENDING REVIEW
          </Badge>
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
            {approved.length} READY TO EXECUTE
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review" className="gap-2">
            Review
            {pending.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="execute" className="gap-2">
            Execute
            {approved.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{approved.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="mt-6">
          <ReviewSection />
        </TabsContent>
        <TabsContent value="execute" className="mt-6">
          <ExecuteSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
