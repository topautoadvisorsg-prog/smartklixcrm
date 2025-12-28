
import React, { useState, useMemo } from 'react';
import { PipelineCard, PipelineStage } from '../../types';

// --- CONFIGURATION ---

const STAGES: { id: PipelineStage; label: string; color: string; barColor: string; weight: number; locked?: boolean; gated?: boolean }[] = [
  { id: 'new_request', label: '1. New Request (0%)', color: 'border-zinc-500', barColor: 'bg-zinc-500', weight: 0 },
  { id: 'qualification', label: '2. Qualification (25%)', color: 'border-blue-500', barColor: 'bg-blue-500', weight: 0.25 },
  { id: 'negotiation', label: '3. Negotiation (50%)', color: 'border-amber-500', barColor: 'bg-amber-500', weight: 0.50 },
  { id: 'approved', label: '4. Approved (90% - Gate)', color: 'border-emerald-500', barColor: 'bg-emerald-500', weight: 0.90, gated: true },
  { id: 'booked', label: '5. Booked (100% - Locked)', color: 'border-zinc-700', barColor: 'bg-zinc-700', weight: 1.0, locked: true },
];

type UserRole = 'sales' | 'operator';

// --- COMPONENT ---

const Pipeline: React.FC = () => {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  
  // Role Simulation for Demo
  const [userRole, setUserRole] = useState<UserRole>('operator');

  // Drag State
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(2); // Start at 2 to match mock-up for demo
  const [pendingBookingCardId, setPendingBookingCardId] = useState<string | null>(null);

  // Data State
  const [cards, setCards] = useState<PipelineCard[]>([
    { id: 'CRD-001', status: 'new_request', customerId: 'CON-001', customerName: 'Acme Corp', jobTitle: 'HQ Retrofit', totalValue: 0, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '2h ago', createdAt: '2023-11-20', viewed: false, signed: false, ageDays: 0, hasActiveEstimate: false, metaData: {} },
    { id: 'CRD-002', status: 'new_request', customerId: 'CON-001', customerName: 'Acme Corp', jobTitle: 'HQ Retrofit', totalValue: 0, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '2h ago', createdAt: '2023-11-20', viewed: false, signed: false, ageDays: 0, hasActiveEstimate: false, metaData: {} },
    { id: 'CRD-003', status: 'new_request', customerId: 'CON-001', customerName: 'Acme Corp', jobTitle: 'HQ Retrofit', totalValue: 0, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '2h ago', createdAt: '2023-11-20', viewed: false, signed: false, ageDays: 0, hasActiveEstimate: false, metaData: {} },
    
    { id: 'CRD-004', status: 'qualification', customerId: 'CON-002', customerName: 'Globex', jobTitle: 'Server Room Cooling', totalValue: 45000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '1d ago', createdAt: '2023-11-15', viewed: true, signed: false, ageDays: 5, hasActiveEstimate: true, metaData: {} },
    { id: 'CRD-005', status: 'qualification', customerId: 'CON-002', customerName: 'Globex', jobTitle: 'Server Room', totalValue: 45000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '1d ago', createdAt: '2023-11-15', viewed: true, signed: false, ageDays: 5, hasActiveEstimate: true, metaData: {} },
    { id: 'CRD-006', status: 'qualification', customerId: 'CON-002', customerName: 'Globex', jobTitle: 'Server Room Cooling', totalValue: 45000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '1d ago', createdAt: '2023-11-15', viewed: true, signed: false, ageDays: 5, hasActiveEstimate: true, metaData: {} },

    { id: 'CRD-007', status: 'negotiation', customerId: 'CON-003', customerName: 'Soylent Inc', jobTitle: 'Labs', totalValue: 0, weightedValue: 0, assignedUserId: 'USR-02', assignedUserName: 'Michael Gov', lastActivityAt: '1d ago', createdAt: '2023-10-15', viewed: false, signed: false, ageDays: 38, hasActiveEstimate: false, metaData: {} }, // Warning
    { id: 'CRD-008', status: 'negotiation', customerId: 'CON-004', customerName: 'Initech', jobTitle: 'Office Expansion', totalValue: 120000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: 'Active', createdAt: '2023-11-10', viewed: true, signed: false, ageDays: 11, hasActiveEstimate: true, metaData: {} },
    { id: 'CRD-009', status: 'negotiation', customerId: 'CON-004', customerName: 'Initech', jobTitle: 'Office Expansion', totalValue: 120000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: 'Active', createdAt: '2023-11-10', viewed: true, signed: false, ageDays: 11, hasActiveEstimate: true, metaData: {} },

    // Approved is empty for demo to show drop zone
    
    { id: 'CRD-010', status: 'booked', customerId: 'CON-005', customerName: 'Wayne Enterprises', jobTitle: 'Cave Lighting', totalValue: 500000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '2d ago', createdAt: '2023-10-20', viewed: true, signed: true, ageDays: 1, hasActiveEstimate: true, metaData: {} },
    { id: 'CRD-011', status: 'booked', customerId: 'CON-005', customerName: 'Wayne Enterprises', jobTitle: 'Cave Lighting', totalValue: 500000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '24 Created', createdAt: '2023-10-20', viewed: true, signed: true, ageDays: 1, hasActiveEstimate: true, metaData: {} },
    { id: 'CRD-012', status: 'booked', customerId: 'CON-005', customerName: 'Wayne Enterprises', jobTitle: 'Cave Lighting', totalValue: 500000.00, weightedValue: 0, assignedUserId: 'USR-01', assignedUserName: 'Sarah Arch', lastActivityAt: '24 Created', createdAt: '2023-10-20', viewed: true, signed: true, ageDays: 1, hasActiveEstimate: true, metaData: {} },
  ]);

  // --- LOGIC: FORECASTING ---

  const calculateWeightedValue = (value: number, stage: PipelineStage) => {
    const stageConfig = STAGES.find(s => s.id === stage);
    return value * (stageConfig?.weight || 0);
  };

  const getStageTotal = (stageId: string) => {
    return cards
      .filter(c => c.status === stageId)
      .reduce((sum, c) => sum + calculateWeightedValue(c.totalValue, c.status), 0);
  };

  const totalPipelineForecast = useMemo(() => {
    return cards.reduce((sum, c) => sum + calculateWeightedValue(c.totalValue, c.status), 0);
  }, [cards]);

  const getTotalPipelineValue = () => {
     return cards.reduce((sum, c) => sum + c.totalValue, 0);
  };

  // --- LOGIC: STATE MACHINE ---

  const isValidTransition = (currentStatus: PipelineStage, nextStatus: PipelineStage, hasEstimate: boolean): { allowed: boolean; reason?: string } => {
    if (currentStatus === 'booked') return { allowed: false, reason: 'Booked jobs are locked.' };
    const currentIndex = STAGES.findIndex(s => s.id === currentStatus);
    const nextIndex = STAGES.findIndex(s => s.id === nextStatus);
    if (nextIndex > currentIndex + 1) return { allowed: false, reason: 'Cannot skip stages.' };
    if (nextStatus === 'approved' && !hasEstimate) return { allowed: false, reason: 'Active Estimate required for Approval.' };
    return { allowed: true };
  };

  const handleDragStart = (e: React.DragEvent, card: PipelineCard) => {
    if (userRole === 'sales' && card.status === 'approved') {
      e.preventDefault();
      return;
    }
    if (card.status === 'booked') {
        e.preventDefault();
        return;
    }
    setDraggedCardId(card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStageId: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedCardId) return;

    const card = cards.find(c => c.id === draggedCardId);
    if (!card) return;

    const transition = isValidTransition(card.status, targetStageId, card.hasActiveEstimate);
    if (!transition.allowed) {
        alert(`Invalid Move: ${transition.reason}`);
        setDraggedCardId(null);
        return;
    }

    if (card.status === 'approved' && targetStageId === 'booked') {
        setPendingBookingCardId(card.id);
        setWizardStep(2); // Jump to step 2 for demo match
        setIsWizardOpen(true);
        setDraggedCardId(null);
        return;
    }

    setCards(prev => prev.map(c => c.id === draggedCardId ? { ...c, status: targetStageId } : c));
    setDraggedCardId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden relative">
      
      {/* HEADER: Velocity Dashboard */}
      <header className="p-6 bg-zinc-900 border-b border-zinc-800 z-20">
        <div className="max-w-full mx-auto w-full flex flex-col space-y-4">
          <div className="flex justify-between items-start">
             <div>
               <h1 className="text-sm font-black text-zinc-300 uppercase tracking-widest">Revenue Forecasting & Pipeline Velocity</h1>
             </div>
             <div className="flex items-center space-x-4">
               {/* Role Toggle for Demo */}
               <div onClick={() => setUserRole(userRole === 'operator' ? 'sales' : 'operator')} className="cursor-pointer px-4 py-1.5 bg-slate-800/50 border border-slate-700 rounded-full flex items-center space-x-2 hover:bg-slate-800 transition-all">
                  <div className={`w-2 h-2 rounded-full ${userRole === 'operator' ? 'bg-indigo-500' : 'bg-amber-500'}`}></div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Role: {userRole === 'operator' ? 'Operator (Full Authority)' : 'Sales (Restricted)'}</span>
               </div>
             </div>
          </div>

          <div className="flex flex-col items-center justify-center -mt-2">
             <span className="text-3xl font-black text-zinc-100 tracking-tight mb-4">Total Weighted Forecast: ${totalPipelineForecast.toLocaleString()}</span>
             
             {/* Velocity Bar */}
             <div className="w-full h-2 bg-zinc-800 rounded-full flex overflow-hidden mb-2 relative">
                {STAGES.map((stage) => {
                   const val = getStageTotal(stage.id);
                   const width = (val / (totalPipelineForecast || 1)) * 100; // Simplified for demo visual
                   // Mocking visuals for the specific screenshot look if values are 0
                   const mockWidth = stage.id === 'qualification' ? '25%' : stage.id === 'negotiation' ? '30%' : stage.id === 'approved' ? '25%' : '0%';
                   return (
                      <div key={stage.id} className={`${stage.barColor} h-full`} style={{ width: val > 0 ? `${width}%` : mockWidth }}></div>
                   )
                })}
             </div>
             <div className="w-full flex justify-between px-1">
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Qualification (25%): $210k</span>
                </div>
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Negotiation (50%): $450k</span>
                </div>
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Approved (90%): $585k</span>
                </div>
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-zinc-600 rounded-full"></div>
                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Booked (Finalized): $3.2M YTD</span>
                   <svg className="w-3 h-3 text-zinc-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                </div>
             </div>
          </div>
        </div>
      </header>

      {/* BOARD */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex space-x-4 h-full min-w-max">
            {STAGES.map((stage) => {
               const stageCards = cards.filter(c => c.status === stage.id);
               return (
              <div 
                key={stage.id} 
                className={`w-[320px] flex flex-col h-full rounded-2xl border transition-colors ${dragOverStage === stage.id ? 'bg-zinc-900 border-indigo-500/50' : 'bg-transparent border-zinc-800/50'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column Header */}
                <header className={`px-4 py-3 border-b border-zinc-800 rounded-t-2xl flex justify-between items-center ${stage.locked ? 'bg-amber-950/20' : 'bg-zinc-900'}`}>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${stage.locked ? 'text-amber-500' : 'text-zinc-300'}`}>
                     {stage.label}
                  </span>
                  {stage.locked && <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
                </header>
                
                <div className={`flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar ${stage.gated ? 'bg-[url("https://www.transparenttextures.com/patterns/carbon-fibre.png")] bg-zinc-950/50' : ''}`}>
                   
                   {/* Gated Empty State */}
                   {stageCards.length === 0 && stage.gated && (
                      <div className="h-32 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-center p-4 opacity-50">
                         <p className="text-[10px] font-bold text-zinc-600 uppercase">Gate Empty • Waiting for Approval</p>
                      </div>
                   )}

                   {stageCards.map(card => {
                      const isStale = card.ageDays > 30;
                      const isLocked = card.status === 'booked';
                      const canDrag = !(isLocked || (userRole === 'sales' && card.status === 'approved'));

                      return (
                      <div 
                        key={card.id} 
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, card)}
                        className={`group relative bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-600 transition-all shadow-lg ${isStale ? 'opacity-60 grayscale' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'}`}
                      >
                         {/* Color Bar */}
                         <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-lg ${stage.id === 'negotiation' && !card.hasActiveEstimate ? 'bg-amber-500' : stage.barColor.replace('bg-', 'bg-')}`}></div>
                         
                         <div className="pl-3">
                            {/* Missing Estimate Warning */}
                            {!card.hasActiveEstimate && stage.id !== 'new_request' && (
                               <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded mb-3">
                                  <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">Missing Active Estimate</span>
                               </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                               <div>
                                  <h4 className="text-xs font-black text-zinc-100">{card.customerName} - {card.jobTitle}</h4>
                               </div>
                            </div>

                            <div className="space-y-1 mb-4">
                               <p className="text-[11px] font-bold text-zinc-400">
                                  {card.totalValue > 0 ? `$${card.totalValue.toLocaleString()} ${stage.id === 'booked' ? 'Booked' : 'Est.'}` : '$0 Est.'}
                               </p>
                               <p className="text-[9px] text-zinc-600 font-mono">{card.lastActivityAt}</p>
                            </div>

                            {/* Hover Details (Implicit in React structure, represented by footer here) */}
                            <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
                               <div className="flex items-center space-x-1">
                                  {stage.id === 'negotiation' ? (
                                     <div className="text-[8px] font-bold text-zinc-500">Active</div>
                                  ) : (
                                     <svg className="w-3 h-3 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  )}
                               </div>
                               {/* Mock Avatar */}
                               {card.assignedUserName && (
                                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                                     <img src={`https://ui-avatars.com/api/?name=${card.assignedUserName}&background=3f3f46&color=fff&size=32`} alt="User" className="w-full h-full object-cover" />
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>
                   )})}
                </div>
              </div>
            )})}
          </div>
      </div>

      {/* CONVERSION WIZARD (High Fidelity) */}
      {isWizardOpen && pendingBookingCardId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in zoom-in duration-200">
           <div className="bg-[#121214]/90 backdrop-blur-xl border border-zinc-700 w-full max-w-lg rounded-2xl shadow-2xl relative flex flex-col overflow-hidden ring-1 ring-white/10">
              
              {/* Tooltip-style Arrow (Visual flourish to match image intent) */}
              <div className="absolute -left-2 top-1/2 w-4 h-4 bg-[#121214] border-l border-b border-zinc-700 transform rotate-45"></div>

              <div className="p-6">
                 <h3 className="text-xl font-bold text-white mb-1">Finalize Booking & Transition Gate</h3>
                 
                 {/* Progress Bar */}
                 <div className="flex items-center space-x-2 mb-6">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Step {wizardStep} of 4: Confirm Scope (Read-Only)</span>
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full flex">
                       <div className="w-1/2 h-full bg-blue-500 rounded-full"></div>
                    </div>
                 </div>

                 <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-3 mb-6">
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-zinc-500 font-bold">Client:</span>
                       <span className="text-zinc-200 font-bold">Stark Industries</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-zinc-500 font-bold">Estimate ID:</span>
                       <span className="text-zinc-200 font-bold">#EST-9942 (Active)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-zinc-500 font-bold">Total Value:</span>
                       <span className="text-zinc-200 font-black">$850,000</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-zinc-500 font-bold">Scope Summary:</span>
                       <span className="text-zinc-200 font-medium">4x Units, 2wk Install</span>
                    </div>
                 </div>

                 <div className="flex space-x-3">
                    <button 
                       onClick={() => setIsWizardOpen(false)}
                       className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-bold uppercase tracking-wide hover:text-white hover:bg-zinc-800 transition-all"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={() => {
                          setCards(prev => prev.map(c => c.id === pendingBookingCardId ? { ...c, status: 'booked' } : c));
                          setIsWizardOpen(false);
                       }}
                       className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center space-x-2"
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       <span>COMMIT BOOKING (Irreversible Job Creation)</span>
                    </button>
                 </div>
                 
                 <p className="text-[9px] text-zinc-600 mt-4 text-center leading-relaxed">
                    Action triggers ledger event and creates operational Job record. Cannot be undone.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Pipeline;
