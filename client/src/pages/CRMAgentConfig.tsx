import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Save, Lock, Zap, Shield, Eye, Brain, Terminal, Copy, Check, RefreshCw, Key, Globe, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Autonomy Levels
enum AutonomyLevel {
  Manual = "manual",
  SemiAutonomous = "semi",
  FullAutonomy = "full"
}

type EntityId = "edge_agent" | "discovery_ai" | "action_ai" | "master_architect";

interface Constraint {
  label: string;
  locked: boolean;
  active: boolean;
  description: string;
  risk?: "high" | "normal";
}

interface AIEntityConfig {
  id: EntityId;
  name: string;
  role: string;
  typeBadge: string;
  status: "active" | "oversight";
  purpose: string;
  systemInstruction: string;
  constraints: Constraint[];
  autonomy: {
    level: AutonomyLevel;
    allowed: boolean;
  };
}

// API Key type for Master Architect
interface ApiKeyConfig {
  id: string;
  name: string;
  purpose: string;
  lastRotated: string;
  status: "active" | "expired" | "revoked";
}

// Initial entity configurations
const initialEntities: Record<EntityId, AIEntityConfig> = {
  action_ai: {
    id: "action_ai",
    name: "ActionAI CRM",
    role: "System Brain",
    typeBadge: "Semi-Autonomous",
    status: "active",
    purpose: "The ActionAI CRM entity exists to autonomously nurture leads and facilitate closes within defined operational parameters, prioritizing velocity over extensive deliberation.",
    systemInstruction: `### ROLE: You are an aggressive, results-oriented sales facilitator.
### TONE: Professional, concise, and fiercely focused on next steps. Do not use fluff.
### CONSTRAINT: Never commit to discounts over {{max_discount_var}} without explicit approval.
### PRIORITY: If intent signal > 80%, move immediately to scheduling closing call.
-> Awaiting architect refinement...`,
    constraints: [
      { label: "PII Masking on Output", locked: false, active: true, description: "Redact phone/email in general logs", risk: "normal" },
      { label: "Cross-Tenant Data Access", locked: true, active: false, description: "LOCKED BY MASTER POLICY", risk: "high" },
      { label: "External API Write Access", locked: false, active: true, description: "Caution: Live System Impact", risk: "high" },
      { label: "Memory Persistence (Long-term)", locked: false, active: true, description: "Allow context retention across sessions", risk: "normal" },
      { label: "Self-Correction Loops", locked: false, active: true, description: "Auto-retry on validation failure", risk: "normal" },
      { label: "Discovery AI 'Write' Access", locked: true, active: false, description: "LOCKED: ARCHITECTURE CONSTRAINT", risk: "high" },
    ],
    autonomy: { level: AutonomyLevel.SemiAutonomous, allowed: true }
  },
  edge_agent: {
    id: "edge_agent",
    name: "Edge Agent",
    role: "Intake",
    typeBadge: "Scripted",
    status: "active",
    purpose: "To capture, structure, and normalize raw inbound signals from public channels (Chat, SMS, Web) without hallucinating capability.",
    systemInstruction: `### ROLE: You are a polite, efficient receptionist.
### GOAL: Collect Name, Intent, and Urgency.
### CONSTRAINT: Do not promise solutions. Hand off to Intake Hub immediately.`,
    constraints: [
      { label: "Read-Only DB", locked: true, active: true, description: "Zero access to CRM records", risk: "normal" },
      { label: "Scripted Responses Only", locked: false, active: true, description: "Adhere to approved brand scripts", risk: "normal" }
    ],
    autonomy: { level: AutonomyLevel.Manual, allowed: false }
  },
  discovery_ai: {
    id: "discovery_ai",
    name: "Discovery AI",
    role: "Retrieval",
    typeBadge: "Read-Only",
    status: "active",
    purpose: "To answer human queries about the business state by retrieving and synthesizing data from the Ledger and Database.",
    systemInstruction: `### ROLE: You are an objective analyst.
### OUTPUT: Provide facts, counts, and summaries. Cite your sources.
### CONSTRAINT: Never invent data. If data is missing, state it.`,
    constraints: [
      { label: "Write Access", locked: true, active: false, description: "Physically incapable of modifying records", risk: "normal" },
      { label: "PII Masking", locked: false, active: true, description: "Hides sensitive data in summaries", risk: "normal" }
    ],
    autonomy: { level: AutonomyLevel.Manual, allowed: false }
  },
  master_architect: {
    id: "master_architect",
    name: "Master Architect",
    role: "Policy",
    typeBadge: "Oversight",
    status: "oversight",
    purpose: "To validate ActionAI proposals against business logic, safety schemas, and risk thresholds before they reach human review.",
    systemInstruction: `### ROLE: You are the skeptic.
### TASK: Review every proposal field-by-field.
### LOGIC: Reject anything that violates the Schema.`,
    constraints: [
      { label: "Logic-Only", locked: true, active: true, description: "Deterministic validation", risk: "normal" },
      { label: "Override Power", locked: true, active: true, description: "Can veto any ActionAI proposal", risk: "high" }
    ],
    autonomy: { level: AutonomyLevel.FullAutonomy, allowed: false }
  }
};

