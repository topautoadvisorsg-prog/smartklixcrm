import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function BrandingSection() {
  const { toast } = useToast();
  const [primaryColor, setPrimaryColor] = useState('#F59E0B');
  const [secondaryColor, setSecondaryColor] = useState('#1565C0');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  const logoUrl = settings?.logoUrl || null;

  const uploadLogoMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      return apiRequest("PATCH", "/api/settings", { logoUrl: dataUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Logo Updated", description: "Your company logo has been saved." });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not save logo.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 500 * 1024) {
      toast({ title: "File Too Large", description: "Please upload an image under 500KB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      uploadLogoMutation.mutate(dataUrl, {
        onSettled: () => setIsUploading(false),
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({ title: "Read Failed", description: "Could not read the file.", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <SectionTitle title="Branding" subtitle="Visual Identity & Theming" />
      
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-6">Company Logo</h3>
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-muted rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl font-black">SK</span>
              )}
            </div>
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || uploadLogoMutation.isPending}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isUploading || uploadLogoMutation.isPending ? "Uploading..." : "Upload New"}
              </button>
              <p className="text-[10px] text-muted-foreground">Square image, max 500KB. PNG or JPG.</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-6">Brand Colors</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Primary Color</label>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-border" style={{ backgroundColor: primaryColor }}></div>
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground uppercase"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Secondary Color</label>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-border" style={{ backgroundColor: secondaryColor }}></div>
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-6">Display Settings</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">White Label Mode</p>
              <p className="text-[10px] text-muted-foreground mt-1">Hide "Powered by Smart Klix" branding</p>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}
