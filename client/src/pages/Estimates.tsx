import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, MoreHorizontal, Eye, Send, CheckCircle, XCircle, FileText, Loader2, Calculator, User, Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/StatusBadge";
import CreateEstimateDialog from "@/components/CreateEstimateDialog";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Estimate, Contact, Job } from "@shared/schema";

export default function Estimates() {
  const [location, setLocation] = useLocation();
  const rawSearch = useSearch();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const { toast } = useToast();

  // Read filter state from URL params
  const urlParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);
  const searchQuery = urlParams.get('search') || '';
  const page = parseInt(urlParams.get('page') || '1', 10);

  // Helper to update URL params while preserving existing ones
  const updateFilters = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(rawSearch);
    Object.entries(updates).forEach(([key, val]) => {
      if (val && val !== '1') {
        newParams.set(key, val);
      } else {
        newParams.delete(key);
      }
    });
    const qs = newParams.toString();
    setLocation(location + (qs ? '?' + qs : ''), { replace: true });
  };
  
  const { data: estimatesResponse, isLoading } = useQuery<{
    data: Estimate[]; total: number; page: number; limit: number; totalPages: number;
  }>({
    queryKey: ["/api/estimates", page, searchQuery],
    queryFn: async ({ queryKey }) => {
      const [, p] = queryKey as [string, number];
      const res = await fetch(`/api/estimates?page=${p}&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const allEstimates = estimatesResponse?.data ?? [];
  const estimatesTotal = estimatesResponse?.total ?? 0;
  const estimatesTotalPages = estimatesResponse?.totalPages ?? 1;

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const getContactName = (contactId: string | null) => {
    if (!contactId) return "-";
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || "Unknown";
  };

  const getJobTitle = (jobId: string | null) => {
    if (!jobId) return "-";
    const job = jobs.find(j => j.id === jobId);
    return job?.title || "Unknown";
  };

  const estimates = allEstimates.filter((estimate) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contactName = getContactName(estimate.contactId).toLowerCase();
    const jobTitle = getJobTitle(estimate.jobId).toLowerCase();
    return (
      estimate.id.toLowerCase().includes(query) ||
      estimate.status.toLowerCase().includes(query) ||
      String(estimate.totalAmount || "").toLowerCase().includes(query) ||
      contactName.includes(query) ||
      jobTitle.includes(query)
    );
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/estimates/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update estimate status",
        variant: "destructive",
      });
    },
  });

  const sendEstimateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/estimates/${id}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({
        title: "Estimate Sent",
        description: "The estimate has been sent to the customer.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send estimate",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/estimates/${id}`);
      if (res.status === 204) return { success: true };
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({
        title: "Estimate Deleted",
        description: "The estimate has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setSelectedEstimate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete estimate",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (estimate: Estimate) => {
    setLocation(`/estimates/${estimate.id}`);
  };

  const handleSend = (estimate: Estimate) => {
    sendEstimateMutation.mutate(estimate.id);
  };

  const handleAccept = (estimate: Estimate) => {
    updateStatusMutation.mutate({ id: estimate.id, status: "accepted" });
    toast({
      title: "Estimate Accepted",
      description: "The estimate has been marked as accepted.",
    });
  };

  const handleReject = (estimate: Estimate) => {
    updateStatusMutation.mutate({ id: estimate.id, status: "rejected" });
    toast({
      title: "Estimate Rejected",
      description: "The estimate has been marked as rejected.",
    });
  };

  const handleDelete = (estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEstimate) {
      deleteMutation.mutate(selectedEstimate.id);
    }
  };

  const getOriginBadge = (estimate: Estimate) => {
    const isAIGenerated = (estimate as { aiGenerated?: boolean }).aiGenerated;
    if (isAIGenerated) {
      return (
        <Badge variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400">
          <Bot className="w-3 h-3" />
          AI
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
        <User className="w-3 h-3" />
        Human
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="page-estimates">
      <div className="bg-glass-surface border border-glass-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">ESTIMATES</h1>
              <p className="text-sm text-muted-foreground">Commercial Modeling Surface</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-xs">
              {estimatesTotal} Total
            </Badge>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-estimate">
              <Plus className="w-4 h-4 mr-2" />
              New Estimate
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-glass-surface border border-glass-border rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search estimates by ID, contact, job, or status..."
            className="pl-10 bg-background/50"
            value={searchQuery}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
            data-testid="input-search-estimates"
          />
        </div>
      </div>

      <Card className="bg-glass-surface border-glass-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && estimates && estimates.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">No estimates found</p>
                  <p className="text-sm">Create your first estimate to get started.</p>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && estimates && estimates.map((estimate) => (
              <TableRow 
                key={estimate.id} 
                data-testid={`estimate-row-${estimate.id}`}
                className="cursor-pointer hover-elevate"
                onClick={() => handleViewDetails(estimate)}
              >
                <TableCell className="font-mono text-sm">{estimate.id.substring(0, 8)}</TableCell>
                <TableCell>{getOriginBadge(estimate)}</TableCell>
                <TableCell>{getContactName(estimate.contactId)}</TableCell>
                <TableCell className="text-muted-foreground">{getJobTitle(estimate.jobId)}</TableCell>
                <TableCell className="font-semibold">${estimate.totalAmount}</TableCell>
                <TableCell>
                  <StatusBadge status={estimate.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {estimate.validUntil ? format(new Date(estimate.validUntil), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(estimate.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-${estimate.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(estimate)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSend(estimate)}
                        disabled={sendEstimateMutation.isPending}
                      >
                        {sendEstimateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send to Customer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleAccept(estimate)}
                        disabled={estimate.status === "accepted"}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Accepted
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleReject(estimate)}
                        disabled={estimate.status === "rejected"}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark Rejected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(estimate)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {estimatesTotal > 0 && (
        <div className="flex items-center justify-between gap-2 bg-glass-surface border border-glass-border rounded-xl p-4">
          <span className="text-xs text-muted-foreground">
            Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, estimatesTotal)} of {estimatesTotal}
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
              disabled={page >= estimatesTotalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateEstimateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this estimate? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
