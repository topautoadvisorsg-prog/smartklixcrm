import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, Eye, Pencil, Copy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Settings as SettingsType } from "@shared/schema";

interface SectionTitleProps {
  title: string;
  subtitle: string;
}

function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <div className="mb-8 pb-6 border-b border-border">
      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">{title}</h2>
      <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">{subtitle}</p>
    </div>
  );
}

interface CredentialDef {
  key: keyof SettingsType;
  name: string;
  type: string;
  placeholder: string;
}

const CREDENTIAL_DEFS: CredentialDef[] = [
  { key: "n8nWebhookUrl", name: "N8N Webhook URL", type: "Webhook", placeholder: "https://n8n.example.com/webhook/..." },
  { key: "stripeSecretKey", name: "Stripe Secret Key", type: "API Key", placeholder: "sk_live_..." },
  { key: "openaiApiKey", name: "OpenAI API Key", type: "API Key", placeholder: "sk-proj-..." },
  { key: "twilioAccountSid", name: "Twilio Account SID", type: "Token", placeholder: "AC..." },
  { key: "twilioAuthToken", name: "Twilio Auth Token", type: "Token", placeholder: "Auth token..." },
  { key: "sendgridApiKey", name: "SendGrid API Key", type: "API Key", placeholder: "SG..." },
];

export default function CredentialsSection() {
  const { toast } = useToast();
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  // Reveal dialog state
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revealValue, setRevealValue] = useState<string>("");
  const [revealTimer, setRevealTimer] = useState(30);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Reveal mutation
  const revealMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", "/api/settings/credentials/reveal", { key });
      return res.json() as Promise<{ key: string; value: string }>;
    },
    onSuccess: (data) => {
      setRevealValue(data.value);
      setRevealTimer(30);
      setRevealDialogOpen(true);
    },
    onError: (error) => {
      toast({
        title: "Reveal Failed",
        description: error instanceof Error ? error.message : "Could not reveal credential.",
        variant: "destructive",
      });
    },
  });

  // Update credential mutation
  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("POST", "/api/settings/credentials", { key, value });
      return res.json() as Promise<{ success: boolean; key: string; masked: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setEditDialogOpen(false);
      setEditKey(null);
      setEditValue("");
      toast({ title: "Credential Updated", description: "The credential has been securely stored." });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not update credential.",
        variant: "destructive",
      });
    },
  });

  // Auto-close reveal dialog after 30 seconds
  useEffect(() => {
    if (revealDialogOpen) {
      revealTimerRef.current = setInterval(() => {
        setRevealTimer((prev) => {
          if (prev <= 1) {
            setRevealDialogOpen(false);
            setRevealKey(null);
            setRevealValue("");
            if (revealTimerRef.current) clearInterval(revealTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      };
    }
  }, [revealDialogOpen]);

  const handleReveal = useCallback((key: string) => {
    setRevealKey(key);
    revealMutation.mutate(key);
  }, [revealMutation]);

  const handleEdit = useCallback((key: string) => {
    setEditKey(key);
    setEditValue("");
    setEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editKey && editValue) {
      updateMutation.mutate({ key: editKey, value: editValue });
    }
  }, [editKey, editValue, updateMutation]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const getCredentialDef = (key: string) => CREDENTIAL_DEFS.find((c) => c.key === key);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Credentials" subtitle="Secure Storage Vault" />

      <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl flex items-start space-x-4">
        <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground mb-1">Vault Description</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add, name, and store API keys, tokens, and webhook URLs. Partial credentials allowed.
            This is a secure storage vault only — no validation or execution happens here.
            Raw values are never stored in browser state.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-6">
        <table className="w-full text-left">
          <thead className="bg-muted/50 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest">
            <tr>
              <th className="px-6 py-4">Credential Name</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Value (Masked)</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CREDENTIAL_DEFS.map((cred) => {
              const maskedValue = settings?.[cred.key] as string | undefined;
              const hasValue = !!maskedValue;
              return (
                <tr key={cred.key} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-foreground">{cred.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-muted border border-border rounded text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                      {cred.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-muted-foreground tracking-wider">
                      {maskedValue || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {hasValue && (
                      <button
                        onClick={() => handleReveal(cred.key)}
                        disabled={revealMutation.isPending && revealKey === cred.key}
                        className="text-[10px] font-black uppercase text-primary hover:text-primary/80 mr-4 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Reveal
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(cred.key)}
                      className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground mr-4 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reveal Dialog */}
      <Dialog open={revealDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setRevealDialogOpen(false);
          setRevealKey(null);
          setRevealValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal Credential</DialogTitle>
            <DialogDescription>
              This value will be hidden automatically in {revealTimer} seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 border border-border rounded-xl p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
              {getCredentialDef(revealKey || "")?.name || revealKey}
            </p>
            <p className="font-mono text-sm text-foreground break-all select-all">
              {revealValue}
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                copyToClipboard(revealValue);
              }}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest inline-flex items-center gap-2"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditKey(null);
          setEditValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Credential</DialogTitle>
            <DialogDescription>
              Enter the new value for {getCredentialDef(editKey || "")?.name || editKey}.
              The raw value will not be stored in browser state after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              {getCredentialDef(editKey || "")?.name || editKey}
            </label>
            <input
              type="password"
              value={editValue}
              placeholder={getCredentialDef(editKey || "")?.placeholder || ""}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              autoFocus
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => {
                setEditDialogOpen(false);
                setEditKey(null);
                setEditValue("");
              }}
              className="px-4 py-2 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editValue || updateMutation.isPending}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
