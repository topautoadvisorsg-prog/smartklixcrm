import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, Filter, ChevronRight, Link2, Clock, Hash, User, Bot } from "lucide-react";

interface LedgerEntry {
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

const ACTION_TYPES = [
  "PROPOSAL_CREATED",
  "AI_VALIDATION_RECORDED",
  "HUMAN_EXECUTION_DECISION",
  "STAGED_ACTIONS_ACCEPTED",
  "INTAKE_RECEIVED",
  "RECORD_CREATED",
  "RECORD_UPDATED",
  "COMMUNICATION_SENT",
  "PAYMENT_PROCESSED",
] as const;

export default function AutomationLedger() {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  const { data: entries = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["/api/automation-ledger"],
  });

  const filteredEntries = entries.filter((entry) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      entry.id.toLowerCase().includes(searchLower) ||
      (entry.actionType && entry.actionType.toLowerCase().includes(searchLower)) ||
      (entry.agentName && entry.agentName.toLowerCase().includes(searchLower)) ||
      (entry.entityId && entry.entityId.toLowerCase().includes(searchLower)) ||
      (entry.reason && entry.reason.toLowerCase().includes(searchLower));
    const matchesType = eventTypeFilter === "all" || entry.actionType === eventTypeFilter;
    return matchesSearch && matchesType;
  });

  const getAgentIcon = (agentName: string | null | undefined) => {
    if (!agentName) return <Hash className="w-3 h-3" />;
    const lowerName = agentName.toLowerCase();
    if (lowerName.includes("human") || lowerName.includes("operator")) {
      return <User className="w-3 h-3" />;
    }
    if (lowerName.includes("architect") || lowerName.includes("ai") || lowerName.includes("action")) {
      return <Bot className="w-3 h-3" />;
    }
    return <Hash className="w-3 h-3" />;
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "proposed":
        return "secondary";
      case "ai_validated":
        return "default";
      case "executed":
        return "default";
      case "rejected":
        return "destructive";
      case "recorded":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getActionBadgeVariant = (actionType: string | null | undefined): "default" | "secondary" | "outline" => {
    if (!actionType) return "secondary";
    if (actionType.includes("PROPOSAL")) return "secondary";
    if (actionType.includes("VALIDATION")) return "outline";
    if (actionType.includes("EXECUTION")) return "default";
    return "secondary";
  };

  const getSummary = (entry: LedgerEntry): string => {
    if (entry.reason) return entry.reason;
    const diff = entry.diffJson as Record<string, unknown> | null;
    if (diff?.userRequest) return String(diff.userRequest).slice(0, 80);
    if (diff?.decision) return `Decision: ${diff.decision}`;
    return (entry.actionType || "unknown").replace(/_/g, " ").toLowerCase();
  };

  return (
    <div className="space-y-6" data-testid="page-automation-ledger">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" data-testid="text-page-title">
            <ScrollText className="w-6 h-6 text-primary" />
            Automation Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable event log with cryptographic hash chaining
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          {entries.length} EVENTS
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, action type, agent, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-ledger"
          />
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-[220px]" data-testid="select-event-type">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-glass-surface border-glass-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Event Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading ledger...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="p-6 text-center">
                  <ScrollText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No events found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${
                        selectedEntry?.id === entry.id ? "bg-muted/80" : ""
                      }`}
                      data-testid={`ledger-entry-${entry.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={getActionBadgeVariant(entry.actionType)} className="font-mono text-[10px]">
                              {entry.actionType || "UNKNOWN"}
                            </Badge>
                            <Badge variant={getStatusBadgeVariant(entry.status)} className="font-mono text-[10px]">
                              {entry.status}
                            </Badge>
                            {entry.assistQueueId && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                Linked
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{getSummary(entry)}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {getAgentIcon(entry.agentName)}
                              {entry.agentName || "Unknown"}
                            </span>
                            <span className="font-mono">{entry.entityType}{entry.entityId ? `#${entry.entityId.slice(0, 8)}` : ""}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-mono text-primary">{entry.id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-glass-surface border-glass-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEntry ? (
              <div className="h-[540px] flex flex-col items-center justify-center text-center">
                <ScrollText className="w-12 h-12 mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Select an event to view details</p>
              </div>
            ) : (
              <ScrollArea className="h-[540px]">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Action Type</p>
                    <Badge variant={getActionBadgeVariant(selectedEntry.actionType)} className="font-mono">{selectedEntry.actionType || "UNKNOWN"}</Badge>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Status</p>
                    <Badge variant={getStatusBadgeVariant(selectedEntry.status)} className="font-mono">{selectedEntry.status}</Badge>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Entry ID</p>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded block">{selectedEntry.id}</code>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm">{getSummary(selectedEntry)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Agent</p>
                      <p className="text-sm flex items-center gap-1">
                        {getAgentIcon(selectedEntry.agentName)}
                        {selectedEntry.agentName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Target</p>
                      <p className="text-sm font-mono">{selectedEntry.entityType}{selectedEntry.entityId ? `#${selectedEntry.entityId.slice(0, 8)}` : ""}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Timestamp</p>
                    <p className="text-sm">{new Date(selectedEntry.timestamp).toLocaleString()}</p>
                  </div>

                  {selectedEntry.assistQueueId && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Linked Queue Entry</p>
                      <Button variant="outline" size="sm" className="text-xs font-mono">
                        <Link2 className="w-3 h-3 mr-2" />
                        {selectedEntry.assistQueueId.slice(0, 8)}
                      </Button>
                    </div>
                  )}

                  {selectedEntry.reason && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{selectedEntry.reason}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Diff / Payload</p>
                    <pre className="text-xs font-mono overflow-auto max-h-48 p-3 rounded bg-muted">
                      {JSON.stringify(selectedEntry.diffJson, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
