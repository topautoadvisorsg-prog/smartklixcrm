
import React, { useState } from 'react';

// --- Types ---
type VoiceEngine = 'economic' | 'premium';
type DispatchStatus = 'in_progress' | 'success' | 'failed';

interface DispatchLog {
  id: string;
  contactName: string;
  intent: string;
  engine: VoiceEngine;
  status: DispatchStatus;
  timestamp: string;
  summary: string;
}

const AiVoice: React.FC = () => {
  // --- State: Configuration (Left Panel) ---
  const [selectedContact, setSelectedContact] = useState<string>('Sarah Chen (Acme Corp)');
  const [selectedIntent, setSelectedIntent] = useState<string>('Schedule Maintenance Follow-up');
  const [contextNotes, setContextNotes] = useState<string>('Please emphasize the new service window and confirm availability for next Tuesday. Reference ticket #9942.');
  const [selectedEngine, setSelectedEngine] = useState<VoiceEngine>('premium');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // --- State: Ledger (Right Panel) ---
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([
    {
      id: 'LOG-001',
      contactName: 'Mark Davis',
      intent: 'Billing Inquiry',
      engine: 'premium',
      status: 'in_progress',
      timestamp: '1 min ago',
      summary: 'AI Voice Server Executing...'
    },
    {
      id: 'LOG-002',
      contactName: 'Emily Blunt',
      intent: 'Schedule Maintenance',
      engine: 'economic',
      status: 'success',
      timestamp: '25 mins ago',
      summary: 'Appointment confirmed for 10/27, 2 PM. Transcript available.'
    },
    {
      id: 'LOG-003',
      contactName: 'John Smith',
      intent: 'Feature Announcement',
      engine: 'economic',
      status: 'failed',
      timestamp: '2 hours ago',
      summary: 'Max retries reached by server. No contact made.'
    }
  ]);

  // --- Handlers ---
  const handleDispatch = () => {
    if (!isAuthorized) return;
    setIsDispatching(true);

    // Simulate Network Request
    setTimeout(() => {
      const newLog: DispatchLog = {
        id: `LOG-${Date.now()}`,
        contactName: selectedContact.split(' - ')[0] || selectedContact, // Simple parse
        intent: selectedIntent,
        engine: selectedEngine,
        status: 'in_progress',
        timestamp: 'Just now',
        summary: 'Handshake successful. AI Voice Server spinning up instance...'
      };
      setDispatchLogs([newLog, ...dispatchLogs]);
      setIsDispatching(false);
      setIsAuthorized(false); // Reset auth check
    }, 800);
  };

  // --- Render Helpers ---
  const getStatusColor = (status: DispatchStatus) => {
    switch (status) {
      case 'in_progress': return 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]';
      case 'success': return 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
      case 'failed': return 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]';
    }
  };

  const getStatusText = (status: DispatchStatus) => {
    switch (status) {
      case 'in_progress': return 'text-amber-500';
      case 'success': return 'text-emerald-500';
      case 'failed': return 'text-red-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="p-6 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl z-20 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-black text-zinc-100 uppercase tracking-tighter">AI Voice Dispatch</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Voice Mission Control & Observability</p>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          
          {/* LEFT PANEL: HUMAN DISPATCH */}
          <div className="flex flex-col bg-zinc-900/40 border border-indigo-500/30 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
             {/* Glow Effect */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
             
             {/* Badge */}
             <div className="mb-8">
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                   AUTHORITY: Human Operator
                </span>
             </div>

             <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                
                {/* Mission Definition */}
                <section className="space-y-4">
                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mission Definition</h3>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Contact Selection</label>
                         <input 
                           value={selectedContact}
                           onChange={(e) => setSelectedContact(e.target.value)}
                           className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold text-zinc-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Voice Intent</label>
                         <select 
                           value={selectedIntent}
                           onChange={(e) => setSelectedIntent(e.target.value)}
                           className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-bold text-zinc-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                         >
                            <option>Schedule Maintenance Follow-up</option>
                            <option>Billing Inquiry</option>
                            <option>Feature Announcement</option>
                            <option>Customer Satisfaction Survey</option>
                         </select>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex justify-between">
                         <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Context & Script Notes</label>
                         <span className="text-[10px] font-mono text-zinc-600">{contextNotes.length}/500</span>
                      </div>
                      <textarea 
                        value={contextNotes}
                        onChange={(e) => setContextNotes(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-xs font-medium text-zinc-300 focus:border-indigo-500 outline-none transition-all min-h-[100px] resize-none leading-relaxed shadow-inner placeholder:text-zinc-700"
                        placeholder="Provide specific instructions for the AI agent..."
                      />
                   </div>
                </section>

                {/* Engine Routing */}
                <section className="space-y-4">
                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">Engine Routing (Mandatory Selection)</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setSelectedEngine('economic')}
                        className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${selectedEngine === 'economic' ? 'bg-zinc-800 border-amber-500/50' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
                      >
                         <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2">
                               <span className={`text-xs font-black uppercase tracking-widest ${selectedEngine === 'economic' ? 'text-amber-500' : 'text-zinc-500'}`}>Economic Engine</span>
                               {selectedEngine === 'economic' && <div className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-medium">(Standard Latency, Cost-Effective)</span>
                         </div>
                      </button>

                      <button 
                        onClick={() => setSelectedEngine('premium')}
                        className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${selectedEngine === 'premium' ? 'bg-zinc-800 border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.1)]' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
                      >
                         <div className="relative z-10">
                            <div className="flex justify-between items-center mb-2">
                               <span className={`text-xs font-black uppercase tracking-widest ${selectedEngine === 'premium' ? 'text-indigo-400' : 'text-zinc-500'}`}>Premium Engine</span>
                               {selectedEngine === 'premium' && <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                            </div>
                            <span className="text-[10px] text-zinc-400 font-medium">(Low Latency, Enhanced Realism)</span>
                         </div>
                      </button>
                   </div>
                   <p className="text-[10px] text-zinc-600 italic pl-1">Selection is required for payload. Affects call quality and cost.</p>
                </section>

                {/* Authorization */}
                <section className="space-y-6 pt-6 border-t border-zinc-800/50">
                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">Authorization & Dispatch</h3>
                   
                   <label className="flex items-start space-x-4 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all mt-0.5 shrink-0 ${isAuthorized ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-950 border-zinc-700'}`}>
                         <input type="checkbox" className="hidden" checked={isAuthorized} onChange={(e) => setIsAuthorized(e.target.checked)} />
                         {isAuthorized && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <p className="text-[11px] text-zinc-400 font-medium leading-relaxed group-hover:text-zinc-200 transition-colors">
                         I authorize the immediate execution of this AI voice call. This action is irreversible and transfers control to the AI Voice Server.
                      </p>
                   </label>

                   <button 
                     onClick={handleDispatch}
                     disabled={!isAuthorized || isDispatching}
                     className={`w-full py-5 rounded-2xl text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center space-x-3 transition-all ${
                        isAuthorized 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]' 
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
                     }`}
                   >
                      {isDispatching ? (
                         <>
                           <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707" /></svg>
                           <span>Transmitting...</span>
                         </>
                      ) : (
                         <>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                           <span>DISPATCH OUTBOUND CALL</span>
                         </>
                      )}
                   </button>
                </section>

             </div>
          </div>

          {/* RIGHT PANEL: SYSTEM LEDGER */}
          <div className="flex flex-col bg-zinc-900/40 border border-teal-500/30 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
             {/* Glow Effect */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
             
             {/* Badge */}
             <div className="mb-8 flex justify-between items-center">
                <span className="px-3 py-1 bg-teal-500/20 border border-teal-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                   AUTHORITY: System / AI Voice Server
                </span>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Live Feed</span>
             </div>

             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                {dispatchLogs.map((log) => (
                   <div key={log.id} className={`p-5 rounded-2xl border ${getStatusColor(log.status)} flex flex-col space-y-4 transition-all hover:scale-[1.01]`}>
                      
                      <div className="flex justify-between items-start">
                         <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusText(log.status)}`}>
                               Status: {log.status === 'in_progress' ? 'In-Progress (AI Voice Server Executing)' : log.status === 'success' ? 'Success (Completed)' : 'Failed (No Answer)'}
                            </span>
                            {log.status === 'in_progress' && (
                               <div className="flex space-x-1">
                                  <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce"></span>
                                  <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce delay-75"></span>
                                  <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce delay-150"></span>
                               </div>
                            )}
                         </div>
                         <div className="flex items-center space-x-2">
                            {log.status === 'in_progress' && <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            {log.status === 'success' && <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                            {log.status === 'failed' && <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                         <div>
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Contact</span>
                            <span className="font-bold text-zinc-200">{log.contactName}</span>
                         </div>
                         <div>
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Engine</span>
                            <span className="font-bold text-zinc-200 capitalize">{log.engine}</span>
                         </div>
                         <div>
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Intent</span>
                            <span className="font-bold text-zinc-200">{log.intent}</span>
                         </div>
                         <div>
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Time</span>
                            <span className="font-bold text-zinc-200">{log.timestamp}</span>
                         </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-700/30 flex items-center justify-between">
                         <p className="text-[10px] text-zinc-400 font-medium italic">{log.summary}</p>
                         <button className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                            log.status === 'success' 
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500' 
                            : 'bg-transparent border-transparent text-zinc-600 cursor-not-allowed'
                         }`}>
                            {log.status === 'in_progress' ? 'View Live Status' : log.status === 'success' ? 'View Transcript' : 'View Details'}
                         </button>
                      </div>

                   </div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AiVoice;
