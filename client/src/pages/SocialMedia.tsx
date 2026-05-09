import { Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SocialMedia() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Share2 className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Social Planner</h1>
      <Badge variant="secondary">Coming Soon</Badge>
      <p className="text-muted-foreground text-center max-w-md">
        Social media content planning and scheduling. Draft posts, schedule campaigns, and track engagement across platforms.
      </p>
    </div>
  );
}
