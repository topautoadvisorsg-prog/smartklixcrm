
import React, { useState } from 'react';

type ItemType = 'Service' | 'Material' | 'Labor' | 'Equipment';
type StatusType = 'Active' | 'Archived' | 'Flagged';

interface PriceBookItem {
  id: string;
  sku: string;
  name: string;
  type: ItemType;
  category: string; // e.g. "Services > HVAC"
  internalCost: number;
  price: number;
  margin: number; // percentage
  status: StatusType;
  statusLabel?: string; // e.g. "TBD Item"
  unit?: string; // e.g. "/hr" or each
}

const PriceBook: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'catalog'>('grid');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // Mock Data matching the visual reference
  const items: PriceBookItem[] = [
    { 
      id: 'ITM-001', sku: 'SRV-HVAC-001', name: 'Annual HVAC Tune-up', type: 'Service', 
      category: 'Services > HVAC', internalCost: 45.00, price: 129.00, margin: 65, 
      status: 'Active' 
    },
    { 
      id: 'ITM-002', sku: 'MAT-PIPE-PVC-050', name: '1/2" PVC Pipe (10ft)', type: 'Material', 
      category: 'Materials > Pipes', internalCost: 8.50, price: 14.50, margin: 40, 
      status: 'Archived' 
    },
    { 
      id: 'ITM-003', sku: 'LBR-ELEC-MSTR', name: 'Master Electrician Rate', type: 'Labor', 
      category: 'Labor Rates', internalCost: 75.00, price: 95.00, margin: 20, 
      status: 'Flagged', statusLabel: 'TBD Item', unit: '/hr' 
    },
  ];

  const categories = [
    { 
      label: 'Services', 
      children: ['HVAC', 'Plumbing', 'Electrical'] 
    },
    { 
      label: 'Materials', 
      children: ['Pipes & Fittings', 'Wire & Cable'] 
    },
    { 
      label: 'Labor Rates', 
      children: [] 
    }
  ];

  const selectedItem = items.find(i => i.id === editingItemId);

  const getMarginColor = (margin: number) => {
    if (margin >= 60) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (margin >= 30) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  };

  const getMarginLabel = (margin: number) => {
    if (margin >= 60) return 'Healthy';
    if (margin >= 30) return 'Standard';
    return 'Low';
  };

  const getStatusStyle = (status: StatusType) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Archived': return 'bg-zinc-800 text-zinc-500 border-zinc-700';
      case 'Flagged': return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  return (
    <div className="flex h-full bg-[#050505] text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. SIDEBAR: CATEGORY TREE */}
      <aside className="w-[280px] bg-zinc-900/30 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-zinc-800">
           <h2 className="text-lg font-bold text-white tracking-tight">Price Book Categories</h2>
        </div>
        
        <div className="px-4 py-4">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search categories..." 
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
              />
              <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
           <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-zinc-300 hover:bg-zinc-800/50 flex items-center">
              <svg className="w-3 h-3 mr-2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              All Items
           </button>
           
           {categories.map((cat, i) => (
              <div key={i} className="mb-1">
                 <button className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white flex items-center group">
                    <svg className="w-3 h-3 mr-2 text-zinc-600 group-hover:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    {cat.label}
                 </button>
                 {cat.children.length > 0 && (
                    <div className="ml-6 space-y-0.5 border-l border-zinc-800 pl-2 mt-1">
                       {cat.children.map(child => (
                          <button key={child} className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30 transition-colors">
                             {child}
                          </button>
                       ))}
                    </div>
                 )}
              </div>
           ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 space-y-3">
           <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Item Type: All</label>
              <div className="h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center px-3 justify-between cursor-pointer hover:border-zinc-700">
                 <span className="text-xs text-zinc-400">All Types</span>
                 <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Status: Active</label>
              <div className="h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center px-3 justify-between cursor-pointer hover:border-zinc-700">
                 <span className="text-xs text-zinc-400">Active</span>
                 <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
           </div>
        </div>
      </aside>

      {/* 2. MAIN GRID VIEW */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex justify-between items-center z-20">
          <div className="flex items-center space-x-6">
             <h1 className="text-xl font-bold text-white tracking-tight">Price Book Items <span className="text-zinc-500 font-medium text-sm ml-2">(Operational SSOT)</span></h1>
          </div>

          <div className="flex items-center space-x-6">
             <div className="relative group">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by SKU, Name, or Tag..." 
                  className="w-80 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 outline-none transition-all" 
                />
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             
             <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Privacy Mode</span>
                <button 
                  onClick={() => setPrivacyMode(!privacyMode)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${privacyMode ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                >
                   <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${privacyMode ? 'left-6' : 'left-1'}`}></div>
                </button>
                <span className="text-[9px] text-zinc-600 max-w-[80px] leading-tight ml-2">Currently {privacyMode ? 'hides' : 'reveals'} cost/margin</span>
             </div>

             <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center ${viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                   <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7-4h14a2 2 0 11-18 0 2 2 0 0118 0z" /></svg>
                   Grid
                </button>
                <button onClick={() => setViewMode('catalog')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center ${viewMode === 'catalog' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                   <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                   Catalog
                </button>
             </div>

             <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-1">irreversible action</span>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all flex items-center">
                   + Provision Item
                </button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left">
                 <thead className="bg-zinc-950 border-b border-zinc-800 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                    <tr>
                       <th className="px-6 py-4 font-mono">SKU</th>
                       <th className="px-6 py-4">Name</th>
                       <th className="px-6 py-4">Category</th>
                       <th className="px-6 py-4">Type</th>
                       {!privacyMode && <th className="px-6 py-4">Internal Cost</th>}
                       {!privacyMode && <th className="px-6 py-4">Margin %</th>}
                       <th className="px-6 py-4">Price</th>
                       <th className="px-6 py-4">Status</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800/50 text-xs">
                    {items.map(item => (
                       <tr 
                         key={item.id} 
                         onClick={() => setEditingItemId(item.id)}
                         className={`cursor-pointer transition-colors group ${editingItemId === item.id ? 'bg-indigo-900/10' : 'hover:bg-zinc-800/30'}`}
                       >
                          <td className="px-6 py-4 font-mono text-zinc-400 group-hover:text-zinc-300">{item.sku}</td>
                          <td className="px-6 py-4 font-bold text-zinc-200 group-hover:text-white">{item.name}</td>
                          <td className="px-6 py-4 text-zinc-400">{item.category}</td>
                          <td className="px-6 py-4">
                             <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{item.type}</span>
                          </td>
                          {!privacyMode && <td className="px-6 py-4 font-mono text-zinc-400">${item.internalCost.toFixed(2)}{item.unit}</td>}
                          {!privacyMode && (
                             <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wide ${getMarginColor(item.margin)}`}>
                                   {item.margin}% ({getMarginLabel(item.margin)})
                                </span>
                             </td>
                          )}
                          <td className="px-6 py-4 font-mono font-bold text-white">${item.price.toFixed(2)}{item.unit}</td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col items-start">
                                <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(item.status)}`}>
                                   {item.status}
                                </span>
                                {item.statusLabel && <span className="text-[9px] text-red-400 font-bold mt-1 ml-1 flex items-center"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> {item.statusLabel}</span>}
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        {/* FLOATING ITEM EDITOR MODAL */}
        {selectedItem && (
           <div className="absolute bottom-8 right-8 w-[400px] bg-[#121214] border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in z-50">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                 <div>
                    <h3 className="text-sm font-bold text-white">Item Editor</h3>
                    <p className="text-[10px] text-zinc-500 truncate max-w-[250px]">Edit Item: <span className="text-zinc-300">{selectedItem.name} ({selectedItem.sku})</span></p>
                 </div>
                 <button onClick={() => setEditingItemId(null)} className="text-zinc-500 hover:text-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-800">
                 <button className="flex-1 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300">Identity</button>
                 <button className="flex-1 py-3 text-[10px] font-bold text-blue-400 border-b-2 border-blue-500 uppercase tracking-wider bg-blue-500/5">Financials</button>
                 <button className="flex-1 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300">Media</button>
                 <button className="flex-1 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300">History</button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 bg-zinc-900/20">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Internal Cost</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                       <input 
                         type="number" 
                         defaultValue={selectedItem.internalCost} 
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-6 pr-3 text-sm text-zinc-200 focus:border-indigo-500 outline-none transition-colors"
                       />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Markup % (auto-calcs price)</label>
                    <div className="relative">
                       <input 
                         type="number" 
                         defaultValue={186.67} 
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-sm text-zinc-200 focus:border-indigo-500 outline-none transition-colors"
                       />
                       <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                          <button className="text-zinc-600 hover:text-zinc-400"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                          <button className="text-zinc-600 hover:text-zinc-400"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Calculated Price</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">$</span>
                       <input 
                         type="number" 
                         defaultValue={selectedItem.price} 
                         disabled
                         className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-6 pr-3 text-sm text-zinc-500 cursor-not-allowed"
                       />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Final Price (Override)</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-xs">$</span>
                       <input 
                         type="number" 
                         defaultValue={selectedItem.price} 
                         className="w-full bg-zinc-950 border border-blue-500/30 rounded-lg py-2 pl-6 pr-3 text-sm text-white focus:border-blue-500 outline-none transition-colors shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                       />
                    </div>
                 </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-zinc-800 bg-zinc-900 flex justify-end space-x-3">
                 <button 
                   onClick={() => setEditingItemId(null)}
                   className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-bold hover:bg-zinc-800 hover:text-white transition-colors"
                 >
                    Cancel
                 </button>
                 <button 
                   className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all"
                 >
                    Save Changes
                 </button>
              </div>
           </div>
        )}

      </main>
    </div>
  );
};

export default PriceBook;
