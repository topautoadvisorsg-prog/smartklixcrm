import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Lock, AlertTriangle, X, Zap, User, Phone, Mail, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ============================================
// CONFIGURATION - FIXED STAGES (NON-CONFIGURABLE)
// ============================================

type PipelineStage = 'new_request' | 'qualification' | 'negotiation' | 'approved' | 'booked';
type UserRole = 'sales' | 'operator';

interface StageConfig {
  id: PipelineStage;
  label: string;
  weight: number;
  colorClass: string;
  barColor: string;
  locked?: boolean;
  gated?: boolean;
}

const STAGES: StageConfig[] = [
  { id: 'new_request', label: '1. New Request (0%)', weight: 0, colorClass: 'border-muted-foreground', barColor: 'bg-muted-foreground' },
  { id: 'qualification', label: '2. Qualification (25%)', weight: 0.25, colorClass: 'border-blue-500', barColor: 'bg-blue-500' },
  { id: 'negotiation', label: '3. Negotiation (50%)', weight: 0.50, colorClass: 'border-amber-500', barColor: 'bg-amber-500' },
  { id: 'approved', label: '4. Approved (90% - Gate)', weight: 0.90, colorClass: 'border-emerald-500', barColor: 'bg-emerald-500', gated: true },
  { id: 'booked', label: '5. Booked (100% - Locked)', weight: 1.0, colorClass: 'border-primary', barColor: 'bg-primary', locked: true },
];

// ============================================
// TYPES
// ============================================

