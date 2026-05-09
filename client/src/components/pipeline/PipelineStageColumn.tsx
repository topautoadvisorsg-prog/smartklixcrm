import { Lock } from "lucide-react";
import PipelineCard, { PipelineCardData, PipelineStage, StageConfig, UserRole } from "./PipelineCard";

interface PipelineStageColumnProps {
  stage: StageConfig;
  cards: PipelineCardData[];
  userRole: UserRole;
  isDropTarget: boolean;
  draggedCardId: string | null;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: PipelineStage) => void;
  onCardDragStart: (e: React.DragEvent, card: PipelineCardData) => void;
}

export default function PipelineStageColumn({
  stage,
  cards,
  userRole,
  isDropTarget,
  draggedCardId,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
}: PipelineStageColumnProps) {
  const stageCards = cards.filter(c => c.status === stage.id);

  return (
    <div
      className={`w-[320px] flex flex-col h-full rounded-2xl border transition-colors ${
        isDropTarget 
          ? 'bg-accent border-primary/50' 
          : 'bg-transparent border-border/50'
      }`}
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column Header */}
      <header className={`px-4 py-3 border-b border-border rounded-t-2xl flex justify-between items-center ${
        stage.locked ? 'bg-primary/10' : 'bg-card'
      }`}>
        <span className={`text-[11px] font-black uppercase tracking-widest ${
          stage.locked ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {stage.label}
        </span>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-muted-foreground">
            {stageCards.length}
          </span>
          {stage.locked && <Lock className="w-3 h-3 text-primary" />}
        </div>
      </header>

      {/* Cards Area */}
      <div className={`flex-1 p-3 space-y-3 overflow-y-auto ${
        stage.gated ? 'bg-muted/20' : ''
      }`}>
        {/* Empty State */}
        {stageCards.length === 0 && (
          <div className="h-32 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-center p-4 opacity-50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">
              {stage.gated ? 'Gate Empty • Waiting for Approval' : 'No items'}
            </p>
          </div>
        )}

        {/* Cards */}
        {stageCards.map(card => (
          <PipelineCard
            key={card.id}
            card={card}
            stageConfig={stage}
            userRole={userRole}
            isDragging={draggedCardId === card.id}
            onDragStart={onCardDragStart}
          />
        ))}
      </div>
    </div>
  );
}
