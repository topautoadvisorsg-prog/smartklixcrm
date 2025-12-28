import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, CreditCard, DollarSign, CheckCircle, AlertCircle, 
  Loader2, User, FileText, Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Contact, Payment } from "@shared/schema";

type PaymentStatus = "idle" | "loading" | "ready" | "processing" | "success" | "error";

export default function PaymentTerminal() {
  const [, params] = useRoute("/payment/terminal/:id");
  const [, setLocation] = useLocation();
  const invoiceId = params?.id;
  const { toast } = useToast();

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [publishableKey, setPublishableKey] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const invoice = allInvoices.find(inv => inv.id === invoiceId);
  const contact = invoice?.contactId ? allContacts.find(c => c.id === invoice.contactId) : null;
  
  const invoicePayments = allPayments.filter(p => p.invoiceId === invoiceId);
  const paidAmount = invoicePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const amountDue = invoice ? Number(invoice.totalAmount) - paidAmount : 0;
  const paymentAmount = customAmount ? parseFloat(customAmount) : amountDue;

  useEffect(() => {
    async function fetchStripeKey() {
      try {
        const response = await fetch("/api/stripe/publishable-key");
        if (response.ok) {
          const data = await response.json();
          setPublishableKey(data.publishableKey);
          setPaymentStatus("ready");
        } else {
          setPaymentStatus("error");
          setErrorMessage("Stripe is not configured. Please set up Stripe in Settings.");
        }
      } catch (error) {
        setPaymentStatus("error");
        setErrorMessage("Failed to initialize payment system.");
      }
    }
    fetchStripeKey();
  }, []);

  const handleCreatePaymentIntent = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setPaymentStatus("processing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          contactId: contact?.id,
          invoiceId: invoice?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      
      toast({
        title: "Payment Ready",
        description: "Payment intent created. In production, this would connect to Stripe Terminal hardware.",
      });
      
      setPaymentStatus("success");
    } catch (error) {
      setPaymentStatus("error");
      setErrorMessage("Failed to create payment. Please try again.");
      toast({
        title: "Payment failed",
        description: "Could not process the payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSimulatePayment = async () => {
    setPaymentStatus("success");
    toast({
      title: "Payment Simulated",
      description: `$${paymentAmount.toFixed(2)} payment would be processed via Stripe Terminal in production.`,
    });
  };

  const getStatusBadge = () => {
    switch (paymentStatus) {
      case "idle":
      case "loading":
        return <Badge variant="secondary">Initializing...</Badge>;
      case "ready":
        return <Badge variant="outline" className="text-green-600 border-green-600">Ready</Badge>;
      case "processing":
        return <Badge variant="secondary">Processing...</Badge>;
      case "success":
        return <Badge variant="default" className="bg-green-600">Complete</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  if (!invoice) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/invoices")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Invoice not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              The invoice you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => setLocation("/invoices")} data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Terminal
              </CardTitle>
              <CardDescription>Process in-person card payment</CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invoice Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Invoice</span>
              </div>
              <span className="text-sm font-mono">#{invoice.id.substring(0, 8)}</span>
            </div>
            
            {contact && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Customer</span>
                </div>
                <span className="text-sm">{contact.name || "Unknown"}</span>
              </div>
            )}

            {contact?.company && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Company</span>
                </div>
                <span className="text-sm">{contact.company}</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Invoice Total</span>
              <span className="font-medium">${Number(invoice.totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Already Paid</span>
              <span className="font-medium text-green-600">${paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount Due</span>
              <span className="text-lg font-semibold">${amountDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder={amountDue.toFixed(2)}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="pl-8 text-lg"
                disabled={paymentStatus === "processing" || paymentStatus === "success"}
                data-testid="input-payment-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to pay the full amount due
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {paymentStatus === "success" && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Payment Complete</AlertTitle>
              <AlertDescription>
                Payment of ${paymentAmount.toFixed(2)} has been processed successfully.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {paymentStatus === "ready" && (
              <>
                <Button 
                  size="lg" 
                  onClick={handleCreatePaymentIntent}
                  className="w-full"
                  data-testid="button-process-payment"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Process Payment - ${(customAmount ? parseFloat(customAmount) : amountDue).toFixed(2)}
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={handleSimulatePayment}
                  className="w-full"
                  data-testid="button-simulate-payment"
                >
                  Simulate Terminal Payment (Demo)
                </Button>
              </>
            )}
            
            {paymentStatus === "processing" && (
              <Button size="lg" disabled className="w-full">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Payment...
              </Button>
            )}

            {paymentStatus === "success" && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setLocation("/invoices")}
                className="w-full"
                data-testid="button-done"
              >
                Done
              </Button>
            )}
          </div>

          {/* Terminal Info */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              In production, this page connects to Stripe Terminal hardware for tap-to-pay or chip card payments.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
