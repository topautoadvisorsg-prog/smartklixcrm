import React, { useState } from 'react';

type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
type FinanceStatus = 'invoiced' | 'paid' | 'outstanding' | 'unquoted';

interface Job {
  id: string;
  customerName: string;
  address: string;
  type: string;
  status: JobStatus;
  finance: FinanceStatus;
  technician: string;
  timeSlot: string;
  balance: string;
  urgency: 'high' | 'normal' | 'low';
}

const Jobs: React.FC = () => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'work_logs' | 'finances'>('overview');

  const jobs: Job[] = [
    { id: 'JOB-9021', customerName: 'Apex Logistics', address: '124 Industrial Way, Ste 402', type: 'HVAC Maintenance', status: 'in_progress', finance: 'outstanding', technician: 'Dave Miller', timeSlot: 'Today, 10:00 AM', balance: '$450.00', urgency: 'high' },
    { id: 'JOB-8842', customerName: 'TechFlow Systems', address: '88 Silicon Pkwy', type: 'Server Room Cooling Repair', status: 'scheduled', finance: 'unquoted', technician: 'Sarah Jones', timeSlot: 'Tomorrow, 08:00 AM', balance: '$0.00', urgency: 'normal' },
    { id: 'JOB-7712', customerName: 'Marcus Vane', address: 'Private Residence', type: 'Duct Cleaning', status: 'completed', finance: 'paid', technician: 'Dave Miller', timeSlot: 'Yesterday', balance: '$0.00', urgency: 'low' },
    { id: 'JOB-9102', customerName: 'Global Build', address: 'Construction Site B', type: 'Full System Install', status: 'scheduled', finance: 'outstanding', technician: 'Unassigned', timeSlot: 'Oct 29, 09:00 AM', balance: '$12,400.00', urgency: 'high' },
  ];

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in_progress': return 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const getFinanceColor = (status: FinanceStatus) => {
    switch (status) {
      case 'paid': return 'text-emerald-500';
      case 'outstanding': return 'text-amber-500';
      case 'invoiced': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getActionText = (status: JobStatus) => {
    switch (status) {
      case 'scheduled': return 'Start Job';
      case 'in_progress': return 'Complete Job';
      case 'completed': return 'Create Invoice';
      default: return 'Re-Open Job';
    }
  };

  if (selectedJob) {
    return (
      <div className="flex h-full flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden animate-in fade-in duration-500">
        {/* JOB HERO STATUS BAR */}
        <header className="p-8 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center backdrop-blur-xl">
           <div className="flex items-center space-x-6">
              <button 
                onClick={() => setSelectedJobId(null)}
                className="p-3 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
              >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div>
                 <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">{selectedJob.type}</h2>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusColor(selectedJob.status)} ${selectedJob.status === 'in_progress' ? 'animate-pulse' : ''}`}>
                       {selectedJob.status.replace('_', ' ')}
                    </span>
                 </div>
                 <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1 italic flex items-center">
                    {selectedJob.id} <span className="mx-2 opacity-30">|</span> {selectedJob.customerName}
                 </p>
              </div>
           </div>
           
           <div className="flex items-center space-x-12">
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Appointment</span>
                 <span className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">{selectedJob.timeSlot}</span>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Financial State</span>
                 <span className={`text-xl font-black tracking-tight ${getFinanceColor(selectedJob.finance)}`}>{selectedJob.balance} ({selectedJob.finance})</span>
              </div>
              <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all flex items-center group">
                 {getActionText(selectedJob.status)}
                 <svg className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
           </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
           {/* LEFT PANE: ASSET INFO & AI NUDGE */}
           <div className="w-[420px] bg-slate-50/50 dark:bg-transparent border-r border-slate-200 dark:border-zinc-800 overflow-y-auto p-8 space-y-8">
              <section className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3"></span>
                    Operational Context
                 </h4>
                 <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-sm space-y-6">
                    <div>
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Primary Address</span>
                       <div className="flex items-start space-x-3">
                          <svg className="w-5 h-5 text-indigo-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-relaxed">{selectedJob.address}</span>
                       </div>
                    </div>
                    <div>
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Technician Assigned</span>
                       <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-black text-indigo-600 text-[10px]">DM</div>
                          <span className="text-xs font-black text-slate-700 dark:text-zinc-300">{selectedJob.technician}</span>
                       </div>
                    </div>
                 </div>
              </section>

              {/* AI EXCEPTION WARNING - VISUAL ONLY */}
              {selectedJob.status === 'in_progress' && (
                <section className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] flex items-center">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]"></span>
                      AI Operational Watch (Static)
                   </h4>
                   <div className="p-8 bg-zinc-950 border border-red-900/30 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                      <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-600/10 blur-3xl rounded-full"></div>
                      <div className="relative z-10 space-y-4">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center">
                               <svg className="w-3.5 h-3.5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"/></svg>
                               Job Duration Exception
                            </span>
                            <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase">+15m over est.</span>
                         </div>
                         <p className="text-xs text-zinc-300 font-bold italic leading-relaxed">
                           "Technician has been on site for <span className="text-red-400 font-black">2.5 hours</span>. Historical benchmark for HVAC Maintenance at this location is 1.8 hours. Potential bottleneck detected in 'Part Acquisition'."
                         </p>
                         <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pt-2 border-t border-zinc-900/50">
                            Informational Alert • No Action Required
                         </div>
                      </div>
                   </div>
                </section>
              )}

              {/* Field Stats */}
              <section className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3"></span>
                    Connectivity Reference
                 </h4>
                 <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl flex items-center justify-between">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Field Sync Status</span>
                       <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
                          Mirroring Active
                       </span>
                    </div>
                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 20v-5M9 20v-8M15 20v-2M18 20v-4M21 20v-6" strokeWidth={2.5}/></svg>
                 </div>
              </section>
           </div>

           {/* RIGHT PANE: TABBED DATA */}
           <div className="flex-1 bg-white dark:bg-zinc-900 transition-colors flex flex-col">
              <nav className="flex px-8 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
                 {['overview', 'messages', 'work_logs', 'finances'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${
                        activeTab === tab ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
                      }`}
                    >
                       {tab.replace('_', ' ')}
                       {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 shadow-[0_-4px_10px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                 ))}
              </nav>

              <div className="flex-1 overflow-y-auto p-12">
                 {activeTab === 'overview' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <section>
                          <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter mb-6">Service Summary</h3>
                          <div className="p-8 bg-slate-50 dark:bg-zinc-950 rounded-[2.5rem] border-2 border-slate-100 dark:border-zinc-800 text-[14px] text-slate-600 dark:text-zinc-400 font-bold leading-relaxed italic shadow-inner">
                             "Scheduled maintenance for primary HVAC unit. Customer reports intermittent rattling in Zone 4. Requires filter replacement and coolant pressure check. Dave to use secondary entrance."
                          </div>
                       </section>

                       <section>
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-4">Site Location Reference</h4>
                          <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-[3rem] relative overflow-hidden flex items-center justify-center border-4 border-white dark:border-zinc-800 shadow-xl group">
                             <div className="absolute inset-0 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700 bg-zinc-900">
                                <img src="https://picsum.photos/seed/map1/800/400?grayscale" alt="Map" className="w-full h-full object-cover" />
                             </div>
                             <div className="relative z-10 flex flex-col items-center">
                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl">
                                   <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                </div>
                                <span className="mt-3 px-4 py-1.5 bg-zinc-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-zinc-700 shadow-xl">124 Industrial Way</span>
                             </div>
                          </div>
                       </section>
                    </div>
                 )}

                 {activeTab === 'messages' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                       <div className="flex justify-center mb-6">
                          <span className="px-4 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] border border-slate-200 dark:border-zinc-700 shadow-inner">
                            Read-Only Historical Log
                          </span>
                       </div>
                       {[
                         { role: 'customer', type: 'WhatsApp', text: "Hey, is the technician still on his way? I have a meeting at 11.", time: "09:42 AM", status: 'Read' },
                         { role: 'dispatcher', type: 'System', text: "Dave Miller checked in at 124 Industrial Way.", time: "10:01 AM", status: 'Delivered' },
                         { role: 'customer', type: 'WhatsApp', text: "Okay, I'll let him in through the side gate.", time: "10:05 AM", status: 'Read' },
                         { role: 'tech', type: 'Email', text: "Filter size 24x24x1 not in van. Procuring from local supply hub. +15m delay.", time: "11:15 AM", status: 'Sent' },
                       ].map((msg, i) => (
                         <div key={i} className={`flex ${msg.role === 'customer' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] p-6 rounded-[2rem] border shadow-sm relative overflow-hidden ${msg.role === 'customer' ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800' : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'}`}>
                               <div className="flex justify-between items-center mb-2">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${msg.role === 'customer' ? 'text-indigo-600' : 'text-slate-400'}`}>{msg.type}</span>
                                  <span className={`text-[9px] font-mono font-bold text-slate-400`}>{msg.time}</span>
                               </div>
                               <p className="text-xs font-bold leading-relaxed text-slate-700 dark:text-zinc-200">"{msg.text}"</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 )}

                 {activeTab === 'work_logs' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                       <section className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Field Documentation (Photos)</h4>
                          <div className="grid grid-cols-3 gap-6">
                             {[1, 2, 3].map(i => (
                               <div key={i} className="aspect-square bg-slate-100 dark:bg-zinc-800 rounded-[2rem] border-2 border-slate-200 dark:border-zinc-700 overflow-hidden relative group">
                                  <img src={`https://picsum.photos/seed/joblog${i}/400/400`} alt="Log" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                               </div>
                             ))}
                             <button className="aspect-square bg-slate-50 dark:bg-zinc-950 rounded-[2rem] border-4 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-all">
                                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                                <span className="text-[10px] font-black uppercase tracking-widest">Add Field Log</span>
                             </button>
                          </div>
                       </section>

                       <section className="p-10 bg-zinc-950 border-2 border-zinc-800 rounded-[3rem] shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 opacity-5">
                             <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M13.17 4L18 8.83V20H6V4h7.17M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg>
                          </div>
                          <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.4em] mb-8">Digital Signature Capture</h4>
                          <div className="h-40 bg-white/5 border-2 border-dashed border-zinc-800 rounded-3xl flex items-center justify-center relative group">
                             <div className="text-zinc-700 font-black italic text-4xl opacity-10 select-none group-hover:opacity-20 transition-opacity font-serif">Marcus Vane</div>
                             <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Sign on glass interface</span>
                          </div>
                       </section>
                    </div>
                 )}

                 {activeTab === 'finances' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                       <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Linked Financial Artifacts</h3>
                          <span className="text-[9px] font-black text-indigo-500 uppercase">Navigation Only</span>
                       </div>
                       {[
                         { title: 'HVAC Base Quote', id: 'EST-9901', amount: '$450.00', status: 'Approved', type: 'Estimate' },
                         { title: 'Material Surcharge (Filters)', id: 'INV-4412', amount: '$85.00', status: 'Pending', type: 'Invoice' },
                       ].map((fin, i) => (
                         <div key={i} className="p-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between shadow-sm hover:shadow-xl transition-all group cursor-pointer">
                            <div className="flex items-center space-x-6">
                               <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-950 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-zinc-800 text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" strokeWidth={2}/></svg>
                               </div>
                               <div>
                                  <h4 className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">{fin.title}</h4>
                                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{fin.id}</span>
                               </div>
                            </div>
                            <div className="flex items-center space-x-12">
                               <div className="text-right">
                                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Type</span>
                                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{fin.type}</span>
                               </div>
                               <div className="text-right">
                                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Balance</span>
                                  <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tighter">${fin.amount}</span>
                               </div>
                               <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${fin.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                  {fin.status}
                               </span>
                            </div>
                         </div>
                       ))}
                       <div className="text-center py-6">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">All financial modifications occur in the Pipeline or Estimator modules.</p>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 transition-colors overflow-hidden">
      <header className="p-8 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">Operations Queue</h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 uppercase font-black tracking-[0.4em] italic flex items-center">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2 shadow-[0_0_8px_rgba(79,70,229,0.8)]"></span>
              Execution Visibility Layer
            </p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500">
               Operational State Snapshot
             </div>
             <button className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
             </button>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
         {/* STATUS FILTER ROW */}
         <div className="flex space-x-3 mb-8 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
            {['All Jobs', 'Scheduled', 'In Progress', 'Completed', 'Outstanding'].map((filter, i) => (
               <button 
                 key={filter}
                 className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${
                   i === 0 
                     ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' 
                     : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
                 }`}
               >
                  {filter}
               </button>
            ))}
         </div>

         {/* JOBS TABLE / QUEUE */}
         <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">
                     <tr>
                        <th className="px-10 py-6">Identity & Type</th>
                        <th className="px-10 py-6">Site Location</th>
                        <th className="px-10 py-6">Technician</th>
                        <th className="px-10 py-6">Financial State</th>
                        <th className="px-10 py-6 text-right">Operational Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                     {jobs.map((job) => (
                        <tr 
                          key={job.id} 
                          onClick={() => setSelectedJobId(job.id)}
                          className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                        >
                           <td className="px-10 py-6">
                              <div className="flex items-center space-x-4">
                                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-all shadow-sm ${getStatusColor(job.status)}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-900 dark:text-zinc-100 tracking-tight">{job.type}</span>
                                    <div className="flex items-center mt-1 space-x-2">
                                       <span className="text-[10px] font-mono font-bold text-slate-400">{job.id}</span>
                                       {job.urgency === 'high' && (
                                          <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-widest">Urgent</span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase tracking-tighter">{job.customerName}</span>
                                 <span className="text-[10px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px] italic">{job.address}</span>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex items-center space-x-3">
                                 <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-black text-indigo-500">{job.technician.charAt(0)}</div>
                                 <span className="text-[11px] font-black uppercase text-slate-400 dark:text-zinc-600 italic tracking-widest">{job.technician}</span>
                              </div>
                           </td>
                           <td className="px-10 py-6">
                              <div className="flex flex-col">
                                 <span className={`text-[11px] font-black tracking-tighter ${getFinanceColor(job.finance)}`}>{job.balance}</span>
                                 <span className="text-[9px] font-black uppercase text-slate-400/50 tracking-widest">{job.finance}</span>
                              </div>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex flex-col items-end">
                                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(job.status)}`}>
                                    {job.status.replace('_', ' ')}
                                 </span>
                                 <span className="text-[9px] font-mono font-bold text-slate-400 uppercase mt-1.5">{job.timeSlot}</span>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Jobs;