
import React, { useState } from 'react';

type IdentityType = 'personal' | 'company';
type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'scheduled';

interface EmailRecord {
  id: string;
  identity: IdentityType; // personal = Gmail, company = SendGrid
  senderName: string;
  recipient: string;
  subject: string;
  preview: string;
  timestamp: string;
  status: EmailStatus;
  templateId?: string; // Only for company emails
}

const Email: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'personal' | 'company' | 'failed'>('all');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  
  // Compose State
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityType>('personal');
  const [draftTo, setDraftTo] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('INV_OVERDUE_V2');

  // Mock Data
  const emails: EmailRecord[] = [
    {
      id: 'MSG-1029',
      identity: 'personal',
      senderName: 'Sarah Architect',
      recipient: 'Acme Corp, +2 others',
      subject: 'Re: Project Scope Review - Q3',
      preview: 'Hello, a free text body. The project Scope computation information on our end points to the amounts of...',
      timestamp: '2h ago',
      status: 'opened'
    },
    {
      id: 'MSG-1028',
      identity: 'company',
      senderName: 'System Dispatch',
      recipient: 'finance@acmecorp.com',
      subject: '[ALERT] Invoice #INV-9942 Overdue',
      preview: 'Dear Client, Your invoice is now 5 days overdue. Please remit payment immediately to avoid service interruption.',
      timestamp: '4h ago',
      status: 'clicked',
      templateId: 'INV_OVERDUE_V2'
    },
    {
      id: 'MSG-1027',
      identity: 'company',
      senderName: 'System Dispatch',
      recipient: 'invalid.email@example.com',
      subject: '[Auto] Welcome Onboarding',
      preview: 'Welcome to the platform! Click here to set up your account credentials.',
      timestamp: '5h ago',
      status: 'failed',
      templateId: 'ONBOARD_V1'
    },
    {
      id: 'MSG-1026',
      identity: 'personal',
      senderName: 'Sarah Architect',
      recipient: 'Marcus Vane',
      subject: 'Quick question about the site access',
      preview: 'Hey Marcus, are we still good for the 10am arrival tomorrow? I need to let the team know.',
      timestamp: 'Yesterday',
      status: 'sent'
    }
  ];

  const filteredEmails = emails.filter(e => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'personal') return e.identity === 'personal';
    if (activeFilter === 'company') return e.identity === 'company';
    if (activeFilter === 'failed') return e.status === 'failed';
    return true;
  });

  // Strict Identity Switching Logic
  const handleIdentityChange = (newIdentity: IdentityType) => {
    if (newIdentity === selectedIdentity) return;
    
    // THE FRICTION RULE: Wipe body to prevent context leak
    if (confirm("Switching identity will clear your current draft to prevent cross-contamination. Continue?")) {
      setSelectedIdentity(newIdentity);
      setDraftBody('');
      setDraftSubject('');
    }
  };

  const renderStatusBadge = (status: EmailStatus, identity: IdentityType) => {
    if (status === 'failed') {
      return (
        <span className="flex items-center text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Failed: Hard Bounce
        </span>
      );
    }
    
    const color = identity === 'personal' ? 'text-blue-400' : 'text-purple-400';
    const icon = status === 'opened' || status === 'clicked' 
      ? <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
      : <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;

    return (
      <span className={`flex items-center text-[10px] font-bold ${color} uppercase tracking-wide`}>
        {icon} {status} ({status === 'clicked' ? '30m ago' : '1h ago'})
      </span>
    );
  };

  return (
    <div className="flex h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. SIDEBAR: FILTERS */}
      <aside className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-900/30 p-4 shrink-0">
        <div className="mb-8 pl-2">
           <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-4">Communication Filters</h2>
           
           <nav className="space-y-1">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
              >
                 <span>All Communications</span>
                 <span className="bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded text-[9px]">1,245</span>
              </button>

              <button 
                onClick={() => setActiveFilter('personal')}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'personal' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' : 'text-zinc-400 hover:text-blue-400'}`}
              >
                 <span className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>Personal Identity (Gmail)</span>
                 <span className="text-[9px] opacity-60">850</span>
              </button>

              <button 
                onClick={() => setActiveFilter('company')}
                className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'company' ? 'bg-purple-900/20 text-purple-400 border border-purple-500/20' : 'text-zinc-400 hover:text-purple-400'}`}
              >
                 <span className="flex items-center"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>Company Identity (System)</span>
                 <span className="text-[9px] opacity-60">395</span>
              </button>

              <div className="pt-4 mt-4 border-t border-zinc-800">
                 <button className="w-full flex items-center px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    Sent
                 </button>
                 <button 
                   onClick={() => setActiveFilter('failed')}
                   className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === 'failed' ? 'bg-red-900/20 text-red-500 border border-red-500/20' : 'text-zinc-500 hover:text-red-500'}`}
                 >
                    <span className="flex items-center"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Failed</span>
                    <span className="bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded text-[9px]">3</span>
                 </button>
                 <button className="w-full flex items-center px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Scheduled
                 </button>
              </div>
           </nav>
        </div>

        <div className="mt-auto p-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
           <div className="flex items-start space-x-3 text-zinc-500">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <div>
                 <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Ingress Filter Active</p>
                 <p className="text-[9px] leading-relaxed mt-1">Showing only CRM-matched records. Personal emails hidden.</p>
              </div>
           </div>
        </div>
      </aside>

      {/* 2. MAIN FEED */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
         {/* Header */}
         <header className="px-8 py-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
            <div>
               <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Audit Trail & Dispatch</h1>
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Unified Communication Feed</p>
            </div>
            <button 
              onClick={() => setIsComposeOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-900/20 transition-all flex items-center"
            >
               <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
               Compose Dispatch
            </button>
         </header>

         {/* Feed List */}
         <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
            {/* Search Bar */}
            <div className="relative mb-6">
               <input 
                 type="text" 
                 placeholder="Search subject, contact, or trace ID..." 
                 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 outline-none transition-all"
               />
               <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {filteredEmails.map((email) => (
               <div 
                 key={email.id} 
                 className={`p-5 rounded-2xl border transition-all hover:bg-zinc-900 ${
                    email.status === 'failed' ? 'bg-red-950/10 border-red-900/30' : 
                    email.identity === 'personal' ? 'bg-zinc-900/40 border-zinc-800 border-l-4 border-l-blue-500' : 
                    'bg-zinc-900/40 border-zinc-800 border-l-4 border-l-purple-500'
                 }`}
               >
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                           email.identity === 'personal' ? 'bg-blue-500/10 border-blue-500/20' : 
                           email.status === 'failed' ? 'bg-red-500/10 border-red-500/20' : 
                           'bg-purple-500/10 border-purple-500/20'
                        }`}>
                           {email.identity === 'personal' ? (
                              <img src={`https://ui-avatars.com/api/?name=${email.senderName}&background=random`} className="w-full h-full rounded-full opacity-80" alt="User" />
                           ) : (
                              <svg className={`w-5 h-5 ${email.status === 'failed' ? 'text-red-500' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 {email.status === 'failed' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />}
                              </svg>
                           )}
                        </div>
                        <div>
                           <div className="flex items-center space-x-2">
                              <span className="text-sm font-bold text-zinc-200">{email.senderName}</span>
                              <span className={`text-[10px] font-black uppercase tracking-wider ${email.identity === 'personal' ? 'text-blue-500' : 'text-purple-500'}`}>
                                 (via {email.identity === 'personal' ? 'Gmail' : 'SendGrid'})
                              </span>
                           </div>
                           <div className="text-xs text-zinc-500">To: {email.recipient}</div>
                        </div>
                     </div>
                     <div className="text-right">
                        {renderStatusBadge(email.status, email.identity)}
                        <div className="text-[10px] font-mono text-zinc-600 mt-1">Sent {email.timestamp}</div>
                     </div>
                  </div>
                  
                  <div className="pl-13 ml-13">
                     <h4 className="text-sm font-bold text-zinc-300 mb-1">{email.subject}</h4>
                     <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{email.preview}</p>
                  </div>
               </div>
            ))}
         </div>
      </main>

      {/* 3. COMPOSE MODAL */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-[#121214] border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl relative flex flex-col overflow-hidden ring-1 ring-white/10">
              
              <div className="p-6 border-b border-zinc-800">
                 <h2 className="text-xl font-bold text-white mb-4">Compose New Dispatch</h2>
                 
                 {/* Identity Switcher */}
                 <div className="bg-zinc-900 p-1.5 rounded-xl flex space-x-1 border border-zinc-800">
                    <button 
                      onClick={() => handleIdentityChange('personal')}
                      className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${selectedIdentity === 'personal' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       <span>Personal Identity (Gmail)</span>
                    </button>
                    <button 
                      onClick={() => handleIdentityChange('company')}
                      className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${selectedIdentity === 'company' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                       <span>Company Identity (System)</span>
                    </button>
                 </div>
                 
                 <div className="flex items-center space-x-2 mt-3 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/20">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>Switching identity clears draft body to prevent cross-contamination.</span>
                 </div>
              </div>

              <div className="p-6 space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">To:</label>
                    <input 
                      value={draftTo}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors"
                      placeholder="Recipient email..."
                    />
                 </div>

                 {selectedIdentity === 'personal' ? (
                    // PERSONAL MODE: Free Text
                    <>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Subject:</label>
                          <input 
                            value={draftSubject}
                            onChange={(e) => setDraftSubject(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors"
                            placeholder="Subject line..."
                          />
                       </div>
                       <div className="space-y-1">
                          <div className="flex justify-between">
                             <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Message Body</label>
                             <div className="flex space-x-2 text-zinc-600">
                                <button className="hover:text-zinc-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg></button>
                                <button className="hover:text-zinc-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></button>
                             </div>
                          </div>
                          <textarea 
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-300 outline-none focus:border-blue-500 transition-colors min-h-[200px] resize-none"
                            placeholder="Type your message here..."
                          />
                       </div>
                    </>
                 ) : (
                    // SYSTEM MODE: Template Selection (Free Text Blocked)
                    <>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Template (Required)</label>
                          <select 
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-purple-400 outline-none focus:border-purple-500 transition-colors"
                          >
                             <option value="INV_OVERDUE_V2">Invoice Overdue Warning (v2)</option>
                             <option value="ONBOARD_V1">Welcome Onboarding Flow</option>
                             <option value="PWD_RESET">Password Reset Instructions</option>
                             <option value="SVC_CONFIRM">Service Appointment Confirmation</option>
                          </select>
                       </div>
                       <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-xl mt-4">
                          <h4 className="text-[10px] font-black uppercase text-purple-500 tracking-widest mb-2">Payload Preview (Read-Only)</h4>
                          <div className="font-mono text-[10px] text-purple-300 whitespace-pre-wrap">
{`{
  "template_id": "${selectedTemplate}",
  "dynamic_data": {
    "first_name": "John",
    "account_id": "ACC-9921",
    "link_expiry": "24h"
  }
}`}
                          </div>
                       </div>
                       <p className="text-[10px] text-zinc-500 italic text-center mt-2">
                          System messages are transactional. Free-text entry is disabled to ensure compliance.
                       </p>
                    </>
                 )}

                 {/* Signature Block */}
                 {selectedIdentity === 'personal' && (
                    <div className="text-[10px] text-zinc-500 border-t border-zinc-800 pt-3">
                       <p>--</p>
                       <p className="font-bold text-zinc-400">Sarah Architect</p>
                       <p>Senior Solution Architect</p>
                       <p className="text-blue-500">[CRM Profile Link]</p>
                    </div>
                 )}
              </div>

              <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex justify-between items-center">
                 <button onClick={() => setIsComposeOpen(false)} className="text-xs font-bold text-zinc-500 hover:text-zinc-300">Cancel</button>
                 <button 
                   onClick={() => { alert(`Dispatched via Neo8 using ${selectedIdentity.toUpperCase()} protocol.`); setIsComposeOpen(false); }}
                   className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all ${selectedIdentity === 'personal' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
                 >
                    Authorize Dispatch
                    <span className="block text-[8px] font-normal opacity-70 normal-case">(Sends via Neo8 Engine)</span>
                 </button>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};

export default Email;
