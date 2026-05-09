import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, ChevronDown, ChevronUp, Clock, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProposalAction {
  tool: string;
  args: Record<string, unknown>;
}

interface Proposal {
  id: string;
  summary: string;
  actions: ProposalAction[];
  reasoning: string | null;
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  // Governance fields from assist_queue migration
  origin?: "voice" | "ai_chat" | "admin_chat" | "gpt_actions" | "webhook";
  userRequest?: string;
  validatorDecision?: "approve" | "reject";
  validatorReason?: string;
  requiresApproval?: boolean;
  mode?: string;
}

export default function ReviewQueue() {
  const { toast } = useToast();
  const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set());
  const [rejectingProposalId, setRejectingProposalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/proposals", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/proposals?status=pending");
      if (!res.ok) throw new Error("Failed to fetch proposals");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest("POST", `/api/proposals/${proposalId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", "pending"] });
      toast({ title: "Proposal approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve proposal", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: string; reason: string }) => {
      return apiRequest("POST", `/api/proposals/${proposalId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", "pending"] });
      toast({ title: "Proposal rejected" });
      setRejectingProposalId(null);
      setRejectReason("");
    },
    onError: () => {
      toast({ title: "Failed to reject proposal", variant: "destructive" });
    },
  });

  const toggleExpanded = (proposalId: string) => {
    const newExpanded = new Set(expandedProposals);
    if (newExpanded.has(proposalId)) {
      newExpanded.delete(proposalId);
    } else {
      newExpanded.add(proposalId);
    }
    setExpandedProposals(newExpanded);
  };

  const handleApprove = (proposalId: string) => {
    approveMutation.mutate(proposalId);
  };

  const handleRejectClick = (proposalId: string) => {
    setRejectingProposalId(proposalId);
    setRejectReason("");
  };

  const handleCancelReject = () => {
    setRejectingProposalId(null);
    setRejectReason("");
  };

  const handleConfirmReject = (proposalId: string) => {
    if (!rejectReason.trim()) {
      toast({ title: "Please provide a reason for rejection", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({ proposalId, reason: rejectReason });
  };

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "medium":
        return "bg-amber-500/20 text-amber-500 border-amber-500/30";
      case "low":
        return "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return <ShieldAlert className="w-3 h-3" />;
      case "medium":
        return <Shield className="w-3 h-3" />;
      case "low":
        return <ShieldCheck className="w-3 h-3" />;
      default:
        return <Shield className="w-3 h-3" />;
    }
  };

  // Origin badge color coding
  const originColors: Record<string, string> = {
    voice: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    ai_chat: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    admin_chat: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    gpt_actions: "bg-green-500/20 text-green-300 border-green-500/30",
    webhook: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  };

  return (
    <div className="space-y-6" data-testid="page-review-queue">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Review Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approve or reject AI-proposed actions
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
          {proposals.length} PENDING
        </Badge>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-glass-surface border-glass-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
                <CardFooter className="gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </CardFooter>
              </Card>
            ))}
          </>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <CheckCircle className="w-16 h-16 text-emerald-500/50" />
            <p className="text-muted-foreground text-center">
              No pending proposals.
            </p>
          </div>
        ) : (
          proposals.map((proposal) => (
            <Card key={proposal.id} className="bg-glass-surface border-glass-border" data-testid={`proposal-card-${proposal.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
                    </span>
                    <span className="font-mono text-[10px] opacity-50">
                      ({new Date(proposal.createdAt).toLocaleString()})
                    </span>
                    {/* Origin badge */}
                    {proposal.origin && (
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ml-2 ${originColors[proposal.origin] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                      >
                        {proposal.origin.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <Badge className={`text-[10px] font-black uppercase tracking-wide ${getRiskBadgeVariant(proposal.riskLevel)}`}>
                    <span className="flex items-center gap-1">
                      {getRiskIcon(proposal.riskLevel)}
                      {proposal.riskLevel} Risk
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* User request */}
                {proposal.userRequest && (
                  <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                    "{proposal.userRequest}"
                  </p>
                )}
                <p className="font-semibold text-sm">{proposal.summary}</p>
                {/* Validator decision indicator */}
                {proposal.validatorDecision && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Validator:</span>
                    <Badge 
                      variant="outline" 
                      className={proposal.validatorDecision === "approve" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                      }
                    >
                      {proposal.validatorDecision}
                    </Badge>
                    {proposal.validatorReason && (
                      <span className="text-muted-foreground">— {proposal.validatorReason}</span>
                    )}
                  </div>
                )}
                {/* Mode badge */}
                {proposal.mode && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {proposal.mode} mode
                    </Badge>
                  </div>
                )}

                <Collapsible open={expandedProposals.has(proposal.id)} onOpenChange={() => toggleExpanded(proposal.id)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest gap-1 p-0 h-auto">
                      {expandedProposals.has(proposal.id) ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          Show Details
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    {proposal.reasoning && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-1">
                          AI Reasoning
                        </p>
                        <p className="text-xs text-muted-foreground">{proposal.reasoning}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                        Proposed Actions ({proposal.actions.length})
                      </p>
                      {proposal.actions.map((action, index) => (
                        <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">
                              {action.tool}
                            </code>
                          </div>
                          <pre className="text-[10px] font-mono overflow-auto max-h-32 p-2 rounded bg-muted">
                            {JSON.stringify(action.args, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {rejectingProposalId === proposal.id && (
                  <div className="pt-2">
                    <Textarea
                      placeholder="Enter reason for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="text-xs min-h-[80px] resize-none"
                      data-testid={`reject-reason-${proposal.id}`}
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                {rejectingProposalId === proposal.id ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelReject}
                      className="text-[10px] font-black uppercase tracking-widest"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleConfirmReject(proposal.id)}
                      disabled={rejectMutation.isPending}
                      className="text-[10px] font-black uppercase tracking-widest"
                      data-testid={`confirm-reject-${proposal.id}`}
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectClick(proposal.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      data-testid={`reject-button-${proposal.id}`}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(proposal.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`approve-button-${proposal.id}`}
                    >
                      {approveMutation.isPending ? "Approving..." : "Approve"}
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
