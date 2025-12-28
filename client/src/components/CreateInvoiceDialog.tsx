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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EstimateLineItemsEditor, { EstimateLineItem } from "./EstimateLineItemsEditor";
import type { Contact, Job, Settings } from "@shared/schema";

const createInvoiceSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  jobId: z.string().optional(),
  notes: z.string().optional(),
  dueDays: z.string().default("30"),
});

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId?: string;
  defaultJobId?: string;
}

export default function CreateInvoiceDialog({
  open,
  onOpenChange,
  defaultContactId,
  defaultJobId,
}: CreateInvoiceDialogProps) {
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

  const form = useForm<CreateInvoiceFormData>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      contactId: defaultContactId || "",
      jobId: defaultJobId || "",
      notes: "",
      dueDays: "30",
    },
  });

  const selectedContactId = form.watch("contactId");
  const contactJobs = jobs.filter(j => j.clientId === selectedContactId);

  const createMutation = useMutation({
    mutationFn: async (data: CreateInvoiceFormData) => {
      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const taxableTotal = lineItems
        .filter(item => item.taxable !== false)
        .reduce((sum, item) => sum + item.total, 0);
      const taxTotal = taxableTotal * taxRate;
      const totalAmount = subtotal + taxTotal;

      const issuedAt = new Date();
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + parseInt(data.dueDays || "30"));

      const payload = {
        contactId: data.contactId,
        jobId: data.jobId || null,
        status: "draft",
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          pricebookItemId: item.pricebookItemId,
          taxable: item.taxable,
        })),
        subtotal: subtotal.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        notes: data.notes || null,
        issuedAt: issuedAt.toISOString(),
        dueAt: dueAt.toISOString(),
      };

      const res = await apiRequest("POST", "/api/invoices", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Created",
        description: "Your new invoice has been created successfully.",
      });
      form.reset();
      setLineItems([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateInvoiceFormData) => {
    if (lineItems.length === 0) {
      toast({
        title: "No Line Items",
        description: "Please add at least one line item to the invoice.",
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-invoice">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Create New Invoice
          </DialogTitle>
          <DialogDescription>
            Build a new invoice with line items from your pricebook
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
                  name="dueDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due In</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-due-days">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Due on receipt</SelectItem>
                          <SelectItem value="7">Net 7</SelectItem>
                          <SelectItem value="14">Net 14</SelectItem>
                          <SelectItem value="30">Net 30</SelectItem>
                          <SelectItem value="60">Net 60</SelectItem>
                          <SelectItem value="90">Net 90</SelectItem>
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
                          placeholder="Notes to display on the invoice..."
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
                  "Create Invoice"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
