import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CRMAgentConfig() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Bot className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">AI Settings</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Configure AI agent behavior, prompts, and permissions. Fine-tune how your AI assistants interact with contacts and handle tasks.
      </p>
    </div>
  );
}
