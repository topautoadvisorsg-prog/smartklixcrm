
import React, { useState } from 'react';

interface ValidationStep {
  label: string;
  status: 'pending' | 'active' | 'passed' | 'failed';
}

interface Proposal {
  id: string;
  origin: string;
  summary: string;
  details: string;
  steps: ValidationStep[];
  status: 'in_validation' | 'approved' | 'rejected';
  timestamp: string;
}

interface LedgerEntry {
  time: string;
  id: string;
  result: 'APPROVED' | 'REJECTED';
  reason: string;
}

const ReviewQueue: React.FC = () => {
  // Mock Data matching the visual reference
  const proposals: Proposal[] = [
    {
      id: 'PROP-2024-10-26-A1B2',
      origin: 'ActionAI CRM',
      summary: 'Update CRM Record: Lead Status → Qualified, Discount → 5%',
      details: 'Automated progression based on engagement score > 80.',
      steps: [
        { label: 'Logic Check', status: 'passed' },
        { label: 'Schema Check', status: 'passed' },
        { label: 'Policy Compliance', status: 'active' },
      ],
      status: 'in_validation',
      timestamp: '2024-10-26 09:15:02 UTC'
    },
    {
      id: 'PROP-2024-10-26-C3D4',
      origin: 'ActionAI CRM',
      summary: 'Create New Opportunity: "Project Alpha", Value: $50k',
      details: 'Ingress from GHL Form #991.',
      steps: [
        { label: 'Logic Check', status: 'passed' },
        { label: 'Schema Check', status: 'passed' },
        { label: 'Policy Compliance', status: 'passed' },
      ],
      status: 'approved',
      timestamp: '2024-10-25 09:14:45 UTC'
    },
    {
      id: 'PROP-2024-10-26-E5F6',
      origin: 'ActionAI CRM',
      summary: 'Delete Account: "Inactive Client X"',
      details: 'Purge request triggered by stale data policy.',
      steps: [
        { label: 'Logic Check', status: 'passed' },
        { label: 'Schema Check', status: 'passed' },
        { label: 'Policy Compliance', status: 'failed' },
      ],
      status: 'rejected',
      timestamp: '2024-10-26 09:13:22 UTC'
    },
    {
      id: 'PROP-2024-10-26-G7H8',
      origin: 'ActionAI CRM',
      summary: 'Update Contact: "Jane Doe", Title: "Director"',
      details: 'Enrichment from LinkedIn scraper node.',
      steps: [
        { label: 'Logic Check', status: 'passed' },
        { label: 'Schema Check', status: 'active' },
        { label: 'Policy Compliance', status: 'pending' },
      ],
      status: 'in_validation',
      timestamp: '2024-10-26 09:15:10 UTC'
    }
  ];

  const ledger: LedgerEntry[] = [
    { time: '09:15:373', id: 'PROP-2024-10-26-A1B2', result: 'APPROVED', reason: 'Policy Check Passed' },
    { time: '09:15:371', id: 'PROP-2024-10-26-C3D4', result: 'APPROVED', reason: 'Policy Check Passed' },
    { time: '09:15:321', id: 'PROP-2024-10-26-E5F6', result: 'REJECTED', reason: 'Policy Violation - Data Retention Rule' },
    { time: '09:13:321', id: 'PROP-2024-10-26-G7H8', result: 'APPROVED', reason: 'Policy Check Passed' },
    { time: '09:12:112', id: 'PROP-2024-10-26-K9L0', result: 'APPROVED', reason: 'Schema Validation OK' },
    { time: '09:11:005', id: 'PROP-2024-10-26-M1N2', result: 'REJECTED', reason: 'Logic Check Failed: Circular Reference' },
  ];

  const renderStep = (step: ValidationStep, index: number, total: number) => {
    let colorClass = 'bg-zinc-800 border-zinc-700 text-zinc-500'; // Pending
    if (step.status === 'passed') colorClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    if (step.status === 'active') colorClass = 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)]';
    if (step.status === 'failed') colorClass = 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]';

    return (
      <div key={index} className={`flex-1 flex items-center justify-center py-2 px-1 border-b-2 ${step.status === 'pending' ? 'border-zinc-800' : step.status === 'active' ? 'border-amber-500' : step.status === 'failed' ? 'border-red-500' : 'border-emerald-500'} mx-1 first:ml-0 last:mr-0`}>
        <div className="flex flex-col items-center">
           {step.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mb-1 animate-ping"></div>}
           <span className={`text-[9px] font-black uppercase tracking-tight ${step.status === 'passed' ? 'text-emerald-500' : step.status === 'failed' ? 'text-red-500' : step.status === 'active' ? 'text-amber-500' : 'text-zinc-600'}`}>
             {step.label}
           </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 overflow-hidden font-sans relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[150px] rounded-full"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="p-8 border-b border-white/5 bg-black/20 backdrop-blur-xl z-20 flex justify-between items-start">
        <div className="flex items-center space-x-6">
           <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-900 flex items-center justify-center shadow-2xl border border-white/10">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <div>
              <h1 className="text-3xl font-bold tracking-tighter text-white mb-2">Review Queue <span className="text-zinc-500 font-medium">(AI Governance Layer)</span></h1>
              <div className="flex items-center space-x-3">
                 <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse"></div>
                 <span className="text-xs font-mono text-blue-400 font-bold tracking-widest uppercase">Master Architect AI: Active | Passive Observability Mode</span>
              </div>
           </div>
        </div>
        <div className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(239,68,68,0.1)]">
           System Controlled | Read-Only Access
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden z-10 p-8 space-x-8">
         
         {/* LEFT: THE QUEUE */}
         <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
               <div className="col-span-2">Proposal ID</div>
               <div className="col-span-2">Origin</div>
               <div className="col-span-3">Summary</div>
               <div className="col-span-3 text-center">Validation Progress (Master Architect)</div>
               <div className="col-span-2 text-right">Status</div>
            </div>

            {proposals.map((prop) => (
               <div key={prop.id} className="group relative">
                  {/* Card Glow */}
                  <div className={`absolute -inset-0.5 rounded-[1.5rem] blur opacity-20 transition duration-1000 group-hover:opacity-40 ${
                     prop.status === 'approved' ? 'bg-emerald-500' : prop.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                  }`}></div>
                  
                  <div className="relative bg-zinc-900/80 border border-white/5 rounded-[1.2rem] p-6 grid grid-cols-12 gap-4 items-center shadow-xl backdrop-blur-sm transition-all hover:bg-zinc-900">
                     <div className="col-span-2 font-mono text-[11px] text-zinc-400 font-bold tracking-tight">{prop.id}</div>
                     <div className="col-span-2 text-[11px] font-bold text-zinc-300">{prop.origin}</div>
                     <div className="col-span-3">
                        <div className="text-[12px] font-bold text-white leading-tight">{prop.summary}</div>
                        <div className="text-[10px] text-zinc-500 mt-1 italic">{prop.details}</div>
                     </div>
                     
                     {/* Stepper */}
                     <div className="col-span-3 flex items-center bg-black/40 rounded-lg p-2 border border-white/5">
                        {prop.steps.map((step, i) => renderStep(step, i, prop.steps.length))}
                     </div>

                     <div className="col-span-2 flex flex-col items-end justify-center space-y-2">
                        {prop.status === 'in_validation' && (
                           <div className="flex items-center space-x-2 text-amber-500">
                              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-[10px] font-black uppercase tracking-widest">In Validation</span>
                           </div>
                        )}
                        {prop.status === 'approved' && (
                           <div className="flex flex-col items-end">
                              <div className="flex items-center space-x-2 text-emerald-500">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Approved</span>
                              </div>
                              <span className="text-[9px] text-emerald-500/60 font-bold uppercase tracking-wide mt-0.5">&gt; Moving to Ready</span>
                           </div>
                        )}
                        {prop.status === 'rejected' && (
                           <div className="flex flex-col items-end">
                              <div className="flex items-center space-x-2 text-red-500">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Rejected</span>
                              </div>
                              <span className="text-[9px] text-red-500/60 font-bold uppercase tracking-wide mt-0.5">&gt; Returned to Source</span>
                           </div>
                        )}
                        <div className="text-[9px] font-mono text-zinc-600">{prop.timestamp.split(' ')[0]}</div>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* RIGHT: LEDGER */}
         <div className="w-[350px] bg-zinc-900/50 border border-white/10 rounded-[1.5rem] flex flex-col overflow-hidden backdrop-blur-md">
            <header className="p-5 border-b border-white/5 bg-white/5">
               <h3 className="text-xs font-black text-zinc-300 uppercase tracking-widest">System Activity Ledger</h3>
               <p className="text-[9px] text-zinc-600 font-mono mt-1">(AI_REVIEW_DECISION)</p>
            </header>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
               {ledger.map((entry, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                     <div className="flex flex-col items-center space-y-1 pt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                        <div className="w-0.5 h-full bg-zinc-800"></div>
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-[9px] font-mono text-zinc-500">{entry.time}</span>
                           <div className="w-4 h-4 rounded bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                              <span className="text-[8px] font-black text-indigo-400">AI</span>
                           </div>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 font-bold truncate mb-1">
                           {entry.id}
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-wider ${entry.result === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'}`}>
                           {entry.result}: <span className="text-zinc-500 font-bold normal-case">{entry.reason}</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

      </div>
    </div>
  );
};

export default ReviewQueue;
