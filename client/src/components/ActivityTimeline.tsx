import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TimelineEvent {
  id: string;
  user: string;
  userAvatar?: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
}

export default function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <div className="space-y-4" data-testid="activity-timeline">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4" data-testid={`timeline-event-${event.id}`}>
          <div className="flex flex-col items-center">
            <Avatar className="w-8 h-8">
              <AvatarImage src={event.userAvatar} />
              <AvatarFallback className="text-xs">{event.user.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {index < events.length - 1 && (
              <div className="w-0.5 flex-1 bg-border mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-medium">{event.user}</p>
              <p className="text-xs text-muted-foreground">{event.timestamp}</p>
            </div>
            <p className="text-sm text-foreground mt-1">{event.action}</p>
            {event.details && (
              <p className="text-xs text-muted-foreground mt-1">{event.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
