import { Handle, Position } from "@xyflow/react";
import { Bot, FileText, User, MessageSquare } from "lucide-react";

const iconMap: Record<string, typeof Bot> = {
  bot: Bot,
  fileText: FileText,
  user: User,
};

interface ResponseNodeProps {
  data: {
    label?: string;
    icon?: string;
  };
  selected?: boolean;
}

export default function ResponseNode({ data, selected }: ResponseNodeProps) {
  const Icon = iconMap[data.icon || "bot"] || MessageSquare;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-purple-500/10 to-purple-600/5 min-w-[160px] ${
        selected ? "border-purple-500 shadow-lg" : "border-purple-500/50"
      }`}
      data-testid={`node-response-${data.label?.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-purple-500 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-purple-600 dark:text-purple-400 font-medium">
            Response
          </p>
          <p className="text-sm font-medium">{data.label}</p>
        </div>
      </div>
    </div>
  );
}
