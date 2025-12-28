import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Phone, 
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  FileText
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";

type VoiceEngine = "economic" | "premium";
type DispatchStatus = "pending" | "in_progress" | "success" | "failed";

interface VoiceDispatchLog {
  id: string;
  contactName: string;
  intent: string;
  engine: VoiceEngine;
  status: DispatchStatus;
  originType: "human" | "ai";
  summary: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  company: string | null;
}

export default function AIReceptionistConfig() {
  const { toast } = useToast();
  
  // Dispatch Tab State
  const [dispatchContact, setDispatchContact] = useState("");
  const [dispatchContactId, setDispatchContactId] = useState<string | null>(null);
  const [dispatchIntent, setDispatchIntent] = useState("schedule_maintenance");
  const [dispatchContext, setDispatchContext] = useState("");
  const [dispatchEngine, setDispatchEngine] = useState<VoiceEngine>("economic");
  const [dispatchAuthorized, setDispatchAuthorized] = useState(false);
  
  // Logs Tab State
  const [logSearchQuery, setLogSearchQuery] = useState("");

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: dispatchLogs = [], refetch: refetchLogs } = useQuery<VoiceDispatchLog[]>({
    queryKey: ["/api/voice/dispatch-logs"],
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload: {
      contactId: string | null;
      contactName: string;
      intent: string;
      contextNotes: string;
      engine: VoiceEngine;
    }) => {
      const res = await apiRequest("POST", "/api/voice/dispatch", payload);
      return res.json();
    },
    onSuccess: () => {
      refetchLogs();
      setDispatchAuthorized(false);
      setDispatchContact("");
      setDispatchContactId(null);
      setDispatchContext("");
      toast({ title: "Dispatch sent", description: "Voice call has been dispatched to AI Voice Server." });
    },
    onError: () => {
      toast({ title: "Dispatch failed", description: "Failed to dispatch voice call.", variant: "destructive" });
    },
  });

  const handleDispatch = () => {
    if (!dispatchAuthorized || !dispatchContact.trim() || dispatchMutation.isPending) return;
    dispatchMutation.mutate({
      contactId: dispatchContactId,
      contactName: dispatchContact,
      intent: dispatchIntent,
      contextNotes: dispatchContext,
      engine: dispatchEngine,
    });
  };

  const filteredLogs = dispatchLogs.filter((log) => {
    if (!logSearchQuery) return true;
    const search = logSearchQuery.toLowerCase();
    return (
      log.contactName.toLowerCase().includes(search) ||
      log.intent.toLowerCase().includes(search)
    );
  });

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

  const getStatusIcon = (status: DispatchStatus) => {
    switch (status) {
      case "in_progress": return <Clock className="w-4 h-4 text-[hsl(var(--status-pending))]" />;
      case "success": return <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-success))]" />;
      case "failed": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: DispatchStatus) => {
    switch (status) {
      case "in_progress": 
        return <Badge className="bg-[hsl(var(--status-pending)/0.2)] text-[hsl(var(--status-pending))] border border-[hsl(var(--status-pending)/0.5)]">IN PROGRESS</Badge>;
      case "success": 
        return <Badge className="bg-[hsl(var(--status-success)/0.2)] text-[hsl(var(--status-success))] border border-[hsl(var(--status-success)/0.5)]">SUCCESS</Badge>;
      case "failed": 
        return <Badge variant="destructive">FAILED</Badge>;
      default: 
        return <Badge variant="secondary">PENDING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <Phone className="w-6 h-6" />
            AI Voice
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispatch voice missions and monitor call outcomes
          </p>
        </div>
      </div>

      <Tabs defaultValue="dispatch" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dispatch" data-testid="tab-dispatch">
            <Send className="w-4 h-4 mr-2" />
            Dispatch
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Dispatch Tab - Voice Mission Control */}
        <TabsContent value="dispatch" className="space-y-0">
          <div className="flex flex-col min-h-[calc(100vh-220px)] bg-background text-foreground rounded-xl overflow-hidden">
            
            {/* Header */}
            <header className="p-6 border-b border-border bg-card/60 backdrop-blur-xl z-20 flex justify-between items-center shrink-0">
              <div>
                <h1 className="text-xl font-black text-foreground uppercase tracking-tighter">AI Voice Dispatch</h1>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Voice Mission Control & Observability</p>
              </div>
            </header>

            {/* Main Split Layout */}
            <div className="flex-1 overflow-hidden p-8">
              <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                
                {/* LEFT PANEL: HUMAN DISPATCH */}
                <div className="flex flex-col bg-card/40 border border-[hsl(var(--authority-human)/0.3)] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                  {/* Glow Effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-[hsl(var(--authority-human))]"></div>
                  
                  {/* Badge */}
                  <div className="mb-8">
                    <span className="px-3 py-1 bg-[hsl(var(--authority-human)/0.2)] border border-[hsl(var(--authority-human)/0.3)] rounded-lg text-[10px] font-black uppercase tracking-widest text-[hsl(var(--authority-human))] shadow-[0_0_10px_hsl(var(--authority-human)/0.2)]">
                      AUTHORITY: Human Operator
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-8 pr-2">
                    
                    {/* Mission Definition */}
                    <section className="space-y-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Mission Definition</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contact Selection</label>
                          <select 
                            value={dispatchContactId || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (!value) {
                                setDispatchContactId(null);
                                setDispatchContact("");
                                return;
                              }
                              setDispatchContactId(value);
                              const contact = contacts.find(c => c.id === value);
                              if (contact) {
                                setDispatchContact(contact.name || "Unknown");
                              }
                            }}
                            className="w-full bg-muted border border-input rounded-xl px-4 py-3 text-xs font-bold text-foreground focus:border-[hsl(var(--authority-human))] outline-none transition-all shadow-inner"
                            data-testid="select-dispatch-contact"
                          >
                            <option value="">Select a contact...</option>
                            {contacts.map((contact) => (
                              <option key={contact.id} value={contact.id}>
                                {contact.name || "Unknown"} {contact.company ? `(${contact.company})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Voice Intent</label>
                          <select 
                            value={dispatchIntent}
                            onChange={(e) => setDispatchIntent(e.target.value)}
                            className="w-full bg-muted border border-input rounded-xl px-4 py-3 text-xs font-bold text-foreground focus:border-[hsl(var(--authority-human))] outline-none transition-all shadow-inner"
                            data-testid="select-dispatch-intent"
                          >
                            <option value="schedule_maintenance">Schedule Maintenance Follow-up</option>
                            <option value="billing_inquiry">Billing Inquiry</option>
                            <option value="feature_announcement">Feature Announcement</option>
                            <option value="satisfaction_survey">Customer Satisfaction Survey</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Context & Script Notes</label>
                          <span className="text-[10px] font-mono text-muted-foreground">{dispatchContext.length}/500</span>
                        </div>
                        <textarea 
                          value={dispatchContext}
                          onChange={(e) => setDispatchContext(e.target.value.slice(0, 500))}
                          className="w-full bg-muted border border-input rounded-xl p-4 text-xs font-medium text-foreground focus:border-[hsl(var(--authority-human))] outline-none transition-all min-h-[100px] resize-none leading-relaxed shadow-inner placeholder:text-muted-foreground"
                          placeholder="Provide specific instructions for the AI agent..."
                          data-testid="textarea-dispatch-context"
                        />
                      </div>
                    </section>

                    {/* Engine Routing */}
                    <section className="space-y-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Engine Routing (Mandatory Selection)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          type="button"
                          onClick={() => setDispatchEngine("economic")}
                          className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${dispatchEngine === "economic" ? "bg-accent border-[hsl(var(--engine-economic)/0.5)]" : "bg-muted border-border hover:border-muted-foreground/30"}`}
                        >
                          <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-xs font-black uppercase tracking-widest ${dispatchEngine === "economic" ? "text-[hsl(var(--engine-economic))]" : "text-muted-foreground"}`}>Economic Engine</span>
                              {dispatchEngine === "economic" && <div className="w-2 h-2 bg-[hsl(var(--engine-economic))] rounded-full shadow-[0_0_8px_hsl(var(--engine-economic)/0.8)]"></div>}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">(Standard Latency, Cost-Effective)</span>
                          </div>
                        </button>

                        <button 
                          type="button"
                          onClick={() => setDispatchEngine("premium")}
                          className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${dispatchEngine === "premium" ? "bg-accent border-[hsl(var(--engine-premium))] shadow-[0_0_30px_hsl(var(--engine-premium)/0.1)]" : "bg-muted border-border hover:border-muted-foreground/30"}`}
                        >
                          <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-xs font-black uppercase tracking-widest ${dispatchEngine === "premium" ? "text-[hsl(var(--engine-premium))]" : "text-muted-foreground"}`}>Premium Engine</span>
                              {dispatchEngine === "premium" && <div className="w-2 h-2 bg-[hsl(var(--engine-premium))] rounded-full shadow-[0_0_8px_hsl(var(--engine-premium)/0.8)]"></div>}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">(Low Latency, Enhanced Realism)</span>
                          </div>
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic pl-1">Selection is required for payload. Affects call quality and cost.</p>
                    </section>

                    {/* Authorization */}
                    <section className="space-y-6 pt-6 border-t border-border/50">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Authorization & Dispatch</h3>
                      
                      <label className="flex items-start space-x-4 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 shrink-0 ${dispatchAuthorized ? "bg-[hsl(var(--authority-human))] border-[hsl(var(--authority-human))]" : "bg-muted border-input"}`}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={dispatchAuthorized} 
                            onChange={(e) => setDispatchAuthorized(e.target.checked)} 
                            data-testid="checkbox-dispatch-authorize"
                          />
                          {dispatchAuthorized && (
                            <svg className="w-3 h-3 text-[hsl(var(--authority-human-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed group-hover:text-foreground transition-colors">
                          I authorize the immediate execution of this AI voice call. This action is irreversible and transfers control to the AI Voice Server.
                        </p>
                      </label>

                      <button 
                        onClick={handleDispatch}
                        disabled={!dispatchAuthorized || !dispatchContact.trim() || dispatchMutation.isPending}
                        className={`w-full py-5 rounded-2xl text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center space-x-3 transition-all ${
                          dispatchAuthorized && dispatchContact.trim()
                          ? "bg-[hsl(var(--authority-human))] text-[hsl(var(--authority-human-foreground))] shadow-xl shadow-[hsl(var(--authority-human)/0.2)] hover:scale-[1.02] active:scale-[0.98]" 
                          : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                        }`}
                        data-testid="button-dispatch"
                      >
                        {dispatchMutation.isPending ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707" />
                            </svg>
                            <span>Transmitting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <span>DISPATCH OUTBOUND CALL</span>
                          </>
                        )}
                      </button>
                    </section>

                  </div>
                </div>

                {/* RIGHT PANEL: SYSTEM LEDGER */}
                <div className="flex flex-col bg-card/40 border border-[hsl(var(--authority-system)/0.3)] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                  {/* Glow Effect */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-[hsl(var(--authority-system))]"></div>
                  
                  {/* Badge */}
                  <div className="mb-8 flex justify-between items-center">
                    <span className="px-3 py-1 bg-[hsl(var(--authority-system)/0.2)] border border-[hsl(var(--authority-system)/0.3)] rounded-lg text-[10px] font-black uppercase tracking-widest text-[hsl(var(--authority-system))] shadow-[0_0_10px_hsl(var(--authority-system)/0.2)]">
                      AUTHORITY: System / AI Voice Server
                    </span>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Live Feed</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {dispatchLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <svg className="w-12 h-12 mb-3 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="text-sm text-muted-foreground">No dispatch logs yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Dispatched calls will appear here</p>
                      </div>
                    ) : (
                      dispatchLogs.map((log) => (
                        <div 
                          key={log.id} 
                          className={`p-5 rounded-2xl border flex flex-col space-y-4 transition-all hover:scale-[1.01] ${
                            log.status === "in_progress" 
                              ? "border-[hsl(var(--status-pending)/0.5)] bg-[hsl(var(--status-pending)/0.05)] shadow-[0_0_20px_hsl(var(--status-pending)/0.1)]" 
                              : log.status === "success" 
                                ? "border-[hsl(var(--status-success)/0.5)] bg-[hsl(var(--status-success)/0.05)] shadow-[0_0_20px_hsl(var(--status-success)/0.1)]" 
                                : "border-[hsl(var(--status-failed)/0.5)] bg-[hsl(var(--status-failed)/0.05)] shadow-[0_0_20px_hsl(var(--status-failed)/0.1)]"
                          }`}
                        >
                          
                          <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${
                                log.status === "in_progress" ? "text-[hsl(var(--status-pending))]" : log.status === "success" ? "text-[hsl(var(--status-success))]" : "text-[hsl(var(--status-failed))]"
                              }`}>
                                Status: {log.status === "in_progress" ? "In-Progress (AI Voice Server Executing)" : log.status === "success" ? "Success (Completed)" : "Failed (No Answer)"}
                              </span>
                              {log.status === "in_progress" && (
                                <div className="flex space-x-1">
                                  <span className="w-1 h-1 bg-[hsl(var(--status-pending))] rounded-full animate-bounce"></span>
                                  <span className="w-1 h-1 bg-[hsl(var(--status-pending))] rounded-full animate-bounce" style={{ animationDelay: "75ms" }}></span>
                                  <span className="w-1 h-1 bg-[hsl(var(--status-pending))] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {log.status === "in_progress" && (
                                <svg className="w-4 h-4 text-[hsl(var(--status-pending))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              {log.status === "success" && (
                                <svg className="w-4 h-4 text-[hsl(var(--status-success))]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                              {log.status === "failed" && (
                                <svg className="w-4 h-4 text-[hsl(var(--status-failed))]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Contact</span>
                              <span className="font-bold text-foreground">{log.contactName}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Engine</span>
                              <span className="font-bold text-foreground capitalize">{log.engine}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Intent</span>
                              <span className="font-bold text-foreground">{log.intent}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Time</span>
                              <span className="font-bold text-foreground">{getTimeAgo(log.createdAt)}</span>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground font-medium italic">{log.summary || "Awaiting server response..."}</p>
                            <button className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                              log.status === "success" 
                              ? "bg-accent border-border text-foreground hover:text-foreground hover:border-muted-foreground/50" 
                              : "bg-transparent border-transparent text-muted-foreground cursor-not-allowed"
                            }`}>
                              {log.status === "in_progress" ? "View Live Status" : log.status === "success" ? "View Transcript" : "View Details"}
                            </button>
                          </div>

                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </TabsContent>

        {/* Logs Tab - Read-Only Observability */}
        <TabsContent value="logs" className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Call Logs</h2>
                <p className="text-sm text-muted-foreground">Read-only view of all voice dispatch activity</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-log-search"
                />
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <FileText className="w-12 h-12 mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No logs found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {logSearchQuery ? "Try a different search term" : "Dispatch calls to see logs here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="p-4 rounded-lg border border-border bg-card/50 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <span className="font-semibold text-foreground">{log.contactName}</span>
                          {getStatusBadge(log.status)}
                        </div>
                        <span className="text-xs text-muted-foreground">{getTimeAgo(log.createdAt)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Intent:</span>
                          <span className="ml-2 text-foreground">{log.intent}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Engine:</span>
                          <span className="ml-2 text-foreground capitalize">{log.engine}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Origin:</span>
                          <span className="ml-2 text-foreground capitalize">{log.originType}</span>
                        </div>
                      </div>
                      {log.summary && (
                        <p className="mt-3 text-sm text-muted-foreground italic border-t border-border/50 pt-3">
                          {log.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
