import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Marketplace() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Store className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Browse and install CRM extensions and integrations. Expand your CRM capabilities with community and official add-ons.
      </p>
    </div>
  );
}
