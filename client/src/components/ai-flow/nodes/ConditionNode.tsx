import { Handle, Position } from "@xyflow/react";
import { GitBranch, User, Settings, MessageSquare, Clock } from "lucide-react";

const iconMap: Record<string, typeof GitBranch> = {
  user: User,
  settings: Settings,
  message: MessageSquare,
  clock: Clock,
};

interface ConditionNodeProps {
  data: {
    label?: string;
    icon?: string;
  };
  selected?: boolean;
}

export default function ConditionNode({ data, selected }: ConditionNodeProps) {
  const Icon = iconMap[data.icon || "settings"] || GitBranch;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-amber-500/10 to-amber-600/5 min-w-[160px] ${
        selected ? "border-amber-500 shadow-lg" : "border-amber-500/50"
      }`}
      data-testid={`node-condition-${data.label?.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium">
            Condition
          </p>
          <p className="text-sm font-medium">{data.label}</p>
        </div>
      </div>
      <div className="flex justify-around mt-2 text-[10px] text-muted-foreground">
        <span>Yes</span>
        <span>No</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: "30%" }}
        className="!bg-green-500 !w-3 !h-3 !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: "70%" }}
        className="!bg-red-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
}
