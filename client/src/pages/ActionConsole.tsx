import { Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ActionConsole() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Terminal className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Action Console</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Monitor and control all active AI agent operations in real time. Pause, resume, or terminate running automations from a single dashboard.
      </p>
    </div>
  );
}
