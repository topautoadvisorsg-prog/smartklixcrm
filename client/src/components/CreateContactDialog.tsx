import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertContact, Contact } from "@shared/schema";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneInput from "@/components/PhoneInput";

// Form schema that matches InsertContact but uses strings for form handling
const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  countryCode: z.string().min(2, "Country is required"),
  company: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  contactType: z.string().default("individual"),
  customerType: z.string().default("lead"),
  source: z.string().default("manual"),
  niche: z.string().optional().or(z.literal("")),
  preferredChannel: z.string().default("email"),
  billingAddress: z.string().optional().or(z.literal("")),
  billingCity: z.string().optional().or(z.literal("")),
  billingState: z.string().optional().or(z.literal("")),
  billingZip: z.string().optional().or(z.literal("")),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateContactDialog({ open, onOpenChange }: CreateContactDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<Contact[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      countryCode: "US",
      company: "",
      website: "",
      contactType: "individual",
      customerType: "lead",
      source: "manual",
      niche: "",
      preferredChannel: "email",
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingZip: "",
    },
  });

  const watchedValues = useWatch({
    control: form.control,
    name: ["name", "email", "phone"],
  });

  const checkDuplicates = useCallback(async (name: string, email: string, phone: string) => {
    if (!name && !email && !phone) {
      setDuplicates([]);
      return;
    }
    
    setIsCheckingDuplicates(true);
    try {
      const params = new URLSearchParams();
      if (name && name.length >= 2) params.append("name", name);
      if (email) params.append("email", email);
      if (phone) params.append("phone", phone);
      
      if (params.toString()) {
        const response = await fetch(`/api/contacts/duplicates/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setDuplicates(data);
        }
      } else {
        setDuplicates([]);
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error);
    } finally {
      setIsCheckingDuplicates(false);
    }
  }, []);

  useEffect(() => {
    const [name, email, phone] = watchedValues;
    const timeout = setTimeout(() => {
      checkDuplicates(name || "", email || "", phone || "");
    }, 500); // Debounce 500ms
    return () => clearTimeout(timeout);
  }, [watchedValues, checkDuplicates]);

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      // Convert empty strings to null for optional fields
      const payload: InsertContact = {
        name: data.name,
        phone: data.phone,
        countryCode: data.countryCode,
        email: data.email || undefined,
        company: data.company || undefined,
        website: data.website || undefined,
        contactType: data.contactType,
        customerType: data.customerType,
        source: data.source,
        niche: data.niche || undefined,
        preferredChannel: data.preferredChannel,
        billingAddress: data.billingAddress || undefined,
        billingCity: data.billingCity || undefined,
        billingState: data.billingState || undefined,
        billingZip: data.billingZip || undefined,
      };
      const res = await apiRequest("POST", "/api/contacts", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh]" data-testid="dialog-create-contact">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to your CRM. Fill in the required fields below.
          </DialogDescription>
        </DialogHeader>
        
        {duplicates.length > 0 && (
          <Alert variant="destructive" className="my-2 flex-shrink-0" data-testid="alert-duplicate-contacts">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Potential Duplicates Found</AlertTitle>
            <AlertDescription>
              <p className="mb-2">We found {duplicates.length} contact(s) that may match:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {duplicates.slice(0, 3).map(dup => (
                  <li key={dup.id}>
                    <span className="font-medium">{dup.name || "Unknown"}</span>
                    {dup.email && <span className="text-muted-foreground"> - {dup.email}</span>}
                    {dup.phone && <span className="text-muted-foreground"> - {dup.phone}</span>}
                  </li>
                ))}
                {duplicates.length > 3 && (
                  <li className="text-muted-foreground">...and {duplicates.length - 3} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        data-testid="input-contact-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <PhoneInput
                  value={form.watch("phone")}
                  onChange={(value) => {
                    form.setValue("phone", value, { shouldValidate: true });
                  }}
                  onCountryChange={(countryCode) => {
                    form.setValue("countryCode", countryCode, { shouldValidate: true });
                  }}
                  defaultCountry={form.watch("countryCode") as any}
                  error={form.formState.errors.phone?.message}
                />
              </FormItem>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Acme Corp"
                        {...field}
                        data-testid="input-contact-company"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com"
                        {...field}
                        data-testid="input-contact-website"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-customer-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="churned">Churned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-source">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="inbound_call">Inbound Call</SelectItem>
                          <SelectItem value="outreach">Outreach</SelectItem>
                          <SelectItem value="existing">Existing</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="niche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Healthcare, Legal, Construction"
                          {...field}
                          data-testid="input-contact-niche"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="preferredChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Channel</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-preferred-channel">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Billing Address</h4>
                <FormField
                  control={form.control}
                  name="billingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main St"
                          {...field}
                          data-testid="input-billing-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="billingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City"
                            {...field}
                            data-testid="input-billing-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="State"
                            {...field}
                            data-testid="input-billing-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Zip"
                            {...field}
                            data-testid="input-billing-zip"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="flex-shrink-0 flex justify-end gap-3 pt-4 mt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            data-testid="button-cancel-contact"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            data-testid="button-submit-contact"
          >
            {isSubmitting ? "Creating..." : "Create Contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
