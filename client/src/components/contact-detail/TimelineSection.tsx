import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ActivityTimeline from "@/components/ActivityTimeline";

interface TimelineEvent {
  id: string;
  user: string;
  userAvatar: string;
  action: string;
  timestamp: string;
  rawTimestamp: number;
  details?: string;
  type: "audit" | "note";
}

interface TimelineSectionProps {
  events: TimelineEvent[];
}

export default function TimelineSection({ events }: TimelineSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Communication Timeline
        </CardTitle>
        <CardDescription>All interactions, notes, and system events</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <ActivityTimeline events={events.slice(0, 10)} />
        ) : (
          <p className="text-center text-muted-foreground py-8">No activity yet</p>
        )}
      </CardContent>
    </Card>
  );
}
