/**
 * Send Email Dialog Component
 * 
 * Allows users to send emails to contacts via n8n → SendGrid integration.
 * Triggered from contact dropdown menus or job/estimate pages.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import { sendEmail } from "@/lib/n8nEvents";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    email: string;
  };
  defaultSubject?: string;
  defaultMessage?: string;
  metadata?: Record<string, unknown>;
}

export default function SendEmailDialog({
  open,
  onOpenChange,
  contact,
  defaultSubject = "",
  defaultMessage = "",
  metadata,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({
        title: "Subject Required",
        description: "Please enter an email subject.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send.",
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

    setIsSending(true);

    try {
      await sendEmail(contact.id, contact.email, subject, message, metadata);

      toast({
        title: "Email Queued",
        description: `Email to ${contact.name} has been queued for sending via n8n.`,
      });

      setSubject("");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to send email:", error);
      toast({
        title: "Failed to Send",
        description: error instanceof Error ? error.message : "Could not queue email.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-send-email">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email to {contact.name}
          </DialogTitle>
          <DialogDescription>
            Email will be sent to {contact.email} via SendGrid integration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              data-testid="input-email-subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message">Message</Label>
            <Textarea
              id="email-message"
              data-testid="textarea-email-message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              disabled={isSending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            data-testid="button-cancel-email"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !message.trim()}
            data-testid="button-send-email"
          >
            {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
