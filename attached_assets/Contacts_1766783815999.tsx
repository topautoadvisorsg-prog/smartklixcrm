
import React, { useState } from 'react';
import { TabType } from '../../types';

interface JobHistory {
  id: string;
  title: string;
  status: 'Complete' | 'In Progress' | 'Closed';
  date: string;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive' | 'lead' | 'vip';
  warmth: number; // 0-100
  churnRisk: number; // 0-100 (Low is good)
  lastContact: string;
  lifecycle: 'prospect' | 'customer' | 'churned';
  owner: string;
  totalRevenue: string;
  recentJobs: JobHistory[];
  sentimentTrend: number[]; // Array of values for sparkline
}

interface ContactsProps {
  onNavigate?: (tab: TabType) => void;
}

const Contacts: React.FC<ContactsProps> = ({ onNavigate }) => {
  const [selectedId, setSelectedId] = useState<string>('CON-001');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock Data matching the visual reference
  const contacts: Contact[] = [
    { 
      id: 'CON-001', 
      name: 'Sarah Jenkins', 
      company: 'Acme Corp.', 
      role: 'VP of Ops', 
      email: 'sarah.j@acmecorp.com', 
      phone: '+1-555-019-2200', 
      address: '123 Main St, Anytown, USA',
      status: 'vip', 
      warmth: 85, 
      churnRisk: 12,
      lastContact: '2h ago', 
      lifecycle: 'customer', 
      owner: 'Sarah Arch', 
      totalRevenue: '$245,000',
      sentimentTrend: [60, 65, 62, 70, 75, 80, 85],
      recentJobs: [
        { id: 'J-9942', title: 'Enterprise Onboarding', status: 'Complete', date: 'Oct 25' },
        { id: 'J-9810', title: 'Q3 Review', status: 'In Progress', date: 'Oct 10' },
        { id: 'J-9755', title: 'Initial Consultation', status: 'Closed', date: 'Sep 28' },
      ]
    },
    { 
      id: 'CON-002', 
      name: 'Jarah Flanes', 
      company: 'Acme Corp.', 
      role: 'VP of Ops', 
      email: 'jarah.f@acmecorp.com', 
      phone: '+1-555-019-2201', 
      address: '123 Main St, Anytown, USA',
      status: 'active', 
      warmth: 45, 
      churnRisk: 60,
      lastContact: '1d ago', 
      lifecycle: 'customer', 
      owner: 'Michael Gov', 
      totalRevenue: '$12,500',
      sentimentTrend: [50, 45, 40, 45, 42, 45, 45],
      recentJobs: []
    },
    { 
      id: 'CON-003', 
      name: 'Joman Evew', 
      company: 'Acme Corp.', 
      role: 'VP of Ops', 
      email: 'joman@acmecorp.com', 
      phone: '+1-555-019-2202', 
      address: '123 Main St, Anytown, USA',
      status: 'active', 
      warmth: 20, 
      churnRisk: 85,
      lastContact: '5d ago', 
      lifecycle: 'prospect', 
      owner: 'Sarah Arch', 
      totalRevenue: '$0',
      sentimentTrend: [30, 25, 20, 15, 20, 18, 20],
      recentJobs: []
    },
    { 
      id: 'CON-004', 
      name: 'Sarah Jenkins', 
      company: 'Acme Corp.', 
      role: 'VP of Ops', 
      email: 'sarah.duplicate@acmecorp.com', 
      phone: '+1-555-019-2203', 
      address: '123 Main St, Anytown, USA',
      status: 'active', 
      warmth: 85, 
      churnRisk: 12,
      lastContact: '15m ago', 
      lifecycle: 'customer', 
      owner: 'Sarah Arch', 
      totalRevenue: '$18,900',
      sentimentTrend: [70, 72, 75, 78, 80, 82, 85],
      recentJobs: []
    },
    { 
      id: 'CON-005', 
      name: 'Joman Edew', 
      company: 'Acme Corp.', 
      role: 'VP of Ops', 
      email: 'joman.e@acmecorp.com', 
      phone: '+1-555-019-2204', 
      address: '123 Main St, Anytown, USA',
      status: 'inactive', 
      warmth: 12, 
      churnRisk: 95,
      lastContact: '3mo ago', 
      lifecycle: 'churned', 
      owner: 'Michael Gov', 
      totalRevenue: '$12,000',
      sentimentTrend: [20, 15, 10, 5, 5, 5, 12],
      recentJobs: []
    },
  ];

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedContact = contacts.find(c => c.id === selectedId) || contacts[0];

  // --- Visual Helpers ---

  const renderCircularWarmth = (percentage: number) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    let color = 'text-red-500';
    if (percentage > 75) color = 'text-purple-500';
    else if (percentage > 40) color = 'text-amber-500';

    return (
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
          <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={color} strokeLinecap="round" />
        </svg>
      </div>
    );
  };

  const renderSparkline = (data: number[]) => {
    const max = 100;
    const min = 0;
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / (max - min)) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={`M0,100 L${points} L100,100 Z`} fill="url(#gradient)" opacity="0.2" />
        <path d={`M${points}`} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="flex h-full bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. SIDEBAR LIST */}
      <aside className="w-[320px] flex flex-col border-r border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="p-5 border-b border-zinc-800 space-y-4">
           <h2 className="text-xl font-bold text-zinc-200">Contacts ({contacts.length.toLocaleString()})</h2>
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
              />
              <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
           {filteredContacts.map(c => (
              <div 
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all group ${selectedId === c.id ? 'bg-indigo-900/20 border border-indigo-500/30' : 'hover:bg-zinc-800/50 border border-transparent'}`}
              >
                 <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                       <img src={`https://ui-avatars.com/api/?name=${c.name}&background=random&color=fff`} alt={c.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                       <div className={`text-sm font-bold truncate ${selectedId === c.id ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-200'}`}>{c.name}</div>
                       <div className="text-[10px] text-zinc-500 truncate">{c.role} @ {c.company}</div>
                       <div className="text-[10px] text-zinc-600 mt-0.5 truncate">Last Activity: {c.lastContact}</div>
                    </div>
                 </div>
                 <div className="flex flex-col items-end space-y-1 shrink-0 ml-2">
                    {renderCircularWarmth(c.warmth)}
                    <span className="text-[9px] font-bold text-zinc-500">Warmth: {c.warmth < 30 ? 'Low' : 'High'}</span>
                 </div>
              </div>
           ))}
        </div>
      </aside>

      {/* 2. MAIN DETAIL VIEW */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
         
         {/* Detail Header */}
         <header className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
            <div className="flex items-center space-x-6">
               <div className="w-20 h-20 rounded-full bg-zinc-800 p-1 border border-zinc-700">
                  <img src={`https://ui-avatars.com/api/?name=${selectedContact.name}&background=random&size=128`} alt="Profile" className="w-full h-full rounded-full object-cover" />
               </div>
               <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{selectedContact.name}</h1>
                  <p className="text-sm text-zinc-400 font-medium mt-1">{selectedContact.role} @ <span className="text-zinc-300">{selectedContact.company}</span></p>
               </div>
            </div>
            
            <div className="flex items-center">
               <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  <span>Send Intake Request (Initiate Only)</span>
               </button>
            </div>
         </header>

         {/* 3-Column Content Grid */}
         <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-12 gap-8 h-full min-h-[600px]">
               
               {/* COL 1: STATIC IDENTITY (EDITABLE) */}
               <div className="col-span-4 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 flex flex-col">
                  <div className="mb-6 flex justify-between items-center">
                     <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Static Identity [Editable]</h3>
                  </div>
                  
                  <div className="space-y-5 flex-1">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Full Name</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.name} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Title</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.role} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Company</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.company} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Email</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.email} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Phone</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.phone} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Address</label>
                        <input className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 transition-colors" defaultValue={selectedContact.address} />
                     </div>
                  </div>

                  <button className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                     Save Changes
                  </button>
               </div>

               {/* COL 2: RELATIONSHIP SIGNALS (AI-DERIVED) */}
               <div className="col-span-4 bg-transparent border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden flex flex-col shadow-[0_0_30px_rgba(168,85,247,0.05)]">
                  {/* Glass Background Effect */}
                  <div className="absolute inset-0 bg-purple-900/5 backdrop-blur-sm pointer-events-none"></div>
                  
                  <div className="relative z-10 mb-8 flex justify-between items-start">
                     <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Relationship Signals [AI-Derived | Read-Only]</h3>
                  </div>

                  <div className="relative z-10 space-y-8 flex-1">
                     
                     {/* Warmth Score */}
                     <div className="bg-zinc-900/50 border border-purple-500/10 rounded-2xl p-6 flex flex-col items-center justify-center relative">
                        <div className="absolute top-3 right-3 text-zinc-600"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg></div>
                        <span className="text-xs font-bold text-zinc-400 mb-4">Warmth Score</span>
                        
                        {/* Gauge */}
                        <div className="relative w-40 h-20 overflow-hidden">
                           <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-zinc-800 box-border"></div>
                           <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-transparent border-t-purple-500 border-r-purple-500 box-border transform -rotate-45" style={{ transform: `rotate(${-45 + (selectedContact.warmth / 100) * 180}deg)` }}></div>
                        </div>
                        <div className="text-3xl font-bold text-white -mt-10">{selectedContact.warmth}/100</div>
                        <div className="text-[10px] text-purple-400 font-bold uppercase mt-1">(High)</div>
                        <div className="text-[9px] text-zinc-600 mt-2">Source: Discovery AI</div>
                     </div>

                     {/* Churn Risk */}
                     <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                           <span className="font-bold text-zinc-400">Churn Risk</span>
                           <svg className="w-3 h-3 text-zinc-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
                           <div className={`h-full rounded-full ${selectedContact.churnRisk < 30 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${selectedContact.churnRisk}%` }}></div>
                        </div>
                        <div className="text-[10px] text-emerald-500 font-bold">{selectedContact.churnRisk}% (Low Risk)</div>
                     </div>

                     {/* Last Interaction */}
                     <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start space-x-3">
                        <svg className="w-5 h-5 text-zinc-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        <div>
                           <div className="text-[10px] font-bold text-zinc-300">Last Interaction</div>
                           <div className="text-xs text-zinc-400">Email Received ({selectedContact.lastContact})</div>
                        </div>
                     </div>

                     {/* Sentiment Trend */}
                     <div>
                        <div className="text-[10px] font-bold text-zinc-400 mb-2">Sentiment Trend</div>
                        <div className="h-16 w-full bg-zinc-900/30 rounded-xl border border-zinc-800/50 pt-2 px-2">
                           {renderSparkline(selectedContact.sentimentTrend)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">Positive</div>
                     </div>

                  </div>

                  <div className="relative z-10 mt-auto pt-4 border-t border-purple-500/10">
                     <p className="text-[9px] text-zinc-600 leading-tight">
                        Signals are advisory and owned by Discovery AI.<br/>No manual edits permitted.
                     </p>
                  </div>
               </div>

               {/* COL 3: LEDGER AGGREGATES (READ-ONLY) */}
               <div className="col-span-4 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 flex flex-col">
                  <div className="mb-8">
                     <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4">Ledger Aggregates & History [Read-Only Viewport]</h3>
                     
                     <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center shadow-inner">
                        <div className="text-4xl font-bold text-white tracking-tight">{selectedContact.totalRevenue}</div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Lifetime Revenue (Settled)</div>
                        <div className="text-[9px] text-zinc-700 mt-1">Source: Ledger</div>
                     </div>
                  </div>

                  <div className="flex-1">
                     <div className="text-xs font-bold text-zinc-300 mb-4">Recent Job History ({selectedContact.recentJobs.length})</div>
                     
                     <div className="space-y-3">
                        {selectedContact.recentJobs.map(job => (
                           <div key={job.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex justify-between items-center group hover:border-zinc-700 transition-colors">
                              <div>
                                 <div className="text-xs font-bold text-zinc-200 group-hover:text-white">Job #{job.id}: {job.title}</div>
                                 <div className="text-[10px] text-zinc-500 mt-1">Status: <span className="text-zinc-300">{job.status}</span></div>
                                 <div className="text-[10px] text-zinc-600">Date: {job.date}</div>
                              </div>
                              <button 
                                onClick={() => onNavigate && onNavigate(TabType.Jobs)}
                                className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                 [Jump to Job] ↗
                              </button>
                           </div>
                        ))}
                        {selectedContact.recentJobs.length === 0 && (
                           <div className="text-center py-8 text-zinc-600 text-xs italic">No recent job history found in Ledger.</div>
                        )}
                     </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-zinc-800">
                     <p className="text-[9px] text-zinc-600 leading-tight">
                        Data reflected from the Ledger and Jobs modules.<br/>Edits must be made at the source.
                     </p>
                  </div>
               </div>

            </div>
         </div>

      </main>
    </div>
  );
};

export default Contacts;
