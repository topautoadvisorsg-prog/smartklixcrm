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
  status: z.string().default("lead"),
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
      status: "lead",
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
        email: data.email || null,
        company: data.company || null,
        status: data.status,
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
      <DialogContent data-testid="dialog-create-contact">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to your CRM. Fill in the required fields below.
          </DialogDescription>
        </DialogHeader>
        
        {duplicates.length > 0 && (
          <Alert variant="destructive" className="my-2" data-testid="alert-duplicate-contacts">
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-contact-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-4">
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
                disabled={isSubmitting}
                data-testid="button-submit-contact"
              >
                {isSubmitting ? "Creating..." : "Create Contact"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
