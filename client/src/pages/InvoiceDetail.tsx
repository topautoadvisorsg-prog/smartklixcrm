import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Calendar, DollarSign, User, CreditCard, Edit, RefreshCw, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import EditInvoiceDialog from "@/components/EditInvoiceDialog";
import type { Invoice, Contact, Job, Payment, AuditLogEntry } from "@shared/schema";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import avatar1 from "@assets/generated_images/Female_executive_avatar_c19fd1f4.png";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const [, setLocation] = useLocation();
  const invoiceId = params?.id;
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: invoices = [], isLoading: invoiceLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  const invoice = invoices.find(inv => inv.id === invoiceId);
  const contact = invoice ? contacts.find(c => c.id === invoice.contactId) : undefined;
  const job = invoice ? jobs.find(j => j.id === invoice.jobId) : undefined;
  const payments = allPayments.filter(p => p.invoiceId === invoiceId);

  const invoiceAudit = auditLog.filter(log => log.entityId === invoiceId);
  const auditEvents = invoiceAudit.map(log => ({
    id: log.id,
    user: log.userId || "System",
    userAvatar: avatar1,
    action: `${log.action.replace(/_/g, " ")} ${log.entityType ? `on ${log.entityType}` : ""}`,
    timestamp: formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }),
    details: undefined,
  }));

  if (invoiceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <FileText className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Invoice Not Found</h2>
        <p className="text-muted-foreground">The invoice you're looking for doesn't exist.</p>
        <Button onClick={() => setLocation("/contacts")} data-testid="button-back-contacts">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const lineItems = (invoice.lineItems as LineItem[] | null) || [];
  const subtotal = parseFloat(invoice.subtotal as string) || 0;
  const taxTotal = parseFloat(invoice.taxTotal as string) || 0;
  const totalAmount = parseFloat(invoice.totalAmount as string) || 0;
  
  const totalPaid = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount as string || "0"), 0);
  const amountDue = totalAmount - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/contacts")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Invoice #{invoice.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              Issued {invoice.issuedAt ? format(new Date(invoice.issuedAt), "MMM d, yyyy") : "Not issued"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditDialogOpen(true)}
            data-testid="button-edit-invoice"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client</CardTitle>
            <User className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contact?.name || "Unknown"}</div>
            <p className="text-xs text-muted-foreground">{contact?.email || "No email"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Subtotal: ${subtotal.toFixed(2)} + Tax: ${taxTotal.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount Due</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${amountDue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Paid: ${totalPaid.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Date</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoice.dueAt ? format(new Date(invoice.dueAt), "MMM d") : "Not set"}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoice.dueAt
                ? formatDistanceToNow(new Date(invoice.dueAt), { addSuffix: true })
                : "No due date"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items">Line Items</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="mt-1">{format(new Date(invoice.createdAt), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Client</p>
                  <p className="mt-1">{contact?.name || "Unknown"}</p>
                </div>
                {job && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Related Job</p>
                    <button
                      className="mt-1 text-primary hover:underline cursor-pointer"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                      data-testid="link-job"
                    >
                      {job.title}
                    </button>
                  </div>
                )}
                {invoice.issuedAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Issued Date</p>
                    <p className="mt-1">{format(new Date(invoice.issuedAt), "PPP")}</p>
                  </div>
                )}
                {invoice.dueAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                    <p className="mt-1">{format(new Date(invoice.dueAt), "PPP")}</p>
                  </div>
                )}
                {invoice.paidAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Paid Date</p>
                    <p className="mt-1">{format(new Date(invoice.paidAt), "PPP")}</p>
                  </div>
                )}
              </div>

              {invoice.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-semibold">${taxTotal.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-600 font-semibold">-${totalPaid.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Amount Due</span>
                <span className="font-bold text-primary">${amountDue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Accounting Sync
              </CardTitle>
              {invoice.syncEnabled ? (
                <Badge variant="secondary" className="text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Disabled
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.syncEnabled ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">External Invoice ID</p>
                      <p className="mt-1 font-mono text-sm">
                        {invoice.externalInvoiceId || <span className="text-muted-foreground">Not synced yet</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Synced</p>
                      <p className="mt-1 text-sm">
                        {invoice.lastSyncedAt 
                          ? format(new Date(invoice.lastSyncedAt), "PPpp")
                          : <span className="text-muted-foreground">Never</span>
                        }
                      </p>
                    </div>
                  </div>
                  
                  {invoice.syncError && (
                    <div className="p-3 bg-destructive/10 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Sync Error</p>
                          <p className="text-sm text-destructive/80">{invoice.syncError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button variant="outline" size="sm" disabled className="w-full" data-testid="button-sync-now">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Configure QuickBooks or Xero in Settings to enable live sync
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Link2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect your accounting software to automatically sync invoices
                  </p>
                  <Button variant="outline" size="sm" disabled data-testid="button-enable-sync">
                    Connect Accounting
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    QuickBooks and Xero integrations coming soon
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
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
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={index} data-testid={`row-item-${index}`}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">${item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No payments recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                        <TableCell>
                          {payment.paidAt
                            ? format(new Date(payment.paidAt), "MMM d, yyyy")
                            : format(new Date(payment.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="capitalize">{payment.method}</TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${parseFloat(payment.amount as string || "0").toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <ActivityTimeline events={auditEvents} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditInvoiceDialog
        invoice={invoice}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}
