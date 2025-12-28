
import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'action_ai';
  content: string;
  timestamp: string;
  proposalId?: string; // If ActionAI generates a proposal
}

const ActionChat: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: 'msg_1', 
      role: 'system', 
      content: 'ActionAI Console Online. I am the operational brain. I can propose actions, drafts, and record updates based on your commands. All output requires governance approval.', 
      timestamp: '10:00 AM' 
    },
    {
      id: 'msg_2',
      role: 'user',
      content: 'Draft a follow-up email to Marcus Vane regarding the delay.',
      timestamp: '10:01 AM'
    },
    {
      id: 'msg_3',
      role: 'action_ai',
      content: 'I have generated a draft email proposal based on your instruction.',
      timestamp: '10:01 AM',
      proposalId: 'P-302'
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: 'Just now'
    };
    setMessages([...messages, newMsg]);
    setInput('');

    // Simulate AI thinking and proposing
    setTimeout(() => {
      const responseMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'action_ai',
        content: `I've analyzed your request. A new Action Proposal has been created for Architect review.`,
        timestamp: 'Just now',
        proposalId: `P-${Math.floor(Math.random() * 1000)}`
      };
      setMessages(prev => [...prev, responseMsg]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 transition-colors">
      <header className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex justify-between items-center backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center space-x-4">
           <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
           </div>
           <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Action Console</h2>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-[0.3em] mt-0.5">Direct Brain Interface</p>
           </div>
        </div>
        <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center">
           <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
           System Active
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar" ref={scrollRef}>
         {messages.map((msg) => (
           <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${msg.role === 'user' ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800' : 'bg-slate-100 dark:bg-zinc-900/50 text-slate-700 dark:text-zinc-300 border border-transparent'} p-6 rounded-[2rem] shadow-sm relative group`}>
                 <div className="flex justify-between items-center mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'action_ai' ? 'text-indigo-500' : 'text-slate-400'}`}>
                       {msg.role === 'action_ai' ? 'ActionAI Engine' : msg.role === 'user' ? 'Operator' : 'System'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 opacity-60">{msg.timestamp}</span>
                 </div>
                 <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                 
                 {msg.proposalId && (
                   <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700/50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                         <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proposal Pending</span>
                      </div>
                      <span className="px-3 py-1 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-mono font-black text-indigo-500 cursor-pointer hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors">
                         VIEW {msg.proposalId}
                      </span>
                   </div>
                 )}
              </div>
           </div>
         ))}
      </div>

      <div className="p-8 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
         <div className="max-w-4xl mx-auto relative group">
            <div className="absolute inset-0 bg-indigo-500/5 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            <div className="relative flex items-center bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-2 shadow-2xl focus-within:border-indigo-500 transition-all">
               <input 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                 placeholder="Instruct ActionAI (e.g., 'Create a lead for Acme Corp')..." 
                 className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-sm font-bold text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
               />
               <button 
                 onClick={handleSend}
                 className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
               </button>
            </div>
            <div className="text-center mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-600">
               Governance Active: All instructions are drafted as proposals for review.
            </div>
         </div>
      </div>
    </div>
  );
};

export default ActionChat;
