import { useState } from "react";
import { Building2, Palette, Users, Lock } from "lucide-react";
import { CompanySection, BrandingSection, UsersSection, CredentialsSection } from "@/components/settings";

type SettingsSection = 'company' | 'branding' | 'users' | 'credentials';

const NAV_ITEMS: { id: SettingsSection; label: string; icon: typeof Building2 }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'credentials', label: 'Credentials', icon: Lock },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-64 flex flex-col border-r border-border bg-card/50 p-4 shrink-0 overflow-y-auto">
        <div className="mb-8 px-4 pt-4">
          <h1 className="text-lg font-black text-foreground uppercase tracking-tight">Settings</h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Configuration & Vault</p>
        </div>
        
        <nav className="space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${
                  isActive
                    ? 'bg-card text-primary shadow-md border border-border'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 bg-background">
        <div className="max-w-4xl mx-auto">
          {activeSection === 'company' && <CompanySection />}
          {activeSection === 'branding' && <BrandingSection />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'credentials' && <CredentialsSection />}
        </div>
      </main>
    </div>
  );
}
