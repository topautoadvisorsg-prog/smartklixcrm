import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, Mail, Phone, MessageSquare, CreditCard, ArrowUpDown, Lock, User, Send, ExternalLink, MessageCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

export default function Contacts() {
  const [location, setLocation] = useLocation();
  const rawSearch = useSearch();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  // Read filter state from URL params
  const urlParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);
  const searchQuery = urlParams.get('search') || '';
  const statusFilter = urlParams.get('status') || 'all';
  const sortField = (urlParams.get('sort') as SortField) || 'createdAt';
  const sortOrder = (urlParams.get('order') as SortOrder) || 'desc';
  const page = parseInt(urlParams.get('page') || '1', 10);

  // Helper to update URL params while preserving existing ones
  const updateFilters = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(rawSearch);
    Object.entries(updates).forEach(([key, val]) => {
      if (val && val !== 'all' && val !== '1' && val !== 'createdAt' && val !== 'desc') {
        newParams.set(key, val);
      } else {
        newParams.delete(key);
      }
    });
    const qs = newParams.toString();
    setLocation(location + (qs ? '?' + qs : ''), { replace: true });
  };

  // Refs for editable form fields
  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  const { data: contactsResponse, isLoading } = useQuery<{
    data: Contact[]; total: number; page: number; limit: number; totalPages: number;
  }>({
    queryKey: ["/api/contacts", page, searchQuery, statusFilter, sortField, sortOrder],
    queryFn: async ({ queryKey }) => {
      const [, p] = queryKey as [string, number];
      const res = await fetch(`/api/contacts?page=${p}&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const contacts = contactsResponse?.data ?? [];
  const contactsTotal = contactsResponse?.total ?? 0;
  const contactsTotalPages = contactsResponse?.totalPages ?? 1;

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  // Mutation for updating contact
  const updateContactMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; company: string; email: string; phone: string; title?: string; address?: string }) => {
      return apiRequest("PATCH", `/api/contacts/${data.id}`, {
        name: data.name,
        company: data.company,
        email: data.email,
        phone: data.phone,
        title: data.title,
        address: data.address,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact Updated",
        description: "Contact information has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not update contact.",
        variant: "destructive",
      });
    },
  });

  const handleSaveContact = () => {
    if (!selectedContact) return;
    
    updateContactMutation.mutate({
      id: selectedContact.id,
      name: nameRef.current?.value || selectedContact.name || "",
      company: companyRef.current?.value || selectedContact.company || "",
      email: emailRef.current?.value || selectedContact.email || "",
      phone: phoneRef.current?.value || selectedContact.phone || "",
      title: titleRef.current?.value || "",
      address: addressRef.current?.value || "",
    });
  };

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
      updateFilters({ sort: field, order: sortOrder === "asc" ? "desc" : "asc", page: "1" });
    } else {
      updateFilters({ sort: field, order: "asc", page: "1" });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      
      {/* LEFT SIDEBAR - Contact List */}
      <aside className="w-[320px] flex flex-col border-r border-border bg-glass-surface shrink-0">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Contacts ({contactsTotal})</h2>
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
              onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
              data-testid="input-search-contacts"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v, page: "1" })}>
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
                {contactsTotal > 0 
                  ? "No contacts match your filters."
                  : "No contacts found. Create one to get started."}
              </div>
            )}

            {!isLoading && filteredAndSortedContacts.map((contact) => (
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
              </div>
            ))}
          </div>
        </ScrollArea>
        {contactsTotal > 0 && (
          <div className="p-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {((page - 1) * 50) + 1}-{Math.min(page * 50, contactsTotal)} of {contactsTotal}
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
                disabled={page >= contactsTotalPages}
                onClick={() => updateFilters({ page: String(page + 1) })}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
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
                        <Input ref={nameRef} defaultValue={selectedContact.name || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Title / Role</label>
                        <Input ref={titleRef} placeholder="e.g. VP of Operations" className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Company</label>
                        <Input ref={companyRef} defaultValue={selectedContact.company || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Email</label>
                        <Input ref={emailRef} defaultValue={selectedContact.email || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Phone</label>
                        <Input ref={phoneRef} defaultValue={selectedContact.phone || ""} className="bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Address</label>
                        <Input ref={addressRef} placeholder="Street address" className="bg-background" />
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full mt-4" 
                        data-testid="button-save-contact"
                        onClick={handleSaveContact}
                        disabled={updateContactMutation.isPending}
                      >
                        {updateContactMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <Lock className="h-5 w-5 mb-2 opacity-50" />
                        <p className="text-xs">AI signals not yet available</p>
                      </div>

                      <p className="text-[9px] text-muted-foreground/50 pt-2 border-t border-purple-500/10">
                        Signals are advisory and owned by Query Agent. No manual edits permitted.
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
