import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ExternalLink,
  MapPin,
  Users,
  AlertTriangle,
  X,
  Calendar as CalendarIcon,
  Briefcase,
  User,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Job, Contact } from "@shared/schema";
import { format, addDays, subDays, isToday, parseISO, isWithinInterval, isBefore, isAfter, differenceInMinutes } from "date-fns";

type EventType = "installation" | "meeting" | "follow_up" | "maintenance" | "site_visit" | "general";
type EventStatus = "active" | "imminent" | "completed" | "future";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  displayTime: string;
  type: EventType;
  linkedEntity?: string;
  entityType?: "Contact" | "Job" | "Deal";
  entityId?: string;
  location?: string;
  attendees: string[];
  description?: string;
  externalUrl?: string;
}

function getEventStatus(start: string, end: string, now: Date): EventStatus {
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  
  if (isWithinInterval(now, { start: startDate, end: endDate })) return "active";
  if (isBefore(now, startDate) && differenceInMinutes(startDate, now) <= 60) return "imminent";
  if (isAfter(now, endDate)) return "completed";
  return "future";
}

function getStatusBadge(status: EventStatus) {
  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse"></span>
          Active
        </Badge>
      );
    case "imminent":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-500 text-[9px] font-black uppercase tracking-widest">
          Imminent
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="text-muted-foreground text-[9px] font-black uppercase tracking-widest opacity-60">
          Completed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">
          Upcoming
        </Badge>
      );
  }
}

function getTypeStyle(type: EventType) {
  switch (type) {
    case "installation": return "bg-indigo-600";
    case "meeting": return "bg-amber-500";
    case "follow_up": return "bg-emerald-500";
    case "maintenance": return "bg-blue-500";
    case "site_visit": return "bg-purple-600";
    default: return "bg-muted-foreground";
  }
}

function getTypeBadge(type: EventType) {
  const color = getTypeStyle(type);
  return (
    <Badge className={`${color} text-white text-[8px] font-black uppercase tracking-widest`}>
      {type.replace("_", " ")}
    </Badge>
  );
}

function getEntityIcon(entityType?: "Contact" | "Job" | "Deal") {
  switch (entityType) {
    case "Job": return <Briefcase className="w-3 h-3" />;
    case "Contact": return <User className="w-3 h-3" />;
    case "Deal": return <FileText className="w-3 h-3" />;
    default: return null;
  }
}

