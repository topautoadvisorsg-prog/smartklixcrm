import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStageColumn, BookingWizard, PipelineCardData, PipelineStage, StageConfig, UserRole } from "@/components/pipeline";

// ============================================
// CONFIGURATION - FIXED STAGES (NON-CONFIGURABLE)
// ============================================

const STAGES: StageConfig[] = [
  { id: 'new_request', label: '1. New Request (0%)', weight: 0, colorClass: 'border-muted-foreground', barColor: 'bg-muted-foreground' },
  { id: 'qualification', label: '2. Qualification (25%)', weight: 0.25, colorClass: 'border-blue-500', barColor: 'bg-blue-500' },
  { id: 'negotiation', label: '3. Negotiation (50%)', weight: 0.50, colorClass: 'border-amber-500', barColor: 'bg-amber-500' },
  { id: 'approved', label: '4. Approved (90% - Gate)', weight: 0.90, colorClass: 'border-emerald-500', barColor: 'bg-emerald-500', gated: true },
  { id: 'booked', label: '5. Booked (100% - Locked)', weight: 1.0, colorClass: 'border-primary', barColor: 'bg-primary', locked: true },
];

// ============================================
// BACKEND INTEGRATION TYPES
// ============================================

interface TransitionRequest {
  cardId: string;
  fromStage: string;
  toStage: string;
}

// ============================================
// COMPONENT
// ============================================

