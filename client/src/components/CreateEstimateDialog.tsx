import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { FileText, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EstimateLineItemsEditor, { EstimateLineItem } from "./EstimateLineItemsEditor";
import type { Contact, Job, Settings } from "@shared/schema";

const createEstimateSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  jobId: z.string().optional(),
  notes: z.string().optional(),
  validDays: z.string().default("30"),
});

type CreateEstimateFormData = z.infer<typeof createEstimateSchema>;

interface CreateEstimateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultJobId?: string;
}

export default function CreateEstimateDialog({
  open,
  onOpenChange,
  defaultContactId,
  defaultJobId,
}: CreateEstimateDialogProps) {
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const taxRate = settings?.defaultTaxRate ? parseFloat(settings.defaultTaxRate) / 100 : 0.0825;

  const form = useForm<CreateEstimateFormData>({
    resolver: zodResolver(createEstimateSchema),
    defaultValues: {
      contactId: defaultContactId || "",
      jobId: defaultJobId || "",
      notes: "",
      validDays: "30",
    },
  });

  const selectedContactId = form.watch("contactId");
  const contactJobs = jobs.filter(j => j.clientId === selectedContactId);

  const createMutation = useMutation({
    mutationFn: async (data: CreateEstimateFormData) => {
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const taxableTotal = lineItems
        .filter(item => item.taxable !== false)
        .reduce((sum, item) => sum + item.total, 0);
      const taxTotal = taxableTotal * taxRate;
      const totalAmount = subtotal + taxTotal;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + parseInt(data.validDays || "30"));

      const payload = {
        contactId: data.contactId,
        jobId: data.jobId || null,
        status: "draft",
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          tier: item.tier,
          pricebookItemId: item.pricebookItemId,
          taxable: item.taxable,
        })),
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        notes: data.notes || null,
        validUntil: validUntil.toISOString(),
      };

      const res = await apiRequest("POST", "/api/estimates", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({
        title: "Estimate Created",
        description: "Your new estimate has been created successfully.",
      });
      form.reset();
      setLineItems([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create estimate",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateEstimateFormData) => {
    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description: "Please add at least one line item to the estimate.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxableTotal = lineItems
    .filter(item => item.taxable !== false)
    .reduce((sum, item) => sum + item.total, 0);
  const taxTotal = taxableTotal * taxRate;
  const totalAmount = subtotal + taxTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-estimate">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create New Estimate
          </DialogTitle>
          <DialogDescription>
            Build a new estimate with line items from your pricebook
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="items" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="items" data-testid="tab-line-items">Line Items</TabsTrigger>
                <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="space-y-4 pt-4">
                <EstimateLineItemsEditor
                  items={lineItems}
                  onChange={setLineItems}
                />

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</span>
                    <span className="font-medium">${taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-contact">
                            <SelectValue placeholder="Select a contact" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name} {contact.company ? `(${contact.company})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Job (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-job">
                            <SelectValue placeholder="Select a job (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No job selected</SelectItem>
                          {contactJobs.map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid For</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-valid-days">
                            <SelectValue placeholder="Select validity period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal notes about this estimate..."
                          {...field}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-create"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Estimate"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