interface PipelineCard {
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

interface WizardData {
  contactPhone: string;
  contactEmail: string;
  assignedTech: string;
  duration: string;
  depositReady: boolean;
}

// ============================================
// BACKEND INTEGRATION HOOKS
// ============================================
// TODO: When backend is ready, replace MOCK_CARDS with:
// const { data: cards, isLoading } = useQuery({
//   queryKey: ['/api/pipeline/cards'],
//   queryFn: () => apiRequest('/api/pipeline/cards'),
// });
//
// TODO: Stage transitions should call:
// const updateStageMutation = useMutation({
//   mutationFn: (data: { cardId: string; newStage: PipelineStage }) =>
//     apiRequest('/api/pipeline/transition', { method: 'POST', body: data }),
//   onSuccess: () => queryClient.invalidateQueries(['/api/pipeline/cards']),
// });
//
// TODO: Booking wizard commit should call:
// const commitBookingMutation = useMutation({
//   mutationFn: (data: BookingCommitPayload) =>
//     apiRequest('/api/pipeline/book', { method: 'POST', body: data }),
// });
// ============================================

// ============================================
// MOCK DATA (Approved for demonstration - see README)
// Backend/schema update will come later - do not block UI work on it
// ============================================

const MOCK_CARDS: PipelineCard[] = [
  { id: 'CRD-001', status: 'new_request', customerId: 'CON-001', customerName: 'Acme Corp', customerPhone: '+1 555-0101', customerEmail: 'contact@acme.com', jobTitle: 'HQ Retrofit', totalValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '2h ago', createdAt: '2024-01-20', ageDays: 2, hasActiveEstimate: false },
  { id: 'CRD-002', status: 'new_request', customerId: 'CON-002', customerName: 'TechStart Inc', customerPhone: '+1 555-0102', customerEmail: 'info@techstart.com', jobTitle: 'Office Setup', totalValue: 0, assignedUserName: 'Michael Gov', lastActivityAt: '5h ago', createdAt: '2024-01-19', ageDays: 3, hasActiveEstimate: false },
  { id: 'CRD-003', status: 'new_request', customerId: 'CON-003', customerName: 'Local Shop', jobTitle: 'AC Install', totalValue: 0, lastActivityAt: '1d ago', createdAt: '2024-01-18', ageDays: 4, hasActiveEstimate: false },
  
  { id: 'CRD-004', status: 'qualification', customerId: 'CON-004', customerName: 'Globex Corp', customerPhone: '+1 555-0104', customerEmail: 'projects@globex.com', jobTitle: 'Server Room Cooling', totalValue: 45000, assignedUserName: 'Sarah Arch', lastActivityAt: '1d ago', createdAt: '2024-01-15', ageDays: 7, hasActiveEstimate: true, estimateId: 'EST-001' },
  { id: 'CRD-005', status: 'qualification', customerId: 'CON-005', customerName: 'MegaMart', customerPhone: '+1 555-0105', jobTitle: 'Warehouse HVAC', totalValue: 78000, assignedUserName: 'Sarah Arch', lastActivityAt: '2d ago', createdAt: '2024-01-14', ageDays: 8, hasActiveEstimate: true, estimateId: 'EST-002' },
  { id: 'CRD-006', status: 'qualification', customerId: 'CON-006', customerName: 'City Hospital', jobTitle: 'Wing Renovation', totalValue: 125000, lastActivityAt: '3d ago', createdAt: '2024-01-10', ageDays: 12, hasActiveEstimate: false },

  { id: 'CRD-007', status: 'negotiation', customerId: 'CON-007', customerName: 'Soylent Inc', customerPhone: '+1 555-0107', jobTitle: 'Labs HVAC', totalValue: 0, assignedUserName: 'Michael Gov', lastActivityAt: '1d ago', createdAt: '2023-12-15', ageDays: 38, hasActiveEstimate: false },
  { id: 'CRD-008', status: 'negotiation', customerId: 'CON-008', customerName: 'Initech', customerPhone: '+1 555-0108', customerEmail: 'peter@initech.com', jobTitle: 'Office Expansion', totalValue: 120000, assignedUserName: 'Sarah Arch', lastActivityAt: 'Active', createdAt: '2024-01-10', ageDays: 11, hasActiveEstimate: true, estimateId: 'EST-003' },
  { id: 'CRD-009', status: 'negotiation', customerId: 'CON-009', customerName: 'Umbrella Corp', customerPhone: '+1 555-0109', jobTitle: 'Lab Climate Control', totalValue: 250000, assignedUserName: 'Sarah Arch', lastActivityAt: 'Active', createdAt: '2024-01-08', ageDays: 14, hasActiveEstimate: true, estimateId: 'EST-004' },

  { id: 'CRD-010', status: 'booked', customerId: 'CON-010', customerName: 'Wayne Enterprises', customerPhone: '+1 555-0110', customerEmail: 'alfred@wayne.com', jobTitle: 'Cave Lighting', totalValue: 500000, assignedUserName: 'Sarah Arch', lastActivityAt: '2d ago', createdAt: '2024-01-05', ageDays: 17, hasActiveEstimate: true, estimateId: 'EST-005' },
  { id: 'CRD-011', status: 'booked', customerId: 'CON-011', customerName: 'Stark Industries', customerPhone: '+1 555-0111', jobTitle: 'Arc Reactor Cooling', totalValue: 850000, assignedUserName: 'Sarah Arch', lastActivityAt: 'Job Created', createdAt: '2024-01-02', ageDays: 20, hasActiveEstimate: true, estimateId: 'EST-006' },
  { id: 'CRD-012', status: 'booked', customerId: 'CON-012', customerName: 'Oscorp', jobTitle: 'Lab Ventilation', totalValue: 320000, assignedUserName: 'Michael Gov', lastActivityAt: 'Job Created', createdAt: '2023-12-28', ageDays: 25, hasActiveEstimate: true, estimateId: 'EST-007' },
];

// ============================================
// COMPONENT
// ============================================

export default function Pipeline() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Role simulation for demo
  const [userRole, setUserRole] = useState<UserRole>('operator');
  
