import React, { useState } from 'react';

type IntegrationStatus = 'connected' | 'available' | 'coming_soon' | 'error' | 'paused';
type Category = 'featured' | 'my_integrations' | 'finance' | 'communication' | 'scheduling' | 'marketing' | 'forms';

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  category: Category;
  status: IntegrationStatus;
  logoUrl: string;
  verified: boolean;
  popular?: boolean;
  lastSync?: string;
}

const Marketplace: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('featured');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const apps: IntegrationApp[] = [
    { 
      id: 'qbo', 
      name: 'QuickBooks Online', 
      description: 'Read-only access to Invoice statuses, aging reports, and balance totals.', 
      category: 'finance', 
      status: 'connected', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/01/QuickBooks_logo.svg', 
      verified: true, 
      popular: true, 
      lastSync: '12m ago' 
    },
    { 
      id: 'stripe', 
      name: 'Stripe', 
      description: 'Observe payment history, failure reasons, and dispute lifecycle states.', 
      category: 'finance', 
      status: 'connected', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg', 
      verified: true, 
      lastSync: '1h ago' 
    },
    { 
      id: 'slack', 
      name: 'Slack', 
      description: 'Read channel activity and metadata for team availability analysis.', 
      category: 'communication', 
      status: 'available', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg', 
      verified: true, 
      popular: true 
    },
    { 
      id: 'gcal', 
      name: 'Google Calendar', 
      description: 'Query event times and attendee availability for scheduling awareness.', 
      category: 'scheduling', 
      status: 'connected', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg', 
      verified: true, 
      lastSync: 'Now' 
    },
    { 
      id: 'typeform', 
      name: 'Typeform', 
      description: 'Ingest completed form responses for lead discovery and intake audit.', 
      category: 'forms', 
      status: 'available', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Typeform_logo.svg', 
      verified: true 
    },
    { 
      id: 'facebook', 
      name: 'FB Lead Ads', 
      description: 'Monitor incoming lead volume and campaign attribution metadata.', 
      category: 'marketing', 
      status: 'available', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png', 
      verified: true 
    },
    { 
      id: 'whatsapp', 
      name: 'WhatsApp Business', 
      description: 'Track delivery states and message timestamps for client sequences.', 
      category: 'communication', 
      status: 'coming_soon', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg', 
      verified: true 
    },
    { 
      id: 'xero', 
      name: 'Xero', 
      description: 'Read-only financial reconciliation mirror for international ledgers.', 
      category: 'finance', 
      status: 'available', 
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Xero_logo.svg', 
      verified: true 
    },
  ];

  const categories = [
    { id: 'featured', label: 'Featured / All Apps', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.143-5.714L5 12l5.714-2.143L13 3z' },
    { id: 'my_integrations', label: 'My Integrations', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id: 'finance', label: 'Finance & Accounting', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'communication', label: 'Communication', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'scheduling', label: 'Scheduling', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'marketing', label: 'Marketing & Leads', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
    { id: 'forms', label: 'Forms & Intake', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ];

  const filteredApps = apps.filter(a => {
    if (activeCategory === 'featured') return true;
    if (activeCategory === 'my_integrations') return a.status === 'connected' || a.status === 'paused' || a.status === 'error';
    return a.category === activeCategory;
  });

  const selectedApp = apps.find(a => a.id === selectedAppId);

  return (
    <div className="flex h-full bg-zinc-950 transition-colors overflow-hidden">
      {/* Sidebar: Taxonomy */}
      <aside className="w-72 flex flex-col p-6 bg-zinc-900 border-r border-zinc-800 space-y-8 shrink-0">
         <div>
            <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tighter mb-1">Marketplace</h2>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest italic">Operational Extensions</p>
         </div>

         <nav className="flex-1 space-y-1">
            {categories.map(cat => (
               <button 
                 key={cat.id} 
                 onClick={() => setActiveCategory(cat.id as Category)}
                 className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${activeCategory === cat.id ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={cat.icon} strokeWidth={2.5}/></svg>
                  <span className="text-xs font-black uppercase tracking-widest">{cat.label}</span>
               </button>
            ))}
         </nav>

         <div className="p-5 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl space-y-3">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-relaxed">
               Authorized read-only access via Secure Dispatch Relay.
            </p>
            <div className="flex items-center space-x-2 text-[9px] font-bold text-zinc-500 uppercase italic">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
               <span>Relay Status: Optimal</span>
            </div>
         </div>
      </aside>

      {/* Main Grid area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
         <header className="p-8 border-b border-zinc-800 bg-zinc-900/60 flex justify-between items-center backdrop-blur-xl">
            <div>
               <h1 className="text-2xl font-black text-zinc-100 uppercase tracking-tighter">
                  {categories.find(c => c.id === activeCategory)?.label}
               </h1>
               <p className="text-[11px] text-zinc-400 mt-1 font-bold uppercase tracking-[0.3em] italic">
                  Functional observation nodes for external system visibility
               </p>
            </div>
            <div className="flex items-center space-x-4">
               <div className="relative">
                  <input type="text" placeholder="Search platforms..." className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl px-5 py-2.5 text-xs font-bold w-64 shadow-inner outline-none focus:border-indigo-600 transition-all" />
                  <svg className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5}/></svg>
               </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
            {activeCategory === 'my_integrations' ? (
               <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in duration-500">
                  <table className="w-full text-left">
                     <thead className="bg-zinc-950 border-b border-zinc-800 text-[10px] font-black uppercase text-zinc-500 tracking-[0.4em]">
                        <tr>
                           <th className="px-10 py-6">Integration</th>
                           <th className="px-10 py-6">Operational Scope</th>
                           <th className="px-10 py-6">Last Handshake</th>
                           <th className="px-10 py-6">Status</th>
                           <th className="px-10 py-6 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800/40">
                        {filteredApps.map(app => (
                           <tr key={app.id} className="hover:bg-zinc-800/30 transition-colors group">
                              <td className="px-10 py-6">
                                 <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg">
                                       <img src={app.logoUrl} alt={app.name} className="max-w-full max-h-full object-contain" />
                                    </div>
                                    <span className="text-sm font-black text-zinc-100 uppercase tracking-tight">{app.name}</span>
                                 </div>
                              </td>
                              <td className="px-10 py-6 text-xs text-zinc-400 italic font-medium">"{app.description}"</td>
                              <td className="px-10 py-6 text-[10px] font-mono font-bold text-zinc-500">{app.lastSync || 'N/A'}</td>
                              <td className="px-10 py-6">
                                 <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest">Active</span>
                              </td>
                              <td className="px-10 py-6 text-right">
                                 <button onClick={() => setSelectedAppId(app.id)} className="text-[10px] font-black text-red-500 uppercase hover:underline">Disconnect</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                  {filteredApps.map(app => (
                     <div 
                       key={app.id} 
                       onClick={() => app.status !== 'coming_soon' && setSelectedAppId(app.id)}
                       className={`p-8 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col h-[340px] relative overflow-hidden cursor-pointer ${app.status === 'coming_soon' ? 'grayscale opacity-60' : ''}`}
                     >
                        <div className="flex justify-between items-start mb-8">
                           <div className="w-16 h-16 bg-white p-3 rounded-2xl flex items-center justify-center shadow-xl shadow-black/40 group-hover:scale-105 transition-transform">
                              <img src={app.logoUrl} alt={app.name} className="max-w-full max-h-full object-contain" />
                           </div>
                           {app.verified && <div title="Verified SmartClicks Node" className="p-1.5 bg-indigo-900/20 rounded-lg"><svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>}
                        </div>

                        <div className="flex-1 space-y-3">
                           <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-black text-zinc-100 uppercase tracking-tighter leading-tight group-hover:text-indigo-400 transition-colors">{app.name}</h3>
                              {app.popular && <span className="text-[8px] bg-amber-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-lg">Trending</span>}
                           </div>
                           <p className="text-xs text-zinc-400 font-bold italic leading-relaxed">"{app.description}"</p>
                        </div>

                        <div className="pt-6 mt-6 border-t border-zinc-800 flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">{app.category}</span>
                           <button className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${app.status === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner' : app.status === 'coming_soon' ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-100 text-zinc-900 shadow-xl hover:bg-white'}`}>
                              {app.status === 'connected' ? 'Connected' : app.status === 'coming_soon' ? 'Coming Soon' : 'Connect'}
                           </button>
                        </div>
                     </div>
                  ))}
                  
                  {/* REQUEST CARD */}
                  <div className="p-8 border-4 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4 opacity-50 hover:opacity-100 transition-opacity">
                     <svg className="w-12 h-12 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth={2.5}/></svg>
                     <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600 italic">Don't see what you need?</p>
                  </div>
               </div>
            )}
         </div>
      </main>

      {/* CONNECT WIZARD (Modal) */}
      {selectedAppId && selectedApp && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6 transition-all animate-in zoom-in duration-300">
            <div className="bg-zinc-900 border-2 border-zinc-800 w-full max-w-3xl rounded-[4rem] shadow-[0_0_150px_rgba(79,70,229,0.1)] relative flex flex-col overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600 shadow-[0_4px_30px_rgba(79,70,229,0.3)]"></div>
               
               <div className="p-12 pb-6 flex justify-between items-start">
                  <div className="flex items-center space-x-6">
                     <div className="w-20 h-20 bg-white p-3 rounded-3xl flex items-center justify-center shadow-2xl border border-zinc-800">
                        <img src={selectedApp.logoUrl} alt={selectedApp.name} className="max-w-full max-h-full object-contain" />
                     </div>
                     <div>
                        <h3 className="text-3xl font-black text-zinc-100 uppercase tracking-tighter">Authorize {selectedApp.name}</h3>
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.3em] mt-1 italic">Read-Only Dispatch Relay Integration</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedAppId(null)} className="p-3 bg-zinc-800 text-zinc-500 hover:text-zinc-100 rounded-2xl transition-all hover:rotate-90">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-12 space-y-12 no-scrollbar">
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <h4 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.4em] flex items-center">
                           <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                           Secure Handshake Flow
                        </h4>
                        <div className="space-y-4">
                           {[
                              { s: '01', t: 'Authorize Access', d: 'Securely link your account via masked OAuth protocol.' },
                              { s: '02', t: 'Select Template', d: 'Choose a pre-defined read-only search template.' },
                              { s: '03', t: 'Activate Monitoring', d: 'Sync operational health data directly to SmartClicks UI.' },
                           ].map(step => (
                              <div key={step.s} className="flex space-x-5">
                                 <span className="text-xl font-black text-indigo-500 opacity-20">{step.s}</span>
                                 <div className="flex flex-col">
                                    <span className="text-xs font-black text-zinc-300 uppercase tracking-widest">{step.t}</span>
                                    <p className="text-[11px] text-zinc-500 italic font-bold mt-1 leading-tight">{step.d}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="bg-zinc-950 border-2 border-zinc-800 rounded-[2.5rem] p-8 flex flex-col items-center justify-center space-y-6 shadow-inner">
                        <div className="flex items-center space-x-8">
                           <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" strokeWidth={3}/></svg>
                           </div>
                           <div className="flex space-x-1 animate-pulse">
                              {[...Array(3)].map((_, i) => <div key={i} className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>)}
                           </div>
                           <div className="w-12 h-12 bg-white p-2 rounded-2xl flex items-center justify-center shadow-xl border border-zinc-800">
                              <img src={selectedApp.logoUrl} alt={selectedApp.name} className="max-w-full max-h-full object-contain" />
                           </div>
                        </div>
                        <div className="text-center">
                           <span className="text-[9px] font-black uppercase text-indigo-500 tracking-[0.4em] block mb-2">Relay Linkage State</span>
                           <p className="text-[10px] text-zinc-600 font-bold italic">Waiting for authority authorization...</p>
                        </div>
                     </div>
                  </section>

                  <section className="space-y-6">
                     <h4 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.4em] flex items-center px-1">
                        <span className="w-2 h-2 bg-indigo-600 rounded-full mr-3"></span>
                        Available read-only templates
                     </h4>
                     <div className="space-y-3">
                        {[
                           `Monitor ${selectedApp.name} record state changes`,
                           'Read-only historical outcome retrieval',
                           'Status inspection for operational reporting',
                        ].map((temp, i) => (
                           <div key={i} className="flex items-center justify-between p-6 bg-zinc-950 border border-zinc-800 rounded-[2rem] shadow-sm hover:border-indigo-600 transition-all cursor-pointer group">
                              <span className="text-xs font-black text-zinc-300 uppercase tracking-widest">{temp}</span>
                              <svg className="w-5 h-5 text-zinc-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg>
                           </div>
                        ))}
                     </div>
                  </section>
               </div>

               <div className="p-12 border-t border-zinc-800 bg-zinc-950/50 flex space-x-6">
                  <button onClick={() => setSelectedAppId(null)} className="flex-1 py-6 border-2 border-zinc-800 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 transition-all hover:bg-zinc-800 shadow-sm active:scale-95">Cancel</button>
                  <button 
                    onClick={() => { alert('Handshake protocol initialized via Zapier Relay.'); setSelectedAppId(null); }}
                    className="flex-1 py-6 bg-indigo-600 text-white rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-indigo-600/30 border-2 border-indigo-500 active:scale-95 flex items-center justify-center space-x-3 group"
                  >
                     <span>Authorize & Connect</span>
                     <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7-7 7" strokeWidth={4}/></svg>
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Marketplace;