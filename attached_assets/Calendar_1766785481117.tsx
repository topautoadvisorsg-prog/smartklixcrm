
import React, { useState, useEffect } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO String for logic
  end: string;   // ISO String for logic
  displayTime: string; // Pre-formatted for UI
  type: 'installation' | 'meeting' | 'follow_up' | 'maintenance' | 'site_visit' | 'general';
  linkedEntity?: string;
  entityType?: 'Contact' | 'Job' | 'Deal';
  location?: string;
  attendees: string[];
  description?: string;
  externalUrl: string;
}

const Calendar: React.FC = () => {
  // Simulated System Time: "2023-10-24T10:30:00"
  // Used to demonstrate Active/Imminent states
  const MOCK_NOW = new Date('2023-10-24T10:30:00'); 
  
  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false); // New: Throttle state
  const [showUnlinked, setShowUnlinked] = useState(false);
  const [error, setError] = useState<string | null>(null); // New: Error state

  const events: CalendarEvent[] = [
    { 
      id: 'CAL-001', 
      title: 'HVAC Install: Apex Site B', 
      start: '2023-10-24T10:00:00', 
      end: '2023-10-24T14:00:00', 
      displayTime: '10:00 AM - 02:00 PM',
      type: 'installation', 
      linkedEntity: 'Apex Logistics', 
      entityType: 'Job', 
      location: '124 Industrial Way', 
      attendees: ['Dave Miller', 'Marcus Vane'], 
      description: 'Primary system deployment for server cluster 4.',
      externalUrl: 'https://calendar.google.com/event?id=1'
    },
    { 
      id: 'CAL-002', 
      title: 'TechFlow Infrastructure Review', 
      start: '2023-10-24T15:00:00', 
      end: '2023-10-24T16:00:00', 
      displayTime: '03:00 PM - 04:00 PM',
      type: 'meeting', 
      linkedEntity: 'TechFlow Systems', 
      entityType: 'Contact', 
      location: 'Virtual Hub', 
      attendees: ['Ayla Vance', 'Sarah Arch'], 
      description: 'Q4 planning and capacity audit.',
      externalUrl: 'https://calendar.google.com/event?id=2'
    },
    { 
      id: 'CAL-003', 
      title: 'Duct Cleaning Follow-up', 
      start: '2023-10-25T08:30:00', 
      end: '2023-10-25T09:30:00', 
      displayTime: 'Tomorrow, 08:30 AM',
      type: 'follow_up', 
      linkedEntity: 'James Miller', 
      entityType: 'Contact', 
      attendees: ['Sarah Arch'], 
      description: 'Verify satisfaction on residential job #7712.',
      externalUrl: 'https://calendar.google.com/event?id=3'
    },
    { 
      id: 'CAL-004', 
      title: 'Internal Team Lunch', 
      start: '2023-10-24T12:00:00', 
      end: '2023-10-24T13:00:00', 
      displayTime: '12:00 PM - 01:00 PM',
      type: 'general', 
      // No Linked Entity (Unlinked Event)
      location: 'Break Room', 
      attendees: ['All Staff'],
      externalUrl: 'https://calendar.google.com/event?id=4'
    },
    { 
      id: 'CAL-005', 
      title: 'Site Visit: Tokyo Hub Prep', 
      start: '2023-10-30T09:00:00', 
      end: '2023-10-30T11:00:00', 
      displayTime: 'Oct 30, 09:00 AM',
      type: 'site_visit', 
      linkedEntity: 'Tokyo-Hub.net', 
      entityType: 'Deal', 
      location: '6 Chome-10-1 Roppongi', 
      attendees: ['Hiroshi Tan', 'Sarah Arch'],
      externalUrl: 'https://calendar.google.com/event?id=5'
    },
  ];

  const handleRefresh = () => {
    if (isRateLimited) return; // Prevent abuse
    
    setIsRefreshing(true);
    setIsRateLimited(true);
    setError(null);

    // Simulate API Fetch with potential random error for demo
    setTimeout(() => {
      // 10% chance of error simulation
      if (Math.random() > 0.9) {
         setError("Google Calendar API connection timed out. Please try again.");
      } else {
         setLastSynced(new Date().toLocaleTimeString());
      }
      setIsRefreshing(false);
      
      // Enforce 5s cooldown
      setTimeout(() => setIsRateLimited(false), 5000);
    }, 800);
  };

  const getEventStatus = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const now = MOCK_NOW;

    if (now >= s && now <= e) return 'active';
    if (now < s && (s.getTime() - now.getTime()) <= 60 * 60 * 1000) return 'imminent';
    if (now > e) return 'completed';
    return 'future';
  };

  const getTypeStyle = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'installation': return 'bg-indigo-600 shadow-indigo-600/30';
      case 'meeting': return 'bg-amber-500 shadow-amber-500/30';
      case 'follow_up': return 'bg-emerald-500 shadow-emerald-500/30';
      case 'maintenance': return 'bg-blue-500 shadow-blue-500/30';
      case 'site_visit': return 'bg-purple-600 shadow-purple-600/30';
      default: return 'bg-zinc-600 shadow-zinc-600/30';
    }
  };

  const filteredEvents = events.filter(e => showUnlinked || e.linkedEntity);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 transition-colors overflow-hidden font-sans">
      <header className="p-8 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Scheduling Mirror</h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 uppercase font-black tracking-[0.4em] italic flex items-center">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              Authority Source: Google Calendar
            </p>
          </div>
          <div className="flex items-center space-x-6">
             <div className="flex items-center space-x-3 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <button 
                  onClick={() => setShowUnlinked(false)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!showUnlinked ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                   Linked Only
                </button>
                <button 
                  onClick={() => setShowUnlinked(true)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${showUnlinked ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                   Show All
                </button>
             </div>

             <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800"></div>

             <div className="flex items-center space-x-3">
               <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-tight">Synced: {lastSynced}</span>
               <button 
                 onClick={handleRefresh}
                 disabled={isRateLimited}
                 className={`p-2.5 bg-white dark:bg-zinc-800 border-2 rounded-xl text-slate-600 dark:text-zinc-300 transition-all shadow-sm ${
                   isRateLimited 
                     ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-zinc-700' 
                     : 'hover:border-indigo-500 hover:text-indigo-500 border-slate-200 dark:border-zinc-700'
                 } ${isRefreshing ? 'animate-spin' : ''}`}
                 title={isRateLimited ? "Refresh Cooldown Active" : "Manual Refresh"}
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
               </button>
             </div>
          </div>
        </div>
      </header>

      {/* ERROR BANNER (If Active) */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-900/30 px-8 py-3 flex items-center justify-center animate-in slide-in-from-top-2">
           <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
           <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">{error}</span>
           <button onClick={() => setError(null)} className="ml-4 text-[9px] font-bold underline text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
         <div className="flex justify-between items-center mb-10">
            <div className="flex space-x-8 items-center">
               <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Tuesday, Oct 24</h2>
               <div className="flex space-x-2">
                  <button className="p-3 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:text-indigo-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg></button>
                  <button className="p-3 bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:text-indigo-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg></button>
               </div>
            </div>
            <div className="flex space-x-4">
               {['Day', 'Week', 'Month'].map((view, i) => (
                  <button key={view} className={`px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${i === 0 ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-800' : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{view}</button>
               ))}
            </div>
         </div>

         <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] shadow-xl overflow-hidden flex flex-col flex-1 relative">
            <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-20">
               {filteredEvents.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mb-6">
                       <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">No scheduled events</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 italic">Check filters or refresh to sync with Google Calendar</p>
                 </div>
               ) : (
                 <div className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                    {filteredEvents.map((event) => {
                       const status = getEventStatus(event.start, event.end);
                       const isActive = status === 'active';
                       const isImminent = status === 'imminent';
                       const isUnlinked = !event.linkedEntity;

                       return (
                       <div 
                          key={event.id} 
                          onClick={() => window.open(event.externalUrl, '_blank')}
                          className={`p-12 flex group hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-all cursor-pointer relative overflow-hidden ${isUnlinked ? 'opacity-60 grayscale' : ''}`}
                       >
                          <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-5 transition-opacity">
                             {getTypeStyle(event.type)}
                          </div>
                          
                          {/* Time Column */}
                          <div className="w-56 shrink-0 space-y-2">
                             <span className={`text-2xl font-black tracking-tighter uppercase italic ${isActive ? 'text-emerald-500' : 'text-slate-900 dark:text-zinc-100'}`}>
                                {event.start.includes('T') ? new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : event.start}
                             </span>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-mono">{event.displayTime}</p>
                             
                             {isActive && <span className="inline-block mt-3 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm animate-pulse">Now Active</span>}
                             {isImminent && <span className="inline-block mt-3 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20 shadow-sm">Imminent</span>}
                          </div>

                          {/* Details Column */}
                          <div className="flex-1 space-y-8">
                             <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                   <h3 className="text-3xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter group-hover:text-indigo-600 transition-colors leading-none">{event.title}</h3>
                                   <div className="flex items-center space-x-4">
                                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-[0.25em] shadow-lg ${getTypeStyle(event.type)}`}>{event.type.replace('_', ' ')}</span>
                                      {event.linkedEntity ? (
                                        <div className="flex items-center space-x-2">
                                           <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-zinc-700">{event.entityType}</span>
                                           <span className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.2em] italic">REF: {event.linkedEntity}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Unlinked Event</span>
                                      )}
                                   </div>
                                </div>
                                <div className="flex -space-x-4">
                                   {event.attendees.map((a, i) => (
                                      <div key={i} className="w-12 h-12 rounded-full border-4 border-white dark:border-zinc-900 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-black text-slate-500 shadow-sm transition-transform group-hover:scale-110" title={a}>{a.charAt(0)}</div>
                                   ))}
                                </div>
                             </div>
                             
                             {event.description && (
                               <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 italic max-w-2xl leading-relaxed">"{event.description}"</p>
                             )}

                             {event.location && (
                               <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                                  <svg className="w-5 h-5 text-indigo-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2.5}/></svg>
                                  <span>{event.location}</span>
                               </div>
                             )}
                          </div>

                          {/* Action Column */}
                          <div className="w-24 flex flex-col items-end justify-center opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                             <div className="p-5 bg-zinc-950 text-white rounded-[1.5rem] shadow-2xl border-2 border-zinc-800 group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-colors">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={3}/></svg>
                             </div>
                             <span className="text-[8px] font-black uppercase text-zinc-500 mt-2 tracking-widest text-center w-full">Open GCal</span>
                          </div>
                       </div>
                    )})}
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Calendar;
