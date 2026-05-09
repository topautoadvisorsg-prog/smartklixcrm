import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, DollarSign, Calendar, FileText, MessageSquare, Activity, 
  Edit, User, CheckCircle, Clock, Wrench, TrendingUp, Sparkles,
  Plus, Upload, Send, Users, AlertCircle, Trash2, ClipboardCheck, Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import EditJobDialog from "@/components/EditJobDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import avatar1 from "@assets/generated_images/Female_executive_avatar_c19fd1f4.png";
import type { Job, Contact, Estimate, Invoice, Note, FileRecord as FileData, AuditLogEntry, Appointment, JobTask, FieldReport, FinancialRecord } from "@shared/schema";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const jobId = params?.id;
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Field report form state
  const [reportType, setReportType] = useState("progress");
  const [reportObservations, setReportObservations] = useState("");
  const [reportActionsTaken, setReportActionsTaken] = useState("");
  const [reportRecommendations, setReportRecommendations] = useState("");
  const [reportPhotos, setReportPhotos] = useState("");
  const [reportStatusUpdate, setReportStatusUpdate] = useState("");
  const [reportSeverity, setReportSeverity] = useState("low");
  const [reportResolutionStatus, setReportResolutionStatus] = useState("open");
  const [reportStartedAt, setReportStartedAt] = useState(new Date().toISOString().slice(0, 16));
  const [reportCompletedAt, setReportCompletedAt] = useState(new Date().toISOString().slice(0, 16));
  
  // Financial record form state
  const [finType, setFinType] = useState("expense");
  const [finCategory, setFinCategory] = useState("other");
  const [finAmount, setFinAmount] = useState("");
  const [finDescription, setFinDescription] = useState("");
  const [finDate, setFinDate] = useState(new Date().toISOString().split('T')[0]);
  const [finIsEstimated, setFinIsEstimated] = useState(false);
  const [finPaymentStatus, setFinPaymentStatus] = useState("pending");
  const [finPaymentMethod, setFinPaymentMethod] = useState("cash");
  const [finTransactionRef, setFinTransactionRef] = useState("");
  const [finIsBillable, setFinIsBillable] = useState(true);

  const { data: jobs = [], isLoading: jobLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const job = jobs.find(j => j.id === jobId);

  const { data: allEstimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: allFiles = [] } = useQuery<FileData[]>({
    queryKey: ["/api/files"],
  });

  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  // Fetch field reports for this job
  const { data: fieldReports = [] } = useQuery<FieldReport[]>({
    queryKey: ["/api/field-reports", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/field-reports?jobId=${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch field reports");
      return response.json();
    },
    enabled: !!jobId,
  });

  // Fetch financial records for this job
  const { data: financialRecords = [] } = useQuery<FinancialRecord[]>({
    queryKey: ["/api/financial-records", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/financial-records?jobId=${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch financial records");
      return response.json();
    },
    enabled: !!jobId,
  });

  const contact = job ? contacts.find(c => c.id === job.clientId) : null;
  const jobEstimates = allEstimates.filter(est => est.jobId === jobId);
  const jobInvoices = allInvoices.filter(inv => inv.jobId === jobId);
  const jobNotes = allNotes.filter(note => note.entityType === 'job' && note.entityId === jobId);
  const jobFiles = allFiles.filter(file => file.entityType === 'job' && file.entityId === jobId);
  const jobAppointments = allAppointments.filter(apt => apt.contactId === job?.clientId);
  
  // Calculate profitability using financial records (actual income/expenses)
  const totalIncome = financialRecords
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalExpenses = financialRecords
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  
  // Fallback to invoice/estimate calculation if no financial records exist
  const fallbackBilled = jobInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const fallbackCost = jobEstimates.reduce((sum, est) => {
    const lineItems = est.lineItems as Array<{ unitCost?: number; quantity?: number }> || [];
    return sum + lineItems.reduce((itemSum, item) => {
      const unitCost = Number(item.unitCost || 0);
      const quantity = Number(item.quantity || 0);
      return itemSum + (unitCost * quantity);
    }, 0);
  }, 0);
  const displayIncome = financialRecords.length > 0 ? totalIncome : fallbackBilled;
  const displayCost = financialRecords.length > 0 ? totalExpenses : fallbackCost;
  const displayProfit = financialRecords.length > 0 ? netProfit : (fallbackBilled - fallbackCost);
  const displayMargin = financialRecords.length > 0 ? profitMargin : (fallbackBilled > 0 ? ((fallbackBilled - fallbackCost) / fallbackBilled) * 100 : 0);

  // Fetch job tasks
  const { data: tasks = [] } = useQuery<JobTask[]>({
    queryKey: [`/api/jobs/${jobId}/tasks`],
    enabled: !!jobId,
  });

  // Build timeline
  const timelineEvents = [
    ...auditLog
      .filter(log => log.entityId === jobId)
      .map(log => ({
        id: `audit-${log.id}`,
        user: log.userId || "System",
        userAvatar: avatar1,
        action: `${log.action.replace(/_/g, " ")}`,
        timestamp: formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }),
        rawTimestamp: new Date(log.timestamp).getTime(),
        details: log.entityType || undefined,
        type: "audit" as const,
      })),
    ...jobNotes.map(note => ({
      id: `note-${note.id}`,
      user: "User",
      userAvatar: avatar1,
      action: `Added note: ${note.title || "Untitled"}`,
      timestamp: formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }),
      rawTimestamp: new Date(note.createdAt).getTime(),
      details: note.content?.substring(0, 100),
      type: "note" as const,
    })),
  ].sort((a, b) => b.rawTimestamp - a.rawTimestamp);

  const updateJobStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!jobId) throw new Error("Job ID required");
      return apiRequest(`/api/jobs/${jobId}`, "PATCH", { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Status updated successfully" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "job",
          entityId: jobId,
          content,
          title: "Quick Note",
        }),
      });
      if (!response.ok) throw new Error("Failed to add note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewNote("");
      toast({ title: "Note added successfully" });
    },
  });

  // Job task mutations
  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!jobId) throw new Error("Job ID required");
      return apiRequest(`/api/jobs/${jobId}/tasks`, "POST", { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tasks`] });
      setNewTaskTitle("");
      toast({ title: "Task added successfully" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<JobTask> }) => {
      if (!jobId) throw new Error("Job ID required");
      return apiRequest(`/api/jobs/${jobId}/tasks/${taskId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tasks`] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!jobId) throw new Error("Job ID required");
      return apiRequest(`/api/jobs/${jobId}/tasks/${taskId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/tasks`] });
      toast({ title: "Task deleted successfully" });
    },
  });

  // Field report creation mutation
  const createFieldReportMutation = useMutation({
    mutationFn: async (data: { type: string; observations: string; actionsTaken: string; recommendations: string; photos: string[]; statusUpdate: string; severity: string; resolutionStatus: string; startedAt: string; completedAt: string }) => {
      if (!jobId || !job?.clientId) throw new Error("Job and contact required");
      
      // Calculate duration in minutes
      const started = new Date(data.startedAt);
      const completed = new Date(data.completedAt);
      const durationMinutes = Math.round((completed.getTime() - started.getTime()) / 60000);
      
      const response = await fetch("/api/field-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          contactId: job.clientId,
          type: data.type,
          observations: data.observations,
          actionsTaken: data.actionsTaken,
          recommendations: data.recommendations,
          photos: data.photos,
          statusUpdate: data.statusUpdate,
          severity: data.type === "issue" ? data.severity : undefined,
          resolutionStatus: data.type === "issue" ? data.resolutionStatus : undefined,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          durationMinutes: durationMinutes > 0 ? durationMinutes : 0,
        }),
      });
      if (!response.ok) throw new Error("Failed to create field report");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-reports", jobId] });
      setReportType("progress");
      setReportObservations("");
      setReportActionsTaken("");
      setReportRecommendations("");
      setReportPhotos("");
      setReportStatusUpdate("");
      setReportSeverity("low");
      setReportResolutionStatus("open");
      setReportStartedAt(new Date().toISOString().slice(0, 16));
      setReportCompletedAt(new Date().toISOString().slice(0, 16));
      toast({ title: "Field report created successfully" });
    },
  });

  // Financial record creation mutation
  const createFinancialRecordMutation = useMutation({
    mutationFn: async (data: { type: string; category: string; amount: string; description: string; date: string; isEstimated: boolean; paymentStatus: string; paymentMethod: string; transactionRef: string; isBillable: boolean }) => {
      if (!jobId || !job?.clientId) throw new Error("Job and contact required");
      const response = await fetch("/api/financial-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          contactId: job.clientId,
          type: data.type,
          category: data.category,
          amount: data.amount,
          description: data.description,
          date: data.date,
          isEstimated: data.isEstimated,
          paymentStatus: data.type === "income" ? data.paymentStatus : undefined,
          paymentMethod: data.type === "income" ? data.paymentMethod : undefined,
          transactionRef: data.transactionRef || undefined,
          isBillable: data.type === "expense" ? data.isBillable : undefined,
        }),
      });
      if (!response.ok) throw new Error("Failed to create financial record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-records", jobId] });
      setFinType("expense");
      setFinCategory("other");
      setFinAmount("");
      setFinDescription("");
      setFinDate(new Date().toISOString().split('T')[0]);
      setFinIsEstimated(false);
      setFinPaymentStatus("pending");
      setFinPaymentMethod("cash");
      setFinTransactionRef("");
      setFinIsBillable(true);
      toast({ title: "Financial record created successfully" });
    },
  });

  if (jobLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Button>
        <Card className="p-12">
          <p className="text-center text-muted-foreground">Job not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/jobs")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Job Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{job.title}</h1>
                <StatusBadge status={job.status} />
              </div>
              {job.scope && (
                <p className="text-sm text-muted-foreground mb-4">{job.scope}</p>
              )}
              <div className="flex flex-wrap items-center gap-6 text-sm">
                {contact && (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      {contact.avatar && <AvatarImage src={contact.avatar} />}
                      <AvatarFallback>{contact.name?.substring(0, 2).toUpperCase() || "??"}</AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => setLocation(`/contacts/${contact.id}`)}
                      className="hover:underline text-foreground font-medium"
                      data-testid="link-contact"
                    >
                      {contact.name || contact.phone || "Unknown Contact"}
                    </button>
                  </div>
                )}
                {job.estimatedValue && (
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <DollarSign className="w-4 h-4" />
                    ${job.estimatedValue}
                  </div>
                )}
                {job.scheduledStart && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(job.scheduledStart), "MMM d, yyyy")}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={job.status}
                onValueChange={updateJobStatusMutation.mutate}
                disabled={updateJobStatusMutation.isPending}
              >
                <SelectTrigger className="w-[140px]" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                data-testid="button-edit-job"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "field-reports"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("field-reports")}
        >
          <ClipboardCheck className="w-4 h-4" />
          Progress Updates ({fieldReports.length})
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "financials"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("financials")}
        >
          <DollarSign className="w-4 h-4" />
          Financial Tracking
        </button>
      </div>

      {/* Two-column grid layout */}
      {activeTab === "overview" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Left - 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Suggestions */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Schedule follow-up appointment</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Job completion approaching - recommend scheduling post-service check-in
                  </p>
                </div>
                <Button size="sm" variant="outline" data-testid="button-ai-schedule">
                  <Calendar className="w-3 h-3 mr-1" />
                  Schedule
                </Button>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Send invoice reminder</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Invoice due in 3 days - suggested action: automated reminder
                  </p>
                </div>
                <Button size="sm" variant="outline" data-testid="button-ai-invoice">
                  <Send className="w-3 h-3 mr-1" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task Checklist */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Task Checklist ({tasks.filter(t => t.completed).length}/{tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add new task input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskTitle.trim()) {
                      createTaskMutation.mutate(newTaskTitle.trim());
                    }
                  }}
                  data-testid="input-new-task"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => newTaskTitle.trim() && createTaskMutation.mutate(newTaskTitle.trim())}
                  disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                  data-testid="button-add-task"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {/* Task list */}
              <div className="space-y-2">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-2 border rounded-md hover-elevate"
                    data-testid={`task-${task.id}`}
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => updateTaskMutation.mutate({ taskId: task.id, data: { completed: !task.completed } })}
                      disabled={updateTaskMutation.isPending}
                      data-testid={`checkbox-task-${task.id}`}
                    />
                    <span className={`flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTaskMutation.mutate(task.id)}
                      disabled={deleteTaskMutation.isPending}
                      data-testid={`button-delete-task-${task.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Job Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Job Timeline
              </CardTitle>
              <CardDescription>Status changes, notes, and system events</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineEvents.length > 0 ? (
                <ActivityTimeline events={timelineEvents.slice(0, 10)} />
              ) : (
                <p className="text-center text-muted-foreground py-8">No activity yet</p>
              )}
            </CardContent>
          </Card>

          {/* Inline Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Notes ({jobNotes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a job note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  data-testid="input-job-note"
                  rows={3}
                />
                <Button 
                  onClick={() => newNote.trim() && addNoteMutation.mutate(newNote)} 
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  data-testid="button-add-job-note"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                {jobNotes.slice(0, 5).map(note => (
                  <div key={note.id} className="p-3 border rounded-md" data-testid={`job-note-${note.id}`}>
                    <p className="text-sm font-medium">{note.title || "Quick Note"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Profitability */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Profitability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{financialRecords.length > 0 ? 'Total Income' : 'Total Billed'}</p>
                <p className="text-2xl font-semibold">${displayIncome.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{financialRecords.length > 0 ? 'Total Expenses' : 'Estimated Cost'}</p>
                <p className="text-xl font-medium">${displayCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit</p>
                <p className={`text-xl font-medium ${displayProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${displayProfit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className="text-lg font-medium">{displayMargin.toFixed(1)}%</p>
              </div>
              {financialRecords.length === 0 && (
                <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Showing estimate-based calculation. Add financial records for actual tracking.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Assignment */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Assigned Team
              </CardTitle>
              <Button size="sm" variant="outline" data-testid="button-assign-tech">
                <Plus className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 border rounded-md">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-muted-foreground">Lead Technician</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-semibold">0.0 hrs</p>
              </div>
              <Button size="sm" variant="outline" className="w-full" data-testid="button-log-time">
                <Clock className="w-3 h-3 mr-1" />
                Log Time
              </Button>
            </CardContent>
          </Card>

          {/* Linked Estimates/Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Estimates ({jobEstimates.length})</p>
                {jobEstimates.slice(0, 2).map(est => (
                  <div key={est.id} className="text-sm p-2 border rounded-md mb-2">
                    <p className="font-medium">Estimate {est.id.substring(0, 8)}</p>
                    <p className="text-muted-foreground">${est.totalAmount}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Invoices ({jobInvoices.length})</p>
                {jobInvoices.slice(0, 2).map(inv => (
                  <div key={inv.id} className="text-sm p-2 border rounded-md mb-2">
                    <p className="font-medium">Invoice {inv.id.substring(0, 8)}</p>
                    <p className="text-muted-foreground">${inv.totalAmount}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Files ({jobFiles.length})
              </CardTitle>
              <Button size="sm" variant="outline" data-testid="button-upload-job-file">
                <Upload className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {jobFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No files uploaded</p>
              ) : (
                <div className="space-y-2">
                  {jobFiles.slice(0, 5).map(file => (
                    <div key={file.id} className="flex items-center justify-between text-sm p-2 border rounded-md">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Progress Updates Tab */}
      {activeTab === "field-reports" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Progress Updates List */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5" />
                Progress Updates ({fieldReports.length})
              </CardTitle>
              <CardDescription>Track project progress, blockers, and deliverables</CardDescription>
            </CardHeader>
            <CardContent>
              {fieldReports.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No field reports yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Create your first field report using the form</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fieldReports.map(report => (
                    <div key={report.id} className="border rounded-lg p-4 hover-elevate">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            report.type === 'issue' ? 'destructive' :
                            report.type === 'completion' ? 'default' :
                            report.type === 'inspection' ? 'secondary' : 'outline'
                          }>
                            {report.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      </div>
                      {report.observations && (
                        <p className="text-sm mb-3">{report.observations}</p>
                      )}
                      {report.statusUpdate && (
                        <div className="bg-muted/50 p-3 rounded-md mb-3">
                          <p className="text-xs font-medium mb-1">Status Update:</p>
                          <p className="text-sm">{report.statusUpdate}</p>
                        </div>
                      )}
                      {report.photos && report.photos.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium mb-2 flex items-center gap-1">
                            <Camera className="w-3 h-3" />
                            Photos ({report.photos.length})
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {report.photos.map((photo, idx) => (
                              <img
                                key={idx}
                                src={photo}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-md border"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Create Progress Update Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Progress Update
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Update Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly_update">Weekly Update</SelectItem>
                    <SelectItem value="milestone_review">Milestone Review</SelectItem>
                    <SelectItem value="blocker">Blocker/Risk</SelectItem>
                    <SelectItem value="launch">Launch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div>
                <label className="text-sm font-medium mb-2 block">What was completed *</label>
                <Textarea
                  placeholder="Describe what was completed in this update..."
                  value={reportObservations}
                  onChange={(e) => setReportObservations(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Next Steps */}
              <div>
                <label className="text-sm font-medium mb-2 block">What's next</label>
                <Textarea
                  placeholder="What are the next steps or planned work..."
                  value={reportRecommendations}
                  onChange={(e) => setReportRecommendations(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Blockers */}
              <div>
                <label className="text-sm font-medium mb-2 block">Any blockers or risks</label>
                <Textarea
                  placeholder="List any blockers, risks, or dependencies..."
                  value={reportStatusUpdate}
                  onChange={(e) => setReportStatusUpdate(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Links */}
              <div>
                <label className="text-sm font-medium mb-2 block">Links to work (Figma, staging, PR, etc.)</label>
                <Textarea
                  placeholder="https://figma.com/...\nhttps://staging.example.com\nhttps://github.com/.../pull/123"
                  value={reportPhotos}
                  onChange={(e) => setReportPhotos(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">One URL per line</p>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  if (!reportObservations.trim()) {
                    toast({ title: "Please add a summary", variant: "destructive" });
                    return;
                  }
                  const photos = reportPhotos
                    .split('\n')
                    .map(url => url.trim())
                    .filter(url => url.length > 0);
                  createFieldReportMutation.mutate({
                    type: reportType,
                    observations: reportObservations,
                    actionsTaken: reportRecommendations, // nextSteps stored here for now
                    recommendations: '',
                    photos,
                    statusUpdate: reportStatusUpdate, // blockers stored here
                    severity: 'low', // default, not used in UI
                    resolutionStatus: 'open', // default, not used in UI
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                  });
                }}
                disabled={createFieldReportMutation.isPending || !reportObservations.trim()}
              >
                {createFieldReportMutation.isPending ? 'Creating...' : 'Create Progress Update'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Financial Tracking Tab */}
      {activeTab === "financials" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Financial Records List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                    ${totalIncome.toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                    ${totalExpenses.toFixed(2)}
                  </p>
                </div>
                <div className={`bg-${netProfit >= 0 ? 'green' : 'red'}-50 dark:bg-${netProfit >= 0 ? 'green' : 'red'}-950/20 p-4 rounded-lg border border-${netProfit >= 0 ? 'green' : 'red'}-200 dark:border-${netProfit >= 0 ? 'green' : 'red'}-800`}>
                  <p className={`text-sm text-${netProfit >= 0 ? 'green' : 'red'}-600 dark:text-${netProfit >= 0 ? 'green' : 'red'}-400 font-medium`}>Net Profit</p>
                  <p className={`text-2xl font-bold text-${netProfit >= 0 ? 'green' : 'red'}-700 dark:text-${netProfit >= 0 ? 'green' : 'red'}-300 mt-1`}>
                    ${netProfit.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Records List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Financial Records ({financialRecords.length})
              </CardTitle>
              <CardDescription>Internal job economics tracking (separate from customer billing)</CardDescription>
            </CardHeader>
            <CardContent>
              {financialRecords.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No financial records yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Start tracking job income and expenses</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {financialRecords.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={record.type === 'income' ? 'default' : 'destructive'}>
                            {record.type}
                          </Badge>
                          {record.category && (
                            <span className="text-xs text-muted-foreground">{record.category}</span>
                          )}
                        </div>
                        {record.description && (
                          <p className="text-sm text-muted-foreground">{record.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(record.date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <p className={`text-lg font-semibold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {record.type === 'income' ? '+' : '-'}${Number(record.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Create Financial Record Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Financial Record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={finType} onValueChange={setFinType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={finCategory} onValueChange={setFinCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {finType === "expense" ? (
                      <>
                        <SelectItem value="ad_spend">Ad Spend</SelectItem>
                        <SelectItem value="software">Software/Tools</SelectItem>
                        <SelectItem value="freelancer">Freelancer/Contractor</SelectItem>
                        <SelectItem value="hosting">Hosting</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="project_payment">Project Payment</SelectItem>
                        <SelectItem value="retainer">Retainer</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={finAmount}
                    onChange={(e) => setFinAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Input
                    type="date"
                    value={finDate}
                    onChange={(e) => setFinDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Income-specific fields */}
              {finType === "income" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Payment Status</label>
                      <Select value={finPaymentStatus} onValueChange={setFinPaymentStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Payment Method</label>
                      <Select value={finPaymentMethod} onValueChange={setFinPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* Expense-specific fields */}
              {finType === "expense" && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="billable"
                      checked={finIsBillable}
                      onCheckedChange={(checked) => setFinIsBillable(checked as boolean)}
                    />
                    <label
                      htmlFor="billable"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Billable to client
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Transaction Reference</label>
                <Input
                  placeholder="Invoice #, receipt #, etc."
                  value={finTransactionRef}
                  onChange={(e) => setFinTransactionRef(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="What is this for..."
                  value={finDescription}
                  onChange={(e) => setFinDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  if (!finAmount || Number(finAmount) <= 0) {
                    toast({ title: "Please enter a valid amount", variant: "destructive" });
                    return;
                  }
                  createFinancialRecordMutation.mutate({
                    type: finType,
                    category: finCategory,
                    amount: finAmount,
                    description: finDescription,
                    date: finDate,
                    isEstimated: finIsEstimated,
                    paymentStatus: finPaymentStatus,
                    paymentMethod: finPaymentMethod,
                    transactionRef: finTransactionRef,
                    isBillable: finIsBillable,
                  });
                }}
                disabled={createFinancialRecordMutation.isPending || !finAmount}
              >
                {createFinancialRecordMutation.isPending ? 'Creating...' : 'Add Financial Record'}
              </Button>

              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded border">
                <p className="font-medium mb-1">Note:</p>
                <p>Financial records track internal job economics, separate from customer invoices and payments.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      <EditJobDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        job={job}
      />
    </div>
  );
}
