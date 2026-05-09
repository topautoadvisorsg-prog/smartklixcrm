import { Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function GoogleWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Cloud className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Google Workspace</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Google Docs, Sheets, and Drive integration. Sync documents, attach files to contacts, and collaborate without leaving the CRM.
      </p>
    </div>
  );
}
