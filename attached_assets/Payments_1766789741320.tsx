import React, { useState } from 'react';

type PaymentStatus = 'authorized' | 'captured' | 'settled' | 'failed' | 'disputed';
type PaymentMethod = 'card' | 'ach' | 'cash' | 'check' | 'financing';

interface PaymentLinkage {
  entityType: 'invoice' | 'estimate' | 'job' | 'contact';
  entityId: string;
  amountAllocated: number;
}

interface PaymentRecord {
  id: string;
  contactName: string;
  contactId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string;
  processorId: string; // e.g., Stripe ch_...
  last4?: string;
  links: PaymentLinkage[];
  payoutId?: string; // Linked to a batch deposit
  reconciled: boolean;
}

const Payments: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const payments: PaymentRecord[] = [
    { 
      id: 'PAY-8801', contactName: 'Marcus Vane', contactId: 'CON-001', amount: 488.25, method: 'card', 
      status: 'settled', date: '2023-11-20 14:22:01', processorId: 'ch_3Nrk...', last4: '4242',
      reconciled: true, payoutId: 'PO_9901',
      links: [{ entityType: 'invoice', entityId: 'INV-4412', amountAllocated: 488.25 }]
    },
    { 
      id: 'PAY-8802', contactName: 'Apex Logistics', contactId: 'CON-001', amount: 2500.00, method: 'ach', 
      status: 'captured', date: '2023-11-21 09:15:00', processorId: 'ba_9Mll...',
      reconciled: false,
      links: [
        { entityType: 'estimate', entityId: 'EST-9901', amountAllocated: 1500.00 },
        { entityType: 'invoice', entityId: 'INV-9021', amountAllocated: 1000.00 }
      ]
    },
    { 
      id: 'PAY-8803', contactName: 'TechFlow Systems', contactId: 'CON-002', amount: 1240.00, method: 'card', 
      status: 'failed', date: '2023-11-21 11:30:12', processorId: 'ch_failed_88', last4: '1111',
      reconciled: false, links: []
    },
    { 
      id: 'PAY-8804', contactName: 'James Miller', contactId: 'CON-003', amount: 45.00, method: 'cash', 
      status: 'settled', date: '2023-11-22 08:45:00', processorId: 'CASH_REC_01',
      reconciled: true, payoutId: 'BATCH_CASH_001',
      links: [{ entityType: 'job', entityId: 'JOB-7712', amountAllocated: 45.00 }]
    }
  ];

  const selectedPayment = payments.find(p => p.id === selectedId);

  const getStatusStyle = (status: PaymentStatus) => {
    const styles = {
      settled: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      captured: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      authorized: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
      disputed: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    return styles[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  };

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'card': return 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z';
      case 'ach': return 'M8 14v20m4-20v20m4-20v20m4-20v20M2 4h20a2 2 0 012 2v2a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2z';
      case 'cash': return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      default: return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    }
  };

  if (selectedPayment) {
    return (
      <div className="flex h-full flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden animate-in fade-in duration-500">
        {/* PAYMENT DETAIL HEADER */}
        <header className="p-8 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center backdrop-blur-xl">
           <div className="flex items-center space-x-6">
              <button 
                onClick={() => setSelectedId(null)}
                className="p-3 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
              >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div>
                 <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Transaction Log</h2>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(selectedPayment.status)}`}>
                       {selectedPayment.status}
                    </span>
                 </div>
                 <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1 italic">
                    {selectedPayment.id} <span className="mx-2 opacity-30">|</span> Method: {selectedPayment.method.toUpperCase()}
                 </p>
              </div>
           </div>
           
           <div className="flex items-center space-x-12">
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">External Processor Ref</span>
                 <span className="text-xs font-mono font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">{selectedPayment.processorId}</span>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Processor-Reported Amount</span>
                 <span className="text-3xl font-black italic tracking-tighter text-indigo-600 dark:text-indigo-400">
                    ${selectedPayment.amount.toLocaleString()}
                 </span>
              </div>
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           {/* LEFT PANE: OPERATIONAL CONTEXT */}
           <div className="w-[420px] bg-slate-50/50 dark:bg-transparent border-r border-slate-200 dark:border-zinc-800 overflow-y-auto p-8 space-y-8">
              <section className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3"></span>
                    Contact Reference
                 </h4>
                 <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-sm space-y-6">
                    <div className="flex items-center space-x-4">
                       <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">{selectedPayment.contactName}</span>
                          <span className="text-[10px] font-mono text-slate-400">{selectedPayment.contactId}</span>
                       </div>
                    </div>
                    <button className="w-full py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-all">
                       Navigate to Relationship Intel
                    </button>
                 </div>
              </section>

              {/* RECONCILIATION WATCH - INFORMATIONAL ONLY */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em] flex items-center">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  Reconciliation Watch (Snapshot)
                </h4>
                <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                   <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-600/5 blur-3xl rounded-full"></div>
                   <div className="relative z-10 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center">
                            <svg className="w-3.5 h-3.5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            Match Recorded
                         </span>
                         <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase">Archive Match</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-bold italic leading-relaxed">
                        "Archive Log: Transaction metadata aligns with QuickBooks entry #QB-9912. Payout batch {selectedPayment.payoutId || 'PENDING'} has been recorded for the next settlement period."
                      </p>
                      <div className="pt-4 border-t border-zinc-900 text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                         Read-Only Status Feedback • No Action Required
                      </div>
                   </div>
                </div>
              </section>

              {/* PAYOUT FLOW */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3"></span>
                  External Payout Logic
                </h4>
                <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-sm space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payout Batch ID</span>
                      <span className="text-[10px] font-mono font-black text-slate-900 dark:text-zinc-100">{selectedPayment.payoutId || 'Awaiting Sync'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Processor Statement</span>
                      <span className="text-[10px] font-black text-slate-900 dark:text-zinc-100 uppercase italic">Cleared</span>
                   </div>
                </div>
              </section>
           </div>

           {/* RIGHT PANE: LINKED ENTITIES & LOGS */}
           <div className="flex-1 bg-white dark:bg-zinc-900 transition-colors flex flex-col p-12 overflow-y-auto">
              <section className="space-y-8">
                 <div className="flex justify-between items-end">
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Allocations & Mirroring</h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 italic">Reference Linkage Only</span>
                 </div>
                 
                 <div className="space-y-4">
                    {selectedPayment.links.length > 0 ? selectedPayment.links.map((link, i) => (
                       <div key={i} className="p-8 bg-slate-50 dark:bg-zinc-950 border-2 border-slate-100 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between group hover:border-indigo-500 transition-all shadow-sm">
                          <div className="flex items-center space-x-6">
                             <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 text-indigo-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={2}/></svg>
                             </div>
                             <div>
                                <h4 className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">Linked {link.entityType}</h4>
                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{link.entityId}</span>
                             </div>
                          </div>
                          <div className="flex items-center space-x-12">
                             <div className="text-right">
                                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Amount Applied</span>
                                <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tighter">${link.amountAllocated.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>
                    )) : (
                       <div className="py-20 border-4 border-dashed border-slate-100 dark:border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center opacity-30 text-center">
                          <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg>
                          <p className="text-xs font-black uppercase tracking-[0.4em]">Unallocated Payment Record</p>
                          <p className="text-[10px] mt-2 italic font-bold">This receipt currently lacks a primary entity linkage.</p>
                       </div>
                    )}
                 </div>
              </section>

              <section className="mt-16 pt-12 border-t-2 border-slate-50 dark:border-zinc-800">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-8">External Processor Log (Archive)</h4>
                 <div className="space-y-4 font-mono text-[10px]">
                    {[
                       { time: '2023-11-20 14:22:01', event: 'payment_intent.succeeded', desc: 'Processor confirmed capture completion.' },
                       { time: '2023-11-20 14:21:55', event: 'payment_intent.created', desc: 'Processor session initialized externally.' },
                       { time: '2023-11-21 02:00:00', event: 'payout.created', desc: 'Settlement batch record PO_9901 logged.' },
                    ].map((log, i) => (
                       <div key={i} className="flex space-x-6 p-4 bg-slate-50 dark:bg-zinc-950/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                          <span className="text-slate-400 shrink-0">{log.time}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black shrink-0">{log.event}</span>
                          <span className="text-slate-500 dark:text-zinc-500 italic truncate">{log.desc}</span>
                       </div>
                    ))}
                 </div>
              </section>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 transition-colors overflow-hidden">
      <header className="p-8 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Financial Mirror</h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 uppercase font-black tracking-[0.4em] italic flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2 shadow-[0_0_8px_rgba(79,70,229,0.8)]"></span>
              Money Movement Visibility Layer
            </p>
          </div>
          <div className="flex items-center space-x-4">
             <button className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all shadow-sm italic">
                External Payout Log
             </button>
             <button className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all opacity-30 cursor-not-allowed">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
             </button>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
         {/* STATUS FILTER ROW */}
         <div className="flex space-x-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
            {['All Records', 'Settled', 'Captured', 'Authorized', 'Failed', 'Disputed'].map((filter, i) => (
               <button 
                 key={filter}
                 className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${
                   i === 0 
                     ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-800 shadow-lg' 
                     : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                 }`}
               >
                  {filter}
               </button>
            ))}
         </div>

         {/* PAYMENTS TABLE */}
         <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">
                     <tr>
                        <th className="px-10 py-6">Audit ID</th>
                        <th className="px-10 py-6">Customer Context</th>
                        <th className="px-10 py-6">Captured Method</th>
                        <th className="px-10 py-6">Audit Status</th>
                        <th className="px-10 py-6 text-right">Last-Known State</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                     {payments.map((pay) => (
                        <tr 
                          key={pay.id} 
                          onClick={() => setSelectedId(pay.id)}
                          className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                        >
                           <td className="px-10 py-6">
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900 dark:text-zinc-100 tracking-tight">{pay.id}</span>
                                 <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{pay.date}</span>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-black text-indigo-500 text-[9px]">{pay.contactName.charAt(0)}</div>
                                 <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-tighter">{pay.contactName}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{pay.contactId}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex items-center space-x-4">
                                 <div className="flex flex-col">
                                    <span className="text-[13px] font-black text-slate-900 dark:text-zinc-100 tracking-tighter italic">${pay.amount.toLocaleString()}</span>
                                    <div className="flex items-center space-x-1.5 mt-0.5">
                                       <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={getMethodIcon(pay.method)} strokeWidth={2}/></svg>
                                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pay.method} {pay.last4 ? `•••• ${pay.last4}` : ''}</span>
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex items-center space-x-3">
                                 <div className={`p-2 rounded-xl border ${pay.reconciled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reconciled</span>
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${pay.reconciled ? 'text-emerald-500' : 'text-slate-400'}`}>{pay.reconciled ? 'Yes' : 'Pending'}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${getStatusStyle(pay.status)}`}>
                                 {pay.status}
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
         
         {/* MOBILE TAP TO PAY LAUNCHER NUDGE */}
         <div className="mt-8 flex md:hidden bg-zinc-950 text-white p-8 rounded-[3rem] items-center justify-between shadow-2xl border border-zinc-800 relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-600/10 opacity-50"></div>
            <div className="flex items-center space-x-5 relative z-10">
               <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-xl shadow-indigo-600/30">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeWidth={2.5}/></svg>
               </div>
               <div>
                  <span className="text-sm font-black uppercase tracking-[0.2em] block mb-1 italic">Launcher: NFC Collection</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Technician: Initiate External Tap-to-Pay Flow</span>
               </div>
            </div>
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping relative z-10"></div>
         </div>
      </div>
    </div>
  );
};

export default Payments;