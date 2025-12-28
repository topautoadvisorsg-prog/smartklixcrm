import React, { useState, useEffect, useRef } from 'react';

type SessionStatus = 'active' | 'expiring' | 'expired';
type FilterType = 'all' | 'unread' | 'assigned' | 'expired' | 'failed';

interface Conversation {
  id: string;
  contactName: string;
  phone: string;
  jobId?: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  sessionStatus: SessionStatus;
  avatarUrl: string;
  urgencyScore: number; 
  assignedToMe: boolean;
  hasFailedMessage?: boolean;
}

interface Message {
  id: string;
  sender: 'customer' | 'operator' | 'system' | 'ai_draft';
  content: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  media?: { type: 'image' | 'file'; url: string; fileName?: string };
}

const WhatsApp: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>('C-001');
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // Mock conversations
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 'C-001', contactName: 'Marcus Vane', phone: '+1 650 555-0192', jobId: 'JOB-9021', lastMessage: 'Technician is running 15m late, FYI.', timestamp: '2m ago', unreadCount: 1, sessionStatus: 'active', avatarUrl: 'https://picsum.photos/seed/marcus/40/40', urgencyScore: 95, assignedToMe: true },
    { id: 'C-002', contactName: 'Ayla Tech CEO', phone: '+1 415 555-2281', jobId: 'JOB-8842', lastMessage: 'System check complete. All nodes green.', timestamp: '1h ago', unreadCount: 0, sessionStatus: 'expiring', avatarUrl: 'https://picsum.photos/seed/ayla/40/40', urgencyScore: 60, assignedToMe: true },
    { id: 'C-003', contactName: 'James Miller', phone: '+1 212 555-9012', lastMessage: 'When can we reschedule?', timestamp: 'Yesterday', unreadCount: 0, sessionStatus: 'expired', avatarUrl: 'https://picsum.photos/seed/james/40/40', urgencyScore: 30, assignedToMe: false },
    { id: 'C-004', contactName: 'Global Build Support', phone: '+1 312 555-4422', jobId: 'JOB-9102', lastMessage: 'Attachment: Site_Layout_Draft.pdf', timestamp: '5m ago', unreadCount: 3, sessionStatus: 'active', avatarUrl: 'https://picsum.photos/seed/global/40/40', urgencyScore: 88, assignedToMe: false },
    { id: 'C-005', contactName: 'Unknown Node', phone: '+1 555 010-9912', lastMessage: 'Delivery Failed', timestamp: '3h ago', unreadCount: 0, sessionStatus: 'expired', avatarUrl: '', urgencyScore: 90, assignedToMe: true, hasFailedMessage: true },
  ]);

  // Mock messages
  const [messages, setMessages] = useState<Message[]>([
    { id: 'm1', sender: 'customer', content: 'Hello, is Dave on his way yet?', timestamp: '10:00 AM', status: 'read' },
    { id: 'm2', sender: 'system', content: 'Automated Dispatch: Technician Dave Miller checked into route.', timestamp: '10:02 AM' },
    { id: 'm3', sender: 'operator', content: 'Hi Marcus, yes Dave is currently 4 mins out. He will enter via the side gate as requested.', timestamp: '10:05 AM', status: 'read' },
    { id: 'm4', sender: 'customer', content: 'Great, thanks. I have the power panel open for him.', timestamp: '10:10 AM', status: 'read' },
    { id: 'm5', sender: 'ai_draft', content: 'Confirmed. Dave will start with the panel inspection. Do you have any specific safety protocols we should note?', timestamp: '10:11 AM' },
    { id: 'm6', sender: 'customer', content: 'Actually, Technician is running 15m late, FYI. Just saw his truck pull over for gas.', timestamp: '10:42 AM' },
  ]);

  const selectedConv = conversations.find(c => c.id === selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedId]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || selectedConv?.sessionStatus === 'expired') return;
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'operator',
      content: messageInput,
      timestamp: 'Just now',
      status: 'sent'
    };
    setMessages([...messages, newMessage]);
    setMessageInput('');
  };

  const getSessionRingColor = (status: SessionStatus) => {
    switch (status) {
      case 'active': return 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
      case 'expiring': return 'border-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'expired': return 'border-zinc-700';
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return c.unreadCount > 0;
    if (activeFilter === 'assigned') return c.assignedToMe;
    if (activeFilter === 'expired') return c.sessionStatus === 'expired';
    if (activeFilter === 'failed') return c.hasFailedMessage;
    return true;
  });

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden font-sans">
      
      {/* Pane A: Triage Rail (Left) */}
      <aside className="w-1/4 min-w-[340px] max-w-[420px] flex flex-col border-r border-zinc-800 bg-zinc-900/20">
        <header className="p-6 space-y-5 border-b border-zinc-800/50">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black uppercase tracking-tighter italic text-indigo-400">Triage Rail</h2>
            <div className="flex items-center space-x-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,1)]"></span>
               <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Protocol: Secure</span>
            </div>
          </div>
          
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner overflow-x-auto no-scrollbar gap-1">
            {['all', 'unread', 'assigned', 'expired', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f as FilterType)}
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === f ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-zinc-800/40">
          {filteredConversations
            .sort((a, b) => b.urgencyScore - a.urgencyScore)
            .map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`p-5 cursor-pointer transition-all hover:bg-zinc-800/30 group relative flex space-x-4 border-l-4 ${selectedId === c.id ? 'bg-zinc-800/50 border-indigo-600 shadow-inner' : 'border-transparent'}`}
            >
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-full border-2 p-0.5 transition-all ${getSessionRingColor(c.sessionStatus)}`}>
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.contactName} className="w-full h-full rounded-full object-cover grayscale opacity-80 group-hover:grayscale-0 transition-all" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500 uppercase">{c.contactName.slice(0, 2)}</div>
                  )}
                </div>
                {c.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-lg border-2 border-zinc-900">
                    {c.unreadCount}
                  </span>
                )}
                {c.hasFailedMessage && (
                  <span className="absolute -bottom-1 -right-1 bg-red-600 text-white w-4 h-4 flex items-center justify-center rounded-full shadow-lg border-2 border-zinc-900">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={3}/></svg>
                  </span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`text-sm font-black uppercase tracking-tight truncate ${selectedId === c.id ? 'text-indigo-400' : 'text-zinc-100'}`}>{c.contactName}</h3>
                  <span className="text-[9px] font-mono font-bold text-zinc-600 shrink-0 ml-2">{c.timestamp}</span>
                </div>
                <div className="flex items-center space-x-2 mb-1.5">
                   {c.jobId && <span className="text-[8px] font-black bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 text-indigo-500/60 uppercase tracking-tighter">{c.jobId}</span>}
                   <span className="text-[9px] font-mono text-zinc-700 truncate">{c.phone}</span>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium italic line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity">"{c.lastMessage}"</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Pane B: Active Thread (Center) */}
      <main className="flex-1 flex flex-col bg-zinc-950 relative border-r border-zinc-800">
        {selectedConv ? (
          <>
            <header className="p-6 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-xl flex justify-between items-center z-10 sticky top-0">
              <div className="flex items-center space-x-4">
                 <div className={`w-10 h-10 rounded-full border-2 p-0.5 ${getSessionRingColor(selectedConv.sessionStatus)}`}>
                    {selectedConv.avatarUrl ? <img src={selectedConv.avatarUrl} alt={selectedConv.contactName} className="w-full h-full rounded-full" /> : <div className="w-full h-full rounded-full bg-zinc-800"></div>}
                 </div>
                 <div>
                    <h2 className="text-sm font-black text-zinc-100 uppercase tracking-widest">{selectedConv.contactName}</h2>
                    <div className="flex items-center space-x-2">
                       <span className={`w-1.5 h-1.5 rounded-full ${selectedConv.sessionStatus === 'active' ? 'bg-emerald-500' : 'bg-zinc-700'}`}></span>
                       <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {selectedConv.sessionStatus === 'active' ? 'Session Active' : 'Session Expired'}
                       </span>
                    </div>
                 </div>
              </div>
              <div className="flex items-center space-x-4">
                 <button className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white rounded-xl transition-all shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5}/></svg></button>
                 <button onClick={() => setIsContextCollapsed(!isContextCollapsed)} className={`p-2.5 border rounded-xl transition-all shadow-sm ${isContextCollapsed ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg></button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')]">
              <div className="flex justify-center">
                 <div className="px-5 py-2 bg-zinc-900/80 backdrop-blur rounded-[1.5rem] text-[9px] font-black uppercase text-zinc-500 tracking-[0.4em] border border-zinc-800 shadow-xl">
                    Archive Snapshot: Today, Oct 24, 2023
                 </div>
              </div>

              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'operator' ? 'items-end' : m.sender === 'system' ? 'items-center' : 'items-start'}`}>
                  {m.sender === 'system' ? (
                    <div className="px-8 py-3 text-[10px] font-black uppercase text-zinc-600 tracking-[0.3em] italic text-center max-w-lg border-y border-zinc-800/30">
                       {m.content}
                    </div>
                  ) : (
                    <div className="group relative max-w-[75%]">
                       <div className={`p-5 rounded-[2.2rem] text-[13px] leading-relaxed shadow-2xl relative ${
                         m.sender === 'operator' ? 'bg-indigo-600 text-white rounded-tr-none' : 
                         m.sender === 'ai_draft' ? 'bg-zinc-950 border-2 border-dashed border-indigo-500/40 text-indigo-300 rounded-tl-none italic' :
                         'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800'
                       }`}>
                          {m.sender === 'ai_draft' && <span className="absolute -top-3 -left-3 bg-indigo-600 text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-xl tracking-widest">AI Proposal (Draft)</span>}
                          {m.content}
                          <div className={`flex items-center space-x-2 mt-3 opacity-30 text-[9px] font-mono font-bold ${m.sender === 'operator' ? 'justify-end' : 'justify-start'}`}>
                             <span>{m.timestamp}</span>
                             {m.status && (
                               <svg className={`w-3.5 h-3.5 ${m.status === 'read' ? 'text-indigo-400 opacity-100' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {m.status === 'read' ? <path d="M5 13l4 4L19 7m-12 5l3 3L20 6" strokeWidth={3}/> : <path d="M5 13l4 4L19 7" strokeWidth={3}/>}
                               </svg>
                             )}
                          </div>
                       </div>
                       {m.sender === 'ai_draft' && (
                         <div className="flex space-x-4 mt-3 ml-2">
                            <button onClick={() => { setMessageInput(m.content); setMessages(messages.filter(msg => msg.id !== m.id)); }} className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-white transition-all">Edit and Dispatch</button>
                            <span className="text-zinc-800">/</span>
                            <button onClick={() => setMessages(messages.filter(msg => msg.id !== m.id))} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-all">Discard</button>
                         </div>
                       )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Session-Aware Composer */}
            <footer className="p-8 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
               <div className="max-w-4xl mx-auto space-y-6">
                  {/* AI Suggested Chips (Active only) */}
                  {selectedConv.sessionStatus !== 'expired' && (
                    <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-1">
                       <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest shrink-0">AI Co-Pilot:</span>
                       {['Apologize for lateness', 'Confirm arrival window', 'Send location link', 'Upsell maintenance'].map((s, i) => (
                          <button key={i} className="px-4 py-2 bg-indigo-900/10 border border-indigo-500/20 rounded-full text-[9px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all whitespace-nowrap shadow-sm active:scale-95">
                             {s}
                          </button>
                       ))}
                    </div>
                  )}

                  {selectedConv.sessionStatus === 'expired' ? (
                     <div className="p-10 bg-zinc-950 border-2 border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-8 animate-in slide-in-from-bottom-2 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.89.524 3.658 1.438 5.162L2 22l4.97-.893A9.957 9.957 0 0012 22z" /></svg></div>
                        <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center border-2 border-zinc-800 shadow-xl text-zinc-600">
                           <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                        </div>
                        <div>
                           <h4 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-400">Authority Session Expired</h4>
                           <p className="text-[11px] text-zinc-600 font-bold italic mt-2 max-w-sm mx-auto">WhatsApp Business API policy restricts free-form input after 24h. Authorized template required.</p>
                        </div>
                        <button 
                          onClick={() => setIsTemplateModalOpen(true)}
                          className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all flex items-center border-2 border-indigo-500"
                        >
                           Send Template Message
                           <svg className="w-5 h-5 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth={3}/></svg>
                        </button>
                     </div>
                  ) : (
                     <div className="relative group">
                        <div className="flex items-center space-x-5 bg-zinc-950 border-2 border-zinc-800 rounded-[3rem] p-4 shadow-2xl focus-within:border-indigo-600/50 transition-all ring-offset-4 ring-indigo-500/0 focus-within:ring-4 focus-within:ring-indigo-600/10">
                           <button className="p-3 bg-zinc-900 text-zinc-600 hover:text-indigo-500 rounded-2xl transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth={3}/></svg></button>
                           <input 
                             value={messageInput}
                             onChange={(e) => setMessageInput(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                             placeholder="Type '/' for templates or message Marcus..." 
                             className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] font-bold text-zinc-100 placeholder:text-zinc-800 italic" 
                           />
                           <div className="flex items-center space-x-6 pr-2">
                              <div className="flex flex-col items-end">
                                 <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Session TTL</span>
                                 <span className="text-[10px] font-mono font-black text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">14:42:01</span>
                              </div>
                              <button onClick={handleSendMessage} className="p-5 bg-indigo-600 text-white rounded-[1.8rem] shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 active:scale-90 transition-all border-2 border-indigo-500">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth={3}/></svg>
                              </button>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-800 opacity-50 space-y-8 p-20 text-center">
            <div className="w-32 h-32 bg-zinc-900 rounded-[4rem] flex items-center justify-center border-4 border-dashed border-zinc-800 opacity-40">
               <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.89.524 3.658 1.438 5.162L2 22l4.97-.893A9.957 9.957 0 0012 22z" strokeWidth={1} /></svg>
            </div>
            <p className="italic font-black text-xl uppercase tracking-[0.4em] max-w-sm leading-relaxed">Select a high-urgency thread for dispatch triage.</p>
          </div>
        )}
      </main>

      {/* Pane C: Context Deck (Right) */}
      {!isContextCollapsed && (
        <aside className="w-1/4 min-w-[340px] bg-zinc-900 border-l border-zinc-800 flex flex-col animate-in slide-in-from-right-4 duration-500">
           {selectedConv ? (
             <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-12 pb-24">
                {/* Identity Widget */}
                <section className="space-y-6">
                   <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Identity Deck</h4>
                      <button className="text-[9px] font-black text-indigo-500 hover:underline uppercase tracking-widest">Inspect Profile</button>
                   </div>
                   <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-[3rem] shadow-sm flex flex-col items-center text-center space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
                      <div className="w-24 h-24 rounded-[3rem] bg-indigo-600/10 border-2 border-indigo-500/20 p-1.5 shadow-2xl">
                         {selectedConv.avatarUrl ? (
                           <img src={selectedConv.avatarUrl} alt="Avatar" className="w-full h-full rounded-[2.5rem] object-cover" />
                         ) : (
                           <div className="w-full h-full rounded-[2.5rem] bg-zinc-800 flex items-center justify-center font-black text-zinc-600 uppercase text-xl">{selectedConv.contactName.slice(0, 2)}</div>
                         )}
                      </div>
                      <div>
                         <h3 className="text-xl font-black uppercase tracking-tight text-zinc-100 italic">{selectedConv.contactName}</h3>
                         <p className="text-[11px] font-mono text-zinc-500 uppercase mt-1.5 tracking-tighter">{selectedConv.phone}</p>
                      </div>
                   </div>
                </section>

                {/* Active Pipeline Widget */}
                <section className="space-y-6">
                   <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Operations Node</h4>
                   <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-[3rem] space-y-6 shadow-sm relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12 group-hover:rotate-0 transition-transform"><svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-900 relative z-10">
                         <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Active Dispatch</span>
                         <span className="text-[12px] font-mono font-black text-indigo-500 tracking-tighter">{selectedConv.jobId || 'UNLINKED'}</span>
                      </div>
                      <div className="space-y-4 relative z-10">
                         <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Pipeline State</span>
                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest italic shadow-sm">In Progress</span>
                         </div>
                         <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Field Tech</span>
                            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-tighter flex items-center">
                               <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2 shadow-[0_0_5px_rgba(79,70,229,0.5)]"></span>
                               Dave Miller
                            </span>
                         </div>
                      </div>
                   </div>
                </section>

                {/* AI Intelligence Summary */}
                <section className="space-y-6">
                   <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-500">AI Narrative Analysis</h4>
                   <div className="p-10 bg-indigo-600/5 border border-indigo-500/20 rounded-[3.5rem] relative overflow-hidden group shadow-2xl">
                      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full group-hover:bg-indigo-500/20 transition-colors"></div>
                      <p className="text-[12px] text-zinc-400 font-bold italic leading-relaxed relative z-10">
                         "Marcus is exhibiting high-urgency signals regarding technician arrival. Mentioned pre-opened access points. Tone detected: Frustrated (+15m delay recorded). Suggested action: Issue service fee credit node (5%) to protect LTV."
                      </p>
                      <div className="pt-6 mt-6 border-t border-zinc-900 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-700 relative z-10">
                         <div className="flex items-center">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            Refined 2m ago
                         </div>
                         <div className="flex space-x-3">
                            <button className="hover:text-indigo-400 transition-colors">👍</button>
                            <button className="hover:text-red-400 transition-colors">👎</button>
                         </div>
                      </div>
                   </div>
                </section>

                {/* Internal Notes */}
                <section className="space-y-6">
                   <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-600">Internal Audit log</h4>
                   <div className="space-y-4">
                      <textarea className="w-full bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 text-[11px] font-medium text-zinc-500 outline-none focus:border-zinc-700 min-h-[140px] transition-all italic leading-relaxed shadow-inner placeholder:text-zinc-900" placeholder="Author internal operational notes..."></textarea>
                      <div className="p-5 bg-zinc-950/50 border border-zinc-900 rounded-[2rem] shadow-sm">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">System Record • Sarah Arch</span>
                            <span className="text-[8px] font-mono text-zinc-800">2023-10-24 09:12</span>
                         </div>
                         <p className="text-[11px] text-zinc-600 font-bold italic">"Watch for billing escalation; Marcus has been sensitive to labor rate transparency during previous Q3 audits."</p>
                      </div>
                   </div>
                </section>
             </div>
           ) : (
             <div className="flex-1 flex items-center justify-center p-12 text-center opacity-20">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">Context Reference Data Restricted</p>
             </div>
           )}
        </aside>
      )}

      {/* TEMPLATE PICKER MODAL (Session Expired) */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 transition-all animate-in zoom-in duration-300">
           <div className="bg-zinc-900 border-2 border-zinc-800 w-full max-w-2xl rounded-[4rem] shadow-2xl relative flex flex-col overflow-hidden h-[80vh]">
              <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600"></div>
              <header className="p-12 pb-6 flex justify-between items-start">
                 <div>
                    <h3 className="text-3xl font-black text-zinc-100 uppercase tracking-tighter">Authorised Templates</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.3em] mt-2 italic">Select for Session Re-Engagement</p>
                 </div>
                 <button onClick={() => setIsTemplateModalOpen(false)} className="p-3 bg-zinc-800 text-zinc-500 hover:text-white rounded-2xl transition-all hover:rotate-90">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                 </button>
              </header>

              <div className="flex-1 overflow-y-auto px-12 py-6 space-y-6 custom-scrollbar">
                 {[
                   { id: 'T1', name: 'Appointment Reminder', body: 'Hello {{1}}, this is a reminder for your scheduled service on {{2}}.' },
                   { id: 'T2', name: 'Maintenance Follow-up', body: 'Hi {{1}}, we noticed your system is due for its Q4 overhaul. Would you like to {{2}}?' },
                   { id: 'T3', name: 'Payment Overdue', body: 'URGENT: Invoice {{1}} for ${{2}} is currently past due. Please resolve at {{3}}.' },
                 ].map(template => (
                   <div key={template.id} className="p-8 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] hover:border-indigo-600 transition-all group cursor-pointer shadow-inner">
                      <div className="flex justify-between items-center mb-4">
                         <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{template.name}</span>
                         <span className="text-[8px] font-mono text-zinc-700 uppercase">META_AUTH_OK</span>
                      </div>
                      <p className="text-[13px] text-zinc-400 font-bold italic leading-relaxed group-hover:text-zinc-200 transition-colors">
                        {template.body.split(/({{[0-9]}})/).map((part, i) => 
                          part.match(/{{[0-9]}}/) ? <span key={i} className="text-indigo-400 bg-indigo-500/5 border border-indigo-500/20 px-1 rounded mx-0.5 not-italic">{part}</span> : part
                        )}
                      </p>
                   </div>
                 ))}
              </div>

              <footer className="p-12 border-t border-zinc-800 bg-zinc-950/50 flex space-x-6">
                 <button onClick={() => setIsTemplateModalOpen(false)} className="flex-1 py-5 border-2 border-zinc-800 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 transition-all hover:bg-zinc-800">Discard</button>
                 <button disabled className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-indigo-600/30 opacity-50 cursor-not-allowed border-2 border-indigo-500">Dispatch Template</button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
};

export default WhatsApp;