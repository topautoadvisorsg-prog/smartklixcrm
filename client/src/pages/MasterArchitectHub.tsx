import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, Activity, CheckCircle, XCircle, Clock, Eye, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import type { AssistQueueEntry, AiTask } from "@shared/schema";

interface MasterTask {
  id: string;
  type: "assist_queue" | "ai_task" | "n8n_event";
  status: string;
  title: string;
  description: string;
  userRequest?: string;
  agentResponse?: string;
  context?: {
    contactId?: string;
    jobId?: string;
    estimateId?: string;
    invoiceId?: string;
  };
  toolsCalled?: any[];
  toolResults?: any[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export default function MasterArchitectHub() {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState<MasterTask | null>(null);
  const { toast } = useToast();

  // Fetch unified tasks from centralized endpoint
  const { data: allTasks = [], isLoading } = useQuery<MasterTask[]>({
    queryKey: ["/api/master-architect/tasks"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/assist-queue/${id}/approve`, "POST", {});
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-architect/tasks"] });
      toast({
        title: "Action Approved",
        description: "The AI action has been executed successfully",
      });
      setSelectedTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve action",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/assist-queue/${id}/reject`, "POST", {
        reason: "Rejected by user from Master Architect Hub",
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-architect/tasks"] });
      toast({
        title: "Action Rejected",
        description: "The AI action has been rejected",
      });
      setSelectedTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject action",
        variant: "destructive",
      });
    },
  });

  // Apply filters
  const filteredTasks = allTasks.filter(task => {
    if (typeFilter !== "all" && task.type !== typeFilter) return false;
    if (filter === "pending" && task.status !== "pending") return false;
    if (filter === "completed" && task.status !== "completed") return false;
    if (filter === "failed" && task.status !== "failed") return false;
    return true;
  });

  // Sort by creation date (newest first)
  const sortedTasks = filteredTasks.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      completed: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
      rejected: { variant: "secondary", icon: XCircle },
    };
    const config = variants[status] || { variant: "outline" as const, icon: Activity };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1.5">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const config = {
      assist_queue: { label: "AI Assist", color: "bg-blue-500/10 text-blue-500" },
      ai_task: { label: "Automation", color: "bg-purple-500/10 text-purple-500" },
      n8n_event: { label: "N8N Event", color: "bg-green-500/10 text-green-500" },
    };
    const { label, color } = config[type as keyof typeof config] || config.ai_task;
    return (
      <Badge variant="outline" className={color}>
        {label}
      </Badge>
    );
  };

  const pendingCount = allTasks.filter(t => t.status === "pending").length;
  const completedCount = allTasks.filter(t => t.status === "completed").length;
  const failedCount = allTasks.filter(t => t.status === "failed" || t.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold">Review Queue</h1>
            <Badge variant="outline" className="gap-1.5">
              <Zap className="w-3 h-3" />
              {pendingCount} pending
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Review and approve actions suggested by your AI assistant</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully executed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Errors or rejected</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48" data-testid="select-filter-type">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="assist_queue">AI Assist Only</SelectItem>
            <SelectItem value="ai_task">Automation Only</SelectItem>
            <SelectItem value="n8n_event">N8N Events Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48" data-testid="select-filter-status">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Tasks ({sortedTasks.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Loading tasks...</p>
            </div>
          ) : sortedTasks.length > 0 ? (
            sortedTasks.map((task) => (
              <Card key={task.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedTask(task)}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getTypeBadge(task.type)}
                        {getStatusBadge(task.status)}
                      </div>
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <CardDescription>{task.description}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" data-testid={`button-view-${task.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                    {task.completedAt && (
                      <span>Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No tasks found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {sortedTasks.filter(t => t.status === "pending").map((task) => (
            <Card key={task.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedTask(task)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(task.type)}
                      {getStatusBadge(task.status)}
                    </div>
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {sortedTasks.filter(t => t.status === "completed").map((task) => (
            <Card key={task.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedTask(task)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(task.type)}
                      {getStatusBadge(task.status)}
                    </div>
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <CardDescription>{task.description}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                  {task.completedAt && (
                    <span>Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              {selectedTask && getTypeBadge(selectedTask.type)}
              {selectedTask && getStatusBadge(selectedTask.status)}
            </div>
            <DialogTitle className="text-2xl">{selectedTask?.title}</DialogTitle>
            <DialogDescription>{selectedTask?.description}</DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              {selectedTask.userRequest && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Original Request</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">{selectedTask.userRequest}</p>
                  </div>
                </div>
              )}

              {selectedTask.agentResponse && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">AI Response</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">{selectedTask.agentResponse}</p>
                  </div>
                </div>
              )}

              {selectedTask.toolsCalled && selectedTask.toolsCalled.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Proposed Actions</h4>
                  <div className="space-y-2">
                    {selectedTask.toolsCalled.map((tool: any, idx: number) => (
                      <div key={idx} className="bg-muted p-4 rounded-lg">
                        <div className="font-medium text-sm mb-2">
                          {typeof tool === 'object' && tool.name ? tool.name.replace(/_/g, " ") : "Action"}
                        </div>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(typeof tool === 'object' && tool.args ? tool.args : tool, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.toolResults && selectedTask.toolResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Execution Results</h4>
                  <div className="space-y-2">
                    {selectedTask.toolResults.map((result: any, idx: number) => (
                      <div key={idx} className="bg-muted p-4 rounded-lg">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.error && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-destructive">Error</h4>
                  <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                    <p className="text-sm text-destructive">{selectedTask.error}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div>Created {format(new Date(selectedTask.createdAt), "PPpp")}</div>
                {selectedTask.completedAt && (
                  <div>Completed {format(new Date(selectedTask.completedAt), "PPpp")}</div>
                )}
              </div>

              {selectedTask.type === "assist_queue" && selectedTask.status === "pending" && (
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => rejectMutation.mutate(selectedTask.id)}
                    disabled={rejectMutation.isPending}
                    data-testid="button-reject-task"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => approveMutation.mutate(selectedTask.id)}
                    disabled={approveMutation.isPending}
                    data-testid="button-approve-task"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Execute
                  </Button>
                </div>
              )}

              {selectedTask.type === "n8n_event" && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    N8N events are executed automatically and cannot be approved or rejected from this interface.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
