
import React, { useState } from 'react';

type FunnelStatus = 'active' | 'listening' | 'error' | 'paused';

interface FunnelInstance {
  id: string;
  name: string;
  status: FunnelStatus;
  source: 'GHL_Form' | 'GHL_Ad' | 'GHL_SMS' | 'GHL_Payment';
  lastEventAt: string;
  ingressVolume: number;
  successRate: number;
  tags: string[];
  sparkline: number[];
}

interface FunnelLog {
  id: string;
  timestamp: string;
  event: string;
  payload: string;
  outcome: 'success' | 'filtered' | 'blocked';
  refId?: string;
}

const Funnels: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isListeningMode, setIsListeningMode] = useState(false);

  const funnels: FunnelInstance[] = [
    { id: 'FUN-001', name: 'Q4 HVAC Maintenance Leads', status: 'active', source: 'GHL_Form', lastEventAt: '2m ago', ingressVolume: 142, successRate: 98.2, tags: ['HVAC', 'Residential'], sparkline: [10, 20, 15, 30, 25, 40, 35] },
    { id: 'FUN-002', name: 'APAC Tech Infrastructure Ad Ingress', status: 'listening', source: 'GHL_Ad', lastEventAt: '15m ago', ingressVolume: 89, successRate: 100, tags: ['Enterprise', 'APAC'], sparkline: [5, 12, 8, 20, 22, 18, 25] },
    { id: 'FUN-003', name: 'Emergency Repair SMS Gateway', status: 'error', source: 'GHL_SMS', lastEventAt: '1h ago', ingressVolume: 42, successRate: 74.5, tags: ['Urgent', 'Direct'], sparkline: [40, 35, 30, 20, 10, 5, 2] },
    { id: 'FUN-004', name: 'NFC Tap-to-Pay Confirmation Flow', status: 'paused', source: 'GHL_Payment', lastEventAt: 'Yesterday', ingressVolume: 12, successRate: 100, tags: ['Field', 'Payment'], sparkline: [10, 10, 10, 10, 10, 10, 10] },
  ];

  const logs: FunnelLog[] = [
    { id: 'LOG-881', timestamp: '10:42:01', event: 'Form_Submission_Received', payload: '{"email": "m.vane@apex.log", "intent": "service"}', outcome: 'success', refId: 'CON-001' },
    { id: 'LOG-880', timestamp: '10:40:15', event: 'Ad_Conversion_Captured', payload: '{"click_id": "fb_9901", "source": "LinkedIn"}', outcome: 'success', refId: 'LD-442' },
    { id: 'LOG-879', timestamp: '10:35:44', event: 'Webhook_Handshake_Fail', payload: '{"error": "Invalid_API_Key", "node": "GHL_Node_4"}', outcome: 'blocked' },
    { id: 'LOG-878', timestamp: '10:30:12', event: 'Payload_Filtered (Duplicate)', payload: '{"email": "ayla@techflow.io"}', outcome: 'filtered' },
  ];

  const selectedFunnel = funnels.find(f => f.id === selectedId);

  const getStatusColor = (status: FunnelStatus) => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'listening': return 'bg-indigo-500 animate-pulse';
      case 'error': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
      case 'paused': return 'bg-zinc-600';
    }
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="p-8 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl flex justify-between items-center z-20">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic text-indigo-400">Ingress Orchestration</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] mt-1">GoHighLevel Relay • ActionAI CRM Verification Hub</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="px-6 py-2.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                GHL Connection: Optimal
             </div>
             <button className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all">
                + Instantiate Funnel
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
          {!selectedId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in duration-500">
               {funnels.map(funnel => (
                 <div 
                   key={funnel.id}
                   onClick={() => setSelectedId(funnel.id)}
                   className="p-8 bg-zinc-900 border-2 border-zinc-800 rounded-[3rem] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group cursor-pointer flex flex-col h-[380px] relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors"></div>
                    
                    <div className="flex justify-between items-start mb-8 relative z-10">
                       <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 shadow-inner group-hover:border-indigo-500 transition-colors">
                          <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeWidth={2.5}/>
                          </svg>
                       </div>
                       <div className="flex flex-col items-end">
                          <div className="flex items-center space-x-2">
                             <span className={`w-2 h-2 rounded-full ${getStatusColor(funnel.status)}`}></span>
                             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{funnel.status}</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-zinc-600 mt-1 uppercase">ID: {funnel.id}</span>
                       </div>
                    </div>

                    <div className="flex-1 space-y-2 relative z-10">
                       <h3 className="text-xl font-black uppercase tracking-tighter leading-tight group-hover:text-indigo-400 transition-colors">{funnel.name}</h3>
                       <div className="flex items-center space-x-3">
                          <span className="text-[9px] font-black text-zinc-500 uppercase bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">{funnel.source}</span>
                          <span className="text-[9px] font-bold text-indigo-500 italic opacity-60">Last event {funnel.lastEventAt}</span>
                       </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-zinc-800 flex justify-between items-end relative z-10">
                       <div className="space-y-4">
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Success Rate</span>
                             <span className="text-2xl font-black italic tracking-tighter text-zinc-100">{funnel.successRate}%</span>
                          </div>
                       </div>
                       <div className="flex items-end space-x-1 h-12 w-24">
                          {funnel.sparkline.map((v, i) => (
                            <div key={i} className="flex-1 bg-indigo-600/30 rounded-t-sm" style={{ height: `${v}%` }}></div>
                          ))}
                       </div>
                    </div>
                 </div>
               ))}
               
               {/* Template Wizard Card */}
               <div className="p-8 border-4 border-dashed border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer hover:border-indigo-600">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border-2 border-zinc-800 text-zinc-700">
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth={3}/></svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">Provision From Template</h3>
                    <p className="text-[10px] text-zinc-600 font-bold italic mt-2">Residential, Commercial, and Field-Ready Blueprints</p>
                  </div>
               </div>
            </div>
          ) : selectedFunnel && (
            <div className="flex-1 flex flex-col space-y-10 animate-in slide-in-from-bottom-8 duration-500 h-full overflow-hidden pb-20">
               {/* FUNNEL DETAIL VIEW */}
               <header className="flex justify-between items-end bg-zinc-900 border-2 border-zinc-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <svg className="w-48 h-48 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  </div>
                  <div className="flex items-center space-x-8 relative z-10">
                     <button onClick={() => setSelectedId(null)} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-all shadow-xl active:scale-90">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg>
                     </button>
                     <div>
                        <div className="flex items-center space-x-4">
                           <h2 className="text-4xl font-black uppercase tracking-tighter italic">{selectedFunnel.name}</h2>
                           <span className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusColor(selectedFunnel.status)} text-white shadow-lg`}>{selectedFunnel.status}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.3em] mt-2 italic flex items-center">
                           <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2"></span>
                           Authorized GHL Pipeline Instance • Mirror ID: {selectedFunnel.id}
                        </p>
                     </div>
                  </div>
                  <div className="flex space-x-6 relative z-10">
                     <button 
                       onClick={() => { setIsListeningMode(true); setTimeout(() => setIsListeningMode(false), 5000); }}
                       className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border-2 transition-all flex items-center group ${isListeningMode ? 'bg-indigo-600 border-indigo-500 text-white animate-pulse' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-indigo-600 hover:text-white'}`}
                     >
                        <svg className={`w-5 h-5 mr-3 ${isListeningMode ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={3}/></svg>
                        {isListeningMode ? 'Listening for Test Event...' : 'Test Handshake'}
                     </button>
                     <button onClick={() => setIsDrawerOpen(true)} className="px-10 py-4 bg-white text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Configure Logic</button>
                  </div>
               </header>

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-10 overflow-hidden">
                  {/* Left & Center: Process Pipeline Visualizer */}
                  <div className="lg:col-span-2 flex flex-col space-y-10 overflow-y-auto no-scrollbar">
                     <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-12 relative flex flex-col items-center justify-center space-y-16 py-32 overflow-hidden shadow-sm">
                        <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-gradient-to-b from-indigo-500/20 via-emerald-500/20 to-zinc-800 -translate-x-1/2"></div>
                        
                        {/* Stage 1 */}
                        <div className="w-[500px] bg-zinc-950 border-2 border-indigo-600/40 rounded-[2.5rem] p-8 shadow-2xl relative z-10 group hover:border-indigo-600 transition-all">
                           <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-lg font-black text-[10px] shadow-xl">INGRESS</div>
                           <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-4">GHL Webhook Event</h4>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-5">
                                 <div className="w-12 h-12 bg-white p-2 rounded-2xl flex items-center justify-center shadow-lg"><img src="https://upload.wikimedia.org/wikipedia/commons/e/ee/GoHighLevel_Logo.png" alt="GHL" className="max-w-full max-h-full object-contain" /></div>
                                 <div>
                                    <span className="text-sm font-black uppercase tracking-tight text-zinc-100">{selectedFunnel.source}</span>
                                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1 italic">Type: Contact_Created_Event</p>
                                 </div>
                              </div>
                              <span className="text-[9px] font-mono text-emerald-500 font-black">LISTENING</span>
                           </div>
                        </div>

                        {/* Stage 2 */}
                        <div className="w-[500px] bg-zinc-950 border-2 border-emerald-600/40 rounded-[2.5rem] p-8 shadow-2xl relative z-10 group hover:border-emerald-600 transition-all">
                           <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-emerald-600 text-white px-3 py-1 rounded-lg font-black text-[10px] shadow-xl">BRAIN</div>
                           <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 mb-4">ActionAI CRM Logic Stack</h4>
                           <div className="flex flex-col space-y-4">
                              {[
                                { t: 'Validator', d: 'Deduplication & Enrichment Node' },
                                { t: 'Policy Node', d: 'Architect Governance Check (v4.2)' }
                              ].map(node => (
                                <div key={node.t} className="flex items-center space-x-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-inner">
                                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                                   <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-zinc-100 uppercase tracking-widest">{node.t}</span>
                                      <p className="text-[9px] text-zinc-500 font-bold italic">{node.d}</p>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* Stage 3 */}
                        <div className="w-[500px] bg-zinc-950 border-2 border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl relative z-10 opacity-60 group hover:opacity-100 hover:border-zinc-600 transition-all">
                           <div className="absolute -left-4 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 px-3 py-1 rounded-lg font-black text-[10px]">OUTPUT</div>
                           <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-4">CRM Mutation</h4>
                           <div className="flex items-center space-x-5">
                              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 group-hover:animate-bounce">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={3}/></svg>
                              </div>
                              <div>
                                 <span className="text-sm font-black uppercase tracking-tight text-zinc-300">Target: Pipeline Stage (New)</span>
                                 <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1">Audit Signature Required</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Right: Functional Logs & Monitoring */}
                  <div className="flex flex-col space-y-8 h-full overflow-hidden">
                     <section className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 flex flex-col flex-1 overflow-hidden shadow-sm">
                        <header className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
                           <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">Append-Only Event Ledger</h4>
                           <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Live Sync</span>
                        </header>
                        <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
                           {logs.map(log => (
                             <div key={log.id} className="p-6 bg-zinc-950 border border-zinc-800 rounded-[2rem] space-y-4 hover:border-zinc-700 transition-all group">
                                <div className="flex justify-between items-start">
                                   <div className="flex flex-col">
                                      <span className={`text-[10px] font-black uppercase tracking-tighter ${log.outcome === 'success' ? 'text-emerald-500' : log.outcome === 'blocked' ? 'text-red-500' : 'text-amber-500'}`}>{log.event}</span>
                                      <span className="text-[8px] font-mono text-zinc-600 mt-0.5">{log.timestamp} • REF: {log.id}</span>
                                   </div>
                                   {log.refId && <button className="text-[8px] font-black bg-zinc-900 px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-white uppercase tracking-widest">Jump to {log.refId}</button>}
                                </div>
                                <div className="p-3 bg-zinc-900 rounded-xl text-[10px] font-mono text-zinc-500 leading-relaxed italic truncate">
                                   {log.payload}
                                </div>
                             </div>
                           ))}
                        </div>
                        <footer className="mt-6 pt-6 border-t border-zinc-800 flex justify-between items-center italic">
                           <span className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Audit Chain Intact</span>
                           <button className="text-[9px] font-black text-indigo-500 hover:underline uppercase tracking-widest">Export Session Log</button>
                        </footer>
                     </section>

                     <section className="bg-indigo-600/5 border border-indigo-500/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-6 flex items-center">
                           <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.5)]"></span>
                           Operational Integrity Watch
                        </h4>
                        <p className="text-[11px] text-zinc-300 font-bold italic leading-relaxed">
                           "ActionAI CRM is processing <span className="text-white underline decoration-indigo-500/30">12 events/hr</span>. Payload size remains within benchmark tolerance for high-volume ingress. Webhook handshake latency recorded at <span className="text-emerald-400 font-black">18ms</span>."
                        </p>
                        <div className="mt-8 flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-zinc-600">
                           <span>ActionAI Logic Hash: 0x7F2...</span>
                           <span>Verified Status</span>
                        </div>
                     </section>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* CONFIGURATION DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
           <div onClick={() => setIsDrawerOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"></div>
           <div className="relative w-[500px] bg-zinc-900 border-l-2 border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
              <header className="p-10 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
                 <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic text-indigo-400">Logic Orchestration</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] mt-1">Configure Relay Parameters</p>
                 </div>
                 <button onClick={() => setIsDrawerOpen(false)} className="p-3 bg-zinc-800 text-zinc-500 hover:text-white rounded-2xl transition-all shadow-xl active:scale-90">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                 </button>
              </header>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                 <section className="space-y-6">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600 flex items-center">
                       <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3"></span>
                       Ingress Source Metadata (GHL)
                    </h4>
                    <div className="space-y-4">
                       <div>
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Webhook URL (Public Relay)</label>
                          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-[10px] font-mono text-zinc-400 flex items-center justify-between group shadow-inner">
                             <span className="truncate mr-4">https://relay.smartclicks.io/ghl/in/v1/f_99021</span>
                             <button className="text-indigo-500 hover:text-white transition-colors uppercase font-black tracking-widest text-[8px] shrink-0">Copy</button>
                          </div>
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Payload Filter Level</label>
                          <select className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl p-4 text-xs font-black text-zinc-300 outline-none focus:border-indigo-600 appearance-none transition-all shadow-sm">
                             <option>High Strictness (Dedupe On)</option>
                             <option>Allow Partial Matches</option>
                             <option>Ingest All Events</option>
                          </select>
                       </div>
                    </div>
                 </section>

                 <section className="space-y-6">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600 flex items-center">
                       <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mr-3"></span>
                       ActionAI CRM Logic Path
                    </h4>
                    <div className="p-8 bg-zinc-950 border-2 border-emerald-900/20 rounded-[2.5rem] space-y-6 shadow-inner">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em]">Validation Stack</span>
                          <span className="text-[8px] font-mono bg-emerald-600 text-white px-2 py-0.5 rounded uppercase font-black">ACTIVE</span>
                       </div>
                       <div className="space-y-4">
                          {[
                             { l: 'IF Lead exists in Pipeline', v: 'SKIP Mutation (Log only)' },
                             { l: 'IF Lead lacks primary phone', v: 'ROUTE to Enrichment Node' },
                             { l: 'ELSE', v: 'INSTANTIATE Mission #Outreach_Default' }
                          ].map(logic => (
                            <div key={logic.l} className="flex flex-col p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm">
                               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">{logic.l}</span>
                               <span className="text-[10px] font-bold text-zinc-300 mt-1 uppercase tracking-tight">{logic.v}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </section>

                 <section className="p-8 bg-red-900/5 border border-red-900/30 rounded-[2.5rem] space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-red-500 tracking-widest flex items-center">
                       <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg>
                       Termination Policy
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-bold italic leading-relaxed">
                       Forcefully disconnecting this funnel will immediately abort all listening GHL relay nodes. Historical logs will remain immutable in the Ledger.
                    </p>
                    <button className="w-full py-4 bg-zinc-950 border border-red-900/40 text-red-900 hover:bg-red-900 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Deactivate Funnel Instance</button>
                 </section>
              </div>

              <div className="p-10 border-t border-zinc-800 bg-zinc-950/80 flex space-x-4">
                 <button onClick={() => setIsDrawerOpen(false)} className="flex-1 py-5 border-2 border-zinc-800 rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 hover:bg-zinc-800 transition-all active:scale-95 shadow-sm">Discard Changes</button>
                 <button onClick={() => { alert('Configuration committed to ActionAI CRM stack.'); setIsDrawerOpen(false); }} className="flex-1 py-5 bg-indigo-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] transition-all shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 flex items-center justify-center space-x-3 group border-2 border-indigo-500">
                    <span>Commit Logic</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth={3}/></svg>
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Funnels;
