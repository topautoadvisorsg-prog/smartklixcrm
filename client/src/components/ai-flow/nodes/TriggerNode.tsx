import { Handle, Position } from "@xyflow/react";
import { Globe, Bot, Phone, Settings } from "lucide-react";

const iconMap: Record<string, typeof Bot> = {
  globe: Globe,
  bot: Bot,
  phone: Phone,
  settings: Settings,
};

interface TriggerNodeProps {
  data: {
    label?: string;
    icon?: string;
  };
  selected?: boolean;
}

export default function TriggerNode({ data, selected }: TriggerNodeProps) {
  const Icon = iconMap[data.icon || "bot"] || Bot;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 min-w-[160px] ${
        selected ? "border-emerald-500 shadow-lg" : "border-emerald-500/50"
      }`}
      data-testid={`node-trigger-${data.label?.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-medium">
            Trigger
          </p>
          <p className="text-sm font-medium">{data.label}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-background"
      />
    </div>
  );
}
