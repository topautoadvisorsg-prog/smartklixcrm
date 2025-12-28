
import React, { useState } from 'react';

type ArtifactType = 'doc' | 'sheet' | 'drive' | 'gmail_record';

interface WorkspaceArtifact {
  id: string;
  name: string;
  type: ArtifactType;
  lastModifiedBy: string;
  lastModifiedTime: string;
  status?: 'active' | 'orphaned';
  url: string;
}

const Workspace: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | ArtifactType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // MOCK CONTEXT: Active Job Context
  const activeContext = {
    id: 'JOB-9021',
    title: 'Server Migration Project',
    syncStatus: '2m ago (Google Drive API)'
  };

  // Mock Data matching the visual reference image
  const artifacts: WorkspaceArtifact[] = [
    { 
      id: 'W-001', name: 'J-9021 Scope & Requirements.gdoc', type: 'doc', 
      lastModifiedBy: 'Sarah C.', lastModifiedTime: '1h ago', status: 'active',
      url: '#' 
    },
    { 
      id: 'W-002', name: 'Migration Cost Analysis_v3.gsheet', type: 'sheet', 
      lastModifiedBy: 'Marcus V.', lastModifiedTime: '4h ago', status: 'active',
      url: '#' 
    },
    { 
      id: 'W-003', name: 'Site Photos & Diagrams (J-9021)', type: 'drive', 
      lastModifiedBy: 'System', lastModifiedTime: 'Yesterday', status: 'active',
      url: '#' 
    },
    { 
      id: 'W-004', name: 'Re: Client Approval for Phase 2.eml', type: 'gmail_record', 
      lastModifiedBy: 'Sarah C.', lastModifiedTime: 'Oct 25', status: 'active',
      url: '#' 
    },
    { 
      id: 'W-005', name: 'Legacy System Inventory.gsheet', type: 'sheet', 
      lastModifiedBy: 'Marcus V.', lastModifiedTime: 'Oct 24', status: 'orphaned',
      url: '#' 
    },
    { 
      id: 'W-006', name: 'Meeting Notes - Kickoff.gdoc', type: 'doc', 
      lastModifiedBy: 'Sarah C.', lastModifiedTime: 'Oct 23', status: 'active',
      url: '#' 
    },
  ];

  const filteredArtifacts = artifacts.filter(art => {
    const matchesFilter = activeFilter === 'all' || art.type === activeFilter;
    const matchesSearch = art.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type: ArtifactType) => {
    switch (type) {
      case 'doc': 
        return (
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
             <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" className="text-blue-300" /></svg>
          </div>
        );
      case 'sheet': 
        return (
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
             <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" className="text-emerald-300" /><path d="M8 11h8v2H8zm0 4h8v2H8z" className="text-emerald-300" /></svg>
          </div>
        );
      case 'drive': 
        return (
          <div className="w-10 h-10 bg-zinc-700/50 rounded-lg flex items-center justify-center border border-zinc-600">
             <svg className="w-6 h-6 text-zinc-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          </div>
        );
      case 'gmail_record': 
        return (
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
             <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          </div>
        );
    }
  };

  const getFilterLabel = (type: string) => {
     switch(type) {
        case 'doc': return 'Google Docs';
        case 'sheet': return 'Google Sheets';
        case 'drive': return 'Google Drive Folders';
        case 'gmail_record': return 'Gmail Records';
        default: return 'All Files';
     }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden p-8">
      
      {/* 1. CONTEXT HEADER */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-8 flex justify-between items-center shadow-lg relative overflow-hidden shrink-0">
         <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
         <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-1">
               <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
               <h1 className="text-xl font-bold text-white tracking-tight">Context: Job #{activeContext.id.replace('JOB-','')} - {activeContext.title}</h1>
            </div>
            <p className="text-xs text-zinc-500 font-medium ml-8">Cloud File Mirror (Artifact Visibility Hub) - Read-Only View</p>
         </div>
         <div className="flex items-center space-x-2 bg-zinc-950/50 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[10px] font-mono text-zinc-400">Last Sync: {activeContext.syncStatus}</span>
         </div>
      </div>

      {/* 2. CONTROLS */}
      <div className="flex justify-between items-center mb-6 shrink-0">
         <div className="flex space-x-2">
            {['all', 'doc', 'sheet', 'drive', 'gmail_record'].map((filter) => (
               <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all border flex items-center space-x-2 ${
                     activeFilter === filter 
                     ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm' 
                     : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
               >
                  {/* Miniature Icons for Filter Buttons */}
                  {filter === 'doc' && <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>}
                  {filter === 'sheet' && <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /></svg>}
                  {filter === 'drive' && <svg className="w-3 h-3 text-zinc-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>}
                  {filter === 'gmail_record' && <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>}
                  <span>{getFilterLabel(filter)}</span>
               </button>
            ))}
         </div>
         <div className="relative">
            <input 
               type="text" 
               placeholder="Search linked artifacts..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-64 bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
         </div>
      </div>

      {/* 3. ARTIFACT GRID */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
         {filteredArtifacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {filteredArtifacts.map(art => (
                  <div 
                     key={art.id} 
                     className={`group relative bg-zinc-900/40 border rounded-xl p-5 transition-all hover:bg-zinc-800/60 ${art.status === 'orphaned' ? 'border-amber-900/30' : 'border-zinc-800 hover:border-zinc-700'}`}
                  >
                     <div className="flex items-start space-x-4">
                        {getIcon(art.type)}
                        <div className="flex-1 min-w-0">
                           <h3 className={`text-sm font-bold truncate leading-tight ${art.status === 'orphaned' ? 'text-zinc-400' : 'text-zinc-200 group-hover:text-white'}`}>{art.name}</h3>
                           <p className="text-[10px] text-zinc-500 mt-1">Last modified by {art.lastModifiedBy} | {art.lastModifiedTime}</p>
                           
                           {/* Orphaned Warning */}
                           {art.status === 'orphaned' && (
                              <div className="mt-3 inline-flex items-center px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[9px] text-zinc-500 font-medium">
                                 <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span>
                                 Status: Orphaned (File not found in Drive)
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Link Action */}
                     <a 
                        href={art.url} 
                        className={`absolute bottom-4 right-4 p-2 rounded-lg transition-colors ${art.status === 'orphaned' ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'}`}
                     >
                        {art.status === 'orphaned' ? (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        ) : (
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        )}
                     </a>
                  </div>
               ))}
            </div>
         ) : (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center opacity-40">
               <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
               </div>
               <p className="text-sm font-bold text-zinc-500">No linked files found for this filter.</p>
               <p className="text-xs text-zinc-600 mt-1">Files are linked automatically from Jobs or Intake.</p>
            </div>
         )}
      </div>

    </div>
  );
};

export default Workspace;
