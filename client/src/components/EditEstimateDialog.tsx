import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EstimateLineItemsEditor, { EstimateLineItem } from "./EstimateLineItemsEditor";
import type { Estimate } from "@shared/schema";

const editEstimateSchema = z.object({
  status: z.string().min(1, "Status is required"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  subtotal: z.string().optional(),
  taxTotal: z.string().optional(),
  totalAmount: z.string().optional(),
});

type EditEstimateFormData = z.infer<typeof editEstimateSchema>;

interface EditEstimateDialogProps {
  estimate: Estimate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditEstimateDialog({
  estimate,
  open,
  onOpenChange,
}: EditEstimateDialogProps) {
  const { toast } = useToast();

  const parseLineItems = (): EstimateLineItem[] => {
    if (!estimate.lineItems) return [];
    const items = estimate.lineItems as Array<{ description?: string; quantity?: number; unitPrice?: number; total?: number }>;
    return items.map((item, index) => ({
      id: `existing-${index}`,
      description: item.description || "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      total: item.total || (item.quantity || 1) * (item.unitPrice || 0),
    }));
  };

  const [lineItems, setLineItems] = useState<EstimateLineItem[]>(parseLineItems);

  const form = useForm<EditEstimateFormData>({
    resolver: zodResolver(editEstimateSchema),
    defaultValues: {
      status: estimate.status,
      validUntil: estimate.validUntil ? new Date(estimate.validUntil).toISOString().split("T")[0] : "",
      notes: estimate.notes || "",
      subtotal: estimate.subtotal?.toString() || "",
      taxTotal: estimate.taxTotal?.toString() || "",
      totalAmount: estimate.totalAmount?.toString() || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        status: estimate.status,
        validUntil: estimate.validUntil ? new Date(estimate.validUntil).toISOString().split("T")[0] : "",
        notes: estimate.notes || "",
        subtotal: estimate.subtotal?.toString() || "",
        taxTotal: estimate.taxTotal?.toString() || "",
        totalAmount: estimate.totalAmount?.toString() || "",
      });
      setLineItems(parseLineItems());
    }
  }, [open, estimate, form]);

  const taxRate = 0.0825;
  const subtotalFromItems = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableAmount = lineItems.filter(item => item.taxable !== false).reduce((sum, item) => sum + item.total, 0);
  const taxFromItems = taxableAmount * taxRate;
  const totalFromItems = subtotalFromItems + taxFromItems;

  const updateEstimateMutation = useMutation({
    mutationFn: async (data: EditEstimateFormData) => {
      const payload: Record<string, unknown> = {
        status: data.status,
        notes: data.notes || null,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          pricebookItemId: item.pricebookItemId,
          tier: item.tier,
          taxable: item.taxable,
        })),
        subtotal: subtotalFromItems,
        taxTotal: taxFromItems,
        totalAmount: totalFromItems,
      };

      if (data.validUntil) {
        payload.validUntil = new Date(data.validUntil).toISOString();
      }

      return apiRequest(`/api/estimates/${estimate.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Estimate Updated",
        description: "Estimate information has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not update estimate.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditEstimateFormData) => {
    updateEstimateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-estimate">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Edit Estimate
          </DialogTitle>
          <DialogDescription>
            Update estimate information for #{estimate.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="items" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="items" data-testid="tab-items">Line Items</TabsTrigger>
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="mt-4">
                <EstimateLineItemsEditor
                  items={lineItems}
                  onChange={setLineItems}
                  taxRate={taxRate}
                />
              </TabsContent>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid Until</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-valid-until"
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

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Calculated Totals</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotalFromItems.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</span>
                      <span>${taxFromItems.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base border-t pt-1">
                      <span>Total</span>
                      <span>${totalFromItems.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateEstimateMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateEstimateMutation.isPending}
                data-testid="button-save"
              >
                {updateEstimateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
