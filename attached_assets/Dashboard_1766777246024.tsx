
import React, { useState, useEffect } from 'react';
import { TabType } from '../../types';

interface DashboardProps {
  onNavigate: (tab: TabType) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("10:05:55 AM");

  useEffect(() => {
    // Simulate System Boot / Data Handshake
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }, 800);
  };

  const kpis = [
    { 
      label: 'Active Missions', 
      value: '42', 
      subtext: '15 in progress, 27 pending start', 
      icon: 'rocket', 
      tab: TabType.AiVoice 
    },
    { 
      label: 'Awaiting Review', 
      value: '8', 
      subtext: 'Proposals > 24h old', 
      icon: 'inbox', 
      tab: TabType.ReviewQueue 
    },
    { 
      label: 'Completion Rate (24h)', 
      value: '94%', 
      subtext: '+2% from yesterday', 
      icon: 'check', 
      tab: TabType.Ledger 
    },
    { 
      label: 'Pipeline Value (Forecast)', 
      value: '$1.25M', 
      subtext: 'Weighted probability', 
      icon: 'coin', 
      tab: TabType.Pipeline 
    },
  ];

  const activityFeed = [
    { time: '10:05 AM', status: 'success', action: 'Payload Dispatch (Voice)', details: 'To: Sarah C.', id: '#L-5592' },
    { time: '09:58 AM', status: 'success', action: 'Job Completion', details: 'By: T. Edison', id: '#L-5591' },
    { time: '09:45 AM', status: 'failed', action: 'Email Bounce', details: 'To: invalid@example.com', id: '#L-5590' },
    { time: '09:30 AM', status: 'success', action: 'Proposal Approved', details: 'Client: Wayne Ent.', id: '#L-5589' },
  ];

  // Helper to render icons based on string key
  const renderIcon = (name: string) => {
    switch (name) {
      case 'rocket': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>; 
      case 'inbox': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>;
      case 'check': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'coin': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      default: return null;
    }
  };

  // --- SKELETON LOADER FOR BOOT SEQUENCE ---
  if (isBooting) {
    return (
      <div className="flex flex-col h-full bg-[#050505] p-6 space-y-8 animate-in fade-in duration-500">
         {/* Header Skeleton */}
         <div className="flex justify-between items-center shrink-0">
            <div className="space-y-2">
               <div className="h-6 w-64 bg-zinc-900 rounded-lg animate-pulse"></div>
               <div className="h-4 w-32 bg-zinc-900/50 rounded-lg animate-pulse"></div>
            </div>
            <div className="h-8 w-48 bg-zinc-900 rounded-lg animate-pulse"></div>
         </div>

         {/* KPI Skeleton */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
            {[1,2,3,4].map(i => (
               <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 h-32 flex flex-col justify-between animate-pulse">
                  <div className="flex justify-between">
                     <div className="h-3 w-24 bg-zinc-800 rounded"></div>
                     <div className="h-5 w-5 bg-zinc-800 rounded-full"></div>
                  </div>
                  <div className="space-y-2">
                     <div className="h-8 w-16 bg-zinc-800 rounded"></div>
                     <div className="h-3 w-32 bg-zinc-800/50 rounded"></div>
                  </div>
               </div>
            ))}
         </div>

         {/* Charts Skeleton */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-80 shrink-0">
            <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 animate-pulse">
               <div className="flex justify-between mb-8">
                  <div className="h-4 w-40 bg-zinc-800 rounded"></div>
                  <div className="h-4 w-20 bg-zinc-800 rounded"></div>
               </div>
               <div className="flex items-end space-x-2 h-48">
                  {[...Array(12)].map((_, i) => (
                     <div key={i} className="flex-1 bg-zinc-800/30 rounded-t" style={{ height: `${Math.random() * 100}%` }}></div>
                  ))}
               </div>
            </div>
            <div className="flex flex-col space-y-6">
               <div className="flex-1 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 animate-pulse"></div>
               <div className="flex-1 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-5 animate-pulse"></div>
            </div>
         </div>

         {/* Feed Skeleton */}
         <div className="flex-1 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 animate-pulse">
            <div className="h-4 w-48 bg-zinc-800 rounded mb-6"></div>
            <div className="space-y-4">
               {[1,2,3].map(i => (
                  <div key={i} className="h-12 w-full bg-zinc-800/30 rounded-xl"></div>
               ))}
            </div>
         </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden p-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* 1. Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-zinc-300 tracking-tight">Dashboard / <span className="text-white">Operational Snapshot</span></h1>
          <span className="px-2 py-1 bg-zinc-800 rounded text-[9px] font-black uppercase text-zinc-500 tracking-widest border border-zinc-700">Read-Only View</span>
        </div>
        <div 
          onClick={handleRefresh}
          className="flex items-center space-x-2 text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors group"
        >
          <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
          <span className="font-bold uppercase tracking-wide">System Healthy</span>
          <span className="text-zinc-600 px-2">|</span>
          <span>Last updated: {lastUpdated}</span>
          <svg className={`w-3 h-3 ml-1 ${isRefreshing ? 'animate-spin text-indigo-500' : 'group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
        
        {/* 2. KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <div 
              key={i} 
              onClick={() => onNavigate(kpi.tab)}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:bg-zinc-900 hover:border-zinc-700 transition-all cursor-pointer group shadow-lg"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[11px] font-bold text-zinc-400">{kpi.label}</span>
                <div className="text-zinc-500 group-hover:text-white transition-colors">{renderIcon(kpi.icon)}</div>
              </div>
              <div className="text-3xl font-bold text-white mb-1 tracking-tight">{kpi.value}</div>
              <div className="text-[10px] text-zinc-500 font-medium">{kpi.subtext}</div>
            </div>
          ))}
        </div>

        {/* 3. Middle Section: Chart & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-80">
          
          {/* Activity Volume Chart */}
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-sm font-bold text-zinc-300">Activity Volume (24h Throughput)</h3>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-sm"></span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Neo8 Events</span>
                <span className="text-[10px] text-zinc-400 font-bold ml-4">Total Events: 14,520</span>
              </div>
            </div>
            
            <div className="flex-1 flex items-end justify-between space-x-1">
              {[...Array(24)].map((_, i) => {
                const height = Math.floor(Math.random() * 80) + 15;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end group">
                    <div 
                      className="w-full bg-gradient-to-t from-indigo-900/50 to-indigo-500 rounded-t-sm hover:from-indigo-700 hover:to-indigo-400 transition-all"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
              <span>10AM</span>
              <span>2PM</span>
              <span>6PM</span>
              <span>10AM</span>
              <span>12AM</span>
              <span>2PM</span>
              <span>4PM</span>
              <span>8PM</span>
              <span>12AM</span>
              <span>6PM</span>
              <span>10AM</span>
            </div>
          </div>

          {/* Right Column: Insights & Next Mission */}
          <div className="flex flex-col space-y-6">
            
            {/* Discovery Insights */}
            <div className="flex-1 bg-purple-900/10 border border-purple-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                <h3 className="text-xs font-bold text-purple-100">Discovery Insights (AI-Derived)</h3>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0"></span>
                  <span className="text-[10px] text-zinc-300 leading-tight">12 stale leads detected in 'Negotiation' stage.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0"></span>
                  <span className="text-[10px] text-zinc-300 leading-tight">Unusual drop in 'Form Submissions' from NE region.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 shrink-0"></span>
                  <span className="text-[10px] text-zinc-300 leading-tight">High-priority client 'Acme Corp' mentioned 'urgent' in latest email.</span>
                </li>
              </ul>
            </div>

            {/* Next High-Priority Mission */}
            <div className="flex-1 bg-amber-900/10 border border-amber-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(245,158,11,0.05)] flex flex-col justify-between group cursor-pointer hover:bg-amber-900/20 transition-colors">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <h3 className="text-xs font-bold text-amber-100">Next High-Priority Mission</h3>
                </div>
                <div className="text-[11px] font-bold text-zinc-200 mb-1">Mission #M-1029: Emergency Server Repair at Globex</div>
                <div className="text-[10px] text-zinc-400 font-mono">Scheduled: Today, 11:30 AM</div>
                <div className="text-[10px] text-zinc-400 font-mono">Tech: J. Smith</div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider underline group-hover:text-amber-400">View Details</span>
              </div>
            </div>

          </div>
        </div>

        {/* 4. Recent Activity Feed */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-zinc-300">Recent Activity Feed (Last 4 Ledger Entries)</h3>
          </div>
          <div className="space-y-1">
            {activityFeed.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-4 items-center p-3 hover:bg-zinc-800/50 rounded-lg transition-colors border border-transparent hover:border-zinc-800">
                <div className="col-span-1 text-[10px] font-mono text-zinc-500">{item.time}</div>
                <div className="col-span-1">
                  <span className={`flex items-center text-[10px] font-bold uppercase tracking-wider ${item.status === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {item.status === 'success' ? <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                    {item.status}
                  </span>
                </div>
                <div className="col-span-3 text-[11px] font-bold text-zinc-300">{item.action}</div>
                <div className="col-span-5 text-[11px] text-zinc-400 font-mono">{item.details}</div>
                <div className="col-span-2 text-right">
                  <span className="text-[10px] font-mono text-zinc-600 mr-4">ID: {item.id}</span>
                  <button 
                    onClick={() => onNavigate(TabType.Ledger)}
                    className="text-[9px] font-bold text-zinc-500 hover:text-indigo-400 uppercase tracking-wide"
                  >
                    [View in Ledger]
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
             <button onClick={() => onNavigate(TabType.Ledger)} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 underline uppercase tracking-widest">View Full Automation Ledger History</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
