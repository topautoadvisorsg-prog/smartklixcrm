/**
 * Send SMS Dialog Component
 * 
 * Allows users to send SMS messages to contacts via n8n → Twilio integration.
 * Triggered from contact dropdown menus or job/estimate pages.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare } from "lucide-react";
import { sendSMS } from "@/lib/n8nEvents";

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    phone: string;
  };
  defaultMessage?: string;
  metadata?: Record<string, unknown>;
}

export default function SendSMSDialog({
  open,
  onOpenChange,
  contact,
  defaultMessage = "",
  metadata,
}: SendSMSDialogProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send.",
        variant: "destructive",
      });
      return;
    }

    if (!contact.phone) {
      toast({
        title: "No Phone Number",
        description: `${contact.name} does not have a phone number on file.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      await sendSMS(contact.id, contact.phone, message, metadata);

      toast({
        title: "SMS Queued",
        description: `Message to ${contact.name} has been queued for sending via n8n.`,
      });

      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to send SMS:", error);
      toast({
        title: "Failed to Send",
        description: error instanceof Error ? error.message : "Could not queue SMS message.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-send-sms">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send SMS to {contact.name}
          </DialogTitle>
          <DialogDescription>
            Message will be sent to {contact.phone} via Twilio integration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sms-message">Message</Label>
            <Textarea
              id="sms-message"
              data-testid="textarea-sms-message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              {message.length} characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            data-testid="button-cancel-sms"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            data-testid="button-send-sms"
          >
            {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