export default function Pipeline() {
  const { toast } = useToast();
  
  // Role simulation for demo
  const [userRole, setUserRole] = useState<UserRole>('operator');
  
  // Drag state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  
  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [pendingBookingCard, setPendingBookingCard] = useState<PipelineCardData | null>(null);

  // Fetch pipeline cards from backend
  const { data: cards = [], isLoading, error } = useQuery<PipelineCardData[]>({
    queryKey: ['/api/pipeline/cards'],
  });

  // Stage transition mutation
  const transitionMutation = useMutation({
    mutationFn: async (data: TransitionRequest) => {
      const response = await apiRequest('POST', '/api/pipeline/transition', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/cards'] });
      toast({
        title: "Card Moved",
        description: "Pipeline card moved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Move Failed",
        description: error.message || "Failed to move card",
        variant: "destructive",
      });
    },
  });

  // ============================================
  // CALCULATIONS
  // ============================================

  const calculateWeightedValue = (value: number, stage: PipelineStage): number => {
    const stageConfig = STAGES.find(s => s.id === stage);
    return value * (stageConfig?.weight || 0);
  };

  const getStageTotal = (stageId: PipelineStage): number => {
    return cards
      .filter(c => c.status === stageId)
      .reduce((sum, c) => sum + calculateWeightedValue(c.totalValue, c.status), 0);
  };

  const totalPipelineForecast = useMemo(() => {
    return cards.reduce((sum, c) => sum + calculateWeightedValue(c.totalValue, c.status), 0);
  }, [cards]);

  const getStageCardCount = (stageId: PipelineStage): number => {
    return cards.filter(c => c.status === stageId).length;
  };

  // ============================================
  // STATE MACHINE LOGIC
  // ============================================

  const getStageIndex = (stage: PipelineStage): number => {
    return STAGES.findIndex(s => s.id === stage);
  };

  const isValidTransition = (
    currentStatus: PipelineStage,
    nextStatus: PipelineStage,
    hasEstimate: boolean,
    role: UserRole
  ): { allowed: boolean; reason?: string } => {
    // Booked is locked - no movement out
    if (currentStatus === 'booked') {
      return { allowed: false, reason: 'Booked jobs are locked and cannot be moved.' };
    }

    const currentIndex = getStageIndex(currentStatus);
    const nextIndex = getStageIndex(nextStatus);

    // No skipping stages forward
    if (nextIndex > currentIndex + 1) {
      return { allowed: false, reason: 'Cannot skip stages. Move one stage at a time.' };
    }

    // Negotiation -> Approved requires active estimate
    if (currentStatus === 'negotiation' && nextStatus === 'approved' && !hasEstimate) {
      return { allowed: false, reason: 'Active Estimate required for Approval stage.' };
    }

    // Only Operators can move to Booked
    if (nextStatus === 'booked' && role === 'sales') {
      return { allowed: false, reason: 'Only Operators can finalize bookings.' };
    }

    // Sales cannot move cards already in Approved
    if (currentStatus === 'approved' && role === 'sales') {
      return { allowed: false, reason: 'Sales role cannot move Approved cards.' };
    }

    return { allowed: true };
  };

  // ============================================
  // DRAG HANDLERS
  // ============================================

  const handleDragStart = (e: React.DragEvent, card: PipelineCardData) => {
    // Prevent dragging locked cards
    if (card.status === 'booked') {
      e.preventDefault();
      return;
    }
    
    // Prevent sales from dragging approved cards
    if (userRole === 'sales' && card.status === 'approved') {
      e.preventDefault();
      return;
    }

    setDraggedCardId(card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStageId: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedCardId) return;

    const card = cards.find(c => c.id === draggedCardId);
    if (!card) return;

    // Same stage - do nothing
    if (card.status === targetStageId) {
      setDraggedCardId(null);
      return;
    }

    const transition = isValidTransition(card.status, targetStageId, card.hasActiveEstimate, userRole);
    
    if (!transition.allowed) {
      toast({
        title: "Invalid Move",
        description: transition.reason,
        variant: "destructive",
      });
      setDraggedCardId(null);
      return;
    }

    // Special handling for Approved -> Booked (requires wizard)
    if (card.status === 'approved' && targetStageId === 'booked') {
      setPendingBookingCard(card);
      setIsWizardOpen(true);
      setDraggedCardId(null);
      return;
    }

    // Call backend to transition card
    transitionMutation.mutate({
      cardId: draggedCardId,
      fromStage: card.status,
      toStage: targetStageId,
    });

    setDraggedCardId(null);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      
      {/* VELOCITY DASHBOARD HEADER */}
      <header className="p-6 bg-card border-b border-border">
        <div className="max-w-full mx-auto w-full flex flex-col space-y-4">
          {/* Top Row: Title & Role Toggle */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-sm font-black text-muted-foreground uppercase tracking-widest">
                Revenue Forecasting & Pipeline Velocity
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Role Toggle for Demo */}
              <button
                onClick={() => setUserRole(userRole === 'operator' ? 'sales' : 'operator')}
                className="cursor-pointer px-4 py-1.5 bg-muted/50 border border-border rounded-full flex items-center space-x-2 hover:bg-muted transition-all"
              >
                <div className={`w-2 h-2 rounded-full ${userRole === 'operator' ? 'bg-primary' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Role: {userRole === 'operator' ? 'Operator (Full Authority)' : 'Sales (Restricted)'}
                </span>
              </button>
            </div>
          </div>

          {/* Forecast Display */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-foreground tracking-tight mb-4">
              Total Weighted Forecast: ${totalPipelineForecast.toLocaleString()}
            </span>
            
            {/* Velocity Bar */}
            <div className="w-full h-2 bg-muted rounded-full flex overflow-hidden mb-2">
              {STAGES.filter(s => s.id !== 'new_request').map((stage) => {
                const stageTotal = getStageTotal(stage.id);
                const width = totalPipelineForecast > 0 
                  ? (stageTotal / totalPipelineForecast) * 100 
                  : 0;
                return (
                  <div 
                    key={stage.id} 
                    className={`${stage.barColor} h-full transition-all`} 
                    style={{ width: `${width}%` }}
                  />
                );
              })}
            </div>

            {/* Stage Legend */}
            <div className="w-full flex justify-between px-1 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Qualification: ${getStageTotal('qualification').toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Negotiation: ${getStageTotal('negotiation').toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Approved: ${getStageTotal('approved').toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Booked: ${getStageTotal('booked').toLocaleString()}
                </span>
                <Lock className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* KANBAN BOARD */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex space-x-4 h-full min-w-max">
            {STAGES.map((stage) => (
              <div key={stage.id} className="w-[320px] flex flex-col h-full rounded-2xl border border-border/50 bg-transparent">
                <header className="px-4 py-3 border-b border-border rounded-t-2xl bg-card">
                  <Skeleton className="h-4 w-32" />
                </header>
                <div className="flex-1 p-3 space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-destructive/10 rounded-xl border border-destructive/20">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
              <p className="text-sm font-medium text-destructive">
                Failed to load pipeline data
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please refresh the page to try again
              </p>
            </div>
          </div>
        )}

        {/* Data State */}
        {!isLoading && !error && (
          <div className="flex space-x-4 h-full min-w-max">
            {STAGES.map((stage) => (
              <PipelineStageColumn
                key={stage.id}
                stage={stage}
                cards={cards}
                userRole={userRole}
                isDropTarget={dragOverStage === stage.id}
                draggedCardId={draggedCardId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onCardDragStart={handleDragStart}
              />
            ))}
          </div>
        )}
      </div>

      {/* CONVERSION WIZARD MODAL */}
      <BookingWizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setPendingBookingCard(null);
        }}
        card={pendingBookingCard}
      />
    </div>
  );
}
