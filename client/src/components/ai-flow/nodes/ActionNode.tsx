import { Handle, Position } from "@xyflow/react";
import { UserPlus, Briefcase, Calendar, Mail, FileText, GitBranch, Zap } from "lucide-react";

const iconMap: Record<string, typeof Zap> = {
  userPlus: UserPlus,
  briefcase: Briefcase,
  calendar: Calendar,
  mail: Mail,
  fileText: FileText,
  pipeline: GitBranch,
};

interface ActionNodeProps {
  data: {
    label?: string;
    icon?: string;
  };
  selected?: boolean;
}

export default function ActionNode({ data, selected }: ActionNodeProps) {
  const Icon = iconMap[data.icon || "userPlus"] || Zap;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-blue-500/10 to-blue-600/5 min-w-[160px] ${
        selected ? "border-blue-500 shadow-lg" : "border-blue-500/50"
      }`}
      data-testid={`node-action-${data.label?.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-medium">
            Action
          </p>
          <p className="text-sm font-medium">{data.label}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
}