  // Drag state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  
  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [pendingBookingCard, setPendingBookingCard] = useState<PipelineCard | null>(null);
  const [wizardData, setWizardData] = useState<WizardData>({
    contactPhone: '',
    contactEmail: '',
    assignedTech: '',
    duration: '',
    depositReady: false,
  });
  const [isCommitting, setIsCommitting] = useState(false);
  
  // Data state (using mock for now)
  const [cards, setCards] = useState<PipelineCard[]>(MOCK_CARDS);

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

  const handleDragStart = (e: React.DragEvent, card: PipelineCard) => {
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
      setWizardData({
        contactPhone: card.customerPhone || '',
        contactEmail: card.customerEmail || '',
        assignedTech: card.assignedUserName || '',
        duration: '',
        depositReady: false,
      });
      setWizardStep(1);
      setIsWizardOpen(true);
      setDraggedCardId(null);
      return;
    }

    // Optimistic update for non-booked transitions
    setCards(prev => prev.map(c => 
      c.id === draggedCardId ? { ...c, status: targetStageId } : c
    ));
    
    toast({
      title: "Card Moved",
      description: `Moved to ${STAGES.find(s => s.id === targetStageId)?.label}`,
    });

    setDraggedCardId(null);
  };

  // ============================================
  // WIZARD HANDLERS
  // ============================================

  const handleWizardNext = () => {
    if (wizardStep < 4) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
    }
  };

  const handleCommitBooking = async () => {
    if (!pendingBookingCard) return;

    setIsCommitting(true);

    // Simulate backend confirmation (non-optimistic)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // On success, move the card
      setCards(prev => prev.map(c => 
        c.id === pendingBookingCard.id ? { ...c, status: 'booked' } : c
      ));

      toast({
        title: "Booking Committed",
        description: `Job created for ${pendingBookingCard.customerName}. This action is irreversible.`,
      });

      setIsWizardOpen(false);
      setPendingBookingCard(null);
      setWizardStep(1);
    } catch (error) {
      toast({
        title: "Booking Failed",
        description: "Failed to create job. Card remains in Approved.",
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCancelWizard = () => {
    setIsWizardOpen(false);
    setPendingBookingCard(null);
    setWizardStep(1);
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
        <div className="flex space-x-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const stageCards = cards.filter(c => c.status === stage.id);
            const isDropTarget = dragOverStage === stage.id;
            
            return (
              <div
                key={stage.id}
                className={`w-[320px] flex flex-col h-full rounded-2xl border transition-colors ${
                  isDropTarget 
                    ? 'bg-accent border-primary/50' 
                    : 'bg-transparent border-border/50'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
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
                      {getStageCardCount(stage.id)}
                    </span>
                    {stage.locked && <Lock className="w-3 h-3 text-primary" />}
                  </div>
                </header>

                {/* Cards Area */}
                <div className={`flex-1 p-3 space-y-3 overflow-y-auto ${
                  stage.gated ? 'bg-muted/20' : ''
                }`}>
                  {/* Gated Empty State */}
                  {stageCards.length === 0 && stage.gated && (
                    <div className="h-32 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-center p-4 opacity-50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        Gate Empty • Waiting for Approval
                      </p>
                    </div>
                  )}

                  {/* Cards */}
                  {stageCards.map(card => {
                    const isStale = card.ageDays > 30;
                    const isLocked = card.status === 'booked';
                    const canDrag = !(isLocked || (userRole === 'sales' && card.status === 'approved'));
                    const stageConfig = STAGES.find(s => s.id === card.status);

                    return (
                      <div
                        key={card.id}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, card)}
                        className={`group relative bg-card rounded-lg p-4 border border-border hover:border-muted-foreground/50 transition-all shadow-sm ${
                          isStale ? 'opacity-50' : ''
                        } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} ${
                          draggedCardId === card.id ? 'opacity-50' : ''
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
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONVERSION WIZARD MODAL */}
      <Dialog open={isWizardOpen} onOpenChange={(open) => !open && handleCancelWizard()}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">
              Finalize Booking & Transition Gate
            </DialogTitle>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
              Step {wizardStep} of 4: {
                wizardStep === 1 ? 'Validate Contact Info' :
                wizardStep === 2 ? 'Confirm Scope (Read-Only)' :
                wizardStep === 3 ? 'Assign Technician & Duration' :
                'Verify Payment Readiness'
              }
            </span>
            <div className="flex-1 h-1 bg-muted rounded-full">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(wizardStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {pendingBookingCard && (
            <>
              {/* Step 1: Contact Validation */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                    <div className="flex items-center space-x-2 text-xs">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-bold">Client:</span>
                      <span className="text-foreground font-bold">{pendingBookingCard.customerName}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                        Phone Number
                      </Label>
                      <Input
                        value={wizardData.contactPhone}
                        onChange={(e) => setWizardData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        placeholder="+1 555-0000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                        Email Address
                      </Label>
                      <Input
                        value={wizardData.contactEmail}
                        onChange={(e) => setWizardData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        placeholder="contact@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Scope Confirmation (Read-Only) */}
              {wizardStep === 2 && (
                <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Client:</span>
                    <span className="text-foreground font-bold">{pendingBookingCard.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Estimate ID:</span>
                    <span className="text-foreground font-bold">
                      {pendingBookingCard.estimateId || 'N/A'} (Active)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Total Value:</span>
                    <span className="text-foreground font-black">
                      ${pendingBookingCard.totalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Job Title:</span>
                    <span className="text-foreground font-medium">{pendingBookingCard.jobTitle}</span>
                  </div>
                </div>
              )}

              {/* Step 3: Assign Tech & Duration */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Assigned Technician
                    </Label>
                    <Select 
                      value={wizardData.assignedTech} 
                      onValueChange={(val) => setWizardData(prev => ({ ...prev, assignedTech: val }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select technician..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sarah Arch">Sarah Arch</SelectItem>
                        <SelectItem value="Michael Gov">Michael Gov</SelectItem>
                        <SelectItem value="John Smith">John Smith</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Estimated Duration
                    </Label>
                    <Select 
                      value={wizardData.duration} 
                      onValueChange={(val) => setWizardData(prev => ({ ...prev, duration: val }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select duration..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 day">1 Day</SelectItem>
                        <SelectItem value="2-3 days">2-3 Days</SelectItem>
                        <SelectItem value="1 week">1 Week</SelectItem>
                        <SelectItem value="2 weeks">2 Weeks</SelectItem>
                        <SelectItem value="1 month">1 Month+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Readiness */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold">Total Value:</span>
                      <span className="text-foreground font-black">
                        ${pendingBookingCard.totalValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold">Deposit Required:</span>
                      <span className="text-foreground font-bold">
                        ${(pendingBookingCard.totalValue * 0.25).toLocaleString()} (25%)
                      </span>
                    </div>
                  </div>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardData.depositReady}
                      onChange={(e) => setWizardData(prev => ({ ...prev, depositReady: e.target.checked }))}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground">
                      Deposit received or payment terms confirmed
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {/* Wizard Actions */}
          <div className="flex space-x-3 mt-6">
            {wizardStep > 1 && (
              <Button variant="outline" onClick={handleWizardBack} disabled={isCommitting}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={handleCancelWizard} disabled={isCommitting}>
              Cancel
            </Button>
            
            {wizardStep < 4 ? (
              <Button onClick={handleWizardNext} className="flex-1">
                Next Step
              </Button>
            ) : (
              <Button 
                onClick={handleCommitBooking} 
                disabled={isCommitting || !wizardData.depositReady}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isCommitting ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    COMMIT BOOKING (Irreversible)
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-[9px] text-muted-foreground mt-4 text-center leading-relaxed">
            This action triggers a ledger event and creates an operational Job record. Cannot be undone.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
