import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, Calendar, DollarSign, User, Edit, Eye, Send, CheckCircle, XCircle, FileDown, Loader2, Lock, Bot, Clock, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "@/components/StatusBadge";
import EditEstimateDialog from "@/components/EditEstimateDialog";
import EstimatePreviewDialog from "@/components/EstimatePreviewDialog";
import type { Estimate, Contact, Job, AuditLogEntry } from "@shared/schema";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tier?: "good" | "better" | "best";
  pricebookItemId?: number;
  taxable?: boolean;
}

export default function EstimateDetail() {
  const [, params] = useRoute("/estimates/:id");
  const [, setLocation] = useLocation();
  const estimateId = params?.id;
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const { data: estimates = [], isLoading: estimateLoading } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  const estimate = estimates.find(e => e.id === estimateId);
  const contact = estimate ? contacts.find(c => c.id === estimate.contactId) : undefined;
  const job = estimate?.jobId ? jobs.find(j => j.id === estimate.jobId) : undefined;
  
  const estimateAudit = auditLog.filter(log => log.entityId === estimateId);

  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/estimates/${estimateId}/send`, {});
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

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/estimates/${estimateId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update estimate",
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    updateStatusMutation.mutate("accepted");
    toast({
      title: "Estimate Accepted",
      description: "The estimate has been marked as accepted.",
    });
  };

  const handleReject = () => {
    updateStatusMutation.mutate("rejected");
    toast({
      title: "Estimate Rejected",
      description: "The estimate has been marked as rejected.",
    });
  };

  const convertToInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/estimates/${estimateId}/convert-to-invoice`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Invoice Created", description: "Estimate converted to invoice successfully." });
      // Navigate to the new invoice
      setLocation(`/invoices/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Conversion Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleConvertToInvoice = () => {
    convertToInvoiceMutation.mutate();
  };

  const handleConvertToJob = () => {
    toast({
      title: "Convert to Job",
      description: "Job creation from estimate coming soon.",
    });
  };

  if (estimateLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <FileText className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Estimate Not Found</h2>
        <p className="text-muted-foreground">The estimate you're looking for doesn't exist.</p>
        <Button onClick={() => setLocation("/estimates")} data-testid="button-back-estimates">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Estimates
        </Button>
      </div>
    );
  }

  const lineItems = (estimate.lineItems as LineItem[] | null) || [];
  const subtotal = parseFloat(estimate.subtotal as string) || 0;
  const taxTotal = parseFloat(estimate.taxTotal as string) || 0;
  const totalAmount = parseFloat(estimate.totalAmount as string) || 0;

  const isAIGenerated = (estimate as { aiGenerated?: boolean }).aiGenerated;
  const isLocked = estimate.status === "accepted" || estimate.status === "sent";
  const needsReview = isAIGenerated && estimate.status === "draft";

  return (
    <div className="space-y-6" data-testid="page-estimate-detail">
      <div className="bg-glass-surface border border-glass-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/estimates")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-estimate-id">
                  Estimate #{estimate.id.slice(0, 8)}
                </h1>
                <StatusBadge status={estimate.status} />
                {isLocked && (
                  <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <Lock className="w-3 h-3" />
                    Locked
                  </Badge>
                )}
                {isAIGenerated ? (
                  <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <Bot className="w-3 h-3" />
                    AI Generated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <User className="w-3 h-3" />
                    Human Created
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created {format(new Date(estimate.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPreviewDialogOpen(true)}
              data-testid="button-preview-estimate"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            {!isLocked && !needsReview && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditDialogOpen(true)}
                data-testid="button-edit-estimate"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            {needsReview ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditDialogOpen(true)}
                  data-testid="button-edit-estimate"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Draft
                </Button>
                <Button 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => toast({ title: "Submitted for Review", description: "Estimate added to Review Queue." })}
                  data-testid="button-submit-review"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Submit for Review
                </Button>
              </>
            ) : (
              <>
                {!isLocked && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending}
                      data-testid="button-send-estimate"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send
                    </Button>
                    {estimate.status !== "accepted" && (
                      <Button 
                        size="sm" 
                        onClick={handleAccept}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-accept-estimate"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Accept
                      </Button>
                    )}
                    {estimate.status !== "rejected" && (
                      <Button 
                        variant="outline"
                        size="sm" 
                        onClick={handleReject}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-reject-estimate"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    )}
                  </>
                )}
                {estimate.status === "accepted" && (
                  <>
                    <Button 
                      size="sm" 
                      onClick={handleConvertToInvoice}
                      data-testid="button-convert-invoice"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Convert to Invoice
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm" 
                      onClick={handleConvertToJob}
                      data-testid="button-convert-job"
                    >
                      Convert to Job
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="bg-glass-surface border-glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-semibold text-lg">{contact?.name || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">{contact?.email || "No email"}</p>
                {contact?.phone && (
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                )}
              </div>
              {job && (
                <div className="pt-3 border-t border-glass-border">
                  <p className="text-xs text-muted-foreground mb-1">Related Job</p>
                  <button
                    className="text-sm text-primary hover:underline cursor-pointer"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    data-testid="link-job"
                  >
                    {job.title}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-glass-surface border-glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Validity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {estimate.validUntil ? format(new Date(estimate.validUntil), "MMM d, yyyy") : "No expiry"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {estimate.validUntil
                  ? formatDistanceToNow(new Date(estimate.validUntil), { addSuffix: true })
                  : "Valid indefinitely"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-glass-surface border-glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                {estimateAudit.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
                ) : (
                  <div className="space-y-3">
                    {estimateAudit.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-glass-surface border-glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Line Items (WBS)</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No line items added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={index} data-testid={`row-item-${index}`}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          {item.tier ? (
                            <Badge
                              variant={item.tier === "best" ? "default" : "secondary"}
                              className="capitalize text-xs"
                            >
                              {item.tier}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-glass-surface border-glass-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Pricing Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">${taxTotal.toFixed(2)}</span>
              </div>
              <div className="h-px bg-glass-border" />
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Grand Total</span>
                <span className="font-mono font-bold text-primary">${totalAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {estimate.notes && (
            <Card className="bg-glass-surface border-glass-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{estimate.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <EditEstimateDialog
        estimate={estimate}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <EstimatePreviewDialog
        estimate={estimate}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />
    </div>
  );
}
