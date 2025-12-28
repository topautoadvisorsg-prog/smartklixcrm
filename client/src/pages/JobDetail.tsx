import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, DollarSign, Calendar, FileText, MessageSquare, Activity, 
  Edit, User, CheckCircle, Clock, Wrench, TrendingUp, Sparkles,
  Plus, Upload, Send, Users, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import EditJobDialog from "@/components/EditJobDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import avatar1 from "@assets/generated_images/Female_executive_avatar_c19fd1f4.png";
import type { Job, Contact, Estimate, Invoice, Note, FileRecord as FileData, AuditLogEntry, Appointment } from "@shared/schema";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const [, setLocation] = useLocation();
  const jobId = params?.id;
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

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

  const contact = job ? contacts.find(c => c.id === job.clientId) : null;
  const jobEstimates = allEstimates.filter(est => est.jobId === jobId);
  const jobInvoices = allInvoices.filter(inv => inv.jobId === jobId);
  const jobNotes = allNotes.filter(note => note.entityType === 'job' && note.entityId === jobId);
  const jobFiles = allFiles.filter(file => file.entityType === 'job' && file.entityId === jobId);
  const jobAppointments = allAppointments.filter(apt => apt.contactId === job?.clientId);
  
  // Calculate profitability
  const totalBilled = jobInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const estimatedCost = 0; // TODO: Calculate from parts/materials when available
  const profit = totalBilled - estimatedCost;
  const profitMargin = totalBilled > 0 ? (profit / totalBilled) * 100 : 0;

  // Mock task checklist - TODO: Store in database
  const [tasks, setTasks] = useState([
    { id: "1", text: "Site survey completed", completed: true },
    { id: "2", text: "Materials ordered", completed: true },
    { id: "3", text: "Installation scheduled", completed: false },
    { id: "4", text: "Final inspection", completed: false },
  ]);

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

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

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
              {job.description && (
                <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
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
                {job.value && (
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <DollarSign className="w-4 h-4" />
                    ${job.value}
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

      {/* Two-column grid layout */}
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
              <Button size="sm" variant="outline" data-testid="button-add-task">
                <Plus className="w-3 h-3 mr-1" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 border rounded-md hover-elevate"
                  data-testid={`task-${task.id}`}
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => toggleTask(task.id)}
                    data-testid={`checkbox-task-${task.id}`}
                  />
                  <span className={task.completed ? "line-through text-muted-foreground" : ""}>
                    {task.text}
                  </span>
                </div>
              ))}
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
                <p className="text-sm text-muted-foreground">Total Billed</p>
                <p className="text-2xl font-semibold">${totalBilled.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                <p className="text-xl font-medium">${estimatedCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit</p>
                <p className={`text-xl font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className="text-lg font-medium">{profitMargin.toFixed(1)}%</p>
              </div>
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

      <EditJobDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        job={job}
      />
    </div>
  );
}
