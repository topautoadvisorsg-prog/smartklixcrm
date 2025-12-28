
import React, { useState } from 'react';

// Defines the strict event types allowed in the Ledger
type LedgerEventType = 
  | 'AI_PROPOSAL_CREATED' 
  | 'AI_REVIEW_DECISION' 
  | 'HUMAN_EXECUTION_DECISION'
  | 'SYSTEM_INGRESS_LOG';

interface LedgerEvent {
  id: string;
  traceId: string; // The link that binds the chain
  eventType: LedgerEventType;
  actor: string;
  details: string;
  timestamp: string;
  integrityHash: string;
  metadata?: Record<string, string>;
}

const AutomationLedger: React.FC = () => {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // Mock Data: Showing 2 distinct workflows (Trace Chains)
  // Workflow 1: Invoice Generation (Completed)
  // Workflow 2: Email Campaign (In Governance)
  const events: LedgerEvent[] = [
    // --- Trace 9901 (Completed Invoice Flow) ---
    { 
      id: 'EVT-1003', traceId: 'TRC-9901', eventType: 'HUMAN_EXECUTION_DECISION', 
      actor: 'Sarah Architect', details: 'Manual Release Triggered: Invoice #9021', 
      timestamp: '2023-11-21 09:15:22', integrityHash: '0x99A...' 
    },
    { 
      id: 'EVT-1002', traceId: 'TRC-9901', eventType: 'AI_REVIEW_DECISION', 
      actor: 'Master Architect', details: 'Policy Check Passed: Financial Cap < $5k', 
      timestamp: '2023-11-21 09:10:00', integrityHash: '0x88B...' 
    },
    { 
      id: 'EVT-1001', traceId: 'TRC-9901', eventType: 'AI_PROPOSAL_CREATED', 
      actor: 'ActionAI CRM', details: 'Generated Invoice Draft based on Job #JOB-8842', 
      timestamp: '2023-11-21 09:09:45', integrityHash: '0x77C...' 
    },

    // --- Trace 9902 (Rejected Campaign Flow) ---
    { 
      id: 'EVT-2002', traceId: 'TRC-9902', eventType: 'AI_REVIEW_DECISION', 
      actor: 'Master Architect', details: 'REJECTED: Tone violation in email body (Policy #T-22)', 
      timestamp: '2023-11-20 14:05:00', integrityHash: '0x22D...' 
    },
    { 
      id: 'EVT-2001', traceId: 'TRC-9902', eventType: 'AI_PROPOSAL_CREATED', 
      actor: 'ActionAI CRM', details: 'Drafted Drip Campaign: "Q4 Outreach"', 
      timestamp: '2023-11-20 14:02:11', integrityHash: '0x11E...' 
    },
  ];

  const getEventColor = (type: LedgerEventType) => {
    switch (type) {
      case 'AI_PROPOSAL_CREATED': return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
      case 'AI_REVIEW_DECISION': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'HUMAN_EXECUTION_DECISION': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 transition-colors">
      <header className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-5">
           <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-700 shadow-sm text-slate-500 dark:text-zinc-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </div>
           <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">Automation Ledger</h2>
              <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 uppercase tracking-[0.35em] font-black">Unified Event Transcript (Chain of Custody)</p>
           </div>
        </div>
        <div className="flex items-center space-x-4">
           <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-inner">Cryptographic Hash: VERIFIED</div>
           <button className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all hover:shadow-md">Export Transcript</button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div className="border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-zinc-950/80 text-slate-400 dark:text-zinc-500 font-black uppercase text-[9px] tracking-[0.25em] border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-8 py-6">Trace ID</th>
                <th className="px-8 py-6">Event Type</th>
                <th className="px-8 py-6">Actor</th>
                <th className="px-8 py-6">Transcript Details</th>
                <th className="px-8 py-6">Timestamp</th>
                <th className="px-8 py-6 text-right">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {events.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                >
                  <td className="px-8 py-6">
                     <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700"></span>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 font-bold">{item.traceId}</span>
                     </div>
                  </td>
                  <td className="px-8 py-6">
                     <span className={`text-[9px] font-black px-3 py-1 rounded border uppercase tracking-tighter ${getEventColor(item.eventType)}`}>
                        {item.eventType.replace(/_/g, ' ')}
                     </span>
                  </td>
                  <td className="px-8 py-6">
                     <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">{item.actor}</span>
                  </td>
                  <td className="px-8 py-6 font-medium text-slate-600 dark:text-zinc-400 text-xs italic">
                     "{item.details}"
                  </td>
                  <td className="px-8 py-6 text-slate-400 dark:text-zinc-500 text-[10px] font-mono whitespace-nowrap font-bold">
                     {item.timestamp}
                  </td>
                  <td className="px-8 py-6 text-right font-mono text-[9px] text-slate-300 dark:text-zinc-600 truncate max-w-[100px]">
                     {item.integrityHash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AutomationLedger;
