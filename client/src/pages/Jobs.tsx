import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { 
  Plus, Search, MoreHorizontal, X, ExternalLink, Calendar, DollarSign, 
  User, Clock, ChevronDown, ArrowLeft, MapPin, ArrowRight, Upload,
  AlertTriangle, Signal, FileText, MessageSquare, Image, Receipt, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import CreateJobDialog from "@/components/CreateJobDialog";
import type { Job, Contact } from "@shared/schema";

type SortField = "title" | "value" | "scheduledStart" | "status";
type SortOrder = "asc" | "desc";
type DetailTab = "overview" | "messages" | "work_logs" | "finances";

function getFinanceColor(status: string) {
  switch (status) {
    case "paid": return "text-emerald-500";
    case "outstanding": return "text-amber-500";
    case "invoiced": return "text-blue-400";
    default: return "text-muted-foreground";
  }
}

function getActionText(status: string) {
  switch (status) {
    case "scheduled": return "Start Job";
    case "in_progress": return "Complete Job";
    case "completed": return "Create Invoice";
    default: return "Update Status";
  }
}

function JobDetailView({ 
  job, 
  clientName,
  onClose,
  onViewFull
}: { 
  job: Job; 
  clientName: string;
  onClose: () => void;
  onViewFull: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const financeStatus = (job as any).financeStatus ?? "unquoted";
  const jobValue = job.estimatedValue ? `$${Number(job.estimatedValue).toLocaleString()}` : "$0.00";

  const tabs: { id: DetailTab; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "work_logs", label: "Work Logs", icon: Image },
    { id: "finances", label: "Finances", icon: Receipt },
  ];

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      <header className="p-6 bg-glass-surface border-b border-border flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={onClose}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-black uppercase tracking-tight">{job.title}</h2>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <Badge variant="muted" className="font-mono text-[10px]">#{job.id.substring(0, 8)}</Badge>
              <span className="opacity-50">|</span>
              {clientName}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Scheduled</span>
            <span className="text-sm font-bold">
              {job.scheduledStart ? new Date(job.scheduledStart).toLocaleDateString() : "Not set"}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Financial State</span>
            <span className={`text-lg font-black tracking-tight ${getFinanceColor(financeStatus)}`}>
              {jobValue} ({financeStatus})
            </span>
          </div>
          <Button data-testid="button-primary-action" className="gap-2">
            {getActionText(job.status)}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[380px] bg-glass-surface border-r border-border overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              Operational Context
            </h4>
            <Card className="p-5 space-y-5">
              <div>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Job Description</span>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium leading-relaxed">
                    {job.scope || "No description provided"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Priority</span>
                <Badge 
                  variant={job.priority === "urgent" ? "destructive" : job.priority === "high" ? "default" : "outline"}
                  className="text-[10px] capitalize"
                >
                  {job.priority || "normal"}
                </Badge>
              </div>
              <div>
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Assigned Technicians</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-primary text-[10px]">
                    {Array.isArray(job.assignedTechs) && job.assignedTechs.length > 0 
                      ? String(job.assignedTechs.length)
                      : "0"}
                  </div>
                  <span className="text-sm font-medium">
                    {Array.isArray(job.assignedTechs) && job.assignedTechs.length > 0 
                      ? `${job.assignedTechs.length} assigned`
                      : "Unassigned"}
                  </span>
                </div>
              </div>
            </Card>
          </section>

          {job.status === "in_progress" && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-destructive tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse"></span>
                AI Operational Watch
              </h4>
              <Card className="p-5 bg-destructive/5 border-destructive/20 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-destructive uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Duration Alert
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono">+15m over</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium italic leading-relaxed">
                  Job duration exceeds historical benchmark. Review technician notes for potential blockers.
                </p>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pt-2 border-t border-border">
                  Informational Alert
                </div>
              </Card>
            </section>
          )}

          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              Field Sync Status
            </h4>
            <Card className="p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Connection</span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Active
                </span>
              </div>
              <Signal className="w-5 h-5 text-muted-foreground" />
            </Card>
          </section>
        </div>

        <div className="flex-1 flex flex-col">
          <nav className="flex px-6 border-b border-border bg-glass-surface">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
                )}
              </button>
            ))}
          </nav>

          <ScrollArea className="flex-1 p-8">
            {activeTab === "overview" && (
              <div className="space-y-8">
                <section>
                  <h3 className="text-lg font-black uppercase tracking-tight mb-4">Service Summary</h3>
                  <Card className="p-6 bg-muted/30">
                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                      {job.scope || "No service description provided. Add notes to describe the work scope."}
                    </p>
                  </Card>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Timeline</h4>
                  <Card className="p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm font-medium">
                        {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Scheduled Start</span>
                      <span className="text-sm font-medium">
                        {job.scheduledStart ? new Date(job.scheduledStart).toLocaleDateString() : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Updated</span>
                      <span className="text-sm font-medium">
                        {job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </Card>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start" onClick={onViewFull} data-testid="button-update-status">
                      Update Status
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={onViewFull} data-testid="button-edit-job">
                      Edit Job
                    </Button>
                    <Button variant="outline" className="justify-start col-span-2" onClick={onViewFull} data-testid="button-view-full-details">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Full Details
                    </Button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "messages" && (
              <div className="space-y-6">
                <div className="flex justify-center mb-6">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">
                    Read-Only Historical Log
                  </Badge>
                </div>
                <Card className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Communication history will appear here
                  </p>
                </Card>
              </div>
            )}

            {activeTab === "work_logs" && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Field Documentation
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="aspect-square border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Add Field Log</span>
                    </Card>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">
                    Signature Capture
                  </h4>
                  <Card className="p-8 bg-muted/30">
                    <div className="h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">Sign on completion</span>
                    </div>
                  </Card>
                </section>
              </div>
            )}

            {activeTab === "finances" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Linked Financial Artifacts
                  </h3>
                  <Badge variant="muted" className="text-[9px]">Navigation Only</Badge>
                </div>
                
                <Card className="p-8 text-center text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">No linked estimates or invoices</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Financial artifacts will appear here when created
                  </p>
                </Card>

                <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest italic pt-4">
                  All financial modifications occur in Estimates or Invoices modules.
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

export default function Jobs() {
  const [location, setLocation] = useLocation();
  const rawSearch = useSearch();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Read filter state from URL params
  const urlParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);
  const searchTerm = urlParams.get('search') || '';
  const statusFilter = urlParams.get('status') || 'all';
  const sortField = (urlParams.get('sort') as SortField) || 'scheduledStart';
  const sortOrder = (urlParams.get('order') as SortOrder) || 'desc';
  const page = parseInt(urlParams.get('page') || '1', 10);

  // Helper to update URL params while preserving existing ones
  const updateFilters = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(rawSearch);
    Object.entries(updates).forEach(([key, val]) => {
      if (val && val !== 'all' && val !== '1' && val !== 'scheduledStart' && val !== 'desc') {
        newParams.set(key, val);
      } else {
        newParams.delete(key);
      }
    });
    const qs = newParams.toString();
    setLocation(location + (qs ? '?' + qs : ''), { replace: true });
  };

  const { data: jobsResponse, isLoading } = useQuery<{
    data: (Job & { financeStatus?: string })[]; total: number; page: number; limit: number; totalPages: number;
  }>({
    queryKey: ["/api/jobs", page, searchTerm, statusFilter, sortField, sortOrder],
    queryFn: async ({ queryKey }) => {
      const [, p] = queryKey as [string, number];
      const res = await fetch(`/api/jobs?page=${p}&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const jobs = jobsResponse?.data ?? [];
  const jobsTotal = jobsResponse?.total ?? 0;
  const jobsTotalPages = jobsResponse?.totalPages ?? 1;

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const contactMap = contacts.reduce((acc, contact) => {
    acc[contact.id] = contact.name || contact.email || "Unknown";
    return acc;
  }, {} as Record<string, string>);

  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((job) => {
        const clientName = job.clientId ? contactMap[job.clientId] : "";
        return (
          job.title?.toLowerCase().includes(searchLower) ||
          job.scope?.toLowerCase().includes(searchLower) ||
          clientName?.toLowerCase().includes(searchLower) ||
          job.status?.toLowerCase().includes(searchLower)
        );
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = (a.title || "").localeCompare(b.title || "");
          break;
        case "value":
          comparison = (Number(a.estimatedValue) || 0) - (Number(b.estimatedValue) || 0);
          break;
        case "scheduledStart":
          const aDate = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
          const bDate = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [jobs, searchTerm, statusFilter, sortField, sortOrder, contactMap]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      updateFilters({ sort: field, order: sortOrder === "asc" ? "desc" : "asc", page: "1" });
    } else {
      updateFilters({ sort: field, order: "asc", page: "1" });
    }
  };

  const handleRowClick = (job: Job) => {
    setSelectedJob(job);
  };

  const statusCounts = useMemo(() => {
    return jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [jobs]);

  if (selectedJob) {
    return (
      <JobDetailView
        job={selectedJob}
        clientName={selectedJob.clientId ? contactMap[selectedJob.clientId] : "No Client"}
        onClose={() => setSelectedJob(null)}
        onViewFull={() => setLocation(`/jobs/${selectedJob.id}`)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 space-y-4 border-b border-border bg-glass-surface">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black uppercase tracking-tight">Operations Queue</h1>
              <Badge variant="muted" className="font-mono text-xs">{jobsTotal} Projects</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mt-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              Field Execution Engine
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-job">
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusCounts["in_progress"] > 0 && (
            <Badge 
              variant="outline" 
              className="bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse"
            >
              {statusCounts["in_progress"]} In Progress
            </Badge>
          )}
          {statusCounts["scheduled"] > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
              {statusCounts["scheduled"]} Scheduled
            </Badge>
          )}
          {statusCounts["completed"] > 0 && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              {statusCounts["completed"]} Completed
            </Badge>
          )}
        </div>

        <Card className="p-3 bg-glass-surface border-glass-border">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
                data-testid="input-search-jobs"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v, page: "1" })}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="lead_intake">New Lead</SelectItem>
                <SelectItem value="estimate_sent">Estimate Sent</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {(searchTerm || statusFilter !== "all") && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => updateFilters({ search: "", status: "all", page: "1" })}
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {(searchTerm || statusFilter !== "all") && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Showing {filteredAndSortedJobs.length} of {jobsTotal} projects
              </span>
            </div>
          )}
        </Card>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-1">
                      Title
                      {sortField === "title" && (
                        <ChevronDown className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleSort("value")}
                  >
                    <div className="flex items-center gap-1">
                      Value
                      {sortField === "value" && (
                        <ChevronDown className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Finance</TableHead>
                  <TableHead 
                    className="cursor-pointer hover-elevate"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === "status" && (
                        <ChevronDown className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : filteredAndSortedJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      {searchTerm || statusFilter !== "all" 
                        ? "No jobs found matching your filters" 
                        : "No jobs yet. Create your first job to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedJobs.map((job) => {
                    const clientName = job.clientId ? contactMap[job.clientId] : "No Client";
                    const jobIdShort = job.id.substring(0, 8);
                    const financeStatus = (job as any).financeStatus ?? "unquoted";
                    
                    return (
                      <TableRow
                        key={job.id}
                        data-testid={`job-row-${job.id}`}
                        className={`cursor-pointer hover-elevate ${job.status === "in_progress" ? "bg-amber-500/5" : ""}`}
                        onClick={() => handleRowClick(job)}
                      >
                        <TableCell>
                          <Badge variant="muted" className="font-mono text-[10px]">#{jobIdShort}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell className="text-muted-foreground">{clientName}</TableCell>
                        <TableCell className="font-semibold">
                          {job.estimatedValue ? `$${Number(job.estimatedValue).toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium capitalize ${getFinanceColor(financeStatus)}`}>
                            {financeStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-menu-${job.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/jobs/${job.id}`)}>
                                View Full Page
                              </DropdownMenuItem>
                              <DropdownMenuItem>Update Status</DropdownMenuItem>
                              <DropdownMenuItem>Edit Job</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">Cancel Job</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </ScrollArea>

      {jobsTotal > 0 && (
        <div className="p-4 border-t border-border flex items-center justify-between gap-2 bg-glass-surface">
          <span className="text-xs text-muted-foreground">
            Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, jobsTotal)} of {jobsTotal}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => updateFilters({ page: String(Math.max(1, page - 1)) })}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= jobsTotalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateJobDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
