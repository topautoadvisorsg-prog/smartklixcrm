import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ChatGPTActions() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Zap className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">ActionGPT</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Custom GPT actions and AI tool configuration. Define prompts, connect data sources, and tailor AI behavior to your business processes.
      </p>
    </div>
  );
}
