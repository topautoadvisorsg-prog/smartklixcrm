import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}

export default function StatsCard({ title, value, change, changeType = "neutral", icon: Icon }: StatsCardProps) {
  const changeColor = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <Card data-testid={`stats-${title.toLowerCase().replace(/\s+/g, '-')}`} className="hover-elevate transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase mb-1">{title}</p>
            <div className="text-3xl font-bold tracking-tight" data-testid={`stats-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
            {change && (
              <p className={`text-sm mt-2 font-medium ${changeColor}`} data-testid="stats-change">
                {change}
              </p>
            )}
          </div>
          {Icon && (
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
