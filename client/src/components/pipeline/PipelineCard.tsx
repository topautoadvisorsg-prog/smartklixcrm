import { Lock, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type PipelineStage = 'new_request' | 'qualification' | 'negotiation' | 'approved' | 'booked';
export type UserRole = 'sales' | 'operator';

export interface PipelineCardData {
  id: string;
  status: PipelineStage;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  jobTitle: string;
  totalValue: number;
  assignedUserId?: string;
  assignedUserName?: string;
  lastActivityAt: string;
  createdAt: string;
  ageDays: number;
  hasActiveEstimate: boolean;
  estimateId?: string;
}

export interface StageConfig {
  id: PipelineStage;
  label: string;
  weight: number;
  colorClass: string;
  barColor: string;
  locked?: boolean;
  gated?: boolean;
}

interface PipelineCardProps {
  card: PipelineCardData;
  stageConfig?: StageConfig;
  userRole: UserRole;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent, card: PipelineCardData) => void;
}

export default function PipelineCard({ 
  card, 
  stageConfig, 
  userRole, 
  isDragging = false, 
  onDragStart 
}: PipelineCardProps) {
  const isStale = card.ageDays > 30;
  const isLocked = card.status === 'booked';
  const canDrag = !(isLocked || (userRole === 'sales' && card.status === 'approved'));

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, card)}
      className={`group relative bg-card rounded-lg p-4 border border-border hover:border-muted-foreground/50 transition-all shadow-sm ${
        isStale ? 'opacity-50' : ''
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Color Bar */}
      <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-lg ${
        !card.hasActiveEstimate && card.status !== 'new_request' 
          ? 'bg-amber-500' 
          : stageConfig?.barColor || 'bg-muted'
      }`} />

      <div className="pl-3">
        {/* Missing Estimate Warning */}
        {!card.hasActiveEstimate && card.status !== 'new_request' && (
          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded mb-3">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">
              Missing Active Estimate
            </span>
          </div>
        )}

        {/* Card Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-foreground truncate">
              {card.customerName}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">
              {card.jobTitle}
            </p>
          </div>
          {isLocked && <Lock className="w-3 h-3 text-primary shrink-0" />}
        </div>

        {/* Value & Activity */}
        <div className="space-y-1 mb-3">
          <p className="text-[11px] font-bold text-muted-foreground">
            {card.totalValue > 0 
              ? `$${card.totalValue.toLocaleString()} ${card.status === 'booked' ? 'Booked' : 'Est.'}`
              : '$0 Est.'
            }
          </p>
          <p className="text-[9px] text-muted-foreground/60 font-mono">
            {card.lastActivityAt}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <div className="flex items-center space-x-2">
            {card.hasActiveEstimate && (
              <span className="text-[8px] font-bold text-emerald-500 uppercase">
                Est. Active
              </span>
            )}
            {isStale && (
              <span className="text-[8px] font-bold text-amber-500 uppercase">
                Stale ({card.ageDays}d)
              </span>
            )}
          </div>
          {card.assignedUserName && (
            <Avatar className="w-5 h-5">
              <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(card.assignedUserName)}&background=random&size=32`} />
              <AvatarFallback className="text-[8px]">
                {card.assignedUserName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
