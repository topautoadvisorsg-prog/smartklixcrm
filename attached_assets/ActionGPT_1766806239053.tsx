
import React, { useState } from 'react';

const ActionGPT: React.FC = () => {
  const [apiKey, setApiKey] = useState("sk-proj-882190... (Hidden)");
  const [clientId, setClientId] = useState("crm_intake_9921");
  const [testPayload, setTestPayload] = useState(`{
  "source_gpt_id": "gpt-4-turbo-preview",
  "payload": {
    "user_intent": "Client is asking about enterprise pricing for 900 seats.",
    "contact_email": "test.user@example.com"
  }
}`);
  const [testResponse, setTestResponse] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);

  const schema = `{
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  const handleGenerateKeys = () => {
    if (confirm("Revoke current keys and generate new credentials? Previous connections will fail immediately.")) {
      setApiKey(`sk-proj-${Math.random().toString(36).substring(2, 15)}...`);
      setClientId(`crm_intake_${Math.floor(Math.random() * 10000)}`);
    }
  };

  const handleTestRequest = () => {
    setIsTestLoading(true);
    setTestResponse("");
    
    // Simulate API latency
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
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 font-sans overflow-hidden">
      
      {/* 1. Header */}
      <header className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-xl flex justify-between items-center shrink-0 z-20">
        <div>
          <div className="flex items-center space-x-3 mb-1">
             <h1 className="text-xl font-black text-zinc-100 uppercase tracking-tighter">ActionGPT (External Integration Wizard)</h1>
             <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                System Authority: AI-Native Configuration
             </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
            Non-Operational Configuration for Custom GPT Ingress. This is a setup tool, not an execution console.
          </p>
        </div>
      </header>

      {/* 2. Visual Stepper */}
      <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
         <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 max-w-5xl mx-auto">
            <div className="flex items-center text-indigo-400">
               <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center mr-3 text-indigo-400">1</span>
               Schema Definition (OpenAPI)
            </div>
            <div className="h-px bg-zinc-800 flex-1 mx-4"></div>
            <div className="flex items-center text-zinc-300">
               <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mr-3 text-zinc-400">2</span>
               Authentication & Security
            </div>
            <div className="h-px bg-zinc-800 flex-1 mx-4"></div>
            <div className="flex items-center text-zinc-300">
               <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mr-3 text-zinc-400">3</span>
               Connectivity Debugger
            </div>
         </div>
      </div>

      {/* 3. Main Wizard Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
         <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            
            {/* LEFT COLUMN: Step 1 (Schema) */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
               <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                  <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                     <h3 className="text-sm font-bold text-zinc-200">Step 1: OpenAPI Schema Definition</h3>
                     <span className="text-[10px] font-mono text-zinc-500">v2.1 (Stable)</span>
                  </div>
                  <div className="flex-1 p-0 relative group">
                     <textarea 
                        readOnly 
                        value={schema} 
                        className="w-full h-full bg-[#09090b] text-zinc-400 font-mono text-[11px] p-6 resize-none outline-none leading-relaxed selection:bg-indigo-500/30"
                     />
                     <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-zinc-600 uppercase font-black bg-zinc-900 px-2 py-1 rounded">Read Only</span>
                     </div>
                  </div>
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex space-x-3">
                     <button 
                        onClick={() => handleCopy(schema)}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center"
                     >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copy Schema to Clipboard
                     </button>
                     <button className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     </button>
                  </div>
               </div>
               <p className="text-[10px] text-zinc-500 font-medium px-2">
                  Paste this into your Custom GPT's "Actions" configuration. It defines the payload structure for the Intake Hub.
               </p>
            </div>

            {/* RIGHT COLUMN: Step 2 (Auth) & Step 3 (Debug) */}
            <div className="lg:col-span-5 flex flex-col space-y-8">
               
               {/* Step 2: Auth */}
               <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5 bg-indigo-500 blur-3xl rounded-full pointer-events-none"></div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-6">Step 2: Authentication Credentials</h3>
                  
                  <div className="space-y-5 relative z-10">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">API Key (Live)</label>
                        <input 
                           readOnly 
                           value={apiKey} 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-emerald-500 outline-none"
                        />
                     </div>
                     <div className="flex space-x-3 items-end">
                        <div className="space-y-1 flex-1">
                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Client ID</label>
                           <input 
                              readOnly 
                              value={clientId} 
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-zinc-300 outline-none"
                           />
                        </div>
                        <button 
                           onClick={handleGenerateKeys}
                           className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-700 transition-all flex items-center h-[42px]"
                        >
                           Generate New Keys
                           <svg className="w-3 h-3 ml-2 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </button>
                     </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-5 italic">
                     These credentials provide write-only access to the Intake Hub. Treat as highly sensitive.
                  </p>
               </div>

               {/* Step 3: Debugger */}
               <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-lg flex flex-col">
                  <h3 className="text-sm font-bold text-zinc-200 mb-4">Step 3: Connectivity Debugger</h3>
                  
                  <div className="flex-1 flex flex-col space-y-4">
                     <div className="space-y-1 flex-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Test Payload</label>
                        <textarea 
                           value={testPayload}
                           onChange={(e) => setTestPayload(e.target.value)}
                           className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-[10px] font-mono text-zinc-300 outline-none resize-none focus:border-indigo-500/50 transition-colors custom-scrollbar"
                        />
                     </div>
                     
                     <button 
                        onClick={handleTestRequest}
                        disabled={isTestLoading}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isTestLoading ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
                     >
                        {isTestLoading ? 'Sending Request...' : 'Send Test Request'}
                     </button>

                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Response Log</label>
                        <div className="h-32 bg-[#0D0D10] border border-zinc-800 rounded-xl p-4 overflow-y-auto custom-scrollbar">
                           {testResponse ? (
                              <pre className="text-[10px] font-mono text-emerald-500 whitespace-pre-wrap">{testResponse}</pre>
                           ) : (
                              <span className="text-[10px] font-mono text-zinc-700 italic">// Waiting for request...</span>
                           )}
                        </div>
                     </div>
                  </div>
               </div>

            </div>
         </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="px-8 py-4 border-t border-zinc-800 bg-zinc-900/30 text-center">
         <p className="text-[10px] text-indigo-400/60 font-bold uppercase tracking-widest">
            Remember: No operational actions are executed here. This is a passive configuration tool.
            <br/><span className="text-zinc-600 normal-case font-medium">See <span className="text-zinc-400 underline cursor-pointer">Action Console</span> for manual instruction.</span>
         </p>
      </footer>

    </div>
  );
};

export default ActionGPT;
