
import React, { useState } from 'react';

// --- Types ---
interface LineItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
  discount: number;
  total: number;
}

interface WBSGroup {
  id: string;
  title: string;
  items: LineItem[];
}

interface AuditEvent {
  id: string;
  time: string;
  title: string;
  icon: 'user' | 'system' | 'edit';
}

const Estimates: React.FC = () => {
  const [showSendModal, setShowSendModal] = useState(false);

  // Mock Data: Matches Visual Reference
  const auditTrail: AuditEvent[] = [
    { id: 'ev3', time: 'Today, 10:15 AM', title: 'Discount applied by Architect.', icon: 'user' },
    { id: 'ev2', time: 'Today, 10:05 AM', title: "Line Item 'Enterprise Server Setup' added.", icon: 'edit' },
    { id: 'ev1', time: 'Today, 10:00 AM', title: 'Estimate Created by Sarah Chen.', icon: 'user' },
  ];

  const wbsGroups: WBSGroup[] = [
    {
      id: 'g1',
      title: 'Phase 1: Infrastructure Setup',
      items: [
        { id: 'li1', description: 'Enterprise Server Setup', qty: 2, rate: 2500.00, discount: 10, total: 4500.00 },
        { id: 'li2', description: 'Network Configuration', qty: 1, rate: 1200.00, discount: 0, total: 1200.00 },
      ]
    },
    {
      id: 'g2',
      title: 'Phase 2: Software Deployment',
      items: [
        { id: 'li3', description: 'SaaS License (Annual)', qty: 50, rate: 120.00, discount: 5, total: 5700.00 },
      ]
    }
  ];

  const totals = {
    subtotal: 11400.00,
    tax: 912.00,
    grandTotal: 12312.00
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. Header */}
      <header className="px-8 py-5 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center space-x-4">
           {/* Status Badge */}
           <div className="flex items-center bg-zinc-800/50 rounded-lg px-4 py-2 border border-white/5">
              <span className="text-zinc-400 font-bold text-xs uppercase tracking-wider mr-2">Status:</span>
              <span className="text-amber-500 font-black text-xs uppercase tracking-wider">Draft</span>
              <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest ml-3">(Human-Controlled Creation)</span>
           </div>
        </div>
        
        <div className="flex items-center space-x-3">
           <button 
             onClick={() => setShowSendModal(true)}
             className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center space-x-2"
           >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span>Email via SendGrid</span>
           </button>
           <button className="px-6 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center space-x-2">
              <span>Convert to Job</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
           </button>
        </div>
      </header>

      {/* 2. Main Content Split */}
      <div className="flex-1 flex overflow-hidden p-8 gap-8">
         
         {/* LEFT PANEL: Audit Trail & Metadata */}
         <div className="w-[320px] flex flex-col bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden shrink-0">
            {/* Ambient Light */}
            <div className="absolute top-0 left-0 w-full h-32 bg-white/5 blur-[60px] pointer-events-none"></div>

            <h3 className="text-sm font-bold text-white mb-8 relative z-10">Audit Trail & Metadata</h3>

            <div className="flex-1 overflow-y-auto space-y-8 relative z-10 pl-2">
               {auditTrail.map((event, i) => (
                  <div key={event.id} className="relative pl-6 border-l-2 border-zinc-800 last:border-0 pb-2">
                     <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-700 border-2 border-zinc-900 ring-2 ring-zinc-800"></div>
                     <div className="text-[10px] font-mono text-zinc-500 mb-1">{event.time}</div>
                     <div className="text-xs text-zinc-300 font-medium leading-relaxed">{event.title}</div>
                  </div>
               ))}
            </div>

            <div className="mt-auto pt-8 border-t border-white/5 space-y-4 relative z-10">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Estimate ID</span>
                  <span className="text-xs font-mono text-zinc-300">#EST-2024-001</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Client</span>
                  <span className="text-xs font-bold text-white">Acme Corp.</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Created</span>
                  <span className="text-xs font-medium text-zinc-400">Oct 24, 2024</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Expires</span>
                  <span className="text-xs font-medium text-zinc-400">Nov 24, 2024</span>
               </div>
            </div>
         </div>

         {/* RIGHT PANEL: WBS Builder */}
         <div className="flex-1 flex flex-col bg-zinc-900/40 border border-white/10 rounded-[2rem] overflow-hidden relative">
            <header className="p-6 border-b border-white/5 bg-white/5">
               <h3 className="text-sm font-bold text-white">Scope & Pricing (WBS Builder)</h3>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
               
               {/* Header Row */}
               <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <div className="col-span-6">Group / Description</div>
                  <div className="col-span-1">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-1 text-center">Disc %</div>
                  <div className="col-span-2 text-right">Total</div>
               </div>

               {wbsGroups.map(group => (
                  <div key={group.id} className="space-y-2 mb-6">
                     {/* Group Header */}
                     <div className="flex items-center px-4 py-2 bg-zinc-800/30 rounded-lg border border-white/5 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                        <svg className="w-3 h-3 text-zinc-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        <span className="text-xs font-bold text-zinc-300">{group.title}</span>
                     </div>

                     {/* Line Items */}
                     {group.items.map(item => (
                        <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg group">
                           <div className="col-span-6 flex items-center space-x-3">
                              <span className="text-[10px] font-bold text-zinc-500 w-16">Line Item {item.id.replace('li', '')}</span>
                              <input 
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none transition-all"
                                defaultValue={item.description}
                              />
                           </div>
                           <div className="col-span-1">
                              <input 
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-white text-center focus:border-indigo-500 focus:outline-none transition-all"
                                defaultValue={item.qty}
                              />
                           </div>
                           <div className="col-span-2 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                              <input 
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-6 pr-2 py-2 text-xs text-white text-right focus:border-indigo-500 focus:outline-none transition-all"
                                defaultValue={item.rate}
                              />
                           </div>
                           <div className="col-span-1 relative">
                              <input 
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-white text-center focus:border-indigo-500 focus:outline-none transition-all"
                                defaultValue={item.discount}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">%</span>
                           </div>
                           <div className="col-span-2 flex items-center justify-end space-x-3">
                              <span className="text-sm font-mono text-zinc-200">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <button className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               ))}

               <button className="mt-4 px-4 py-3 border border-dashed border-zinc-700 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all flex items-center justify-center w-full">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Line Item (from Price Book)
               </button>
            </div>

            {/* Footer Totals */}
            <div className="p-8 bg-black/20 border-t border-white/5">
               <div className="flex flex-col items-end space-y-2">
                  <div className="flex justify-between w-64 text-zinc-400">
                     <span className="text-xs font-medium">Subtotal:</span>
                     <span className="text-xs font-mono">${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-64 text-zinc-400">
                     <span className="text-xs font-medium">Tax (8%):</span>
                     <span className="text-xs font-mono">${totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-64 text-white mt-2 pt-2 border-t border-zinc-800">
                     <span className="text-sm font-bold">Grand Total:</span>
                     <span className="text-xl font-bold font-mono tracking-tight">${totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>
         </div>

      </div>

      {/* SEND MODAL */}
      {showSendModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#18181b] border border-zinc-700 w-full max-w-lg rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
               <div className="px-6 py-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50">
                  <h3 className="text-sm font-bold text-white">Send Estimate Proposal</h3>
                  <button onClick={() => setShowSendModal(false)} className="text-zinc-500 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
               </div>
               
               <div className="p-6 space-y-6">
                  {/* Email Preview Card */}
                  <div className="bg-white rounded-xl p-6 shadow-inner space-y-4">
                     <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg"></div>
                        <div className="h-2 w-32 bg-slate-200 rounded"></div>
                     </div>
                     <div className="space-y-2">
                        <div className="h-2 w-full bg-slate-100 rounded"></div>
                        <div className="h-2 w-5/6 bg-slate-100 rounded"></div>
                        <div className="h-2 w-4/6 bg-slate-100 rounded"></div>
                     </div>
                     <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                        <div className="h-2 w-24 bg-slate-300 rounded"></div>
                        <div className="h-6 w-16 bg-blue-500 rounded"></div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Recipient</label>
                        <input className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none" defaultValue="sarah.j@acmecorp.com" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Subject</label>
                        <input className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none" defaultValue="Send Estimate Proposal" />
                     </div>
                  </div>
               </div>

               <div className="p-6 border-t border-zinc-800 bg-zinc-900 flex justify-end">
                  <button 
                    onClick={() => setShowSendModal(false)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                  >
                     Send
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default Estimates;
