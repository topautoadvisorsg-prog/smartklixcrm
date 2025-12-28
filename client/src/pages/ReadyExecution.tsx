import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, Search, User } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AutomationLedgerEntry {
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
}

export default function ReadyExecution() {
  const { toast } = useToast();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"execute" | "reject" | null>(null);

  const { data: entries = [], isLoading } = useQuery<AutomationLedgerEntry[]>({
    queryKey: ["/api/ready-execution"],
  });

  const executeMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", `/api/ready-execution/${entryId}/execute`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Execution failed" }));
        throw new Error(errorData.error || `Failed to execute (status: ${res.status})`);
      }
      if (res.status === 204) return { success: true };
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-execution"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-log"] });
      setSelectedEntryId(null);
      setShowConfirmDialog(false);
      toast({ title: "Action executed", description: "The action has been dispatched successfully." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Execution failed", 
        description: error.message || "There was an error executing the action.", 
        variant: "destructive" 
      });
      setShowConfirmDialog(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", `/api/ready-execution/${entryId}/reject`, {
        reason: "Rejected by human operator",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Rejection failed" }));
        throw new Error(errorData.error || `Failed to reject (status: ${res.status})`);
      }
      if (res.status === 204) return { success: true };
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-execution"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation-ledger"] });
      setSelectedEntryId(null);
      setShowConfirmDialog(false);
      toast({ title: "Action rejected", description: "The action has been rejected and logged." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Rejection failed", 
        description: error.message || "There was an error rejecting this action.", 
        variant: "destructive" 
      });
      setShowConfirmDialog(false);
    },
  });

  const selectedEntry = entries.find((e) => e.id === selectedEntryId);

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      entry.id.toLowerCase().includes(search) ||
      entry.actionType.toLowerCase().includes(search) ||
      entry.entityType.toLowerCase().includes(search)
    );
  });

  const handleExecuteClick = () => {
    setPendingAction("execute");
    setShowConfirmDialog(true);
  };

  const handleRejectClick = () => {
    setPendingAction("reject");
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    if (!selectedEntry) return;
    if (pendingAction === "execute") {
      executeMutation.mutate(selectedEntry.id);
    } else if (pendingAction === "reject") {
      rejectMutation.mutate(selectedEntry.id);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-6" data-testid="page-ready-execution">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              READY EXECUTION (FINAL HUMAN AUTHORITY & DISPATCH)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              THE ONLY POINT OF HUMAN APPROVAL FOR REAL-WORLD IMPACT. REVIEW, CONFIRM, AND EXECUTE VALIDATED PROPOSALS.
            </p>
          </div>
          <Badge className="bg-transparent border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 px-4 py-2 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            AUTHORITY: HUMAN OPERATOR (FINAL DECISION)
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 bg-card border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              READY FOR DISPATCH QUEUE (AI-VALIDATED)
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search queue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No actions awaiting execution</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Master Architect approved actions appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 transition-colors hover:bg-muted/50 ${
                        selectedEntryId === entry.id ? "bg-muted border-l-2 border-l-emerald-500" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-xs font-mono text-muted-foreground">Proposal #{entry.id.toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{getTimeAgo(entry.timestamp)}</p>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-3">
                        {entry.actionType}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/50 font-mono text-[10px] px-2">
                          AI-VALIDATED (READY)
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs px-4"
                          onClick={() => setSelectedEntryId(entry.id)}
                        >
                          REVIEW
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 bg-card border-border">
          <CardContent className="p-6">
            {!selectedEntry ? (
              <div className="h-[500px] flex flex-col items-center justify-center text-center">
                <User className="w-16 h-16 mb-4 text-muted-foreground/30" />
                <p className="text-lg text-muted-foreground">Select a proposal to review</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  All actions require human confirmation before execution
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Execution Detail: {selectedEntry.actionType} (#{selectedEntry.id.toUpperCase()})
                  </h2>
                </div>

                <div className="bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      PAYLOAD SUMMARY (AI-VALIDATED)
                    </h3>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      READ-ONLY
                    </Badge>
                  </div>
                  <ScrollArea className="h-48">
                    <pre className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap">
                      {selectedEntry.diffJson 
                        ? JSON.stringify(selectedEntry.diffJson, null, 2)
                        : "No payload data"}
                    </pre>
                  </ScrollArea>
                </div>

                <div className="bg-muted/50 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    VALIDATION STATUS
                  </h3>
                  <div className="flex items-center gap-3 p-4 bg-background rounded-lg border border-emerald-500/30">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">MASTER ARCHITECT APPROVED</p>
                      <p className="text-xs text-muted-foreground">AI Validation Complete. Ready for Human Dispatch.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    FINAL HUMAN AUTHORITY
                  </h3>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={handleRejectClick}
                      disabled={rejectMutation.isPending}
                    >
                      REJECT
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      onClick={handleExecuteClick}
                      disabled={executeMutation.isPending}
                    >
                      CONFIRM & DISPATCH
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "execute" ? "Confirm Dispatch" : "Confirm Rejection"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === "execute"
                ? "This action will be dispatched to N8N for execution. This decision will be recorded in the ledger."
                : "This action will be marked as rejected. The proposing agent will be notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 rounded bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">Proposal</p>
              <p className="text-sm font-mono text-foreground">#{selectedEntry?.id.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Action</p>
              <p className="text-sm text-foreground">{selectedEntry?.actionType}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={executeMutation.isPending || rejectMutation.isPending}
              className={pendingAction === "execute" 
                ? "bg-emerald-600 hover:bg-emerald-500" 
                : "bg-destructive hover:bg-destructive/90"}
            >
              {pendingAction === "execute" ? "Dispatch" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
