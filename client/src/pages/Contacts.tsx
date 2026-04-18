import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Mail, Phone, MessageSquare, CreditCard, ArrowUpDown, Lock, User, Send, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "@/components/StatusBadge";
import CreateContactDialog from "@/components/CreateContactDialog";

type Contact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  avatar: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type Job = {
  id: string;
  contactId: string | null;
  title: string | null;
  status: string;
  createdAt: string;
  value: string | null;
};

type SortField = "name" | "createdAt" | "status";
type SortOrder = "asc" | "desc";

/**
 * PLACEHOLDER AI SIGNALS
 * These values are temporary until Discovery AI endpoints exist.
 * Owner: Discovery AI (pending backend integration)
 * DO NOT use Math.random() inline - centralize here for clarity.
 */
function getPlaceholderAISignals(contactId: string) {
  const hash = contactId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    warmthScore: (hash % 50) + 50,
    churnRisk: (hash % 30) + 5,
    sentimentTrend: [
      60 + (hash % 10),
      65 + (hash % 8),
      62 + (hash % 12),
      70 + (hash % 6),
      75 + (hash % 10),
      80 + (hash % 5),
      85 + (hash % 8)
    ],
    lastInteraction: {
      type: "Email Received",
      timeAgo: `${(hash % 48) + 1}h ago`
    }
  };
}

function CircularWarmth({ percentage }: { percentage: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  let colorClass = "text-red-500";
  if (percentage > 75) colorClass = "text-purple-500";
  else if (percentage > 40) colorClass = "text-amber-500";

  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted" />
        <circle 
          cx="20" cy="20" r={radius} 
          stroke="currentColor" strokeWidth="4" fill="transparent" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          className={colorClass} 
          strokeLinecap="round" 
        />
      </svg>
    </div>
  );
}

function SemiCircleGauge({ percentage }: { percentage: number }) {
  const rotation = -45 + (percentage / 100) * 180;
  
  return (
    <div className="relative w-40 h-20 overflow-hidden">
      <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-muted box-border" />
      <div 
        className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-transparent border-t-purple-500 border-r-purple-500 box-border"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </div>
  );
}

