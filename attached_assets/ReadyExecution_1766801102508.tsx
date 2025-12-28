
import React, { useState } from 'react';

// --- Types ---
interface Proposal {
  id: string;
  title: string;
  origin: string;
  timestamp: string;
  payload: object;
}

const ReadyExecution: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>('P-1024');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Mock Queue Data
  const queue: Proposal[] = [
    {
      id: 'P-1024',
      title: 'API Integration - Sendgrid Email Dispatch',
      origin: 'ActionAI CRM',
      timestamp: '2m ago',
      payload: {
        action: "send_email",
        recipient: "client@example.com",
        template_id: "d-1234567890abcdef",
        dynamic_data: {
          first_name: "John",
          project_name: "Alpha"
        }
      }
    },
    {
      id: 'P-1023',
      title: 'Database Sync - Neo8 Record Update',
      origin: 'ActionAI CRM',
      timestamp: '5m ago',
      payload: {
        action: "update_record",
        table: "contacts",
        record_id: "CON-9921",
        fields: {
          status: "active",
          last_contact: "2023-10-27"
        }
      }
    },
    {
      id: 'P-1022',
      title: 'External Workflow - N8N Trigger',
      origin: 'ActionAI CRM',
      timestamp: '10m ago',
      payload: {
        action: "trigger_workflow",
        webhook_url: "https://n8n.internal/webhook/onboard",
        payload_version: "v2"
      }
    }
  ];

  const selectedProposal = queue.find(p => p.id === selectedId);

  const handleRelease = () => {
    setIsExecuting(true);
    setTimeout(() => {
      alert("Payload Released to N8N.io via Secure Gateway.");
      setIsExecuting(false);
      setIsSecurityModalOpen(false);
      setSelectedId(null); // Clear selection on success
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden relative">
      
      {/* 1. Header */}
      <header className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
        <div>
          <h1 className="text-xl font-black text-zinc-100 uppercase tracking-tighter">Ready Execution (Final Human Authority & Dispatch)</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
            The ONLY point of human approval for real-world impact. Review, confirm, and execute validated proposals.
          </p>
        </div>
        <div className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-full flex items-center shadow-lg">
           <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
           <span className="text-[10px] font-black uppercase text-zinc-300 tracking-widest">Authority: Human Operator (Final Decision)</span>
        </div>
      </header>

      {/* 2. Main Split Layout */}
      <div className="flex-1 flex overflow-hidden p-8 gap-8">
         
         {/* LEFT: QUEUE */}
         <div className="w-[400px] flex flex-col shrink-0 space-y-4">
            <div className="flex justify-between items-center px-1">
               <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Ready for Dispatch Queue (AI-Validated)</h2>
            </div>
            
            <div className="relative">
               <input 
                 type="text" 
                 placeholder="Search queue..." 
                 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-700 outline-none transition-all"
               />
               <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
               {queue.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                       selectedId === item.id 
                       ? 'bg-zinc-800 border-zinc-600 shadow-xl' 
                       : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-500">Proposal #{item.id}</span>
                        <span className="text-[9px] font-bold text-zinc-600">{item.timestamp}</span>
                     </div>
                     <h3 className="text-sm font-bold text-zinc-200 leading-tight mb-4">{item.title}</h3>
                     
                     <div className="flex justify-between items-center">
                        <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                           AI-Validated (Ready)
                        </div>
                        <button className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedId === item.id ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-950 text-zinc-500 border border-zinc-800 group-hover:text-zinc-300'}`}>
                           Review
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* RIGHT: DETAIL & ACTION */}
         <div className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-[2rem] flex flex-col overflow-hidden relative">
            {selectedProposal ? (
               <>
                  <header className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/50">
                     <h2 className="text-lg font-bold text-white tracking-tight">Execution Detail: {selectedProposal.title} (#{selectedProposal.id})</h2>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                     
                     {/* Payload Summary */}
                     <div className="space-y-3">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Payload Summary (AI-Validated)</h3>
                        <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 relative group">
                           <pre className="font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {JSON.stringify(selectedProposal.payload, null, 2)}
                           </pre>
                           <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[9px] text-zinc-600 font-bold uppercase bg-zinc-900 px-2 py-1 rounded border border-zinc-800">Read-Only</span>
                           </div>
                        </div>
                     </div>

                     {/* Validation Status */}
                     <div className="space-y-3">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Validation Status</h3>
                        <div className="p-5 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-4">
                           <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                              <svg className="w-5 h-5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                           </div>
                           <div>
                              <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wide">Master Architect Approved</h4>
                              <p className="text-[10px] text-emerald-500/70 font-bold">AI Validation Complete. Ready for Human Dispatch.</p>
                           </div>
                        </div>
                     </div>

                     {/* Final Authority Zone */}
                     <div className="pt-8 border-t border-zinc-800 mt-auto">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">Final Human Authority</h3>
                        
                        <div className="flex items-center space-x-6">
                           <button 
                              onClick={() => { if(confirm("Are you sure you want to PERMANENTLY reject this workflow?")) setSelectedId(null); }}
                              className="px-8 py-4 rounded-xl border border-red-900/30 text-red-700 hover:text-red-500 hover:bg-red-950/20 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest transition-all"
                           >
                              FINAL REJECT (Override & Cancel)
                           </button>
                           
                           <div className="flex-1 flex flex-col space-y-2">
                              <button 
                                 onClick={() => setIsSecurityModalOpen(true)}
                                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center space-x-3 active:scale-95"
                              >
                                 <span>MANUAL RELEASE (Execute API Trigger)</span>
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </button>
                              <div className="flex items-center justify-center space-x-2 text-[9px] font-bold text-zinc-500 uppercase tracking-wide">
                                 <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                 <span>Triggers real-world action via N8N.io. Irreversible.</span>
                              </div>
                           </div>
                        </div>
                        <div className="mt-4 flex items-center space-x-2 justify-start">
                           <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide">Permanently stops the workflow if rejected.</span>
                        </div>
                     </div>

                  </div>
               </>
            ) : (
               <div className="flex-1 flex items-center justify-center text-zinc-700 font-black uppercase tracking-[0.2em] text-xs">
                  Select a proposal to review
               </div>
            )}
         </div>

      </div>

      {/* SECURITY CONFIRMATION MODAL */}
      {isSecurityModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#121214] border border-zinc-700 w-full max-w-md rounded-2xl shadow-2xl p-1 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
               <div className="bg-zinc-900 rounded-xl p-6">
                  <div className="mb-6">
                     <h3 className="text-lg font-bold text-white mb-1">Security Confirmation: Confirm Identity & Execute</h3>
                     <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Final Gate before API Trigger</p>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Password</label>
                        <input 
                           type="password" 
                           placeholder="••••••••••••" 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-white focus:border-blue-500 outline-none transition-colors text-sm"
                        />
                     </div>
                     <button className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-700">
                        Confirm Identity
                     </button>
                  </div>

                  <div className="bg-amber-900/10 border border-amber-500/20 p-3 rounded-lg flex items-start space-x-3 mb-6">
                     <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     <p className="text-[10px] text-amber-500/80 font-bold leading-tight">This action logs a `HUMAN_EXECUTION_DECISION` and cannot be undone.</p>
                  </div>

                  <div className="flex space-x-3">
                     <button 
                        onClick={() => setIsSecurityModalOpen(false)}
                        className="flex-1 py-3 border border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-800 transition-all"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={handleRelease}
                        disabled={isExecuting}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center"
                     >
                        {isExecuting ? <svg className="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707" /></svg> : 'Execute'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default ReadyExecution;
