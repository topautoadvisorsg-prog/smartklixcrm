import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@shared/schema";

const editInvoiceSchema = z.object({
  status: z.string().min(1, "Status is required"),
  issuedAt: z.string().optional(),
  dueAt: z.string().optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
  subtotal: z.string().optional(),
  taxTotal: z.string().optional(),
  totalAmount: z.string().optional(),
});

type EditInvoiceFormData = z.infer<typeof editInvoiceSchema>;

interface EditInvoiceDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditInvoiceDialog({
  invoice,
  open,
  onOpenChange,
}: EditInvoiceDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditInvoiceFormData>({
    resolver: zodResolver(editInvoiceSchema),
    defaultValues: {
      status: invoice.status,
      issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt).toISOString().split("T")[0] : "",
      dueAt: invoice.dueAt ? new Date(invoice.dueAt).toISOString().split("T")[0] : "",
      paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString().split("T")[0] : "",
      notes: invoice.notes || "",
      subtotal: invoice.subtotal?.toString() || "",
      taxTotal: invoice.taxTotal?.toString() || "",
      totalAmount: invoice.totalAmount?.toString() || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        status: invoice.status,
        issuedAt: invoice.issuedAt ? new Date(invoice.issuedAt).toISOString().split("T")[0] : "",
        dueAt: invoice.dueAt ? new Date(invoice.dueAt).toISOString().split("T")[0] : "",
        paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString().split("T")[0] : "",
        notes: invoice.notes || "",
        subtotal: invoice.subtotal?.toString() || "",
        taxTotal: invoice.taxTotal?.toString() || "",
        totalAmount: invoice.totalAmount?.toString() || "",
      });
    }
  }, [open, invoice, form]);

  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: EditInvoiceFormData) => {
      const payload: Record<string, unknown> = {
        status: data.status,
        notes: data.notes || null,
      };

      if (data.issuedAt) {
        payload.issuedAt = new Date(data.issuedAt).toISOString();
      }

      if (data.dueAt) {
        payload.dueAt = new Date(data.dueAt).toISOString();
      }

      if (data.paidAt) {
        payload.paidAt = new Date(data.paidAt).toISOString();
      }

      if (data.subtotal && data.subtotal.trim()) {
        const parsed = parseFloat(data.subtotal);
        if (!isNaN(parsed)) {
          payload.subtotal = parsed;
        }
      }

      if (data.taxTotal && data.taxTotal.trim()) {
        const parsed = parseFloat(data.taxTotal);
        if (!isNaN(parsed)) {
          payload.taxTotal = parsed;
        }
      }

      if (data.totalAmount && data.totalAmount.trim()) {
        const parsed = parseFloat(data.totalAmount);
        if (!isNaN(parsed)) {
          payload.totalAmount = parsed;
        }
      }

      return apiRequest(`/api/invoices/${invoice.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Invoice Updated",
        description: "Invoice information has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not update invoice.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditInvoiceFormData) => {
    updateInvoiceMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-invoice">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Edit Invoice
          </DialogTitle>
          <DialogDescription>
            Update invoice information for #{invoice.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="issuedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-issued-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-due-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-paid-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="subtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-subtotal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxTotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-tax-total"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-total-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes..."
                      rows={3}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateInvoiceMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateInvoiceMutation.isPending}
                data-testid="button-save"
              >
                {updateInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
