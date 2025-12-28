import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Zap, AlertCircle, CheckCircle, Clock, ArrowRight, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AssistQueueEntry {
  id: string;
  mode: string;
  userRequest: string;
  status: string;
  proposedAction: string | null;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export default function AIPulseWidget() {
  const [, setLocation] = useLocation();

  const { data: assistQueueData, isLoading: queueLoading } = useQuery<AssistQueueEntry[]>({
    queryKey: ["/api/assist-queue"],
    refetchInterval: 30000,
  });

  const { data: auditLogData } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  const assistQueue = Array.isArray(assistQueueData) ? assistQueueData : [];
  const auditLog = Array.isArray(auditLogData) ? auditLogData : [];

  const pendingApprovals = assistQueue.filter(e => e.status === "pending").length;
  const completedCount = assistQueue.filter(e => e.status === "completed").length;
  const recentAIActions = auditLog
    .filter(log => log.action.includes("ai_") || log.action.includes("master_architect"))
    .slice(0, 5);

  const aiInsights = [
    pendingApprovals > 0 && {
      type: "approval",
      icon: AlertCircle,
      message: `${pendingApprovals} action${pendingApprovals > 1 ? "s" : ""} awaiting your approval`,
      severity: "warning",
    },
    completedCount > 0 && {
      type: "completed",
      icon: CheckCircle,
      message: `${completedCount} AI tasks completed today`,
      severity: "success",
    },
  ].filter(Boolean) as Array<{
    type: string;
    icon: typeof AlertCircle;
    message: string;
    severity: string;
  }>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "approved": return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "rejected": return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "completed": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="relative overflow-visible" data-testid="widget-ai-pulse">
      <div className="absolute -top-1 -right-1 w-3 h-3">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
      </div>

      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <CardTitle className="text-lg">AI Pulse</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          Live
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {aiInsights.length > 0 && (
          <div className="space-y-2">
            {aiInsights.map((insight, idx) => (
              <div 
                key={idx} 
                className={`flex items-center gap-2 p-2 rounded-md ${
                  insight.severity === "warning" 
                    ? "bg-amber-500/10 border border-amber-500/20" 
                    : "bg-green-500/10 border border-green-500/20"
                }`}
              >
                <insight.icon className={`w-4 h-4 ${
                  insight.severity === "warning" ? "text-amber-500" : "text-green-500"
                }`} />
                <span className="text-sm flex-1">{insight.message}</span>
                {insight.type === "approval" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocation("/approval-hub")}
                    data-testid="button-view-approvals"
                  >
                    Review
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Recent AI Activity</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/approval-hub")}
              data-testid="button-view-all-ai-activity"
            >
              View All
            </Button>
          </div>
          
          {queueLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : assistQueue.length === 0 && recentAIActions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>AI is standing by</p>
              <p className="text-xs">No recent activity</p>
            </div>
          ) : (
            <ScrollArea className="h-[120px]">
              <div className="space-y-2">
                {assistQueue.slice(0, 5).map(entry => (
                  <div 
                    key={entry.id}
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/approval-hub`)}
                    data-testid={`ai-activity-${entry.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      entry.status === "pending" ? "bg-amber-500" :
                      entry.status === "completed" ? "bg-green-500" :
                      entry.status === "rejected" ? "bg-red-500" : "bg-muted-foreground"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.userRequest}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className={`text-xs ${getStatusColor(entry.status)}`}>
                          {entry.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="pt-2 border-t">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => setLocation("/crm-agent")}
            data-testid="button-talk-to-ai"
          >
            <Brain className="w-4 h-4 mr-2" />
            Talk to AI Assistant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