export default function Calendar() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const events: CalendarEvent[] = [];
    const dateStr = format(currentDate, "yyyy-MM-dd");
    
    jobs.forEach(job => {
      if (job.scheduledStart) {
        const startDate = new Date(job.scheduledStart);
        if (format(startDate, "yyyy-MM-dd") === dateStr) {
          const endDate = job.scheduledEnd 
            ? new Date(job.scheduledEnd)
            : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
          
          const contact = contacts.find(c => c.id === job.clientId);
          
          events.push({
            id: job.id,
            title: job.title,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            displayTime: `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`,
            type: job.jobType === "maintenance" ? "maintenance" : 
                  job.jobType === "installation" ? "installation" : 
                  job.jobType === "estimate" ? "site_visit" : "general",
            linkedEntity: contact?.name || job.title,
            entityType: "Job",
            entityId: job.id,
            location: job.scope?.substring(0, 50),
            attendees: Array.isArray(job.assignedTechs) 
              ? (job.assignedTechs as string[]).map(t => String(t))
              : [],
            description: job.description || undefined,
            externalUrl: `https://calendar.google.com`,
          });
        }
      }
    });

    return events.sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [jobs, contacts, currentDate]);

  const filteredEvents = useMemo(() => 
    calendarEvents.filter(e => showUnlinked || e.linkedEntity),
    [calendarEvents, showUnlinked]
  );

  const handleRefresh = async () => {
    if (isRateLimited) return;
    
    setIsRefreshing(true);
    setIsRateLimited(true);
    setError(null);

    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setLastSynced(new Date().toLocaleTimeString());
    } catch {
      setError("Failed to refresh calendar data. Please try again.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setIsRateLimited(false), 5000);
    }
  };

  const navigatePrevious = () => setCurrentDate(prev => subDays(prev, 1));
  const navigateNext = () => setCurrentDate(prev => addDays(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  const now = new Date();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="p-6 border-b border-glass-border bg-glass-surface sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter" data-testid="text-calendar-title">
              Scheduling Mirror
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 uppercase font-black tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              Authority Source: Google Calendar
            </p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center bg-glass-surface border border-glass-border p-1 rounded-xl">
              <Button
                variant={!showUnlinked ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowUnlinked(false)}
                className="text-[9px] font-black uppercase tracking-widest"
                data-testid="button-filter-linked"
              >
                Linked Only
              </Button>
              <Button
                variant={showUnlinked ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowUnlinked(true)}
                className="text-[9px] font-black uppercase tracking-widest"
                data-testid="button-filter-all"
              >
                Show All
              </Button>
            </div>

            <div className="h-6 w-px bg-border"></div>

            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-tight">
                Synced: {lastSynced}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRateLimited}
                    className={isRateLimited ? "opacity-50 cursor-not-allowed" : ""}
                    data-testid="button-refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRateLimited ? "Cooldown active (5s)" : "Refresh calendar"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-3 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-[10px] font-black uppercase tracking-widest text-destructive">
            {error}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setError(null)}
            className="ml-2 text-[9px]"
            data-testid="button-dismiss-error"
          >
            <X className="w-3 h-3 mr-1" />
            Dismiss
          </Button>
        </div>
      )}

      <div className="p-6 max-w-[1400px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black uppercase tracking-tighter" data-testid="text-current-date">
              {format(currentDate, "EEEE, MMM d")}
            </h2>
            {isToday(currentDate) && (
              <Badge variant="default" className="text-[9px] font-black uppercase">Today</Badge>
            )}
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={navigatePrevious}
                data-testid="button-prev-day"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={navigateNext}
                data-testid="button-next-day"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isToday(currentDate) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={goToToday}
                  className="ml-2 text-[10px] font-black uppercase"
                  data-testid="button-today"
                >
                  Today
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {(["day", "week", "month"] as const).map((v) => (
              <Tooltip key={v}>
                <TooltipTrigger asChild>
                  <Button
                    variant={view === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => v === "day" && setView(v)}
                    disabled={v !== "day"}
                    className={`text-[9px] font-black uppercase tracking-widest ${v !== "day" ? "opacity-50" : ""}`}
                    data-testid={`button-view-${v}`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Button>
                </TooltipTrigger>
                {v !== "day" && (
                  <TooltipContent>
                    <p className="text-xs">{v.charAt(0).toUpperCase() + v.slice(1)} view coming soon</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>

        <Card className="bg-glass-surface border-glass-border rounded-2xl flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            {filteredEvents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-60">
                <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-4">
                  <CalendarIcon className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">
                  No scheduled events
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-2">
                  Check filters or refresh to sync with Google Calendar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => {
                  const status = getEventStatus(event.start, event.end, now);
                  const isActive = status === "active";
                  const isUnlinked = !event.linkedEntity;

                  return (
                    <div
                      key={event.id}
                      onClick={() => event.externalUrl && window.open(event.externalUrl, "_blank")}
                      className={`
                        group p-6 rounded-xl border border-glass-border bg-glass-surface
                        hover-elevate cursor-pointer transition-all relative overflow-visible
                        ${isUnlinked ? "opacity-60" : ""}
                        ${isActive ? "ring-2 ring-emerald-500/50" : ""}
                      `}
                      data-testid={`event-card-${event.id}`}
                    >
                      <div className="flex gap-6">
                        <div className="w-40 shrink-0 space-y-1">
                          <div className={`w-1 h-12 rounded-full ${getTypeStyle(event.type)}`}></div>
                          <p className="text-lg font-black tracking-tight">
                            {event.displayTime.split(" - ")[0]}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono uppercase">
                            to {event.displayTime.split(" - ")[1]}
                          </p>
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="text-lg font-black truncate">{event.title}</h3>
                              {event.linkedEntity && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] font-mono">
                                    {getEntityIcon(event.entityType)}
                                    <span className="ml-1">{event.linkedEntity}</span>
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getTypeBadge(event.type)}
                              {getStatusBadge(status)}
                            </div>
                          </div>

                          {(event.location || event.attendees.length > 0) && (
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {event.location && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[200px]">{event.location}</span>
                                </span>
                              )}
                              {event.attendees.length > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
