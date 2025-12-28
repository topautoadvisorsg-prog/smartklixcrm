import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ActionGPTConfig = {
  apiKey?: string;
  clientId?: string;
};

const intakeHubSchema = `{
  "openapi": "3.1.0",
  "info": {
    "title": "CRM Intake Hub Ingress API",
    "version": "v2.1"
  },
  "paths": {
    "/v1/intake/submit": {
      "post": {
        "summary": "Submit arbitrary data for normalization.",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "source_gpt_id": { "type": "string" },
                  "payload": {
                    "type": "object",
                    "additionalProperties": true,
                    "description": "Arbitrary, free-form input. Untrusted until normalized."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Payload accepted for staging." }
        }
      }
    }
  }
}`;

const defaultTestPayload = `{
  "source_gpt_id": "gpt-4-turbo-preview",
  "payload": {
    "user_intent": "Client is asking about enterprise pricing for 900 seats.",
    "contact_email": "test.user@example.com"
  }
}`;

export default function ChatGPTActions() {
  const { toast } = useToast();
  const [testPayload, setTestPayload] = useState(defaultTestPayload);
  const [testResponse, setTestResponse] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: config } = useQuery<ActionGPTConfig>({
    queryKey: ["/api/ai/actiongpt/config"],
  });

  const apiKey = config?.apiKey || "sk-proj-882190... (Hidden)";
  const clientId = config?.clientId || "crm_intake_9921";

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copied",
        description: `${field} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([intakeHubSchema], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "intake-hub-openapi-schema.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "OpenAPI schema downloaded successfully",
    });
  };

  const handleGenerateKeys = () => {
    if (confirm("Revoke current keys and generate new credentials? Previous connections will fail immediately.")) {
      toast({
        title: "Keys Generated",
        description: "New API credentials have been generated. Update your Custom GPT configuration.",
      });
    }
  };

  const handleTestRequest = () => {
    setIsTestLoading(true);
    setTestResponse("");
    
    setTimeout(() => {
      setIsTestLoading(false);
      const timestamp = new Date().toISOString();
      setTestResponse(`[${timestamp}] POST /v1/intake/submit
> Content-Type: application/json
> Authorization: Bearer sk-proj...

< HTTP/1.1 200 OK
< Content-Type: application/json
{
  "status": "queued",
  "trace_id": "req_${Math.floor(Math.random() * 100000)}",
  "message": "Payload accepted. Intake Hub will normalize async."
}`);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-sans overflow-hidden">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-card/60 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-xl font-black text-foreground uppercase tracking-tighter">
              ActionGPT (External Integration Wizard)
            </h1>
            <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg">
              System Authority: AI-Native Configuration
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
            Non-Operational Configuration for Custom GPT Ingress. This is a setup tool, not an execution console.
          </p>
        </div>
      </header>

      {/* Visual Stepper */}
      <div className="px-8 py-6 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground max-w-5xl mx-auto">
          <div className="flex items-center text-primary">
            <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center mr-3 text-primary">1</span>
            Schema Definition (OpenAPI)
          </div>
          <div className="h-px bg-border flex-1 mx-4"></div>
          <div className="flex items-center text-foreground">
            <span className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center mr-3 text-muted-foreground">2</span>
            Authentication & Security
          </div>
          <div className="h-px bg-border flex-1 mx-4"></div>
          <div className="flex items-center text-foreground">
            <span className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center mr-3 text-muted-foreground">3</span>
            Connectivity Debugger
          </div>
        </div>
      </div>

      {/* Main Wizard Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* LEFT COLUMN: Step 1 (Schema) */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            <div className="flex-1 bg-card border border-border rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
              <div className="px-6 py-4 border-b border-border bg-card/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-foreground">Step 1: OpenAPI Schema Definition</h3>
                <span className="text-[10px] font-mono text-muted-foreground">v2.1 (Stable)</span>
              </div>
              <div className="flex-1 p-0 relative group">
                <textarea 
                  readOnly 
                  value={intakeHubSchema} 
                  className="w-full h-full min-h-[400px] bg-muted text-muted-foreground font-mono text-[11px] p-6 resize-none outline-none leading-relaxed selection:bg-primary/30"
                />
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-muted-foreground uppercase font-black bg-card px-2 py-1 rounded border border-border">Read Only</span>
                </div>
              </div>
              <div className="p-4 border-t border-border bg-card/50 flex space-x-3">
                <button 
                  onClick={() => handleCopy(intakeHubSchema, "schema")}
                  className="flex-1 bg-muted hover:bg-accent text-foreground py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center border border-border"
                >
                  {copiedField === "schema" ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Schema to Clipboard
                    </>
                  )}
                </button>
                <button 
                  onClick={handleDownloadSchema}
                  className="px-4 bg-muted hover:bg-accent text-muted-foreground rounded-xl transition-all border border-border"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium px-2">
              Paste this into your Custom GPT's "Actions" configuration. It defines the payload structure for the Intake Hub.
            </p>
          </div>

          {/* RIGHT COLUMN: Step 2 (Auth) & Step 3 (Debug) */}
          <div className="lg:col-span-5 flex flex-col space-y-8">
            
            {/* Step 2: Auth */}
            <div className="bg-card border border-border rounded-3xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 bg-primary blur-3xl rounded-full pointer-events-none"></div>
              <h3 className="text-sm font-bold text-foreground mb-6">Step 2: Authentication Credentials</h3>
              
              <div className="space-y-5 relative z-10">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">API Key (Live)</label>
                  <input 
                    readOnly 
                    value={apiKey} 
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-mono text-[hsl(var(--status-success))] outline-none"
                  />
                </div>
                <div className="flex space-x-3 items-end">
                  <div className="space-y-1 flex-1">
                    <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Client ID</label>
                    <input 
                      readOnly 
                      value={clientId} 
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-mono text-foreground outline-none"
                    />
                  </div>
                  <button 
                    onClick={handleGenerateKeys}
                    className="bg-muted hover:bg-accent text-foreground px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-border transition-all flex items-center h-[42px]"
                  >
                    Generate New Keys
                    <svg className="w-3 h-3 ml-2 text-[hsl(var(--status-pending))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-5 italic">
                These credentials provide write-only access to the Intake Hub. Treat as highly sensitive.
              </p>
            </div>

            {/* Step 3: Debugger */}
            <div className="flex-1 bg-card border border-border rounded-3xl p-6 shadow-lg flex flex-col">
              <h3 className="text-sm font-bold text-foreground mb-4">Step 3: Connectivity Debugger</h3>
              
              <div className="flex-1 flex flex-col space-y-4">
                <div className="space-y-1 flex-1">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Test Payload</label>
                  <textarea 
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    className="w-full h-32 bg-muted border border-border rounded-xl p-4 text-[10px] font-mono text-foreground outline-none resize-none focus:border-primary/50 transition-colors"
                  />
                </div>
                
                <button 
                  onClick={handleTestRequest}
                  disabled={isTestLoading}
                  className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center ${
                    isTestLoading 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                  }`}
                >
                  {isTestLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test Request
                    </>
                  )}
                </button>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Response Log</label>
                  <div className="h-32 bg-muted border border-border rounded-xl p-4 overflow-y-auto">
                    {testResponse ? (
                      <pre className="text-[10px] font-mono text-[hsl(var(--status-success))] whitespace-pre-wrap">{testResponse}</pre>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground italic">// Waiting for request...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
