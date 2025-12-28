import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface AIQueueItemProps {
  id: string;
  action: string;
  description: string;
  priority: "low" | "medium" | "high";
  timestamp: string;
  details?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

const priorityColors = {
  low: "border-l-4 border-l-gray-400",
  medium: "border-l-4 border-l-yellow-500",
  high: "border-l-4 border-l-red-500",
};

export default function AIQueueItem({
  id,
  action,
  description,
  priority,
  timestamp,
  details,
  onApprove,
  onReject,
}: AIQueueItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`${priorityColors[priority]}`} data-testid={`queue-item-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{action}</h4>
              <Badge variant="outline" className="text-xs">{priority}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
          </div>
          {details && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-${id}`}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && details && (
        <CardContent className="pt-0 pb-3">
          <div className="text-xs bg-muted p-3 rounded-md font-mono">
            {details}
          </div>
        </CardContent>
      )}

      <CardFooter className="pt-0 flex gap-3">
        <Button
          size="sm"
          onClick={onApprove}
          className="flex-1"
          data-testid={`button-approve-${id}`}
        >
          <Check className="w-4 h-4 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          className="flex-1"
          data-testid={`button-reject-${id}`}
        >
          <X className="w-4 h-4 mr-1" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