// Mock API Keys (Master Architect authority)
const initialApiKeys: ApiKeyConfig[] = [
  { id: "key-1", name: "chat-testing", purpose: "AI Chat natural conversation", lastRotated: "2025-01-15", status: "active" },
  { id: "key-2", name: "action-draft-testing", purpose: "ActionAI proposal drafting", lastRotated: "2025-01-10", status: "active" },
  { id: "key-3", name: "widget-test", purpose: "Edge Agent widget interactions", lastRotated: "2025-01-08", status: "active" },
];

// Map entity ID to backend prompt field names
const entityToPromptField: Record<EntityId, string> = {
  edge_agent: "edgeAgentPrompt",
  discovery_ai: "discoveryAiPrompt",
  action_ai: "actionAiPrompt",
  master_architect: "masterArchitectPrompt",
};

export default function CRMAgentConfig() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<EntityId>("action_ai");
  const [entities, setEntities] = useState<Record<EntityId, AIEntityConfig>>(initialEntities);
  const [apiKeys] = useState<ApiKeyConfig[]>(initialApiKeys);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch AI Settings from backend
  const { data: aiSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["/api/ai/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai/settings");
      return res.json();
    },
  });

  // Update entities when AI settings are loaded from backend
  useEffect(() => {
    if (aiSettings && !isLoadingSettings) {
      setEntities(prev => ({
        ...prev,
        edge_agent: { 
          ...prev.edge_agent, 
          systemInstruction: aiSettings.edgeAgentPrompt || prev.edge_agent.systemInstruction 
        },
        discovery_ai: { 
          ...prev.discovery_ai, 
          systemInstruction: aiSettings.discoveryAiPrompt || prev.discovery_ai.systemInstruction 
        },
        action_ai: { 
          ...prev.action_ai, 
          systemInstruction: aiSettings.actionAiPrompt || prev.action_ai.systemInstruction 
        },
        master_architect: { 
          ...prev.master_architect, 
          systemInstruction: aiSettings.masterArchitectPrompt || prev.master_architect.systemInstruction 
        },
      }));
    }
  }, [aiSettings, isLoadingSettings]);

  const selectedEntity = entities[selectedId];

  const handleUpdate = (field: keyof AIEntityConfig, value: unknown) => {
    setEntities(prev => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [field]: value }
    }));
  };

  const handleToggleConstraint = (idx: number) => {
    if (selectedEntity.constraints[idx].locked) return;
    const newConstraints = [...selectedEntity.constraints];
    newConstraints[idx].active = !newConstraints[idx].active;
    handleUpdate("constraints", newConstraints);
  };

  // Save mutation for AI Settings
  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/ai/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({
        title: "Configuration Saved",
        description: `${selectedEntity.name} settings have been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save configuration.",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    
    // Build the update payload with the current entity's prompt
    const promptField = entityToPromptField[selectedId];
    const updates: Record<string, string> = {
      [promptField]: selectedEntity.systemInstruction,
    };
    
    try {
      await saveMutation.mutateAsync(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySnippet = () => {
    const snippet = `<script src="https://your-domain.com/widget.js" data-client-id="YOUR_CLIENT_ID"></script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const getEntityIcon = (id: EntityId) => {
    switch (id) {
      case "edge_agent": return <Globe className="w-4 h-4" />;
      case "discovery_ai": return <Eye className="w-4 h-4" />;
      case "action_ai": return <Brain className="w-4 h-4" />;
      case "master_architect": return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
      
      {/* ENTITY REGISTRY (Sidebar) */}
      <aside className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0 backdrop-blur-md">
        <header className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">AI Settings</h2>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-semibold">(Constitution & Configuration)</p>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-3">AI Entity Registry</div>
          
          <div className="space-y-2">
            {(Object.values(entities) as AIEntityConfig[]).map((entity) => (
              <button
                key={entity.id}
                onClick={() => setSelectedId(entity.id)}
                className={`w-full text-left p-4 rounded-xl border-l-2 transition-all group relative overflow-hidden ${
                  selectedId === entity.id 
                    ? "bg-accent/50 border-primary shadow-lg" 
                    : "bg-transparent border-transparent hover:bg-accent/30 hover:border-muted-foreground/30"
                }`}
              >
                {selectedId === entity.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                )}

                <div className="flex justify-between items-start mb-1 relative z-10">
                  <div className="flex items-center gap-2">
                    {getEntityIcon(entity.id)}
                    <span className={`text-sm font-bold tracking-tight ${selectedId === entity.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                      {entity.name}
                    </span>
                  </div>
                  <Badge variant={selectedId === entity.id ? "default" : "outline"} className="text-[9px] px-2 py-0.5">
                    {entity.typeBadge}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 relative z-10 mt-2">
                  <span className="text-[10px] text-muted-foreground font-medium">({entity.role})</span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${entity.status === "active" ? "bg-success" : "bg-muted-foreground"}`} />
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                      {entity.status === "active" ? "Active" : "Oversight"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border text-center">
          <div className="text-[10px] text-muted-foreground font-mono">v4.2.0-Governance-Stable</div>
        </div>
      </aside>

      {/* CONFIGURATION CONSOLE (Main Stage) */}
      <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
        
        {/* Console Header */}
        <header className="px-8 py-4 border-b border-border flex justify-between items-center bg-card/50 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
            {getEntityIcon(selectedId)}
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
              {selectedEntity.name} // CONFIGURATION CONSOLE
            </span>
          </div>
          
          {/* Hot Reload Banner */}
          <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 px-4 py-1.5 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-warning animate-pulse" />
            <span className="text-[10px] font-bold text-warning uppercase tracking-wide">Architect Access Only: Hot Reload Active</span>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-8 max-w-5xl mx-auto space-y-8">
            
            {/* TITLE & ACTIONS */}
            <div className="flex justify-between items-end pb-4 border-b border-border/50">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">Core Mandate & Behavior</h1>
                <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Entity ID: {selectedEntity.id}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="text-xs uppercase tracking-widest">
                  Discard Changes
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs uppercase tracking-widest">
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>

            {/* AUTONOMY THROTTLE (ActionAI CRM only) */}
            {selectedEntity.autonomy.allowed && (
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Autonomy Throttle & Risk Profile</h3>
                </div>
                
                <div className="relative p-1 bg-muted rounded-xl border border-border flex">
                  {[
                    { level: AutonomyLevel.Manual, label: "MANUAL (Human Loop)", variant: "default" as const },
                    { level: AutonomyLevel.SemiAutonomous, label: "SEMI-AUTO (Approval Req)", variant: "warning" as const },
                    { level: AutonomyLevel.FullAutonomy, label: "FULL AUTO (High Risk)", variant: "destructive" as const }
                  ].map((option) => (
                    <button
                      key={option.level}
                      onClick={() => handleUpdate("autonomy", { ...selectedEntity.autonomy, level: option.level })}
                      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                        selectedEntity.autonomy.level === option.level 
                          ? option.variant === "warning" 
                            ? "bg-warning/20 text-warning border border-warning/30" 
                            : option.variant === "destructive"
                              ? "bg-destructive/20 text-destructive border border-destructive/30"
                              : "bg-card text-foreground shadow-md"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono pl-2">
                  Current stance: Biased toward action, requires human sign-off for commitments &gt;$5k.
                </div>
              </section>
            )}

            {/* CORE PURPOSE */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Core Purpose Definition</h3>
              <Textarea 
                value={selectedEntity.purpose}
                onChange={(e) => handleUpdate("purpose", e.target.value)}
                className="min-h-[100px] text-sm leading-relaxed bg-card border-border"
                placeholder="Define the core mandate for this AI entity..."
              />
            </section>

            {/* BEHAVIORAL INSTRUCTIONS (CODE EDITOR) */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Behavioral Instructions (System Prompt)</h3>
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Code Editor</span>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">system_instruction.md</span>
                  <Code className="w-3 h-3 text-muted-foreground" />
                </div>
                <Textarea 
                  value={selectedEntity.systemInstruction}
                  onChange={(e) => handleUpdate("systemInstruction", e.target.value)}
                  className="min-h-[200px] font-mono text-sm leading-loose bg-transparent border-none rounded-none focus-visible:ring-0"
                  spellCheck={false}
                />
              </div>
            </section>

            {/* ARCHITECTURAL HARD CONSTRAINTS */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Architectural Hard Constraints</h3>
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground font-bold uppercase">Changes Require Root Auth</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedEntity.constraints.map((constraint, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleToggleConstraint(idx)}
                    className={`p-4 rounded-xl border flex items-start justify-between group transition-all ${
                      constraint.active 
                        ? "bg-card border-border" 
                        : "bg-muted/30 border-transparent opacity-60"
                    } ${!constraint.locked ? "cursor-pointer hover:border-primary/30" : "cursor-not-allowed"}`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-bold tracking-tight ${constraint.active ? "text-foreground" : "text-muted-foreground"}`}>
                        {constraint.label}
                      </span>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold ${constraint.risk === "high" && constraint.active ? "text-warning" : "text-muted-foreground"}`}>
                        {constraint.description}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {constraint.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                      <Switch 
                        checked={constraint.active} 
                        disabled={constraint.locked}
                        onCheckedChange={() => handleToggleConstraint(idx)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator className="my-8" />

            {/* WIDGET CONFIGURATION (Edge Agent) */}
            {selectedId === "edge_agent" && (
              <section className="space-y-6">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Widget Configuration & Installation</h3>
                </div>
                
                <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2">Step 1: Copy the Widget Snippet</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Add this script tag to your website. Place it before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag.
                    </p>
                    <div className="relative">
                      <pre className="bg-muted border border-border rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`<script 
  src="https://your-domain.com/widget.js" 
  data-client-id="YOUR_CLIENT_ID"
  data-theme="auto"
></script>`}
                      </pre>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="absolute top-2 right-2"
                        onClick={handleCopySnippet}
                      >
                        {copiedSnippet ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2">Step 2: Configure Your Client ID</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Replace <code className="bg-muted px-1 rounded">YOUR_CLIENT_ID</code> with your unique identifier from the dashboard.
                    </p>
                    <div className="flex gap-2">
                      <Input 
                        value="crm_intake_client_12345" 
                        readOnly 
                        className="font-mono text-sm flex-1"
                      />
                      <Button variant="outline" size="sm">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2">Step 3: Test the Widget</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      After adding the snippet, refresh your website. The chat widget should appear in the bottom-right corner.
                    </p>
                    <div className="bg-muted/50 border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        Widget behavior logic lives on the AI Server. This page only configures and instructs.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* API KEYS MANAGEMENT (Master Architect) */}
            {selectedId === "master_architect" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" />
                    <h3 className="text-lg font-bold text-foreground">API Key Authority</h3>
                  </div>
                  <Button size="sm" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rotate All Keys
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Master Architect controls all API credentials. Keys are named, scoped, and traceable.
                  No other role may override or silently change keys.
                </p>

                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${key.status === "active" ? "bg-success" : key.status === "expired" ? "bg-warning" : "bg-destructive"}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground font-mono">{key.name}</span>
                            <Badge variant="outline" className="text-[9px]">{key.status.toUpperCase()}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{key.purpose}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">Last rotated: {key.lastRotated}</span>
                        <Button size="sm" variant="ghost">
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-warning mb-1">Testing Mode Active</p>
                      <p className="text-xs text-muted-foreground">
                        Using Replit AI-provided OpenAI/ChatGPT API keys for testing. These keys are billed to Replit AI and are for testing only.
                        Production keys will be configured separately.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
