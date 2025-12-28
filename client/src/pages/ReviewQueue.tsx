import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, XCircle, Clock, ShieldCheck, AlertTriangle, Network } from "lucide-react";
import { format } from "date-fns";

type ValidationStep = {
  label: string;
  status: "pending" | "active" | "passed" | "failed";
};

type AIProposal = {
  id: string;
  origin: string;
  summary: string;
  details: string;
  targetEntity: string;
  steps: ValidationStep[];
  status: "in_validation" | "approved" | "rejected";
  rejectionReason?: string;
  timestamp: string;
};

type LedgerEntry = {
  id: string;
  time: string;
  proposalId: string;
  result: "APPROVED" | "REJECTED";
  reason: string;
};

type AssistQueueEntry = {
  id: string;
  mode: string;
  userRequest: string;
  status: string;
  gatedActionType: string | null;
  agentResponse: string | null;
  requiresApproval: boolean;
  architectApprovedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  error: string | null;
};

type AutomationLedgerEntry = {
  id: string;
  timestamp: string;
  agentName: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  mode: string;
  status: string;
  diffJson: Record<string, unknown> | null;
  reason: string | null;
  assistQueueId: string | null;
  updatedAt: string;
};

function transformToProposals(entries: AssistQueueEntry[] | undefined | null): AIProposal[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries
    .filter((e) => e.mode !== "human" && e.requiresApproval)
    .map((entry) => {
      const hasArchitectApproval = !!entry.architectApprovedAt;
      const isRejected = !!entry.rejectedAt;
      const isPending = entry.status === "pending" || entry.status === "processing";

      let validationStatus: "in_validation" | "approved" | "rejected" = "in_validation";
      if (hasArchitectApproval && !isRejected) validationStatus = "approved";
      if (isRejected) validationStatus = "rejected";

      const steps: ValidationStep[] = [
        {
          label: "Logic Check",
          status: isPending ? "active" : "passed",
        },
        {
          label: "Schema Check",
          status: isPending ? "pending" : hasArchitectApproval || isRejected ? "passed" : "active",
        },
        {
          label: "Policy Compliance",
          status: isRejected ? "failed" : hasArchitectApproval ? "passed" : "pending",
        },
      ];

      return {
        id: `PROP-${entry.id.slice(0, 8).toUpperCase()}`,
        origin: "ActionAI CRM",
        summary: entry.gatedActionType
          ? `${entry.gatedActionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
          : entry.userRequest?.slice(0, 60) || "AI Action",
        details: entry.agentResponse?.slice(0, 100) || entry.userRequest?.slice(0, 100) || "",
        targetEntity: entry.gatedActionType || "Action",
        steps,
        status: validationStatus,
        rejectionReason: entry.error || undefined,
        timestamp: entry.createdAt,
      };
    });
}

function transformToLedger(entries: AutomationLedgerEntry[] | undefined | null): LedgerEntry[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries
    .filter((e) => 
      e.actionType === "AI_VALIDATION_RECORDED" || 
      e.actionType === "PROPOSAL_CREATED" ||
      e.agentName === "Master Architect" ||
      e.agentName === "ActionAI CRM"
    )
    .slice(0, 20)
    .map((entry) => {
      const diff = entry.diffJson as Record<string, unknown> | null;
      const summary = entry.reason || 
        (diff?.decision ? `Decision: ${diff.decision}` : null) ||
        (diff?.userRequest ? String(diff.userRequest).slice(0, 50) : null) ||
        entry.actionType.replace(/_/g, " ").toLowerCase();
      
      let result: "APPROVED" | "REJECTED" = "APPROVED";
      if (entry.status === "rejected" || (diff?.decision === "rejected")) {
        result = "REJECTED";
      }
      
      return {
        id: entry.id,
        time: format(new Date(entry.timestamp), "HH:mm:ss.SSS"),
        proposalId: entry.assistQueueId 
          ? `PROP-${entry.assistQueueId.slice(0, 8).toUpperCase()}`
          : `LEDG-${entry.id.slice(0, 8).toUpperCase()}`,
        result,
        reason: summary,
      };
    });
}

function ValidationStepper({ steps }: { steps: ValidationStep[] }) {
  return (
    <div className="flex items-center bg-black/20 dark:bg-black/40 rounded-lg p-2 border border-glass-border gap-1">
      {steps.map((step, i) => {
        let borderColor = "border-muted";
        let textColor = "text-muted-foreground/50";
        let indicator = null;

        if (step.status === "passed") {
          borderColor = "border-emerald-500";
          textColor = "text-emerald-500";
        } else if (step.status === "active") {
          borderColor = "border-amber-500";
          textColor = "text-amber-500";
          indicator = <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mb-1 animate-ping" />;
        } else if (step.status === "failed") {
          borderColor = "border-red-500";
          textColor = "text-red-500";
        }

        return (
          <div
            key={i}
            className={`flex-1 flex items-center justify-center py-2 px-1 border-b-2 ${borderColor}`}
          >
            <div className="flex flex-col items-center">
              {indicator}
              <span className={`text-[9px] font-bold uppercase tracking-tight ${textColor}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProposalStatus({ status, rejectionReason }: { status: AIProposal["status"]; rejectionReason?: string }) {
  if (status === "in_validation") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-amber-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest">In Validation</span>
        </div>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Approved</span>
        </div>
        <span className="text-[9px] text-emerald-500/60 font-medium uppercase tracking-wide">
          Moving to Ready Execution
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2 text-red-500">
        <XCircle className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Rejected</span>
      </div>
      <span className="text-[9px] text-red-500/60 font-medium uppercase tracking-wide">
        {rejectionReason ? rejectionReason.slice(0, 30) : "Returned to Source"}
      </span>
    </div>
  );
}

export default function ReviewQueue() {
  const { data: assistData, isLoading: loadingAssist } = useQuery<{ entries: AssistQueueEntry[]; count: number }>({
    queryKey: ["/api/assist-queue"],
  });
  const assistEntries = assistData?.entries || [];

  const { data: ledgerEntries = [], isLoading: loadingLedger } = useQuery<AutomationLedgerEntry[]>({
    queryKey: ["/api/automation-ledger"],
  });

  const proposals = transformToProposals(assistEntries);
  const ledger = transformToLedger(ledgerEntries);
  const isLoading = loadingAssist || loadingLedger;

  const stats = {
    inValidation: proposals.filter((p) => p.status === "in_validation").length,
    approved: proposals.filter((p) => p.status === "approved").length,
    rejected: proposals.filter((p) => p.status === "rejected").length,
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/5 dark:bg-blue-900/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/5 dark:bg-indigo-900/10 blur-[150px] rounded-full" />
      </div>

      {/* Header */}
      <header className="p-6 bg-glass-surface border-b border-glass-border flex justify-between items-start gap-4 flex-wrap z-20">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-900 flex items-center justify-center shadow-xl border border-white/10">
            <Network className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
              Review Queue{" "}
              <span className="text-muted-foreground font-normal">(AI Governance Layer)</span>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
              <span className="text-xs font-mono text-blue-500 dark:text-blue-400 font-medium tracking-wide uppercase">
                Master Architect AI: Active | Passive Observability Mode
              </span>
            </div>
          </div>
        </div>

        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5"
          data-testid="badge-read-only"
        >
          <ShieldCheck className="w-3 h-3 mr-1.5" />
          System Controlled | Read-Only Access
        </Badge>
      </header>

      {/* Stats Bar */}
      <div className="px-6 py-3 bg-glass-surface/50 border-b border-glass-border flex items-center gap-6 z-10">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">{stats.inValidation} In Validation</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium">{stats.approved} Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium">{stats.rejected} Rejected</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden z-10 p-6 gap-6">
        {/* LEFT: THE QUEUE */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Column Headers */}
          <div className="grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <div className="col-span-2">Proposal ID</div>
            <div className="col-span-2">Origin</div>
            <div className="col-span-3">Summary</div>
            <div className="col-span-3 text-center">Validation Progress (Master Architect)</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : proposals.length === 0 ? (
                <Card className="bg-glass-surface border-glass-border p-12 text-center">
                  <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No AI Proposals in Queue</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    AI-generated actions requiring governance validation will appear here.
                    Human-initiated actions skip this queue entirely.
                  </p>
                </Card>
              ) : (
                proposals.map((prop) => (
                  <div key={prop.id} className="group relative" data-testid={`card-proposal-${prop.id}`}>
                    {/* Card Glow Effect */}
                    <div
                      className={`absolute -inset-0.5 rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-500 ${
                        prop.status === "approved"
                          ? "bg-emerald-500"
                          : prop.status === "rejected"
                          ? "bg-red-500"
                          : "bg-amber-500"
                      }`}
                    />

                    <Card className="relative bg-glass-surface border-glass-border rounded-xl p-5 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-2 font-mono text-xs text-muted-foreground font-medium tracking-tight">
                        {prop.id}
                      </div>
                      <div className="col-span-2 text-xs font-medium">{prop.origin}</div>
                      <div className="col-span-3">
                        <div className="text-sm font-medium leading-tight">{prop.summary}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{prop.details}</div>
                      </div>

                      {/* Validation Stepper */}
                      <div className="col-span-3">
                        <ValidationStepper steps={prop.steps} />
                      </div>

                      <div className="col-span-2 flex flex-col items-end justify-center">
                        <ProposalStatus status={prop.status} rejectionReason={prop.rejectionReason} />
                        <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                          {format(new Date(prop.timestamp), "yyyy-MM-dd")}
                        </div>
                      </div>
                    </Card>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: LEDGER */}
        <Card className="w-[320px] bg-glass-surface border-glass-border rounded-xl flex flex-col overflow-hidden">
          <header className="p-4 border-b border-glass-border bg-muted/20">
            <h3 className="text-xs font-bold uppercase tracking-widest">System Activity Ledger</h3>
            <p className="text-[9px] text-muted-foreground font-mono mt-1">(AI_REVIEW_DECISION)</p>
          </header>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {loadingLedger ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No governance decisions yet
                </div>
              ) : (
                ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-glass-border"
                    data-testid={`ledger-entry-${entry.id}`}
                  >
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                      <div className="w-0.5 flex-1 bg-muted-foreground/10" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground">{entry.time}</span>
                        <div className="w-5 h-5 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-[8px] font-bold text-indigo-500 dark:text-indigo-400">AI</span>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground font-medium truncate mb-1">
                        {entry.proposalId}
                      </div>
                      <div
                        className={`text-[9px] font-bold uppercase tracking-wider ${
                          entry.result === "APPROVED" ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {entry.result}:{" "}
                        <span className="text-muted-foreground font-medium normal-case">{entry.reason}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-glass-surface/50 border-t border-glass-border flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>This is an observability interface. AI proposals are automatically validated by Master Architect.</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wide">
          Approved items route to Ready Execution
        </span>
      </div>
    </div>
  );
}