function SentimentSparkline({ data }: { data: number[] }) {
  const max = 100;
  const min = 0;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / (max - min)) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgb(99, 102, 241)" />
          <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0,100 L${points} L100,100 Z`} fill="url(#sparklineGradient)" opacity="0.2" />
      <polyline 
        points={points}
        fill="none" 
        stroke="rgb(99, 102, 241)" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Contacts() {
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredAndSortedContacts = useMemo(() => {
    if (!contacts) return [];

    let result = [...contacts];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(contact => {
        const nameMatch = contact.name?.toLowerCase().includes(query);
        const emailMatch = contact.email?.toLowerCase().includes(query);
        const phoneMatch = contact.phone?.toLowerCase().includes(query);
        const companyMatch = contact.company?.toLowerCase().includes(query);
        const tagMatch = contact.tags?.some(tag => tag.toLowerCase().includes(query));
        return nameMatch || emailMatch || phoneMatch || companyMatch || tagMatch;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter(contact => contact.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [contacts, searchQuery, statusFilter, sortField, sortOrder]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId || !contacts) return null;
    return contacts.find(c => c.id === selectedContactId) || null;
  }, [selectedContactId, contacts]);

  const contactJobs = useMemo(() => {
    if (!selectedContactId || !jobs) return [];
    return jobs.filter(j => j.contactId === selectedContactId).slice(0, 5);
  }, [selectedContactId, jobs]);

  const contactLifetimeRevenue = useMemo(() => {
    if (!contactJobs) return 0;
    return contactJobs
      .filter(j => j.status === "completed" && j.value)
      .reduce((sum, j) => sum + parseFloat(j.value || "0"), 0);
  }, [contactJobs]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const aiSignals = selectedContact ? getPlaceholderAISignals(selectedContact.id) : null;

  return (
    <div className="flex h-full overflow-hidden">
      
      {/* LEFT SIDEBAR - Contact List */}
      <aside className="w-[320px] flex flex-col border-r border-border bg-glass-surface shrink-0">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Contacts ({contacts?.length || 0})</h2>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm" data-testid="button-create-contact">
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-10 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-contacts"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 bg-background" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-sort">
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSort("name")}>
                  Name {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("createdAt")}>
                  Created {sortField === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort("status")}>
                  Status {sortField === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {!isLoading && filteredAndSortedContacts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {contacts && contacts.length > 0 
                  ? "No contacts match your filters."
                  : "No contacts found. Create one to get started."}
              </div>
            )}

            {!isLoading && filteredAndSortedContacts.map((contact) => {
              const signals = getPlaceholderAISignals(contact.id);
              return (
                <div 
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group ${
                    selectedContactId === contact.id 
                      ? "bg-primary/10 border border-primary/30" 
                      : "hover:bg-accent/50 border border-transparent"
                  }`}
                  data-testid={`contact-row-${contact.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      {contact.avatar && <AvatarImage src={contact.avatar} />}
                      <AvatarFallback>
                        {contact.name ? contact.name.substring(0, 2).toUpperCase() : contact.phone ? "PH" : "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${selectedContactId === contact.id ? "text-foreground" : "text-foreground/80"}`}>
                        {contact.name || contact.phone || "Unknown"}
                      </div>
                      {contact.company && (
                        <div className="text-[10px] text-muted-foreground truncate">{contact.company}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Last: {new Date(contact.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <CircularWarmth percentage={signals.warmthScore} />
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {signals.warmthScore < 40 ? "Low" : signals.warmthScore < 70 ? "Med" : "High"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* MAIN CONTENT - 3-Column Grid */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a contact</p>
              <p className="text-sm">Choose a contact from the list to view details</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="p-6 border-b border-border flex flex-wrap justify-between items-center gap-4 bg-glass-surface/50">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-border">
                  {selectedContact.avatar && <AvatarImage src={selectedContact.avatar} />}
                  <AvatarFallback className="text-lg">
                    {selectedContact.name ? selectedContact.name.substring(0, 2).toUpperCase() : "??"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{selectedContact.name || selectedContact.phone || "Unknown"}</h1>
                  <p className="text-sm text-muted-foreground">
                    {selectedContact.company && <span className="font-medium">{selectedContact.company}</span>}
                  </p>
                  <StatusBadge status={selectedContact.status} />
                </div>
              </div>
            </header>

            {/* 3-Column Content Grid */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* COLUMN 1: Static Identity [Editable] */}
                  <Card className="bg-glass-surface border-glass-border rounded-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Static Identity [Editable]
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Full Name</label>
                        <Input defaultValue={selectedContact.name || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Title / Role</label>
                        <Input placeholder="e.g. VP of Operations" className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Company</label>
                        <Input defaultValue={selectedContact.company || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Email</label>
                        <Input defaultValue={selectedContact.email || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Phone</label>
                        <Input defaultValue={selectedContact.phone || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Address</label>
                        <Input placeholder="Street address" className="bg-background" />
                      </div>
                      
                      <Button variant="outline" className="w-full mt-4" data-testid="button-save-contact">
                        Save Changes
                      </Button>
                    </CardContent>
                  </Card>

                  {/* COLUMN 2: Relationship Signals [AI-Derived | Read-Only] */}
                  <Card className="bg-purple-500/5 border-purple-500/20 rounded-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-purple-900/5 pointer-events-none" />
                    <CardHeader className="pb-3 relative z-10">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Lock className="w-3 h-3" />
                        Relationship Signals [AI-Derived | Read-Only]
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 relative z-10">
                      
                      {/* Warmth Score Gauge */}
                      {aiSignals && (
                        <div className="bg-glass-surface/50 border border-purple-500/10 rounded-xl p-4 flex flex-col items-center">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-muted-foreground">Warmth Score</span>
                            <Lock className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                          <SemiCircleGauge percentage={aiSignals.warmthScore} />
                          <div className="text-2xl font-bold -mt-8">{aiSignals.warmthScore}/100</div>
                          <div className="text-[10px] text-purple-400 font-bold uppercase mt-1">
                            ({aiSignals.warmthScore >= 70 ? "High" : aiSignals.warmthScore >= 40 ? "Medium" : "Low"})
                          </div>
                          <div className="text-[9px] text-muted-foreground/50 mt-2">Source: Discovery AI</div>
                        </div>
                      )}

                      {/* Churn Risk */}
                      {aiSignals && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-muted-foreground">Churn Risk</span>
                            <Lock className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${aiSignals.churnRisk < 30 ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${aiSignals.churnRisk}%` }}
                            />
                          </div>
                          <div className={`text-[10px] font-bold ${aiSignals.churnRisk < 30 ? "text-emerald-500" : "text-red-500"}`}>
                            {aiSignals.churnRisk}% ({aiSignals.churnRisk < 30 ? "Low Risk" : "High Risk"})
                          </div>
                        </div>
                      )}

                      {/* Last Interaction */}
                      {aiSignals && (
                        <div className="bg-glass-surface/50 border border-border rounded-xl p-3 flex items-start gap-3">
                          <MessageCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-[10px] font-bold">Last Interaction</div>
                            <div className="text-xs text-muted-foreground">
                              {aiSignals.lastInteraction.type} ({aiSignals.lastInteraction.timeAgo})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sentiment Trend */}
                      {aiSignals && (
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground mb-2">Sentiment Trend</div>
                          <div className="h-16 w-full bg-glass-surface/50 rounded-xl border border-border p-2">
                            <SentimentSparkline data={aiSignals.sentimentTrend} />
                          </div>
                          <div className="text-[10px] text-muted-foreground/50 mt-1">Trend: Positive</div>
                        </div>
                      )}

                      <p className="text-[9px] text-muted-foreground/50 pt-2 border-t border-purple-500/10">
                        Signals are advisory and owned by Discovery AI. No manual edits permitted.
                      </p>
                    </CardContent>
                  </Card>

                  {/* COLUMN 3: Ledger Aggregates [Read-Only] */}
                  <Card className="bg-glass-surface border-glass-border rounded-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Ledger Aggregates & History [Read-Only]
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      
                      {/* Lifetime Revenue */}
                      <div className="bg-background border border-border rounded-xl p-5 text-center">
                        <div className="text-3xl font-bold">${contactLifetimeRevenue.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2">
                          Lifetime Revenue (Settled)
                        </div>
                        <div className="text-[9px] text-muted-foreground/50 mt-1">Source: Ledger</div>
                      </div>

                      {/* Job History */}
                      <div>
                        <div className="text-xs font-bold mb-3">Recent Job History ({contactJobs.length})</div>
                        <div className="space-y-2">
                          {contactJobs.length > 0 ? (
                            contactJobs.map(job => (
                              <div 
                                key={job.id} 
                                className="p-3 bg-background border border-border rounded-xl flex justify-between items-center group hover:border-primary/30 transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">
                                    Job #{job.id.slice(0, 8)}: {job.title || "Untitled"}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Status: <span className="font-medium">{job.status}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/50">
                                    {new Date(job.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setLocation(`/jobs/${job.id}`)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-jump-job-${job.id}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                              No job history found in Ledger.
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-[9px] text-muted-foreground/50 pt-2 border-t border-border">
                        Data reflected from the Ledger and Jobs modules. Edits must be made at the source.
                      </p>
                    </CardContent>
                  </Card>

                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </main>

      {/* Dialogs */}
      <CreateContactDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
