import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, Activity, Settings, Save, Building2, Plus, Trash2, Edit2, Check, X, Loader2, Send, AlertTriangle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ActionIntakeItem = {
  id: string;
  taskType: string;
  originatingAgent: string;
  rawPrompt: string;
  context: string;
  suggestedAction: string;
  extractedIntent?: string;
  parsedEntities?: string;
  chosenTool?: string;
  timestamp: Date;
};

type PendingApproval = {
  id: string;
  description: string;
  originatingModule: string;
  confidenceScore: number;
  isGated: boolean;
  gatedActionType: string | null;
  finalizationPayload: Record<string, unknown> | null;
};

type CompletedAction = {
  id: string;
  result: string;
  duration: number;
  callback: string | null;
  executionPath: string;
  timestamp: Date;
};

type AssistQueueEntry = {
  id: string;
  userId: string | null;
  mode: string;
  userRequest: string;
  status: string;
  agentResponse: string | null;
  toolsCalled: Array<{ name: string; args: unknown }> | null;
  toolResults: Array<{ name: string; status: string; result?: unknown; error?: string }> | null;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  executedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  gatedActionType: string | null;
  finalizationPayload: Record<string, unknown> | null;
  architectApprovedAt: Date | null;
};

type FeedData = {
  feed: ActionIntakeItem[];
  pendingApprovals: PendingApproval[];
  completedActions: CompletedAction[];
};

type ToolPermission = { enabled: boolean; allowedModes: string[] };
type AIChannel = "crm_chat" | "gpt_actions" | "voice" | "widget";

