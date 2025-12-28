/**
 * Create Payment Link Dialog Component
 * 
 * Allows users to generate Stripe payment links for invoices via n8n → Stripe integration.
 * Triggered from job/invoice pages or contact dropdown menus.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { createPaymentLink } from "@/lib/n8nEvents";

interface CreatePaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    email: string;
  };
  defaultAmount?: string;
  defaultDescription?: string;
  metadata?: Record<string, unknown>;
}

export default function CreatePaymentLinkDialog({
  open,
  onOpenChange,
  contact,
  defaultAmount = "",
  defaultDescription = "",
  metadata,
}: CreatePaymentLinkDialogProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [description, setDescription] = useState(defaultDescription);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Amount Required",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please enter a payment description.",
        variant: "destructive",
      });
      return;
    }

    if (!contact.email) {
      toast({
        title: "No Email Address",
        description: `${contact.name} does not have an email address on file.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      await createPaymentLink(contact.id, contact.email, {
        amount: parseFloat(amount),
        description,
        ...metadata,
      });

      toast({
        title: "Payment Link Queued",
        description: `Payment link for ${contact.name} has been queued for creation via n8n.`,
      });

      setAmount("");
      setDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create payment link:", error);
      toast({
        title: "Failed to Create",
        description: error instanceof Error ? error.message : "Could not queue payment link creation.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-payment-link">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Create Payment Link for {contact.name}
          </DialogTitle>
          <DialogDescription>
            Payment link will be sent to {contact.email} via Stripe integration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (USD)</Label>
            <Input
              id="payment-amount"
              data-testid="input-payment-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-description">Description</Label>
            <Textarea
              id="payment-description"
              data-testid="textarea-payment-description"
              placeholder="e.g., Outdoor lighting installation - Invoice #12345"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
            data-testid="button-cancel-payment"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !amount || !description.trim()}
            data-testid="button-create-payment-link"
          >
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
