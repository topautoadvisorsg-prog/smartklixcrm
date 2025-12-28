
import React, { useState } from 'react';

// --- TYPES ---

type SettingsSection = 'company' | 'branding' | 'users' | 'credentials';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Agent' | 'Auditor';
  lastActive: string;
  twoFactor: boolean;
}

interface Credential {
  id: string;
  name: string;
  type: 'API Key' | 'Token' | 'Webhook';
  maskedValue: string;
  lastUpdated: string;
}

// --- MOCK DATA ---

const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Sarah Architect', email: 'sarah@smartclicks.io', role: 'Owner', lastActive: 'Now', twoFactor: true },
  { id: 'u2', name: 'Mike Manager', email: 'mike@smartclicks.io', role: 'Manager', lastActive: '2h ago', twoFactor: true },
  { id: 'u3', name: 'Jessica Agent', email: 'jessica@smartclicks.io', role: 'Agent', lastActive: '1d ago', twoFactor: false },
];

const MOCK_CREDENTIALS: Credential[] = [
  { id: 'c1', name: 'OpenAI API Key', type: 'API Key', maskedValue: 'sk-proj-....................44x9', lastUpdated: 'Oct 20, 2023' },
  { id: 'c2', name: 'Stripe Secret Live', type: 'Token', maskedValue: 'sk_live_....................9921', lastUpdated: 'Sep 15, 2023' },
  { id: 'c3', name: 'Slack Incoming Webhook', type: 'Webhook', maskedValue: 'https://hooks.slack.com/services/T00...', lastUpdated: 'Yesterday' },
];

// --- MAIN COMPONENT ---

const AiSettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5'); // Indigo-600
  const [secondaryColor, setSecondaryColor] = useState('#18181B'); // Zinc-900

  // --- RENDERERS ---

  const renderNavButton = (id: SettingsSection, label: string, iconPath: string) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${
        activeSection === id 
          ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-md border border-slate-200 dark:border-zinc-700' 
          : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-slate-700 dark:hover:text-zinc-300'
      }`}
    >
      <svg className={`w-4 h-4 ${activeSection === id ? 'text-indigo-600 dark:text-white' : 'opacity-70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={iconPath} />
      </svg>
      <span>{label}</span>
    </button>
  );

  const SectionTitle = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
      <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-zinc-500 font-bold mt-1 uppercase tracking-widest">{subtitle}</p>
    </div>
  );

  const InputField = ({ label, value, type = "text", placeholder = "" }: any) => (
    <div className="mb-6">
      <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-500 tracking-widest mb-2">
        {label}
      </label>
      <input 
        type={type}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
      />
    </div>
  );

  // --- SECTIONS ---

  const CompanySection = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <SectionTitle title="Company Profile" subtitle="Core Business Identity" />
      
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <InputField label="Company Name" value="Acme Corp" />
           <InputField label="Contact Email" value="admin@acmecorp.com" />
           <InputField label="Phone Number" value="+1 (555) 019-2834" />
           <InputField label="Timezone" value="EST - New York (UTC-5)" />
        </div>
        <InputField label="Physical Address" value="124 Industrial Way, Suite 400, Tech City, NY 10012" />
        
        <div className="mt-4 pt-6 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
           <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all">
              Save Changes
           </button>
        </div>
      </div>
    </div>
  );

  const BrandingSection = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <SectionTitle title="Branding" subtitle="Visual Identity & Theming" />
      
      <div className="space-y-6">
         {/* Logo Upload */}
         <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest mb-6">Company Logo</h3>
            <div className="flex items-center space-x-6">
               <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-600">
                  <span className="text-2xl font-black">A</span>
               </div>
               <div className="space-y-3">
                  <button className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all">
                     Upload New
                  </button>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500">Recommended: 400x400px PNG or SVG.</p>
               </div>
            </div>
         </div>

         {/* Colors */}
         <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 dark:text-zinc-500 tracking-widest mb-6">Brand Colors</h3>
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-500 tracking-widest mb-3">Primary Color</label>
                  <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700" style={{ backgroundColor: primaryColor }}></div>
                     <input 
                        type="text" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 uppercase"
                     />
                  </div>
               </div>
               <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-zinc-500 tracking-widest mb-3">Secondary Color</label>
                  <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700" style={{ backgroundColor: secondaryColor }}></div>
                     <input 
                        type="text" 
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 uppercase"
                     />
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );

  const UsersSection = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Users" subtitle="Team Members & Access Control" />
      
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm mb-8">
         <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-500 dark:text-zinc-500 tracking-widest">
               <tr>
                  <th className="px-6 py-4">Identity</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Security</th>
                  <th className="px-6 py-4 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
               {MOCK_USERS.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">{user.name.charAt(0)}</div>
                           <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500">{user.email}</div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400 tracking-wide">{user.role}</span>
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{user.twoFactor ? '2FA Enabled' : 'No 2FA'}</span>
                           <span className="text-[9px] text-slate-400 dark:text-zinc-600">Active: {user.lastActive}</span>
                        </div>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <button className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 mr-4">Edit</button>
                        <button className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Remove</button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
         <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 flex justify-end">
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-all">
               Invite User
            </button>
         </div>
      </div>
    </div>
  );

  const CredentialsSection = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Credentials" subtitle="Secure Storage Vault" />
      
      {/* Informational Banner */}
      <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-start space-x-4">
         <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
         </div>
         <div>
            <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 mb-1">Vault Description</h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-400/80 leading-relaxed font-medium">
               Add, name, and store API keys, tokens, and webhook URLs. Partial credentials allowed. This is a secure storage vault only - no validation or execution happens here.
            </p>
         </div>
      </div>

      {/* Credentials Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
         <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-500 dark:text-zinc-500 tracking-widest">
               <tr>
                  <th className="px-6 py-4">Credential Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Value (Masked)</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
               {MOCK_CREDENTIALS.map(cred => (
                  <tr key={cred.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                     <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{cred.name}</span>
                     </td>
                     <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-widest">
                           {cred.type}
                        </span>
                     </td>
                     <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-400 dark:text-zinc-500 tracking-wider select-all">{cred.maskedValue}</span>
                     </td>
                     <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-500">{cred.lastUpdated}</span>
                     </td>
                     <td className="px-6 py-4 text-right flex justify-end space-x-4">
                        <button className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-600 hover:underline">Copy</button>
                        <button className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">Edit</button>
                        <button className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Delete</button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
         <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 flex justify-end">
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center space-x-2">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
               <span>Add Credential</span>
            </button>
         </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="w-64 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 p-4 shrink-0 overflow-y-auto">
        <div className="mb-8 px-4 pt-4">
          <h1 className="text-lg font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">Settings</h1>
          <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Configuration & Vault</p>
        </div>
        
        <nav className="space-y-1">
          {renderNavButton('company', 'Company', 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4')}
          {renderNavButton('branding', 'Branding', 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01')}
          {renderNavButton('users', 'Users', 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z')}
          {renderNavButton('credentials', 'Credentials', 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z')}
        </nav>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-12 bg-white dark:bg-[#09090b]">
        <div className="max-w-4xl mx-auto">
          {activeSection === 'company' && <CompanySection />}
          {activeSection === 'branding' && <BrandingSection />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'credentials' && <CredentialsSection />}
        </div>
      </main>

    </div>
  );
};

export default AiSettings;
