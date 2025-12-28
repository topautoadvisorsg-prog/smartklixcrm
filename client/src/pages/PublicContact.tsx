/**
 * Public Contact Page
 * 
 * Standalone contact page that can be accessed without authentication.
 * Demonstrates website integration for SmartKlix CRM.
 * 
 * This page shows how external websites can integrate the contact form
 * to send leads directly into the SmartKlix CRM system.
 */

import ContactForm from "@/components/ContactForm";
import { Phone, Mail, MapPin } from "lucide-react";

export default function PublicContact() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have a question or need a quote? Fill out the form below and our team will get back to you within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ContactForm
              metadata={{
                source: "website",
                page: "/contact",
                timestamp: new Date().toISOString(),
              }}
            />
          </div>

          <div className="space-y-6">
            <div className="p-6 border border-border rounded-lg">
              <h3 className="font-semibold mb-4">Contact Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">hello@smartklix.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Office</p>
                    <p className="text-sm text-muted-foreground">
                      123 Business Ave<br />
                      San Diego, CA 92101
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border border-border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-2">Business Hours</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Monday - Friday: 8am - 6pm</p>
                <p>Saturday: 9am - 3pm</p>
                <p>Sunday: Closed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
