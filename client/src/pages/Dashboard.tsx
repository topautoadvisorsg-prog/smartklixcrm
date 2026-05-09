import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Rocket, Inbox, CheckCircle, DollarSign, RefreshCw, Lightbulb, Clock, 
  Check, X, ArrowRight 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contact, Job, AuditLogEntry } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const { data: contacts = [], refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: auditLog = [], refetch: refetchAudit } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchContacts(), refetchJobs(), refetchAudit()]);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsRefreshing(false);
  };

  const activeJobs = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled").length;
  const pendingReview = jobs.filter(j => j.status === "estimate_sent").length;
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const completionRate = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;

  const totalRevenue = jobs
    .filter(j => j.status === "completed" && j.value)
    .reduce((sum, j) => sum + parseFloat(j.value || "0"), 0);

  const recentActivity = auditLog.slice(0, 4).map(log => ({
    id: log.id,
    time: formatDistanceToNow(new Date(log.timestamp), { addSuffix: false }),
    status: log.action.includes("create") || log.action.includes("complete") ? "success" : "info",
    action: log.action.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()),
    details: log.entityType ? `${log.entityType}: ${log.entityId?.slice(0, 8) || "N/A"}` : "System event",
    ledgerId: `#L-${log.id.toString().slice(0, 4)}`,
  }));

  const kpis = [
    { 
      label: "Active Missions", 
      value: activeJobs.toString(), 
      subtext: `${jobs.filter(j => j.status === "in_progress").length} in progress, ${jobs.filter(j => j.status === "scheduled").length} scheduled`,
      icon: Rocket,
      route: "/jobs"
    },
    { 
      label: "Awaiting Review", 
      value: pendingReview.toString(), 
      subtext: "Proposals pending approval",
      icon: Inbox,
      route: "/review-queue"
    },
    { 
      label: "Completion Rate (24h)", 
      value: `${completionRate}%`, 
      subtext: jobs.length > 0 ? `${completedJobs} of ${jobs.length} jobs` : "No data",
      icon: CheckCircle,
      route: "/automation-ledger"
    },
    { 
      label: "Pipeline Value", 
      value: `$${totalRevenue.toLocaleString()}`, 
      subtext: "From completed jobs",
      icon: DollarSign,
      route: "/pipeline"
    },
  ];

  const nextMission = jobs.find(j => j.status === "scheduled");

  if (isBooting) {
    return (
      <div className="flex flex-col h-full p-6 space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">
            Dashboard / <span className="text-foreground">Operational Snapshot</span>
          </h1>
          <Badge variant="muted" className="text-[9px] font-black uppercase tracking-widest">
            Read-Only View
          </Badge>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors group"
          data-testid="button-refresh-dashboard"
        >
          <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="font-bold uppercase tracking-wide">System Healthy</span>
          <span className="text-muted-foreground/50 px-2">|</span>
          <span>Last updated: {lastUpdated}</span>
          <RefreshCw className={`w-3 h-3 ml-1 ${isRefreshing ? "animate-spin text-primary" : "group-hover:text-foreground"}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <Card 
              key={i}
              onClick={() => setLocation(kpi.route)}
              className="bg-glass-surface border-glass-border rounded-xl hover:bg-accent/10 transition-all cursor-pointer group shadow-sm"
              data-testid={`kpi-card-${i}`}
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-bold text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="text-3xl font-bold mb-1 tracking-tight">{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium">{kpi.subtext}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <Card className="lg:col-span-2 bg-glass-surface border-glass-border rounded-xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-sm font-bold">Activity Volume (24h Throughput)</CardTitle>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-sm" />
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Neo8 Events</span>
                <span className="text-[10px] text-foreground font-bold ml-4">Total: {auditLog.length}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-1 h-48">
                {(() => {
                  // Group audit log entries by hour for the last 24 hours
                  const now = new Date();
                  const hourlyCounts = new Array(24).fill(0);
                  
                  auditLog.forEach((entry) => {
                    const entryTime = new Date(entry.timestamp);
                    const hoursAgo = Math.floor((now.getTime() - entryTime.getTime()) / (1000 * 60 * 60));
                    if (hoursAgo >= 0 && hoursAgo < 24) {
                      hourlyCounts[23 - hoursAgo]++;
                    }
                  });
                  
                  const maxCount = Math.max(...hourlyCounts, 1);
                  
                  return hourlyCounts.map((count, i) => {
                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end group relative">
                        <div 
                          className="w-full bg-gradient-to-t from-primary/30 to-primary rounded-t-sm hover:from-primary/50 hover:to-primary transition-all"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {count} events
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                <span>12AM</span>
                <span>4AM</span>
                <span>8AM</span>
                <span>12PM</span>
                <span>4PM</span>
                <span>8PM</span>
                <span>Now</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            
            <Card className="flex-1 bg-purple-500/5 border-purple-500/20 rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-xs font-bold text-purple-100">Discovery Insights (AI-Derived)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0" />
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {pendingReview} proposals awaiting review in queue.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0" />
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {contacts.length} total contacts in system.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0" />
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {completionRate}% job completion rate this period.
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className="flex-1 bg-amber-500/5 border-amber-500/20 rounded-xl shadow-sm cursor-pointer hover:bg-amber-500/10 transition-colors group"
              onClick={() => nextMission && setLocation(`/jobs`)}
              data-testid="card-next-mission"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-xs font-bold text-amber-100">Next High-Priority Mission</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {nextMission ? (
                  <>
                    <div className="text-[11px] font-bold mb-1">
                      {nextMission.title || `Job #${nextMission.id.slice(0, 8)}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Status: {nextMission.status.replace(/_/g, " ")}
                    </div>
                    <div className="text-right mt-2">
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider underline group-hover:text-amber-400">
                        View Details
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-muted-foreground">No scheduled missions</div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        <Card className="bg-glass-surface border-glass-border rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-sm font-bold">Recent Activity Feed (Last 4 Ledger Entries)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="grid grid-cols-12 gap-4 items-center p-3 hover:bg-accent/5 rounded-lg transition-colors border border-transparent hover:border-border"
                    data-testid={`activity-row-${idx}`}
                  >
                    <div className="col-span-2 sm:col-span-1 text-[10px] font-mono text-muted-foreground">{item.time}</div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className={`flex items-center text-[10px] font-bold uppercase tracking-wider ${item.status === "success" ? "text-emerald-500" : "text-blue-500"}`}>
                        {item.status === "success" ? <Check className="w-3 h-3 mr-1" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                        {item.status}
                      </span>
                    </div>
                    <div className="col-span-4 sm:col-span-3 text-[11px] font-bold">{item.action}</div>
                    <div className="col-span-4 sm:col-span-5 text-[11px] text-muted-foreground font-mono truncate">{item.details}</div>
                    <div className="hidden sm:block sm:col-span-2 text-right">
                      <span className="text-[10px] font-mono text-muted-foreground mr-4">ID: {item.ledgerId}</span>
                      <button 
                        onClick={() => setLocation("/automation-ledger")}
                        className="text-[9px] font-bold text-muted-foreground hover:text-primary uppercase tracking-wide"
                      >
                        [View in Ledger]
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
            <div className="mt-4 text-center">
              <button 
                onClick={() => setLocation("/automation-ledger")}
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground underline uppercase tracking-widest"
                data-testid="button-view-ledger"
              >
                View Full Automation Ledger History
              </button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
