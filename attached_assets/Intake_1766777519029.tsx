
import React, { useState } from 'react';

type IntakeView = 'triage' | 'outbound';
type SubmissionStatus = 'pending' | 'dedupe_watch' | 'committed' | 'rejected';

interface IntakeSubmission {
  id: string;
  sourceId: string;
  sourceName: string; // e.g., "Corporate Website Form"
  sourceType: 'widget' | 'webhook' | 'form';
  contactName: string;
  timestamp: string;
  status: SubmissionStatus;
  agentId?: string;
  dedupeWarning?: string; // If present, triggers the warning UI
  rawData: object;
  normalizedData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    intent: string;
    proposedObject: 'Lead' | 'Contact' | 'Deal' | 'Ticket';
  };
}

const Intake: React.FC = () => {
  const [activeView, setActiveView] = useState<IntakeView>('triage');
  const [selectedId, setSelectedId] = useState<string>('INT-9901');
  const [isSourceConfigOpen, setIsSourceConfigOpen] = useState(false);

  // Mock Data matching the visual reference
  const submissions: IntakeSubmission[] = [
    { 
      id: 'INT-9901', 
      sourceId: '#WF-99284-SJ',
      sourceName: 'Webform: Contact Request',
      sourceType: 'widget',
      contactName: 'Sarah Jenkins',
      timestamp: '2m ago',
      status: 'pending',
      agentId: '#0953132',
      dedupeWarning: 'Potential match found in Leads (88% Confidence)',
      rawData: {
        source_id: "web_main_v3",
        timestamp: "2023-10-27T14:30:00Z",
        payload: {
          fname: "Sarah",
          lname: "Jenkins",
          work_email: "sarah.j@acmecorp.com",
          phone_raw: "+1 555 0192",
          intent_blob: "Interested in enterprise pricing for 500 seats."
        }
      },
      normalizedData: {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.j@acmecorp.com',
        phone: '+1-555-019-2200',
        intent: 'Enterprise Pricing Inquiry - High Volume',
        proposedObject: 'Lead'
      }
    },
    { 
      id: 'INT-9902', 
      sourceId: '#WF-99285-DM',
      sourceName: 'Webform: Contact Request',
      sourceType: 'webhook',
      contactName: 'Dave Miller',
      timestamp: '5m ago',
      status: 'pending',
      agentId: '#0253284',
      rawData: {
        source: "typeform_99",
        data: { name: "Dave Miller", q1: "Support" }
      },
      normalizedData: {
        firstName: 'Dave',
        lastName: 'Miller',
        email: 'dave@miller.com',
        phone: '+1-555-019-2201',
        intent: 'Support Request',
        proposedObject: 'Ticket'
      }
    },
    { 
      id: 'INT-9903', 
      sourceId: '#WF-99286-XX',
      sourceName: 'Webform: Contact Request',
      sourceType: 'widget',
      contactName: 'Unknown Visitor',
      timestamp: '12m ago',
      status: 'dedupe_watch',
      agentId: '#01957606',
      rawData: {},
      normalizedData: {
        firstName: 'Unknown',
        lastName: 'Visitor',
        email: '',
        phone: '',
        intent: 'Browsing pricing page',
        proposedObject: 'Lead'
      }
    }
  ];

  const selectedSubmission = submissions.find(s => s.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden relative">
      
      {/* 1. Header */}
      <header className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl z-20 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-4">
           <h1 className="text-xl font-black text-zinc-100 uppercase tracking-tighter">Intake Hub</h1>
           <span className="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Ingress Firewall</span>
        </div>
        
        <div className="flex items-center space-x-2">
           <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 shadow-inner mr-4">
              <button 
                onClick={() => setActiveView('triage')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'triage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                 Triage Queue
              </button>
              <button 
                onClick={() => setActiveView('outbound')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'outbound' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                 Active Intake (Outbound)
              </button>
           </div>
           
           <div className="relative">
              <button 
                onClick={() => setIsSourceConfigOpen(!isSourceConfigOpen)}
                className={`px-4 py-2.5 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center ${isSourceConfigOpen ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                 Source Configuration
                 <svg className={`w-3 h-3 ml-2 transition-transform ${isSourceConfigOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Source Config Popover */}
              {isSourceConfigOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                   <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ingress Sources</span>
                      <button onClick={() => setIsSourceConfigOpen(false)} className="text-zinc-500 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                   </div>
                   <div className="p-2 space-y-1">
                      <div className="p-3 hover:bg-zinc-800/50 rounded-xl transition-colors flex items-center justify-between group">
                         <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg></div>
                            <div>
                               <div className="text-[10px] font-black text-white uppercase tracking-tight">Website Widget</div>
                               <div className="text-[9px] text-zinc-500 truncate w-32">https://api.ver/v1/w...</div>
                            </div>
                         </div>
                         <button className="text-[9px] font-black bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-1 rounded uppercase tracking-widest hover:text-white">Config</button>
                      </div>
                      <div className="p-3 hover:bg-zinc-800/50 rounded-xl transition-colors flex items-center justify-between group">
                         <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                            <div>
                               <div className="text-[10px] font-black text-white uppercase tracking-tight">Typeform Connect</div>
                               <div className="text-[9px] text-zinc-500">Source: Enabled</div>
                            </div>
                         </div>
                         <div className="w-8 h-4 bg-indigo-600 rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div></div>
                      </div>
                   </div>
                   <div className="p-3 border-t border-zinc-800 bg-zinc-950/30 text-center">
                      <button className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400">+ Add New Source</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      </header>

      {/* 2. Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
         
         {/* LEFT: Triage Queue */}
         <div className="w-80 flex flex-col border-r border-zinc-800 bg-zinc-900/20 shrink-0">
            <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
               <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Pending ({submissions.filter(s => s.status === 'pending').length})</span>
               <div className="flex space-x-2 text-[9px] font-bold text-zinc-600">
                  <span>Dedupe Watch (1)</span>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
               {submissions.map(sub => (
                  <div 
                    key={sub.id} 
                    onClick={() => setSelectedId(sub.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all group relative overflow-hidden ${selectedId === sub.id ? 'bg-indigo-900/10 border-indigo-500/50 shadow-lg' : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60'}`}
                  >
                     {selectedId === sub.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}
                     <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                           <div className={`w-2 h-2 rounded-full ${sub.status === 'pending' ? 'bg-amber-500' : 'bg-zinc-600'}`}></div>
                           <span className={`text-[11px] font-bold ${selectedId === sub.id ? 'text-white' : 'text-zinc-300'}`}>{sub.sourceName}</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500">{sub.timestamp}</span>
                     </div>
                     <div className="pl-4">
                        <div className="text-xs font-black text-zinc-400 group-hover:text-zinc-200 transition-colors mb-1">{sub.contactName}</div>
                        <div className="flex items-center space-x-2">
                           <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                           <span className="text-[9px] font-mono text-zinc-600">{sub.sourceId}</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* MIDDLE: Raw Ingress Payload (Read-Only) */}
         <div className="flex-1 flex flex-col border-r border-zinc-800 bg-zinc-950 relative overflow-hidden">
            {selectedSubmission ? (
               <>
                  <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
                     <div>
                        <h2 className="text-lg font-black text-zinc-100 uppercase tracking-tight mb-1">Processing Stage</h2>
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500">
                           <span>ID: {selectedSubmission.id}</span>
                           <span>|</span>
                           <span className="uppercase text-zinc-400">Source: {selectedSubmission.sourceName}</span>
                        </div>
                     </div>
                     <div className="px-3 py-1 rounded border border-zinc-700 bg-zinc-900 text-[9px] font-black uppercase text-zinc-400 flex items-center">
                        <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                        Observation Mode
                     </div>
                  </div>
                  
                  <div className="flex-1 p-6 overflow-auto custom-scrollbar">
                     <div className="space-y-2 mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Raw Ingress Payload [Read-Only System Data]</span>
                     </div>
                     <div className="bg-[#0D0D10] border border-zinc-800/50 rounded-xl p-6 font-mono text-xs overflow-x-auto relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="text-[9px] text-zinc-500 hover:text-zinc-300 uppercase font-black">Copy JSON</button>
                        </div>
                        <pre className="text-emerald-500/90 leading-relaxed">
                           {JSON.stringify(selectedSubmission.rawData, null, 2)}
                        </pre>
                     </div>
                     
                     <div className="mt-8 pt-8 border-t border-zinc-900">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                              <span className="text-[9px] font-black uppercase text-zinc-600 block mb-1">Ingress Timestamp</span>
                              <span className="text-xs font-mono text-zinc-400">{selectedSubmission.timestamp}</span>
                           </div>
                           <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                              <span className="text-[9px] font-black uppercase text-zinc-600 block mb-1">Linked Edge Agent</span>
                              <span className="text-xs font-mono text-zinc-400">{selectedSubmission.agentId || 'N/A'}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </>
            ) : (
               <div className="flex-1 flex items-center justify-center text-zinc-700 font-black uppercase tracking-widest text-xs">Select a submission</div>
            )}
         </div>

         {/* RIGHT: Normalized Staging (Editable) */}
         <div className="w-[450px] flex flex-col bg-zinc-900 border-l border-zinc-800 shrink-0">
            {selectedSubmission ? (
               <>
                  <div className="p-6 border-b border-zinc-800/50 bg-zinc-900 z-10">
                     <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4">Normalized Staging [Editable CRM Objects]</h2>
                     
                     {/* Dedupe Warning */}
                     {selectedSubmission.dedupeWarning && (
                        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start space-x-3">
                           <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           <div>
                              <p className="text-[10px] font-black text-amber-500 uppercase tracking-wide">Dedupe Watch</p>
                              <p className="text-[10px] text-amber-400/80 leading-tight mt-1">{selectedSubmission.dedupeWarning}</p>
                           </div>
                        </div>
                     )}

                     <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">First Name</label>
                              <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-indigo-500 transition-colors" defaultValue={selectedSubmission.normalizedData.firstName} />
                           </div>
                           <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Last Name</label>
                              <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-indigo-500 transition-colors" defaultValue={selectedSubmission.normalizedData.lastName} />
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Email (Business)</label>
                           <input className={`w-full bg-zinc-950 border rounded-lg px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-indigo-500 transition-colors ${selectedSubmission.dedupeWarning ? 'border-amber-500/30 focus:border-amber-500' : 'border-zinc-800'}`} defaultValue={selectedSubmission.normalizedData.email} />
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Phone (Normalized)</label>
                           <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-zinc-200 outline-none focus:border-indigo-500 transition-colors" defaultValue={selectedSubmission.normalizedData.phone} />
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Intent Summary</label>
                           <textarea className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-medium text-zinc-300 outline-none focus:border-indigo-500 transition-colors min-h-[80px] resize-none leading-relaxed" defaultValue={selectedSubmission.normalizedData.intent} />
                        </div>

                        <div className="space-y-1">
                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Proposed CRM Object</label>
                           <select className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none">
                              <option value="Lead">Lead</option>
                              <option value="Contact">Contact</option>
                              <option value="Deal">Deal</option>
                              <option value="Ticket">Ticket</option>
                           </select>
                        </div>
                     </div>
                  </div>

                  <div className="mt-auto p-6 border-t border-zinc-800 bg-zinc-900/50 space-y-3">
                     <button className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        <span>Verify & Commit to ActionAI CRM</span>
                     </button>
                     <div className="text-[9px] text-zinc-500 text-center leading-relaxed px-4">
                        Triggering this action passes authority to ActionAI for reasoning and proposal generation. This is irreversible.
                     </div>
                     <button className="w-full py-3 bg-zinc-950 border border-zinc-800 hover:bg-red-950/30 hover:border-red-900/30 hover:text-red-500 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Reject & Archive
                     </button>
                  </div>
               </>
            ) : (
               <div className="flex-1 flex items-center justify-center text-zinc-700 font-black uppercase tracking-widest text-xs opacity-50">
                  Waiting for selection...
               </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default Intake;
