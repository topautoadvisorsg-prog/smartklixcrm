import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings as SettingsType } from "@shared/schema";

interface SettingsInputProps {
  label: string;
  value?: string;
  type?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  id?: string;
}

function SettingsInput({ label, value, type = "text", placeholder = "", onChange, id }: SettingsInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  );
}

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

export default function CompanySection() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
    }
  }, [settings]);

  const saveCompanyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/settings", {
        companyName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setIsSaved(true);
      toast({ title: "Company Profile Saved", description: "Your company information has been updated." });
      setTimeout(() => setIsSaved(false), 2000);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save company profile.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <SectionTitle title="Company Profile" subtitle="Core Business Identity" />
      
      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <SettingsInput 
          label="Company Name" 
          value={companyName} 
          onChange={setCompanyName}
          id="company-name" 
        />
        
        <div className="mt-6 pt-6 border-t border-border flex justify-end">
          <button 
            onClick={() => saveCompanyMutation.mutate()}
            disabled={saveCompanyMutation.isPending || isSaved}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50"
          >
            {isSaved ? "Saved ✓" : saveCompanyMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
