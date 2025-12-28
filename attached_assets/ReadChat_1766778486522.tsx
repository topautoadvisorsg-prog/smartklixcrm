import React from 'react';

interface ReadChatProps {
  mode?: 'discovery' | 'crm';
}

const ReadChat: React.FC<ReadChatProps> = ({ mode = 'discovery' }) => {
  const isCrm = mode === 'crm';

  const messages = isCrm ? [
    { role: 'assistant', content: "CRM Index Loaded. I have access to 14,202 Contacts, 85 Active Jobs, and 124 Open Estimates. What specific record or relationship would you like to inspect?", timestamp: "10:15 AM" },
    { role: 'user', content: "Show me all interactions with 'Apex Logistics' related to 'HVAC' in the last quarter.", timestamp: "10:16 AM" },
    { role: 'assistant', content: "Found 3 linked records: \n1. Job #9021 (In Progress)\n2. Estimate #9901 (Approved)\n3. Payment #PAY-8802 (Settled)\n\nAudit log shows frequent communication regarding 'Cooling Units'.", timestamp: "10:17 AM" },
  ] : [
    { role: 'assistant', content: "Discovery analysis complete. Current pipeline shows 12 high-intent leads that have not been engaged in the last 48 hours. No actions are currently scheduled for these records.", timestamp: "10:15 AM" },
    { role: 'user', content: "Provide a breakdown by industry segment for these leads.", timestamp: "10:16 AM" },
    { role: 'assistant', content: "Breakdown: 5 SaaS Tech, 4 Fintech, 3 Retail Logistics. Historical conversion rates for the Fintech group suggest a potential 12% lift if engaged before Q3 close.", timestamp: "10:17 AM" },
    { role: 'user', content: "Are there any specific compliance risks associated with the Fintech leads?", timestamp: "10:18 AM" },
    { role: 'assistant', content: "Internal Audit Record #A-901 indicates that 2 leads in the Fintech group are currently under legal hold for merger review. All other records are clear for engagement research.", timestamp: "10:19 AM" },
  ];

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors ${isCrm ? 'border-l-4 border-indigo-600' : ''}`}>
      <header className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 rounded ${isCrm ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className={`text-lg font-bold uppercase tracking-tight ${isCrm ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-zinc-100'}`}>
              {isCrm ? 'CRM Context Retrieval' : 'Chat with AI'}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-widest">
              {isCrm ? 'Deep Record Inspection' : 'Discovery & Knowledge Mode'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
           <span className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase flex items-center ${isCrm ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'}`}>
             <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isCrm ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
             {isCrm ? 'Active Record Link' : 'Immutable Capability'}
           </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex justify-center mb-4">
           <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30 text-[10px] text-amber-700 dark:text-amber-500 font-bold uppercase tracking-widest shadow-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Governance Lock: {isCrm ? 'Read-Only Record Access' : 'Discovery Mode'} is permanently read-only.
           </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm border ${
              m.role === 'user' 
                ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100' 
                : isCrm ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-500/20 text-slate-700 dark:text-zinc-300' : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                 <span className="text-[9px] uppercase font-bold tracking-tighter text-slate-400 dark:text-zinc-600">
                   {m.role === 'user' ? 'Governance Architect' : (isCrm ? 'CRM Query Engine' : 'Discovery Agent v4')}
                 </span>
                 <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-600">{m.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
        <div className="relative group max-w-4xl mx-auto">
          <input
            disabled
            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-5 py-4 text-slate-400 dark:text-zinc-500 cursor-not-allowed text-sm focus:outline-none shadow-sm"
            placeholder={isCrm ? "System restricted: Record mutation disabled..." : "System restricted: Query-only interface..."}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden group-hover:block">Safe Retrieval Only</span>
             <svg className="w-5 h-5 text-slate-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
             </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadChat;