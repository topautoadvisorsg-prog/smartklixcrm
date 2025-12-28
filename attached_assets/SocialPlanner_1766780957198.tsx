
import React, { useState } from 'react';

type PlannerTab = 'planner' | 'composer' | 'automation' | 'approvals';
type PostStatus = 'published' | 'scheduled' | 'pending' | 'draft';

interface CalendarEvent {
  id: string;
  date: number; // Day of month for mock
  time: string;
  platform: 'LinkedIn' | 'Instagram' | 'X' | 'Facebook';
  title: string;
  status: PostStatus;
}

const SocialPlanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PlannerTab>('planner');
  const [isEmergencyPause, setIsEmergencyPause] = useState(false);

  // Mock Calendar Events
  const events: CalendarEvent[] = [
    { id: '1', date: 12, time: '2:00 PM', platform: 'X', title: 'New Feature Teaser', status: 'scheduled' },
    { id: '2', date: 23, time: '10:00 AM', platform: 'LinkedIn', title: 'Q3 Performance Highlights', status: 'published' },
    { id: '3', date: 23, time: '11:00 AM', platform: 'Instagram', title: 'Halloween Team Photo', status: 'draft' },
    { id: '4', date: 28, time: '9:00 AM', platform: 'Facebook', title: 'Community Spotlight', status: 'pending' },
  ];

  const getStatusColor = (status: PostStatus) => {
    switch (status) {
      case 'published': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
      case 'scheduled': return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
      case 'pending': return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      case 'draft': return 'bg-zinc-700/30 border-zinc-600/30 text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. Header & Controls */}
      <header className="px-8 py-5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center space-x-8">
           <h1 className="text-xl font-bold text-white tracking-tight">Social Media Planner</h1>
           
           {/* Navigation Tabs */}
           <div className="flex space-x-1">
              {[
                { id: 'planner', label: 'Planner (Calendar)' },
                { id: 'composer', label: 'Composer' },
                { id: 'automation', label: 'Automation (Workflow)' },
                { id: 'approvals', label: 'Approvals' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as PlannerTab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab.id 
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' 
                    : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                   {tab.label}
                </button>
              ))}
           </div>
        </div>

        <button 
          onClick={() => setIsEmergencyPause(!isEmergencyPause)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
             isEmergencyPause 
             ? 'bg-red-600 text-white border-red-500 animate-pulse' 
             : 'bg-red-950/20 border-red-900/50 text-red-400 hover:bg-red-900/40'
          }`}
        >
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           <span className="text-[10px] font-black uppercase tracking-widest">
              {isEmergencyPause ? 'EMERGENCY PAUSE ACTIVE' : 'EMERGENCY PAUSE (Stop All Scheduled Posts)'}
           </span>
        </button>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
         {activeTab === 'planner' && (
            <div className="flex h-full gap-6">
               
               {/* LEFT: CALENDAR */}
               <div className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-3xl p-6 flex flex-col">
                  {/* Calendar Controls */}
                  <div className="flex justify-between items-center mb-6">
                     <div className="flex space-x-2">
                        <button className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                        <button className="px-4 py-2 bg-zinc-800 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-700">Today</button>
                        <button className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                     </div>
                     <h2 className="text-xl font-bold text-white">October 2024</h2>
                     <div className="flex bg-zinc-800 p-1 rounded-lg">
                        <button className="px-3 py-1 bg-zinc-700 rounded text-[10px] font-bold text-white shadow-sm">Month</button>
                        <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-300">Week</button>
                        <button className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-300">Day</button>
                     </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-px bg-zinc-800 border border-zinc-800 rounded-2xl overflow-hidden">
                     {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                        <div key={d} className="bg-zinc-900 p-2 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{d}</div>
                     ))}
                     {/* Days padding + actual days (Simplified for mock) */}
                     {[...Array(35)].map((_, i) => {
                        const day = i - 2; // Offset for Oct 1st start
                        const dayEvents = events.filter(e => e.date === day);
                        const isToday = day === 24;
                        
                        return (
                           <div key={i} className={`bg-zinc-900/50 p-2 min-h-[100px] relative hover:bg-zinc-800/30 transition-colors ${day <= 0 ? 'bg-zinc-950/50' : ''}`}>
                              {day > 0 && day <= 31 && (
                                 <>
                                    <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-zinc-500'}`}>
                                       {day}
                                    </span>
                                    <div className="mt-2 space-y-1">
                                       {dayEvents.map(ev => (
                                          <div key={ev.id} className={`p-1.5 rounded border text-[9px] font-medium leading-tight ${getStatusColor(ev.status)}`}>
                                             <div className="font-bold mb-0.5">{ev.time}</div>
                                             <div className="truncate">{ev.platform}: {ev.title}</div>
                                             {ev.status === 'pending' && <div className="mt-1 flex items-center"><svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg> Pending Approval</div>}
                                             {ev.status === 'published' && <div className="mt-1 text-[8px] font-bold uppercase tracking-wider">Published</div>}
                                             {ev.status === 'scheduled' && <div className="mt-1 text-[8px] font-bold uppercase tracking-wider">Scheduled</div>}
                                          </div>
                                       ))}
                                    </div>
                                 </>
                              )}
                           </div>
                        );
                     })}
                  </div>
               </div>

               {/* RIGHT: COMPOSER & APPROVALS */}
               <div className="w-[500px] flex flex-col gap-6">
                  
                  {/* COMPOSER CARD */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 shadow-xl flex flex-col h-[480px]">
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-zinc-400">Post Content</span>
                        <span className="text-xs font-bold text-zinc-400">Platform Preview</span>
                     </div>
                     <div className="flex-1 flex gap-4">
                        {/* Editor Input */}
                        <div className="flex-1 flex flex-col space-y-4">
                           <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex-1 relative">
                              <textarea 
                                className="w-full h-full bg-transparent text-xs text-zinc-300 outline-none resize-none placeholder:text-zinc-700" 
                                placeholder="Type your post content..."
                                defaultValue="Linkedin Q3 Performance Highlights at concerts markets and vine improvements."
                              />
                              <div className="absolute bottom-3 left-3 text-[9px] font-mono text-zinc-600">LinkedIn: 1245/3000</div>
                              <div className="absolute bottom-3 right-3 text-[9px] font-mono text-zinc-600">X: 258/280</div>
                           </div>
                           
                           {/* Media Drag Drop */}
                           <div className="h-20 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 hover:border-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">
                              <span className="text-[10px] font-bold uppercase tracking-wide">Drag-and-drop post here</span>
                           </div>

                           <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all">
                              Schedule for Approval
                           </button>
                        </div>

                        {/* Preview */}
                        <div className="w-[180px] bg-white rounded-xl border-4 border-zinc-800 overflow-hidden flex flex-col">
                           <div className="bg-white p-3 border-b border-gray-100 flex items-center space-x-2">
                              <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" className="w-5 h-5" alt="LI" />
                              <div className="flex-1 min-w-0">
                                 <div className="h-1.5 w-16 bg-gray-200 rounded mb-1"></div>
                                 <div className="h-1 w-10 bg-gray-100 rounded"></div>
                              </div>
                           </div>
                           <div className="p-3 space-y-2">
                              <p className="text-[7px] text-gray-600 leading-relaxed">
                                 LinkedIn: Q3 Performance Highlights ar conacts markets and wims and eoarres rariganmvoeements.
                              </p>
                              <div className="h-16 bg-blue-50 rounded border border-blue-100 flex items-center justify-center">
                                 <svg className="w-6 h-6 text-blue-200" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* APPROVALS QUEUE */}
                  <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col">
                     <div className="flex space-x-6 border-b border-zinc-800 pb-4 mb-4">
                        <button className="text-xs font-bold text-zinc-500 hover:text-white transition-colors">Pending Posts</button>
                        <button className="text-xs font-bold text-zinc-500 hover:text-white transition-colors">Automation (Workflow)</button>
                        <button className="text-xs font-bold text-white border-b-2 border-blue-500 -mb-4 pb-4">Approvals</button>
                     </div>

                     <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-sm font-bold text-white">Pending Posts</span>
                           <span className="text-[9px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 border border-zinc-700">Requires Approval</span>
                        </div>

                        {[1, 2].map(i => (
                           <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-3">
                              <div className="grid grid-cols-3 gap-2 text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                                 <div>Author</div>
                                 <div>Platform</div>
                                 <div>Scheduled For</div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-300 font-medium">
                                 <div>Sarah C.</div>
                                 <div>Linkedin</div>
                                 <div>Oct 28, 9:00 AM</div>
                              </div>
                              <div className="text-[10px] text-zinc-400 italic bg-zinc-900 p-2 rounded border border-zinc-800">
                                 "Excited to share our latest..."
                              </div>
                              <div className="flex space-x-2 pt-1">
                                 <button className="flex-1 py-1.5 rounded border border-red-900/50 text-red-500 hover:bg-red-950/30 text-[9px] font-black uppercase tracking-wider transition-colors">Reject</button>
                                 <button className="flex-1 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 text-[9px] font-black uppercase tracking-wider transition-colors">Approve</button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default SocialPlanner;
