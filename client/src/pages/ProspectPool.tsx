/**
 * PROSPECT POOL
 *
 * Where external prospecting agents dump leads they find.
 * - Dedup source of truth: agent checks here before reaching out to anyone
 * - Status lifecycle: new → outreached → responded → converted / do_not_outreach
 * - "do_not_outreach": person said they're already a customer or opted out of automated outreach
 *   (they may still be contacted directly — just not via automated campaigns)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import {
  Users, Search, UserCheck, Ban, ArrowRight, Phone, Mail, Building,
  RefreshCw, Filter, Bot
} from "lucide-react";

type ProspectStatus = "new" | "outreached" | "responded" | "converted" | "do_not_outreach";

interface Prospect {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  company: string | null;
  source: string;
  agentId: string | null;
  status: ProspectStatus;
  notes: string | null;
  outreachedAt: string | null;
  respondedAt: string | null;
  convertedAt: string | null;
  convertedContactId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string }> = {
  new:             { label: "New",             color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  outreached:      { label: "Outreached",      color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  responded:       { label: "Responded",       color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  converted:       { label: "Converted",       color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  do_not_outreach: { label: "Do Not Outreach", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const STATUSES: Array<ProspectStatus | "all"> = ["all", "new", "outreached", "responded", "converted", "do_not_outreach"];

export default function ProspectPool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: Prospect[]; total: number }>({
    queryKey: ["/api/prospects", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/prospects?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load prospects");
      return res.json();
    },
  });

  const prospects = (data?.data ?? []).filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(s) ||
      p.phone?.includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.company?.toLowerCase().includes(s)
    );
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/prospects/${id}/convert`),
    onSuccess: () => {
      toast({ title: "Prospect converted to CRM contact" });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setSelectedProspect(null);
    },
    onError: (e: any) => toast({ title: "Conversion failed", description: String(e), variant: "destructive" }),
  });

  const dnoMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/prospects/${id}/do-not-outreach`, { reason }),
    onSuccess: () => {
      toast({ title: "Marked as Do Not Outreach" });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects"] });
      setSelectedProspect(null);
    },
    onError: (e: any) => toast({ title: "Update failed", description: String(e), variant: "destructive" }),
  });

  const counts: Record<string, number> = { all: data?.total ?? 0 };
  (data?.data ?? []).forEach(p => {
    counts[p.status] = (counts[p.status] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Prospect Pool</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Leads found by external agents. Agent dedup source of truth — checks here before reaching out to anyone.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const cfg = s === "all" ? null : STATUS_CONFIG[s];
          const count = counts[s] ?? 0;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
              }`}
            >
              {s === "all" ? "All" : cfg?.label}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, email, company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-black uppercase tracking-widest">Contact</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Phone / Email</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Source</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Found</TableHead>
              <TableHead className="text-xs font-black uppercase tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  Loading prospects...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && prospects.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? "No prospects match your search." : "No prospects yet. Agent will populate this when it finds leads."}
                </TableCell>
              </TableRow>
            )}
            {prospects.map(p => {
              const cfg = STATUS_CONFIG[p.status];
              return (
                <TableRow key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedProspect(p)}>
                  <TableCell>
                    <div className="font-medium text-sm">{p.name || <span className="text-muted-foreground italic">Unknown</span>}</div>
                    {p.company && <div className="text-xs text-muted-foreground flex items-center gap-1"><Building className="w-3 h-3" />{p.company}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {p.phone && <div className="text-xs flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{p.phone}</div>}
                      {p.email && <div className="text-xs flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" />{p.email}</div>}
                      {!p.phone && !p.email && <span className="text-xs text-muted-foreground italic">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{p.source}</div>
                    {p.agentId && <div className="text-[10px] text-muted-foreground/60">{p.agentId}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {p.status !== "converted" && p.status !== "do_not_outreach" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => convertMutation.mutate(p.id)}
                            disabled={convertMutation.isPending}
                          >
                            <UserCheck className="w-3 h-3" />
                            Convert
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => dnoMutation.mutate({ id: p.id, reason: "Marked via CRM" })}
                            disabled={dnoMutation.isPending}
                          >
                            <Ban className="w-3 h-3" />
                            DNO
                          </Button>
                        </>
                      )}
                      {p.status === "converted" && p.convertedContactId && (
                        <a
                          href={`/contacts/${p.convertedContactId}`}
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          View Contact <ArrowRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Total */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          Showing {prospects.length} of {data?.total ?? 0} total prospects
        </p>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedProspect} onOpenChange={open => !open && setSelectedProspect(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-wide">
              {selectedProspect?.name || "Prospect Detail"}
            </DialogTitle>
          </DialogHeader>
          {selectedProspect && (
            <div className="space-y-4">
              {/* Status badge */}
              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_CONFIG[selectedProspect.status].color}`}>
                {STATUS_CONFIG[selectedProspect.status].label}
              </Badge>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedProspect.phone && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Phone</p><p>{selectedProspect.phone}</p></div>
                )}
                {selectedProspect.email && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Email</p><p>{selectedProspect.email}</p></div>
                )}
                {selectedProspect.company && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Company</p><p>{selectedProspect.company}</p></div>
                )}
                <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Source</p><p>{selectedProspect.source}</p></div>
                {selectedProspect.agentId && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Agent</p><p className="text-xs font-mono">{selectedProspect.agentId}</p></div>
                )}
                {selectedProspect.outreachedAt && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Outreached</p><p className="text-xs">{formatDistanceToNow(new Date(selectedProspect.outreachedAt), { addSuffix: true })}</p></div>
                )}
              </div>

              {/* Notes */}
              {selectedProspect.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted/30 rounded p-2 border border-border">{selectedProspect.notes}</p>
                </div>
              )}

              {/* Metadata */}
              {selectedProspect.metadata && Object.keys(selectedProspect.metadata).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Agent Data</p>
                  <pre className="text-xs bg-muted/30 rounded p-2 border border-border overflow-auto max-h-32">
                    {JSON.stringify(selectedProspect.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              {selectedProspect.status !== "converted" && selectedProspect.status !== "do_not_outreach" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => convertMutation.mutate(selectedProspect.id)}
                    disabled={convertMutation.isPending}
                  >
                    <UserCheck className="w-4 h-4" />
                    Convert to Contact
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => dnoMutation.mutate({ id: selectedProspect.id, reason: "Opted out / already a customer" })}
                    disabled={dnoMutation.isPending}
                  >
                    <Ban className="w-4 h-4" />
                    Do Not Outreach
                  </Button>
                </div>
              )}

              {selectedProspect.status === "converted" && selectedProspect.convertedContactId && (
                <a
                  href={`/contacts/${selectedProspect.convertedContactId}`}
                  className="flex items-center gap-2 text-sm text-primary hover:underline pt-2 border-t border-border"
                >
                  <ArrowRight className="w-4 h-4" />
                  View CRM Contact
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
