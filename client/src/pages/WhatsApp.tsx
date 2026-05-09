import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WhatsApp() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <MessageCircle className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">WhatsApp</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        WhatsApp Business messaging integration. Send and receive messages, manage templates, and automate conversations with your contacts.
      </p>
    </div>
  );
}
