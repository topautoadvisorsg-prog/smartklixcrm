import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Emails() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Mail className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Email</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Unified email inbox with AI-assisted drafting and tracking. Connect your inbox, auto-categorize messages, and let AI draft replies.
      </p>
    </div>
  );
}
