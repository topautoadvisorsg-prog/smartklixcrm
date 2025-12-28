import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { z } from "zod";
import { 
  Search, DollarSign, CreditCard, Banknote, Wallet, ArrowLeft, User, CheckCircle, 
  Building2, FileText, Briefcase, ExternalLink, Bot, UserCheck, Clock, Plus, 
  Send, Receipt, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Payment, Contact, Invoice, PaymentSlip } from "@shared/schema";

const paymentSlipFormSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().default("usd"),
  contactId: z.string().min(1, "Customer is required"),
  description: z.string().optional(),
  memo: z.string().optional(),
  invoiceId: z.string().optional(),
  jobId: z.string().optional(),
  paymentMethod: z.string().default("card"),
});

type PaymentSlipFormData = z.infer<typeof paymentSlipFormSchema>;

export default function Payments() {
  const [, setLocation] = useLocation();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedSlipId, setSelectedSlipId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSlipDialogOpen, setIsSlipDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: paymentSlips = [], isLoading: slipsLoading } = useQuery<PaymentSlip[]>({
    queryKey: ["/api/payment-slips"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const form = useForm<PaymentSlipFormData>({
    resolver: zodResolver(paymentSlipFormSchema),
    defaultValues: {
      amount: "",
      currency: "usd",
      contactId: "",
      description: "",
      memo: "",
      invoiceId: "",
      jobId: "",
      paymentMethod: "card",
    },
  });

  const createSlipMutation = useMutation({
    mutationFn: async (data: PaymentSlipFormData) => {
      const contact = contacts.find(c => c.id === data.contactId);
      return apiRequest("POST", "/api/payment-slips", {
        origin: "human",
        status: "draft",
        amount: data.amount,
        currency: data.currency,
        contactId: data.contactId,
        customerEmail: contact?.email || null,
        customerName: contact?.name || null,
        description: data.description || null,
        memo: data.memo || null,
        invoiceId: data.invoiceId || null,
        jobId: data.jobId || null,
        paymentMethodTypes: [data.paymentMethod],
      });
    },
    onSuccess: () => {
      toast({ title: "Payment Slip Created", description: "Draft payment slip has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-slips"] });
      setIsSlipDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create payment slip.", variant: "destructive" });
    },
  });

  const executeSlipMutation = useMutation({
    mutationFn: async (slipId: string) => {
      return apiRequest("POST", `/api/payment-slips/${slipId}/execute`);
    },
    onSuccess: () => {
      toast({ title: "Payment Sent", description: "Payment slip sent to processor via EOA." });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-slips"] });
    },
    onError: () => {
      toast({ title: "Execution Failed", description: "Failed to execute payment slip.", variant: "destructive" });
    },
  });

  const getContact = (contactId: string | null) => {
    if (!contactId) return null;
    return contacts.find(c => c.id === contactId);
  };

  const getInvoice = (invoiceId: string | null | undefined) => {
    if (!invoiceId) return null;
    return invoices.find(i => i.id === invoiceId);
  };

  const payments = useMemo(() => {
    return allPayments.filter((payment) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const contact = getContact(payment.contactId);
      return (
        payment.id.toLowerCase().includes(query) ||
        payment.invoiceId.toLowerCase().includes(query) ||
        payment.status.toLowerCase().includes(query) ||
        payment.method.toLowerCase().includes(query) ||
        String(payment.amount).includes(query) ||
        (contact?.name?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [allPayments, searchQuery, contacts]);

  const totalCollected = useMemo(() => {
    return allPayments
      .filter(p => p.status === "completed" || p.status === "settled")
      .reduce((sum, p) => sum + parseFloat(p.amount as string), 0);
  }, [allPayments]);

  const pendingSlips = paymentSlips.filter(s => s.status === "draft" || s.status === "approved");

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      settled: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      captured: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      authorized: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      draft: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      approved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      sent: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      failed: "bg-red-500/10 text-red-500 border-red-500/20",
      disputed: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      refunded: "bg-muted text-muted-foreground border-muted",
    };
    return styles[status.toLowerCase()] || "bg-muted text-muted-foreground border-muted";
  };

  const getOriginBadge = (origin: string | undefined | null) => {
    const originValue = origin || "human";
    if (originValue === "ai") {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] uppercase tracking-wide gap-1">
          <Bot className="w-3 h-3" />
          AI
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] uppercase tracking-wide gap-1">
        <UserCheck className="w-3 h-3" />
        Human
      </Badge>
    );
  };

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case "card":
      case "credit_card":
      case "stripe":
        return <CreditCard className="w-4 h-4" />;
      case "us_bank_account":
      case "ach":
        return <Building2 className="w-4 h-4" />;
      case "terminal":
        return <Receipt className="w-4 h-4" />;
      case "cash":
        return <Banknote className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const handleExecuteSlip = (slipId: string, origin: string) => {
    if (origin === "ai") {
      toast({ 
        title: "Review Required", 
        description: "AI-created slips must be approved in Review Queue before execution.",
        variant: "destructive"
      });
      return;
    }
    executeSlipMutation.mutate(slipId);
  };

  const onSubmitSlip = (data: PaymentSlipFormData) => {
    const submitData = {
      ...data,
      invoiceId: data.invoiceId === "none" ? undefined : data.invoiceId,
    };
    createSlipMutation.mutate(submitData);
  };

  const selectedPayment = payments.find(p => p.id === selectedPaymentId);
  const selectedSlip = paymentSlips.find(s => s.id === selectedSlipId);

  if (selectedPayment) {
    const contact = getContact(selectedPayment.contactId);
    const invoice = getInvoice(selectedPayment.invoiceId);
    const amount = parseFloat(selectedPayment.amount as string) || 0;
    const origin = (selectedPayment as Payment & { origin?: string }).origin || "human";

    return (
      <div className="flex h-full flex-col overflow-hidden" data-testid="page-payment-detail">
        <header className="p-6 bg-glass-surface border-b border-glass-border flex justify-between items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedPaymentId(null)} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Transaction Record</h2>
                <Badge variant="outline" className={`text-xs uppercase ${getStatusStyle(selectedPayment.status)}`}>
                  {selectedPayment.status}
                </Badge>
                {getOriginBadge(origin)}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {selectedPayment.id.substring(0, 8)} | Immutable Stripe Record
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Amount</span>
            <p className="text-3xl font-bold text-primary">${amount.toFixed(2)}</p>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[380px] bg-muted/30 border-r border-glass-border overflow-y-auto p-6 space-y-6">
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                Contact Reference
              </h4>
              <Card className="p-5 bg-glass-surface border-glass-border space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold">{contact?.name || "Unknown"}</span>
                    <p className="text-[10px] font-mono text-muted-foreground">{contact?.id?.substring(0, 8)}</p>
                  </div>
                </div>
                {contact && (
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setLocation(`/contacts/${contact.id}`)}>
                    Navigate to Contact
                  </Button>
                )}
              </Card>
            </section>
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase text-emerald-500 tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                Reconciliation Status
              </h4>
              <Card className="p-5 bg-zinc-950 border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-3 h-3" />
                  Stripe-Authoritative Record
                </div>
                <p className="text-xs text-zinc-300 italic">
                  This payment record is immutable. It reflects the actual transaction from Stripe.
                </p>
              </Card>
            </section>
          </div>
          <div className="flex-1 bg-background p-8 overflow-y-auto">
            <section className="space-y-6">
              <h3 className="text-xl font-bold">Linked Entities</h3>
              <div className="space-y-4">
                {invoice && (
                  <Card className="p-6 bg-muted/30 border-2 hover:border-primary/50 cursor-pointer" onClick={() => setLocation(`/invoices/${invoice.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center border text-primary">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Invoice</p>
                          <p className="text-xs font-mono text-muted-foreground">{invoice.id.substring(0, 8)}</p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Card>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-payments">
      <div className="bg-glass-surface border border-glass-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">PAYMENTS</h1>
              <p className="text-sm text-muted-foreground">Financial Reconciliation Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Collected</span>
              <span className="text-lg font-bold text-emerald-600">${totalCollected.toFixed(2)}</span>
            </div>
            <Dialog open={isSlipDialogOpen} onOpenChange={setIsSlipDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-slip">
                  <Plus className="w-4 h-4 mr-2" />
                  New Payment Slip
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Payment Slip</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitSlip)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="contactId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-contact">
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {contacts.filter(c => c.id).length === 0 ? (
                                <SelectItem value="_no_customers_" disabled>No customers available</SelectItem>
                              ) : (
                                contacts.filter(c => c.id).map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.name || c.email || c.id.substring(0, 8)}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input placeholder="0.00" type="number" step="0.01" {...field} data-testid="input-amount" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-method">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="us_bank_account">ACH / Bank</SelectItem>
                              <SelectItem value="terminal">Terminal (NFC)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Payment for services..." {...field} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="invoiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Invoice (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-invoice">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {invoices.filter(i => i.id).map(i => (
                                <SelectItem key={i.id} value={i.id}>{i.invoiceNumber || i.id.substring(0, 8)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsSlipDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createSlipMutation.isPending} data-testid="button-submit-slip">
                        {createSlipMutation.isPending ? "Creating..." : "Create Slip"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="slips" className="space-y-4">
        <TabsList>
          <TabsTrigger value="slips" data-testid="tab-slips">
            Payment Slips {pendingSlips.length > 0 && <Badge variant="secondary" className="ml-2">{pendingSlips.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            Transactions <Badge variant="outline" className="ml-2">{payments.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slips" className="space-y-4">
          <Card className="bg-glass-surface border-glass-border p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-4">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm font-medium">Payment Slips are draft payments. Human-created slips execute immediately. AI-created slips require Review Queue approval.</p>
            </div>
            {slipsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : paymentSlips.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No payment slips</p>
                <p className="text-sm">Create a payment slip to initiate a payment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentSlips.map(slip => {
                  const contact = getContact(slip.contactId);
                  const amount = parseFloat(slip.amount as string) || 0;
                  const canExecute = slip.origin === "human" && slip.status === "draft";
                  const needsApproval = slip.origin === "ai" && slip.status === "draft";
                  return (
                    <Card key={slip.id} className="p-4 bg-muted/30 flex items-center justify-between gap-4" data-testid={`slip-row-${slip.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                          {getMethodIcon((slip.paymentMethodTypes as string[])?.[0] || "card")}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{contact?.name || "Unknown Customer"}</p>
                          <p className="text-xs text-muted-foreground">{slip.description || slip.id.substring(0, 8)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-bold">${amount.toFixed(2)}</p>
                        <Badge variant="outline" className={getStatusStyle(slip.status)}>{slip.status}</Badge>
                        {getOriginBadge(slip.origin)}
                        {canExecute && (
                          <Button 
                            size="sm" 
                            onClick={() => handleExecuteSlip(slip.id, slip.origin)}
                            disabled={executeSlipMutation.isPending}
                            data-testid={`button-execute-${slip.id}`}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Execute
                          </Button>
                        )}
                        {needsApproval && (
                          <Button size="sm" variant="outline" onClick={() => setLocation("/review-queue")}>
                            <Clock className="w-3 h-3 mr-1" />
                            Review Queue
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="bg-glass-surface border border-glass-border rounded-xl p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="pl-10 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
          <Card className="bg-glass-surface border-glass-border overflow-hidden">
            <ScrollArea className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Origin</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsLoading && [1, 2, 3].map(i => (
                    <tr key={i} className="border-b border-glass-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-6 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-6 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                  {!paymentsLoading && payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No transactions</p>
                        <p className="text-sm">Completed payments from Stripe will appear here.</p>
                      </td>
                    </tr>
                  )}
                  {!paymentsLoading && payments.map(payment => {
                    const contact = getContact(payment.contactId);
                    const amount = parseFloat(payment.amount as string) || 0;
                    const origin = (payment as Payment & { origin?: string }).origin || "human";
                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-glass-border/50 cursor-pointer hover-elevate"
                        onClick={() => setSelectedPaymentId(payment.id)}
                        data-testid={`payment-row-${payment.id}`}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{payment.id.substring(0, 8)}</td>
                        <td className="px-4 py-3 text-sm">{contact?.name || "Unknown"}</td>
                        <td className="px-4 py-3 font-bold">${amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs uppercase ${getStatusStyle(payment.status)}`}>
                            {payment.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{getOriginBadge(origin)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {payment.paidAt ? format(new Date(payment.paidAt), "MMM d, yyyy") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
