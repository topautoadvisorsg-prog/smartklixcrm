import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Plus, Search, MoreHorizontal, Eye, Send, DollarSign, Download, CheckCircle, Link2, FileText, Loader2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
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
import CreateInvoiceDialog from "@/components/CreateInvoiceDialog";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Contact, Job } from "@shared/schema";

export default function Invoices() {
  const [location, setLocation] = useLocation();
  const rawSearch = useSearch();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
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
  
  const { data: invoicesResponse, isLoading } = useQuery<{
    data: Invoice[]; total: number; page: number; limit: number; totalPages: number;
  }>({
    queryKey: ["/api/invoices", page, searchQuery],
    queryFn: async ({ queryKey }) => {
      const [, p] = queryKey as [string, number];
      const res = await fetch(`/api/invoices?page=${p}&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });
  const allInvoices = invoicesResponse?.data ?? [];
  const invoicesTotal = invoicesResponse?.total ?? 0;
  const invoicesTotalPages = invoicesResponse?.totalPages ?? 1;

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

  const invoices = allInvoices.filter((invoice) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contactName = getContactName(invoice.contactId).toLowerCase();
    const jobTitle = getJobTitle(invoice.jobId).toLowerCase();
    return (
      invoice.id.toLowerCase().includes(query) ||
      invoice.status.toLowerCase().includes(query) ||
      String(invoice.totalAmount || "").toLowerCase().includes(query) ||
      contactName.includes(query) ||
      jobTitle.includes(query)
    );
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/send`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Sent",
        description: "The invoice has been sent to the customer.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/invoices/${id}`);
      if (res.status === 204) return { success: true };
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Deleted",
        description: "The invoice has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (invoice: Invoice) => {
    setLocation(`/invoices/${invoice.id}`);
  };

  const handleSend = (invoice: Invoice) => {
    sendInvoiceMutation.mutate(invoice.id);
  };

  const handleMarkPaid = (invoice: Invoice) => {
    updateStatusMutation.mutate({ id: invoice.id, status: "paid" });
    toast({
      title: "Invoice Marked Paid",
      description: "The invoice has been marked as paid.",
    });
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setLocation(`/payment/terminal/${invoice.id}`);
  };

  const handleDelete = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedInvoice) {
      deleteMutation.mutate(selectedInvoice.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage billing and payments</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-invoice">
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices by ID, contact, job, or status..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
            data-testid="input-search-invoices"
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="text-center">Sync</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && invoices && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">No invoices found</p>
                  <p className="text-sm">Create your first invoice to get started.</p>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && invoices && invoices.map((invoice) => (
              <TableRow 
                key={invoice.id} 
                data-testid={`invoice-row-${invoice.id}`}
                className="cursor-pointer hover-elevate"
                onClick={() => handleViewDetails(invoice)}
              >
                <TableCell className="font-mono text-sm">{invoice.id.substring(0, 8)}</TableCell>
                <TableCell>{getContactName(invoice.contactId)}</TableCell>
                <TableCell className="text-muted-foreground">{getJobTitle(invoice.jobId)}</TableCell>
                <TableCell className="font-semibold">${invoice.totalAmount}</TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {invoice.dueAt ? format(new Date(invoice.dueAt), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {invoice.issuedAt ? format(new Date(invoice.issuedAt), "MMM d, yyyy") : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {invoice.syncEnabled ? (
                    invoice.externalInvoiceId ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    ) : (
                      <Link2 className="w-4 h-4 text-amber-500 mx-auto" />
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-${invoice.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(invoice)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSend(invoice)}
                        disabled={sendInvoiceMutation.isPending}
                      >
                        {sendInvoiceMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send to Customer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleRecordPayment(invoice)}
                        disabled={invoice.status === "paid"}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Record Payment
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleMarkPaid(invoice)}
                        disabled={invoice.status === "paid"}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Paid
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(invoice)}
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

      {invoicesTotal > 0 && (
        <div className="flex items-center justify-between gap-2 p-4 border rounded-lg">
          <span className="text-xs text-muted-foreground">
            Showing {((page - 1) * 50) + 1}-{Math.min(page * 50, invoicesTotal)} of {invoicesTotal}
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
              disabled={page >= invoicesTotalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
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
