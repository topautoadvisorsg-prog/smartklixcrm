
import React, { useState } from 'react';
import { AutonomyLevel } from '../../types';

type EntityId = 'edge_agent' | 'discovery_ai' | 'action_ai' | 'master_architect';

interface AIEntityConfig {
  id: EntityId;
  name: string;
  role: string;
  typeBadge: string;
  status: 'active' | 'oversight';
  color: string;
  purpose: string;
  systemInstruction: string;
  constraints: {
    label: string;
    locked: boolean;
    active: boolean;
    description: string;
    risk?: 'high' | 'normal';
  }[];
  autonomy: {
    level: AutonomyLevel;
    allowed: boolean;
  };
}

const AiSettings: React.FC = () => {
  const [selectedId, setSelectedId] = useState<EntityId>('action_ai');
  const [isEditing, setIsEditing] = useState(false);

  // Mock Configuration State matches the visual direction
  const [entities, setEntities] = useState<Record<EntityId, AIEntityConfig>>({
    action_ai: {
      id: 'action_ai',
      name: 'ActionAI CRM',
      role: 'System Brain',
      typeBadge: 'Semi-Autonomous',
      status: 'active',
      color: 'border-blue-500',
      purpose: 'The ActionAI CRM entity exists to autonomously nurture leads and facilitate closes within defined operational parameters, prioritizing velocity over extensive deliberation.',
      systemInstruction: `10 | ### ROLE: You are an aggressive, results-oriented sales facilitator.
11 | ### TONE: Professional, concise, and fiercely focused on next steps. Do not use fluff.
12 | ### CONSTRAINT: Never commit to discounts over {{max_discount_var}} without explicit approval.
13 | ### PRIORITY: If intent signal > 80%, move immediately to scheduling closing call.
14 | -> Awaiting architect refinement...`,
      constraints: [
        { label: 'PII Masking on Output', locked: false, active: true, description: 'Redact phone/email in general logs', risk: 'normal' },
        { label: 'Cross-Tenant Data Access', locked: true, active: false, description: 'LOCKED BY MASTER POLICY', risk: 'high' },
        { label: 'External API Write Access', locked: false, active: true, description: 'Caution: Live System Impact', risk: 'high' },
        { label: 'Memory Persistence (Long-term)', locked: false, active: true, description: 'Allow context retention across sessions', risk: 'normal' },
        { label: 'Self-Correction Loops', locked: false, active: true, description: 'Auto-retry on validation failure', risk: 'normal' },
        { label: 'Discovery AI \'Write\' Access', locked: true, active: false, description: 'LOCKED: ARCHITECTURE CONSTRAINT', risk: 'high' },
      ],
      autonomy: { level: AutonomyLevel.SemiAutonomous, allowed: true }
    },
    edge_agent: {
      id: 'edge_agent',
      name: 'Edge Agent',
      role: 'Intake',
      typeBadge: 'Scripted',
      status: 'active',
      color: 'border-emerald-500',
      purpose: 'To capture, structure, and normalize raw inbound signals from public channels (Chat, SMS, Web) without hallucinating capability.',
      systemInstruction: `10 | ### ROLE: You are a polite, efficient receptionist.
11 | ### GOAL: Collect Name, Intent, and Urgency.
12 | ### CONSTRAINT: Do not promise solutions. Hand off to Intake Hub immediately.`,
      constraints: [
        { label: 'Read-Only DB', locked: true, active: true, description: 'Zero access to CRM records', risk: 'normal' },
        { label: 'Scripted Responses Only', locked: false, active: true, description: 'Adhere to approved brand scripts', risk: 'normal' }
      ],
      autonomy: { level: AutonomyLevel.Manual, allowed: false }
    },
    discovery_ai: {
      id: 'discovery_ai',
      name: 'Discovery AI',
      role: 'Retrieval',
      typeBadge: 'Read-Only',
      status: 'active',
      color: 'border-purple-500',
      purpose: 'To answer human queries about the business state by retrieving and synthesizing data from the Ledger and Database.',
      systemInstruction: `10 | ### ROLE: You are an objective analyst.
11 | ### OUTPUT: Provide facts, counts, and summaries. Cite your sources.
12 | ### CONSTRAINT: Never invent data. If data is missing, state it.`,
      constraints: [
        { label: 'Write Access', locked: true, active: false, description: 'Physically incapable of modifying records', risk: 'normal' },
        { label: 'PII Masking', locked: false, active: true, description: 'Hides sensitive data in summaries', risk: 'normal' }
      ],
      autonomy: { level: AutonomyLevel.Manual, allowed: false }
    },
    master_architect: {
      id: 'master_architect',
      name: 'Master Architect',
      role: 'Policy',
      typeBadge: 'Oversight',
      status: 'oversight',
      color: 'border-zinc-500',
      purpose: 'To validate ActionAI proposals against business logic, safety schemas, and risk thresholds before they reach human review.',
      systemInstruction: `10 | ### ROLE: You are the skeptic.
11 | ### TASK: Review every proposal field-by-field.
12 | ### LOGIC: Reject anything that violates the Schema.`,
      constraints: [
        { label: 'Logic-Only', locked: true, active: true, description: 'Deterministic validation', risk: 'normal' },
        { label: 'Override Power', locked: true, active: true, description: 'Can veto any ActionAI proposal', risk: 'high' }
      ],
      autonomy: { level: AutonomyLevel.FullAutonomy, allowed: false }
    }
  });

  const selectedEntity = entities[selectedId];

  const handleUpdate = (field: keyof AIEntityConfig, value: any) => {
    setEntities(prev => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [field]: value }
    }));
  };

  const handleToggleConstraint = (idx: number) => {
    if (selectedEntity.constraints[idx].locked) return;
    const newConstraints = [...selectedEntity.constraints];
    newConstraints[idx].active = !newConstraints[idx].active;
    handleUpdate('constraints', newConstraints);
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. ENTITY REGISTRY (Sidebar) */}
      <aside className="w-80 border-r border-white/10 bg-zinc-900/30 flex flex-col shrink-0 backdrop-blur-md">
        <header className="p-6 border-b border-white/10">
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight">AI Settings</h2>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-semibold">(Constitution & Configuration)</p>
        </header>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">AI Entity Registry</div>
          
          {(Object.values(entities) as AIEntityConfig[]).map((entity) => (
            <button
              key={entity.id}
              onClick={() => setSelectedId(entity.id)}
              className={`w-full text-left p-4 rounded-xl border-l-2 transition-all group relative overflow-hidden ${
                selectedId === entity.id 
                  ? `bg-white/5 ${entity.color} shadow-lg` 
                  : 'bg-transparent border-transparent hover:bg-white/5 hover:border-zinc-700'
              }`}
            >
              {/* Active Selection Glow */}
              {selectedId === entity.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
              )}

              <div className="flex justify-between items-start mb-1 relative z-10">
                <span className={`text-sm font-bold tracking-tight ${selectedId === entity.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                  {entity.name}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${
                  selectedId === entity.id ? 'border-white/20 bg-white/10 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                }`}>
                  {entity.typeBadge}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 relative z-10">
                <span className="text-[10px] text-zinc-500 font-medium">({entity.role})</span>
                <div className="flex-1" />
                <div className="flex items-center space-x-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${entity.status === 'active' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-zinc-600'}`} />
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">{entity.status === 'active' ? 'Active' : 'Oversight'}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {/* Footer Info */}
        <div className="p-6 border-t border-white/10 text-center">
           <div className="text-[10px] text-zinc-600 font-mono">v4.2.0-Governance-Stable</div>
        </div>
      </aside>

      {/* 2. CONFIGURATION CONSOLE (Main Stage) */}
      <main className="flex-1 flex flex-col bg-[#09090b] relative overflow-hidden">
        
        {/* Console Header */}
        <header className="px-8 py-5 border-b border-white/10 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl z-20">
           <div className="flex items-center space-x-3">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">ActionAI CRM // CONFIGURATION CONSOLE</span>
           </div>
           
           {/* Hot Reload Banner */}
           <div className="flex items-center space-x-3 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-lg">
              <svg className="w-3.5 h-3.5 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Architect Access Only: Hot Reload Active</span>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
           <div className="max-w-5xl mx-auto space-y-10">
              
              {/* TITLE & ACTIONS */}
              <div className="flex justify-between items-end pb-4 border-b border-white/5">
                 <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Core Mandate & Behavior</h1>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Entity ID: {selectedEntity.id}</p>
                 </div>
                 <div className="flex space-x-3">
                    <button className="px-6 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all">Discard Changes</button>
                    <button className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">Save Configuration</button>
                 </div>
              </div>

              {/* AUTONOMY THROTTLE */}
              <section className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Autonomy Throttle & Risk Profile</h3>
                 </div>
                 
                 <div className="relative p-1 bg-zinc-900 rounded-xl border border-white/10 flex">
                    {/* Visual selection indicator could be added here for animation */}
                    {[
                       { level: AutonomyLevel.Manual, label: 'MANUAL (Human Loop)', color: 'text-zinc-400', activeColor: 'bg-zinc-800 text-white shadow-md' },
                       { level: AutonomyLevel.SemiAutonomous, label: 'SEMI-AUTO (Approval Req)', color: 'text-amber-500/60', activeColor: 'bg-amber-900/30 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' },
                       { level: AutonomyLevel.FullAutonomy, label: 'FULL AUTO (High Risk)', color: 'text-red-500/60', activeColor: 'bg-red-900/30 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.2)]' }
                    ].map((option) => (
                       <button
                         key={option.level}
                         disabled={!selectedEntity.autonomy.allowed}
                         onClick={() => handleUpdate('autonomy', { ...selectedEntity.autonomy, level: option.level })}
                         className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            selectedEntity.autonomy.level === option.level 
                            ? option.activeColor 
                            : `${option.color} hover:bg-white/5`
                         } ${!selectedEntity.autonomy.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          {option.label}
                       </button>
                    ))}
                 </div>
                 <div className="text-[10px] text-zinc-500 font-mono pl-2">
                    Current stance: Biased toward action, requires human sign-off for commitments &gt;$5k.
                 </div>
              </section>

              {/* CORE PURPOSE */}
              <section className="space-y-4">
                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Core Purpose Definition</h3>
                 <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl opacity-0 group-focus-within:opacity-100 transition duration-500 blur"></div>
                    <textarea 
                      value={selectedEntity.purpose}
                      onChange={(e) => handleUpdate('purpose', e.target.value)}
                      className="relative w-full bg-zinc-900 border border-white/10 rounded-xl p-6 text-sm text-zinc-300 leading-relaxed focus:outline-none focus:border-blue-500/50 transition-all min-h-[100px] font-medium"
                    />
                 </div>
              </section>

              {/* BEHAVIORAL INSTRUCTIONS (CODE EDITOR) */}
              <section className="space-y-4">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Behavioral Instructions (System Prompt)</h3>
                    <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Syntax Highlight Active</span>
                 </div>
                 <div className="bg-[#0D0D10] border border-white/10 rounded-xl p-6 font-mono text-sm overflow-hidden relative">
                    <div className="absolute top-0 left-0 bottom-0 w-10 bg-white/5 border-r border-white/5 flex flex-col items-end pt-6 pr-3 text-zinc-600 select-none text-xs leading-loose">
                       <div>10</div><div>11</div><div>12</div><div>13</div><div>14</div>
                    </div>
                    <textarea 
                       value={selectedEntity.systemInstruction}
                       onChange={(e) => handleUpdate('systemInstruction', e.target.value)}
                       className="w-full bg-transparent border-none focus:ring-0 pl-12 text-blue-100/90 leading-loose resize-none min-h-[200px] outline-none"
                       spellCheck={false}
                    />
                 </div>
              </section>

              {/* ARCHITECTURAL HARD CONSTRAINTS */}
              <section className="space-y-6">
                 <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Architectural Hard Constraints</h3>
                    <div className="flex items-center space-x-2">
                       <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                       <span className="text-[9px] text-zinc-600 font-bold uppercase">Changes Require Root Auth</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEntity.constraints.map((constraint, idx) => (
                       <div 
                         key={idx} 
                         onClick={() => handleToggleConstraint(idx)}
                         className={`p-4 rounded-xl border flex items-start justify-between group transition-all ${
                            constraint.active 
                            ? 'bg-zinc-900/80 border-white/10' 
                            : 'bg-zinc-900/30 border-transparent opacity-60'
                         } ${!constraint.locked ? 'cursor-pointer hover:border-white/20' : 'cursor-not-allowed'}`}
                       >
                          <div className="flex flex-col space-y-1">
                             <span className={`text-xs font-bold tracking-tight ${constraint.active ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                {constraint.label}
                             </span>
                             <span className={`text-[10px] uppercase tracking-wider font-semibold ${constraint.risk === 'high' && constraint.active ? 'text-amber-500' : 'text-zinc-600'}`}>
                                {constraint.description}
                             </span>
                          </div>

                          <div className="flex items-center space-x-3">
                             {constraint.locked && (
                                <svg className="w-3 h-3 text-zinc-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                             )}
                             {/* Custom Toggle Switch */}
                             <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${
                                constraint.active 
                                  ? constraint.risk === 'high' ? 'bg-amber-600' : 'bg-emerald-600' 
                                  : 'bg-zinc-700'
                             }`}>
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-300 ${constraint.active ? 'left-6' : 'left-1'}`} />
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

           </div>
        </div>
      </main>
    </div>
  );
};

export default AiSettings;
