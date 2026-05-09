import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Zap,
  ExternalLink,
} from "lucide-react";

interface StagedProposal {
  id: string;
  status: string;
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
  reasoning: string | null;
  riskLevel: string | null;
  summary: string;
  relatedEntity: { type: string; id: string } | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string;
  createdAt: string;
  // Governance fields from assist_queue migration
  origin?: "voice" | "ai_chat" | "admin_chat" | "gpt_actions" | "webhook";
  userRequest?: string;
  mode?: string;
}

type ProposalExecutionState = "idle" | "dispatched" | "dispatch_failed";

const executionStates: Record<string, ProposalExecutionState> = {
  dispatched: "dispatched",
  dispatch_failed: "dispatch_failed",
};

// Origin badge color coding
const originColors: Record<string, string> = {
  voice: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  ai_chat: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  admin_chat: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  gpt_actions: "bg-green-500/20 text-green-300 border-green-500/30",
  webhook: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function getEntityLink(relatedEntity: { type: string; id: string }) {
  const type = relatedEntity.type.toLowerCase();
  switch (type) {
    case "contact":
      return { href: `/contacts/${relatedEntity.id}`, label: "Contact" };
    case "job":
      return { href: `/jobs/${relatedEntity.id}`, label: "Job" };
    case "invoice":
      return { href: `/invoices/${relatedEntity.id}`, label: "Invoice" };
    case "estimate":
      return { href: `/estimates/${relatedEntity.id}`, label: "Estimate" };
    default:
      return { href: "#", label: relatedEntity.type };
  }
}

export default function ReadyExecution() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localStates, setLocalStates] = useState<Record<string, ProposalExecutionState>>({});

  const { data: proposals = [], isLoading } = useQuery<StagedProposal[]>({
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
    mutationFn: async (proposalId: string) => {
      const res = await apiRequest("POST", `/api/proposals/${proposalId}/execute`);
      return res.json();
    },
    onSuccess: (_data, proposalId) => {
      setLocalStates((prev) => ({ ...prev, [proposalId]: "dispatched" }));
      toast({
        title: "Dispatched to execution agent",
        description: "The proposal has been dispatched successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
    onError: (error: Error, proposalId) => {
      setLocalStates((prev) => ({ ...prev, [proposalId]: "dispatch_failed" }));
      toast({
        title: "Dispatch failed",
        description: error.message || "Failed to dispatch proposal to execution agent.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await apiRequest("POST", `/api/proposals/${proposalId}/finalize`);
      if (!res.ok) throw new Error("Finalize failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal finalized and executed" });
    },
    onError: () => {
      toast({ title: "Finalization failed", variant: "destructive" });
    },
  });

  const getEffectiveState = (proposal: StagedProposal): ProposalExecutionState => {
    if (localStates[proposal.id]) return localStates[proposal.id];
    if (executionStates[proposal.status]) return executionStates[proposal.status];
    return "idle";
  };

  return (
    <div className="space-y-6" data-testid="page-ready-execution">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" data-testid="text-page-title">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Ready Execution
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch approved proposals to the execution agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
            {proposals.filter(p => p.status === "approved").length} APPROVED
          </Badge>
          {proposals.filter(p => p.status === "approved_pending_send").length > 0 && (
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              {proposals.filter(p => p.status === "approved_pending_send").length} PENDING FINALIZE
            </Badge>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-glass-surface border-glass-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3 mt-1" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && proposals.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <ShieldCheck className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground text-center">
            No approved proposals awaiting execution.
          </p>
        </div>
      )}

      {/* Proposal cards */}
      {!isLoading && proposals.length > 0 && (
        <div className="grid gap-4">
          {proposals.map((proposal) => {
            const state = getEffectiveState(proposal);
            const actionCount = Array.isArray(proposal.actions) ? proposal.actions.length : 0;

            return (
              <Card
                key={proposal.id}
                className="bg-glass-surface border-glass-border"
                data-testid={`proposal-card-${proposal.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{proposal.summary}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Approved {proposal.approvedAt ? new Date(proposal.approvedAt).toLocaleString() : "N/A"}
                      </p>
                      {/* Origin badge */}
                      {proposal.origin && (
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] mt-2 ${originColors[proposal.origin] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                        >
                          {proposal.origin.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                        {proposal.id.slice(0, 8)}
                      </Badge>
                      {/* Status indicator for approved_pending_send */}
                      {proposal.status === "approved_pending_send" && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 shrink-0">
                          Semi-Auto
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 pb-3">
                  {/* User request */}
                  {proposal.userRequest && (
                    <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                      "{proposal.userRequest}"
                    </p>
                  )}
                  {/* Related entity link */}
                  {proposal.relatedEntity && (
                    <div className="flex items-center gap-2 text-sm">
                      <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                      {(() => {
                        const link = getEntityLink(proposal.relatedEntity);
                        return (
                          <Link
                            href={link.href}
                            className="text-primary hover:underline truncate"
                          >
                            {link.label}: {proposal.relatedEntity.id.slice(0, 8)}
                          </Link>
                        );
                      })()}
                    </div>
                  )}

                  {/* Approved by */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-3 h-3 shrink-0" />
                    <span>
                      Approved by: {proposal.approvedBy || "System"}
                      {proposal.approvedAt && (
                        <span className="ml-1 text-[10px]">
                          ({new Date(proposal.approvedAt).toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Action count */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>{actionCount} action{actionCount !== 1 ? "s" : ""} to execute</span>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-border">
                  {state === "idle" && proposal.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() => executeMutation.mutate(proposal.id)}
                      disabled={executeMutation.isPending}
                    >
                      <Play className="w-3 h-3 mr-2" />
                      {executeMutation.isPending ? "Dispatching..." : "Execute"}
                    </Button>
                  )}
                  {state === "idle" && proposal.status === "approved_pending_send" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => finalizeMutation.mutate(proposal.id)}
                      disabled={finalizeMutation.isPending}
                    >
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
                        <Button variant="outline" size="sm">
                          View in Ledger
                        </Button>
                      </Link>
                    </div>
                  )}

                  {state === "dispatch_failed" && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">Dispatch failed</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLocalStates((prev) => {
                            const next = { ...prev };
                            delete next[proposal.id];
                            return next;
                          });
                          executeMutation.mutate(proposal.id);
                        }}
                        disabled={executeMutation.isPending}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
