import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Funnels() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Layers className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Funnels</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Sales funnel visualization and conversion tracking. Build multi-step funnels, identify drop-offs, and optimize your pipeline conversion.
      </p>
    </div>
  );
}
