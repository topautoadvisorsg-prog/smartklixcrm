/**
 * Contact Form Component
 * 
 * Embeddable contact form for website integration.
 * Calls SmartKlix CRM API directly to create/update contacts.
 * Can be embedded on marketing websites, landing pages, or used standalone.
 * 
 * Integration: Website → POST /api/contacts/create → CRM Database
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

/**
 * Contact form validation schema
 * Matches the CRM API /api/contacts/create endpoint requirements
 */
const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  company: z.string().optional(),
  message: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  /** Show as a card with header (default: true) */
  showCard?: boolean;
  /** Custom title for the form */
  title?: string;
  /** Custom description */
  description?: string;
  /** Callback after successful submission */
  onSuccess?: () => void;
  /** Additional metadata to include with the contact */
  metadata?: Record<string, unknown>;
}

/**
 * Contact Form Component
 * 
 * Features:
 * - Direct CRM API integration (no n8n needed)
 * - Real-time validation
 * - Loading states and success feedback
 * - Fully accessible with proper labels and error messages
 * - Mobile-responsive design
 */
export default function ContactForm({
  showCard = true,
  title = "Get in Touch",
  description = "Fill out the form below and we'll get back to you shortly.",
  onSuccess,
  metadata,
}: ContactFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      await apiRequest("POST", "/api/contacts/create", {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone,
        company: data.company || undefined,
        status: "new",
        ...(metadata && { metadata }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });

      toast({
        title: "Message Sent!",
        description: "Thank you for reaching out. We'll be in touch soon.",
      });

      setIsSubmitted(true);
      form.reset();
      
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to submit contact form:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formContent = (
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
                  placeholder="Your full name"
                  data-testid="input-contact-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  data-testid="input-contact-email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone *</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-contact-phone"
                  {...field}
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
                  placeholder="Your company name"
                  data-testid="input-contact-company"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your project..."
                  rows={4}
                  data-testid="textarea-contact-message"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || isSubmitted}
          data-testid="button-submit-contact"
        >
          {form.formState.isSubmitting && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {isSubmitted && (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          {isSubmitted ? "Sent Successfully!" : "Send Message"}
        </Button>
      </form>
    </Form>
  );

  if (!showCard) {
    return formContent;
  }

  return (
    <Card data-testid="card-contact-form">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