type CompanyInstructions = {
  id: string;
  companyName: string;
  behaviorInstructions: string | null;
  activeChannels: Record<string, boolean>;
  defaultPipelineStage: string | null;
  defaultTags: string[];
  toolPermissionOverrides: Record<string, ToolPermission>;
  customFlags: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type MasterArchitectConfig = {
  id: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  systemPrompt: string;
  reflectionEnabled: boolean;
  maxReflectionRounds: number;
  recursionDepthLimit: number;
  maxConversationHistory: number;
  contextSummarizationEnabled: boolean;
  autoPruneAfterMessages: number;
  toolPermissions: Record<string, ToolPermission>;
  channelToolPermissions: Record<AIChannel, Record<string, ToolPermission>>;
  updatedAt: Date;
};

const CHANNELS: { value: AIChannel | "global"; label: string; description: string }[] = [
  { value: "global", label: "Global (Default)", description: "Default permissions for all channels" },
  { value: "crm_chat", label: "CRM Agent Chat", description: "Internal CRM chat interface" },
  { value: "gpt_actions", label: "ChatGPT Actions", description: "External ChatGPT integration" },
  { value: "voice", label: "Voice (AI Receptionist)", description: "Phone call interactions" },
  { value: "widget", label: "Widget (Public Chat)", description: "Public website chat widget" },
];

function MasterArchitectSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<MasterArchitectConfig | null>(null);
  const [selectedPermissionChannel, setSelectedPermissionChannel] = useState<AIChannel | "global">("global");

  const { data: configData, isLoading } = useQuery<MasterArchitectConfig>({
    queryKey: ["/api/master-architect/config"],
  });

  // Sync local state with query data using useEffect
  useEffect(() => {
    if (configData) {
      const configWithChannels = {
        ...configData,
        channelToolPermissions: configData.channelToolPermissions || {},
      };
      setConfig(configWithChannels);
    }
  }, [configData]);

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<MasterArchitectConfig>) => {
      const res = await apiRequest("PATCH", "/api/master-architect/config", updates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/master-architect/config"] });
      toast({
        title: "Settings saved",
        description: "Approval Hub configuration has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save settings",
        description: "There was an error updating the configuration.",
        variant: "destructive",
      });
    },
  });

  const getPermissionsForChannel = (): Record<string, ToolPermission> => {
    if (!config) return {};
    if (selectedPermissionChannel === "global") {
      return config.toolPermissions || {};
    }
    return config.channelToolPermissions?.[selectedPermissionChannel] || {};
  };

  const updateToolPermission = (toolName: string, enabled: boolean) => {
    if (!config) return;
    
    if (selectedPermissionChannel === "global") {
      setConfig({
        ...config,
        toolPermissions: {
          ...config.toolPermissions,
          [toolName]: {
            ...(config.toolPermissions[toolName] || { allowedModes: ["draft", "assist", "auto"] }),
            enabled,
          },
        },
      });
    } else {
      const channelPerms = config.channelToolPermissions?.[selectedPermissionChannel] || {};
      setConfig({
        ...config,
        channelToolPermissions: {
          ...config.channelToolPermissions,
          [selectedPermissionChannel]: {
            ...channelPerms,
            [toolName]: {
              ...(channelPerms[toolName] || { allowedModes: ["draft", "assist", "auto"] }),
              enabled,
            },
          },
        },
      });
    }
  };

  const updateToolMode = (toolName: string, mode: string, allowed: boolean) => {
    if (!config) return;
    
    if (selectedPermissionChannel === "global") {
      const current = config.toolPermissions[toolName] || { enabled: true, allowedModes: [] };
      const allowedModes = allowed
        ? [...current.allowedModes, mode]
        : current.allowedModes.filter((m) => m !== mode);
      
      setConfig({
        ...config,
        toolPermissions: {
          ...config.toolPermissions,
          [toolName]: {
            ...current,
            allowedModes,
          },
        },
      });
    } else {
      const channelPerms = config.channelToolPermissions?.[selectedPermissionChannel] || {};
      const current = channelPerms[toolName] || { enabled: true, allowedModes: [] };
      const allowedModes = allowed
        ? [...current.allowedModes, mode]
        : current.allowedModes.filter((m) => m !== mode);
      
      setConfig({
        ...config,
        channelToolPermissions: {
          ...config.channelToolPermissions,
          [selectedPermissionChannel]: {
            ...channelPerms,
            [toolName]: {
              ...current,
              allowedModes,
            },
          },
        },
      });
    }
  };

  const clearChannelOverrides = () => {
    if (!config || selectedPermissionChannel === "global") return;
    
    const newChannelPerms = { ...config.channelToolPermissions };
    delete newChannelPerms[selectedPermissionChannel];
    
    setConfig({
      ...config,
      channelToolPermissions: newChannelPerms,
    });
    
    toast({
      title: "Channel overrides cleared",
      description: `${CHANNELS.find(c => c.value === selectedPermissionChannel)?.label} will now use global defaults.`,
    });
  };

  const handleSave = () => {
    if (config) {
      updateConfigMutation.mutate(config);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No configuration found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Master Architect Settings</h2>
          <p className="text-muted-foreground">Configure AI behavior, tool permissions, and execution settings</p>
        </div>
        <Button onClick={handleSave} disabled={updateConfigMutation.isPending || isLoading} data-testid="button-save-settings">
          {updateConfigMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Card data-testid="card-model-config">
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>OpenAI model and generation parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
            >
              <SelectTrigger id="model" data-testid="select-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature: {config.temperature.toFixed(2)}</Label>
            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[config.temperature]}
              onValueChange={([value]) => setConfig({ ...config, temperature: value })}
              data-testid="slider-temperature"
            />
            <p className="text-xs text-muted-foreground">Controls randomness. Lower is more focused, higher is more creative.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens: {config.maxTokens}</Label>
            <Slider
              id="maxTokens"
              min={100}
              max={4000}
              step={100}
              value={[config.maxTokens]}
              onValueChange={([value]) => setConfig({ ...config, maxTokens: value })}
              data-testid="slider-max-tokens"
            />
            <p className="text-xs text-muted-foreground">Maximum response length</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topP">Top P: {config.topP.toFixed(2)}</Label>
            <Slider
              id="topP"
              min={0}
              max={1}
              step={0.05}
              value={[config.topP]}
              onValueChange={([value]) => setConfig({ ...config, topP: value })}
              data-testid="slider-top-p"
            />
            <p className="text-xs text-muted-foreground">Nucleus sampling threshold</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequencyPenalty">Frequency Penalty: {config.frequencyPenalty.toFixed(2)}</Label>
            <Slider
              id="frequencyPenalty"
              min={0}
              max={2}
              step={0.1}
              value={[config.frequencyPenalty]}
              onValueChange={([value]) => setConfig({ ...config, frequencyPenalty: value })}
              data-testid="slider-frequency-penalty"
            />
            <p className="text-xs text-muted-foreground">Reduces repetition in responses</p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-system-behavior">
        <CardHeader>
          <CardTitle>System Behavior</CardTitle>
          <CardDescription>Reflection, recursion, and system prompt configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              rows={6}
              data-testid="textarea-system-prompt"
              placeholder="Enter the system prompt that defines the AI's behavior..."
            />
            <p className="text-xs text-muted-foreground">Base instructions for the Master Architect AI</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reflectionEnabled">Reflection Enabled</Label>
              <p className="text-xs text-muted-foreground">AI reviews its own responses for quality</p>
            </div>
            <Switch
              id="reflectionEnabled"
              checked={config.reflectionEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, reflectionEnabled: checked })}
              data-testid="switch-reflection-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxReflectionRounds">Max Reflection Rounds: {config.maxReflectionRounds}</Label>
            <Slider
              id="maxReflectionRounds"
              min={1}
              max={5}
              step={1}
              value={[config.maxReflectionRounds]}
              onValueChange={([value]) => setConfig({ ...config, maxReflectionRounds: value })}
              data-testid="slider-max-reflection-rounds"
            />
            <p className="text-xs text-muted-foreground">Number of self-review iterations</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recursionDepthLimit">Recursion Depth Limit: {config.recursionDepthLimit}</Label>
            <Slider
              id="recursionDepthLimit"
              min={1}
              max={10}
              step={1}
              value={[config.recursionDepthLimit]}
              onValueChange={([value]) => setConfig({ ...config, recursionDepthLimit: value })}
              data-testid="slider-recursion-depth-limit"
            />
            <p className="text-xs text-muted-foreground">Maximum nested operation depth</p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-context-management">
        <CardHeader>
          <CardTitle>Context Management</CardTitle>
          <CardDescription>Conversation history and memory settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="maxConversationHistory">Max Conversation History: {config.maxConversationHistory}</Label>
            <Slider
              id="maxConversationHistory"
              min={10}
              max={200}
              step={10}
              value={[config.maxConversationHistory]}
              onValueChange={([value]) => setConfig({ ...config, maxConversationHistory: value })}
              data-testid="slider-max-conversation-history"
            />
            <p className="text-xs text-muted-foreground">Number of messages to retain in context</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="contextSummarizationEnabled">Context Summarization</Label>
              <p className="text-xs text-muted-foreground">Compress old messages to save tokens</p>
            </div>
            <Switch
              id="contextSummarizationEnabled"
              checked={config.contextSummarizationEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, contextSummarizationEnabled: checked })}
              data-testid="switch-context-summarization-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="autoPruneAfterMessages">Auto-Prune After Messages: {config.autoPruneAfterMessages}</Label>
            <Slider
              id="autoPruneAfterMessages"
              min={50}
              max={500}
              step={50}
              value={[config.autoPruneAfterMessages]}
              onValueChange={([value]) => setConfig({ ...config, autoPruneAfterMessages: value })}
              data-testid="slider-auto-prune-after-messages"
            />
            <p className="text-xs text-muted-foreground">Automatically delete old messages after this count</p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-tool-permissions">
        <CardHeader>
          <CardTitle>Tool Permissions</CardTitle>
          <CardDescription>Configure which AI tools are enabled and in which modes. Channel-specific settings override global defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="permission-channel">Channel</Label>
              <Select
                value={selectedPermissionChannel}
                onValueChange={(value) => setSelectedPermissionChannel(value as AIChannel | "global")}
              >
                <SelectTrigger id="permission-channel" data-testid="select-permission-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((channel) => (
                    <SelectItem key={channel.value} value={channel.value}>
                      <div className="flex flex-col">
                        <span>{channel.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {CHANNELS.find(c => c.value === selectedPermissionChannel)?.description}
              </p>
            </div>
            {selectedPermissionChannel !== "global" && Object.keys(config.channelToolPermissions?.[selectedPermissionChannel] || {}).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearChannelOverrides}
                data-testid="button-clear-channel-overrides"
              >
                Clear Overrides
              </Button>
            )}
          </div>

          {selectedPermissionChannel !== "global" && Object.keys(config.channelToolPermissions?.[selectedPermissionChannel] || {}).length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
              No overrides configured. This channel uses global defaults. Modify any permission to create an override.
            </p>
          )}

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool Name</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-center">Draft</TableHead>
                  <TableHead className="text-center">Assist</TableHead>
                  <TableHead className="text-center">Auto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: "create_contact", label: "Create Contact" },
                  { name: "search_contacts", label: "Search Contacts" },
                  { name: "update_contact", label: "Update Contact" },
                  { name: "create_job", label: "Create Job" },
                  { name: "update_job_status", label: "Update Job Status" },
                  { name: "search_jobs", label: "Search Jobs" },
                  { name: "add_note", label: "Add Note" },
                  { name: "create_appointment", label: "Create Appointment" },
                  { name: "create_estimate", label: "Create Estimate" },
                  { name: "accept_estimate", label: "Accept Estimate" },
                  { name: "reject_estimate", label: "Reject Estimate" },
                  { name: "create_invoice", label: "Create Invoice" },
                  { name: "record_payment", label: "Record Payment" },
                ].map((tool) => {
                  const channelPerms = getPermissionsForChannel();
                  const globalPerm = config.toolPermissions[tool.name];
                  const channelPerm = channelPerms[tool.name];
                  
                  const permission = channelPerm || globalPerm || { 
                    enabled: true, 
                    allowedModes: ["draft", "assist", "auto"] 
                  };
                  
                  const isOverridden = selectedPermissionChannel !== "global" && channelPerm !== undefined;
                  
                  return (
                    <TableRow key={tool.name} data-testid={`row-tool-${tool.name}`} className={isOverridden ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {tool.label}
                        {isOverridden && <Badge variant="outline" className="ml-2 text-xs">Override</Badge>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={permission.enabled}
                          onCheckedChange={(checked) => updateToolPermission(tool.name, checked)}
                          data-testid={`switch-tool-${tool.name}-enabled`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.allowedModes?.includes("draft") ?? false}
                          onCheckedChange={(checked) => updateToolMode(tool.name, "draft", checked as boolean)}
                          disabled={!permission.enabled}
                          data-testid={`checkbox-tool-${tool.name}-draft`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.allowedModes?.includes("assist") ?? false}
                          onCheckedChange={(checked) => updateToolMode(tool.name, "assist", checked as boolean)}
                          disabled={!permission.enabled}
                          data-testid={`checkbox-tool-${tool.name}-assist`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={permission.allowedModes?.includes("auto") ?? false}
                          onCheckedChange={(checked) => updateToolMode(tool.name, "auto", checked as boolean)}
                          disabled={!permission.enabled}
                          data-testid={`checkbox-tool-${tool.name}-auto`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          <p className="text-xs text-muted-foreground mt-4">
            Draft mode: AI suggests actions only. Assist mode: AI queues actions for approval. Auto mode: AI executes immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyInstructionsManager() {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState<CompanyInstructions | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    behaviorInstructions: "",
    activeChannels: { crm_chat: true, widget: true, voice: false, gpt_actions: false },
    defaultPipelineStage: "lead_intake",
    defaultTags: [] as string[],
    isActive: true,
  });
  const [newTag, setNewTag] = useState("");

  const { data: companies = [], isLoading } = useQuery<CompanyInstructions[]>({
    queryKey: ["/api/company-instructions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/company-instructions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-instructions"] });
      setIsCreating(false);
      resetForm();
      toast({ title: "Company Created", description: "Company instructions have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest("PATCH", `/api/company-instructions/${id}`, data);
      return await res.json();
    },
    onSuccess: (updatedCompany) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-instructions"] });
      setSelectedCompany(updatedCompany);
      setEditMode(false);
      toast({ title: "Saved", description: "Company instructions have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/company-instructions/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-instructions"] });
      setSelectedCompany(null);
      toast({ title: "Deleted", description: "Company instructions have been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: "",
      behaviorInstructions: "",
      activeChannels: { crm_chat: true, widget: true, voice: false, gpt_actions: false },
      defaultPipelineStage: "lead_intake",
      defaultTags: [],
      isActive: true,
    });
  };

  const loadCompanyIntoForm = (company: CompanyInstructions) => {
    const channels = company.activeChannels as Record<string, boolean> || {};
    setFormData({
      companyName: company.companyName,
      behaviorInstructions: company.behaviorInstructions || "",
      activeChannels: {
        crm_chat: channels.crm_chat ?? true,
        widget: channels.widget ?? true,
        voice: channels.voice ?? false,
        gpt_actions: channels.gpt_actions ?? false,
      },
      defaultPipelineStage: company.defaultPipelineStage || "lead_intake",
      defaultTags: company.defaultTags || [],
      isActive: company.isActive,
    });
    setEditMode(true);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.defaultTags.includes(newTag.trim())) {
      setFormData({ ...formData, defaultTags: [...formData.defaultTags, newTag.trim()] });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, defaultTags: formData.defaultTags.filter(t => t !== tag) });
  };

  const handleSave = () => {
    if (!formData.companyName.trim()) {
      toast({ title: "Error", description: "Company name is required", variant: "destructive" });
      return;
    }
    
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedCompany) {
      updateMutation.mutate({ id: selectedCompany.id, data: formData });
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      setIsCreating(false);
      resetForm();
    } else {
      setEditMode(false);
      if (selectedCompany) loadCompanyIntoForm(selectedCompany);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading company instructions...</p></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1" data-testid="card-company-list">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Companies
            </CardTitle>
            <CardDescription>Per-company AI configurations</CardDescription>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              setIsCreating(true);
              setSelectedCompany(null);
              resetForm();
            }}
            data-testid="button-add-company"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {companies.length === 0 && !isCreating && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No companies configured yet. Click + to add one.
                </p>
              )}
              {companies.map((company) => (
                <Card
                  key={company.id}
                  className={`cursor-pointer hover-elevate ${selectedCompany?.id === company.id ? "border-primary" : ""}`}
                  onClick={() => {
                    setSelectedCompany(company);
                    setIsCreating(false);
                    loadCompanyIntoForm(company);
                    setEditMode(false);
                  }}
                  data-testid={`card-company-${company.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{company.companyName}</span>
                      </div>
                      <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2" data-testid="card-company-details">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>
              {isCreating ? "New Company" : selectedCompany ? selectedCompany.companyName : "Select a Company"}
            </CardTitle>
            <CardDescription>
              {isCreating ? "Create a new company configuration" : "Manage AI behavior for this company"}
            </CardDescription>
          </div>
          {(isCreating || (selectedCompany && editMode)) && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-company"
              >
                <Check className="w-4 h-4 mr-1" />
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
          {selectedCompany && !editMode && !isCreating && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-company">
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate(selectedCompany.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-company"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!isCreating && !selectedCompany && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a company from the list or create a new one
            </div>
          )}
          
          {(isCreating || selectedCompany) && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  disabled={!isCreating && !editMode}
                  placeholder="Enter company name"
                  data-testid="input-company-name"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">Enable AI customization for this company</p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  disabled={!isCreating && !editMode}
                  data-testid="switch-company-active"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="behaviorInstructions">Behavior Instructions</Label>
                <Textarea
                  id="behaviorInstructions"
                  value={formData.behaviorInstructions}
                  onChange={(e) => setFormData({ ...formData, behaviorInstructions: e.target.value })}
                  disabled={!isCreating && !editMode}
                  placeholder="Custom AI behavior instructions for this company..."
                  className="min-h-[150px]"
                  data-testid="textarea-behavior-instructions"
                />
                <p className="text-xs text-muted-foreground">
                  These instructions are appended to the Master Architect system prompt when handling requests for this company.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Active Channels</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["crm_chat", "widget", "voice", "gpt_actions"] as const).map((channelKey) => {
                    const labels = { crm_chat: "CRM Chat", widget: "Widget", voice: "Voice", gpt_actions: "GPT Actions" };
                    return (
                    <div key={channelKey} className="flex items-center gap-2">
                      <Checkbox
                        id={`channel-${channelKey}`}
                        checked={formData.activeChannels[channelKey] ?? false}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            activeChannels: { ...formData.activeChannels, [channelKey]: checked as boolean },
                          })
                        }
                        disabled={!isCreating && !editMode}
                        data-testid={`checkbox-channel-${channelKey}`}
                      />
                      <Label htmlFor={`channel-${channelKey}`} className="text-sm font-normal">
                        {labels[channelKey]}
                      </Label>
                    </div>
                  )})}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultPipelineStage">Default Pipeline Stage</Label>
                <Select
                  value={formData.defaultPipelineStage}
                  onValueChange={(value) => setFormData({ ...formData, defaultPipelineStage: value })}
                  disabled={!isCreating && !editMode}
                >
                  <SelectTrigger id="defaultPipelineStage" data-testid="select-pipeline-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_intake">Lead Intake</SelectItem>
                    <SelectItem value="qualification">Qualification</SelectItem>
                    <SelectItem value="estimate_pending">Estimate Pending</SelectItem>
                    <SelectItem value="estimate_sent">Estimate Sent</SelectItem>
                    <SelectItem value="job_scheduled">Job Scheduled</SelectItem>
                    <SelectItem value="job_in_progress">Job In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag"
                    disabled={!isCreating && !editMode}
                    data-testid="input-new-tag"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddTag}
                    disabled={!isCreating && !editMode}
                    data-testid="button-add-tag"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.defaultTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      {(isCreating || editMode) && (
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1" data-testid={`button-remove-tag-${tag}`}>
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MasterArchitect() {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<ActionIntakeItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: assistQueueData, isLoading: loadingQueue } = useQuery<{ entries: AssistQueueEntry[]; count: number }>({
    queryKey: ["/api/assist-queue"],
  });

  const { data: feedData, isLoading } = useQuery<FeedData>({
    queryKey: ["/api/architect/feed"],
    enabled: false,
    initialData: {
      feed: [
        {
          id: "ai-1",
          taskType: "Lead Follow-up",
          originatingAgent: "Intelligence Bot",
          rawPrompt: "Follow up with John Doe about the HVAC estimate",
          context: "Contact: John Doe, Estimate #EST-2024-001, $4,500",
          suggestedAction: "Send SMS follow-up message",
          extractedIntent: "Customer Follow-up",
          parsedEntities: "Contact: John Doe, Entity Type: Estimate",
          chosenTool: "send_sms",
          timestamp: new Date("2024-11-21T10:30:00"),
        },
        {
          id: "ai-2",
          taskType: "Invoice Reminder",
          originatingAgent: "Payment Assistant",
          rawPrompt: "Send payment reminder for overdue invoice",
          context: "Invoice #INV-2024-042, Amount: $2,100, 15 days overdue",
          suggestedAction: "Send email with payment link",
          extractedIntent: "Payment Collection",
          parsedEntities: "Invoice ID: INV-2024-042, Amount: $2,100",
          chosenTool: "send_email_with_payment_link",
          timestamp: new Date("2024-11-21T09:15:00"),
        },
        {
          id: "ai-3",
          taskType: "Job Scheduling",
          originatingAgent: "Scheduling Agent",
          rawPrompt: "Schedule installation for approved estimate",
          context: "Estimate #EST-2024-003 approved, customer requested next week",
          suggestedAction: "Create job and assign team",
          extractedIntent: "Job Creation",
          parsedEntities: "Estimate ID: EST-2024-003, Timeframe: Next week",
          chosenTool: "create_job",
          timestamp: new Date("2024-11-21T08:45:00"),
        },
      ],
      pendingApprovals: [
        {
          id: "pa-1",
          description: "Send $4,500 payment link to Sarah Johnson",
          originatingModule: "Payment Automation",
          confidenceScore: 0.92,
          isGated: false,
          gatedActionType: null,
          finalizationPayload: null,
        },
        {
          id: "pa-2",
          description: "Schedule follow-up call for estimate review",
          originatingModule: "Lead Management",
          confidenceScore: 0.87,
          isGated: false,
          gatedActionType: null,
          finalizationPayload: null,
        },
        {
          id: "pa-3",
          description: "Create invoice for completed job #JOB-2024-089",
          originatingModule: "Invoice Generator",
          confidenceScore: 0.95,
          isGated: false,
          gatedActionType: null,
          finalizationPayload: null,
        },
      ],
      completedActions: [
        {
          id: "ca-1",
          result: "SMS sent successfully to Mike Brown",
          duration: 1.2,
          callback: "Delivered at 10:15 AM",
          executionPath: "AI → N8N → Twilio → Success",
          timestamp: new Date("2024-11-21T10:15:00"),
        },
        {
          id: "ca-2",
          result: "Payment link generated and emailed",
          duration: 2.4,
          callback: "Email opened by recipient",
          executionPath: "AI → Stripe → SendGrid → Success",
          timestamp: new Date("2024-11-21T09:30:00"),
        },
        {
          id: "ca-3",
          result: "Job created and assigned to Team Alpha",
          duration: 0.8,
          callback: null,
          executionPath: "AI → CRM → Success",
          timestamp: new Date("2024-11-21T08:00:00"),
        },
      ],
    },
  });

  const assistEntries = assistQueueData?.entries || [];
  
  const pendingApprovals: PendingApproval[] = assistEntries
    .filter(e => e.status === "pending" || e.status === "pending_approval")
    .map(e => ({
      id: e.id,
      description: e.userRequest,
      originatingModule: `Intelligence Bot (${e.mode} mode)`,
      confidenceScore: 0.85,
      isGated: e.status === "pending_approval" && !!e.gatedActionType,
      gatedActionType: e.gatedActionType,
      finalizationPayload: e.finalizationPayload,
    }));

  const completedActions: CompletedAction[] = assistEntries
    .filter(e => e.status === "completed" || e.status === "rejected" || e.status === "executed" || e.status === "failed")
    .map(e => ({
      id: e.id,
      result: e.status === "rejected" 
        ? `Rejected: ${e.userRequest}` 
        : e.status === "executed"
        ? `Finalized: ${e.userRequest}`
        : e.status === "failed"
        ? `Failed: ${e.error || e.userRequest}`
        : e.agentResponse || e.userRequest,
      duration: 0,
      callback: e.status === "rejected" ? null : e.status === "executed" ? "Finalized" : e.status === "failed" ? "Failed" : "Completed",
      executionPath: `Intelligence Bot → Master Architect → ${e.status === "rejected" ? "Rejected" : e.status === "executed" ? "Finalized" : e.status === "failed" ? "Failed" : "Executed"}`,
      timestamp: e.completedAt || e.createdAt,
    }));

  const actionIntakeFeed: ActionIntakeItem[] = assistEntries.map(e => ({
    id: e.id,
    taskType: e.status === "pending" ? "Pending Approval" : e.status === "pending_approval" ? "Awaiting Finalization" : e.status === "completed" ? "Completed" : e.status === "executed" ? "Finalized" : e.status === "failed" ? "Failed" : "Rejected",
    originatingAgent: "Intelligence Bot",
    rawPrompt: e.userRequest,
    context: `Mode: ${e.mode}, Status: ${e.status}`,
    suggestedAction: e.toolsCalled?.map(t => t.name).join(", ") || "No tools",
    extractedIntent: e.agentResponse || "Processing...",
    parsedEntities: JSON.stringify(e.toolsCalled || []),
    chosenTool: e.toolsCalled?.[0]?.name || "None",
    timestamp: e.createdAt,
  }));

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/assist-queue/" + id + "/approve", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assist-queue"] });
      toast({
        title: "Action Approved",
        description: "The AI action has been approved and is being executed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve action",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/assist-queue/" + id + "/reject", { reason: "Rejected by user" });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assist-queue"] });
      toast({
        title: "Action Rejected",
        description: "The AI action has been rejected and removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject action",
        variant: "destructive",
      });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/assist-queue/" + id + "/finalize", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assist-queue"] });
      toast({
        title: "Action Finalized",
        description: data.message || "The gated action has been executed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Finalization Failed",
        description: "Failed to execute the gated action",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };

  const handleFinalize = (id: string) => {
    finalizeMutation.mutate(id);
  };

  const openDrawer = (item: ActionIntakeItem) => {
    setSelectedItem(item);
  };

  const closeDrawer = () => {
    setSelectedItem(null);
  };

  if (isLoading || loadingQueue) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading approval hub feed...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-master-architect-title">Approval Hub</h1>
          <p className="text-muted-foreground">AI Action Review & Approval Center</p>
        </div>

        <Tabs defaultValue="hub" className="w-full">
          <TabsList>
            <TabsTrigger value="hub" data-testid="tab-hub">Hub</TabsTrigger>
            <TabsTrigger value="companies" data-testid="tab-companies">
              <Building2 className="w-4 h-4 mr-2" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub" className="space-y-6 mt-6"  data-testid="content-hub">

        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-action-intake-feed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Action Intake Feed
              </CardTitle>
              <CardDescription>All incoming tasks from AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {actionIntakeFeed.map((item) => (
                    <Collapsible
                      key={item.id}
                      open={expandedItems.has(item.id)}
                      onOpenChange={() => toggleItem(item.id)}
                    >
                      <Card className="hover-elevate" data-testid={`card-intake-${item.id}`}>
                        <CardHeader className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" data-testid={`badge-task-type-${item.id}`}>
                                  {item.taskType}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {item.originatingAgent}
                                </span>
                              </div>
                              <p className="text-sm mt-2 truncate">{item.rawPrompt}</p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-toggle-${item.id}`}>
                                {expandedItems.has(item.id) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent className="p-4 pt-0 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Context</p>
                              <p className="text-sm">{item.context}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">Suggested Action</p>
                              <p className="text-sm">{item.suggestedAction}</p>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-xs text-muted-foreground">
                                {item.timestamp.toLocaleString()}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDrawer(item)}
                                data-testid={`button-view-details-${item.id}`}
                              >
                                View Details
                              </Button>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-approvals">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Approvals
              </CardTitle>
              <CardDescription>Tasks awaiting Master Architect decision</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <Card key={approval.id} data-testid={`card-approval-${approval.id}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium">{approval.description}</p>
                              {approval.isGated && (
                                <Badge variant="outline" className="text-amber-600 border-amber-600" data-testid={`badge-gated-${approval.id}`}>
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Gated Action
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {approval.originatingModule}
                            </p>
                            {approval.isGated && approval.gatedActionType && (
                              <div className="mt-2 p-2 bg-muted/50 rounded-md">
                                <p className="text-xs font-semibold text-muted-foreground">Action Type</p>
                                <Badge variant="secondary" className="mt-1" data-testid={`badge-action-type-${approval.id}`}>
                                  {approval.gatedActionType.replace(/_/g, ' ')}
                                </Badge>
                                {approval.finalizationPayload && (
                                  <div className="mt-2">
                                    <p className="text-xs font-semibold text-muted-foreground">Payload</p>
                                    <code className="text-xs block mt-1 p-1 bg-background rounded overflow-x-auto" data-testid={`text-payload-${approval.id}`}>
                                      {JSON.stringify(approval.finalizationPayload, null, 2)}
                                    </code>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Confidence:</span>
                              <Badge variant="secondary" data-testid={`badge-confidence-${approval.id}`}>
                                {(approval.confidenceScore * 100).toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              {approval.isGated ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleFinalize(approval.id)}
                                  disabled={finalizeMutation.isPending}
                                  data-testid={`button-finalize-${approval.id}`}
                                >
                                  {finalizeMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4 mr-1" />
                                  )}
                                  Finalize
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(approval.id)}
                                  data-testid={`button-approve-${approval.id}`}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(approval.id)}
                                data-testid={`button-reject-${approval.id}`}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-completed-actions">
          <CardHeader>
            <CardTitle>Completed Actions Log</CardTitle>
            <CardDescription>History of all processed tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {completedActions.map((action) => (
                  <Card key={action.id} className="bg-muted/50" data-testid={`card-completed-${action.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{action.result}</p>
                          <Badge variant="outline" data-testid={`badge-duration-${action.id}`}>
                            {action.duration}s
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-semibold">Path:</span> {action.executionPath}
                          </p>
                          {action.callback && (
                            <p className="text-muted-foreground">
                              <span className="font-semibold">Callback:</span> {action.callback}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {action.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="companies" className="space-y-6 mt-6" data-testid="content-companies">
            <CompanyInstructionsManager />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 mt-6" data-testid="content-settings">
            <MasterArchitectSettings />
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="w-[600px] sm:max-w-[600px]" data-testid="drawer-raw-prompt">
          <SheetHeader>
            <SheetTitle>Raw Prompt Viewer</SheetTitle>
            <SheetDescription>Detailed analysis of AI agent request</SheetDescription>
          </SheetHeader>
          {selectedItem && (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Raw Prompt</h3>
                <Card>
                  <CardContent className="p-4">
                    <code className="text-sm" data-testid="text-raw-prompt">
                      {selectedItem.rawPrompt}
                    </code>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Extracted Intent</h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm" data-testid="text-extracted-intent">
                      {selectedItem.extractedIntent || selectedItem.taskType}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Parsed Entities</h3>
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-1 text-sm">
                      <p data-testid="text-parsed-entities">
                        {selectedItem.parsedEntities || selectedItem.context}
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">
                        <span className="font-semibold">Agent:</span> {selectedItem.originatingAgent}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Chosen Tool</h3>
                <Card>
                  <CardContent className="p-4">
                    <Badge data-testid="badge-chosen-tool">
                      {selectedItem.chosenTool || selectedItem.suggestedAction}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
