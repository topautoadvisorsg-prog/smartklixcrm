import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Palette, Users, Lock, Plus, Copy, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings as SettingsType, User } from "@shared/schema";

type SettingsSection = 'company' | 'branding' | 'users' | 'credentials';

const USER_ROLES = [
  { value: "admin", label: "Administrator", description: "Full system access" },
  { value: "manager", label: "Manager", description: "Team and job management" },
  { value: "technician", label: "Technician", description: "Field work access" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

const NAV_ITEMS: { id: SettingsSection; label: string; icon: typeof Building2 }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'credentials', label: 'Credentials', icon: Lock },
];

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 pb-6 border-b border-border">
      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">{title}</h2>
      <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">{subtitle}</p>
    </div>
  );
}

function SettingsInput({ label, value, type = "text", placeholder = "", onChange, id }: {
  label: string;
  value?: string;
  type?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  id?: string;
}) {
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

function CompanySection() {
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

function BrandingSection() {
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

function UsersSection() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "technician",
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const resetForm = () => {
    setFormData({ username: "", email: "", password: "", role: "technician" });
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "User created", description: "New team member has been added." });
    },
    onError: (error) => {
      toast({
        title: "Failed to create user",
        description: error instanceof Error ? error.message : "Could not create user.",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      resetForm();
      toast({ title: "User updated", description: "User details have been saved." });
    },
    onError: (error) => {
      toast({
        title: "Failed to update user",
        description: error instanceof Error ? error.message : "Could not update user.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeletingUser(null);
      toast({ title: "User deleted", description: "User has been removed from the system." });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete user",
        description: error instanceof Error ? error.message : "Could not delete user.",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!formData.username || !formData.email || !formData.password) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    const updates: Partial<typeof formData> = {
      username: formData.username,
      email: formData.email,
      role: formData.role,
    };
    if (formData.password) {
      updates.password = formData.password;
    }
    updateUserMutation.mutate({ id: editingUser.id, data: updates });
  };

  const openEditDialog = (user: User) => {
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
    });
    setEditingUser(user);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Users" subtitle="Team Members & Access Control" />
      
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              <tr>
                <th className="px-6 py-4">Identity</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No users found. Invite team members to get started.
                  </td>
                </tr>
              )}
              {users.map(user => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{user.username}</div>
                        <div className="text-[10px] text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-muted border border-border rounded-lg text-[10px] font-black uppercase text-muted-foreground tracking-wide">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-green-500">Active</span>
                      <span className="text-[9px] text-muted-foreground">
                        Since {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openEditDialog(user)}
                      className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground mr-4"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setDeletingUser(user)}
                      className="text-[10px] font-black uppercase text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
          <button 
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center space-x-2"
          >
            <Plus className="w-3 h-3" />
            <span>Invite User</span>
          </button>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Add New User</DialogTitle>
            <DialogDescription className="text-[10px] uppercase tracking-widest">Create a new team member account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <SettingsInput
              label="Username"
              value={formData.username}
              placeholder="johndoe"
              onChange={(v) => setFormData({ ...formData, username: v })}
            />
            <SettingsInput
              label="Email"
              type="email"
              value={formData.email}
              placeholder="john@example.com"
              onChange={(v) => setFormData({ ...formData, email: v })}
            />
            <SettingsInput
              label="Password"
              type="password"
              value={formData.password}
              placeholder="Min 8 characters"
              onChange={(v) => setFormData({ ...formData, password: v })}
            />
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest">Role</label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="bg-muted/50 border-border rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <button 
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Edit User</DialogTitle>
            <DialogDescription className="text-[10px] uppercase tracking-widest">Update user details and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <SettingsInput
              label="Username"
              value={formData.username}
              onChange={(v) => setFormData({ ...formData, username: v })}
            />
            <SettingsInput
              label="Email"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData({ ...formData, email: v })}
            />
            <SettingsInput
              label="New Password (leave blank to keep current)"
              type="password"
              placeholder="Enter new password"
              onChange={(v) => setFormData({ ...formData, password: v })}
            />
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-muted-foreground tracking-widest">Role</label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="bg-muted/50 border-border rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <button 
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black uppercase tracking-tight">Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.username}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteUserMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-black uppercase tracking-widest"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CredentialsSection() {
  const { toast } = useToast();
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [integrationsSaved, setIntegrationsSaved] = useState(false);

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setN8nWebhookUrl(settings.n8nWebhookUrl || "");
      setStripeSecretKey(settings.stripeSecretKey || "");
      setOpenaiApiKey(settings.openaiApiKey || "");
      setTwilioAccountSid(settings.twilioAccountSid || "");
      setTwilioAuthToken(settings.twilioAuthToken || "");
      setSendgridApiKey(settings.sendgridApiKey || "");
    }
  }, [settings]);

  const saveCredentialsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/settings", { 
        n8nWebhookUrl,
        stripeSecretKey,
        openaiApiKey,
        twilioAccountSid,
        twilioAuthToken,
        sendgridApiKey,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setIntegrationsSaved(true);
      toast({ title: "Credentials Saved", description: "Your credentials have been securely stored." });
      setTimeout(() => setIntegrationsSaved(false), 2000);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Could not save credentials.",
        variant: "destructive",
      });
    },
  });

  const maskValue = (val: string) => val ? `${val.substring(0, 8)}...${val.substring(val.length - 4)}` : '—';

  const credentials = [
    { id: 'n8n', name: 'N8N Webhook URL', type: 'Webhook', value: n8nWebhookUrl, masked: n8nWebhookUrl ? `${n8nWebhookUrl.substring(0, 30)}...` : '—' },
    { id: 'stripe', name: 'Stripe Secret Key', type: 'API Key', value: stripeSecretKey, masked: maskValue(stripeSecretKey) },
    { id: 'openai', name: 'OpenAI API Key', type: 'API Key', value: openaiApiKey, masked: maskValue(openaiApiKey) },
    { id: 'twilio-sid', name: 'Twilio Account SID', type: 'Token', value: twilioAccountSid, masked: maskValue(twilioAccountSid) },
    { id: 'twilio-auth', name: 'Twilio Auth Token', type: 'Token', value: twilioAuthToken, masked: maskValue(twilioAuthToken) },
    { id: 'sendgrid', name: 'SendGrid API Key', type: 'API Key', value: sendgridApiKey, masked: maskValue(sendgridApiKey) },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

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
            {credentials.map(cred => (
              <tr key={cred.id} className="hover:bg-muted/30 transition-colors">
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
                    {cred.masked}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => cred.value && copyToClipboard(cred.value)}
                    className="text-[10px] font-black uppercase text-primary hover:text-primary/80 mr-4"
                  >
                    Copy
                  </button>
                  <button className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground mr-4">
                    Edit
                  </button>
                  <button className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
        <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-6">Add or Update Credentials</h3>
        
        <div className="space-y-6">
          <SettingsInput
            label="N8N Webhook URL"
            value={n8nWebhookUrl}
            placeholder="https://n8n.example.com/webhook/..."
            onChange={setN8nWebhookUrl}
          />
          
          <SettingsInput
            label="Stripe Secret Key"
            type="password"
            value={stripeSecretKey}
            placeholder="sk_live_..."
            onChange={setStripeSecretKey}
          />
          
          <SettingsInput
            label="OpenAI API Key"
            type="password"
            value={openaiApiKey}
            placeholder="sk-proj-..."
            onChange={setOpenaiApiKey}
          />
          
          <SettingsInput
            label="Twilio Account SID"
            type="password"
            value={twilioAccountSid}
            placeholder="AC..."
            onChange={setTwilioAccountSid}
          />
          
          <SettingsInput
            label="Twilio Auth Token"
            type="password"
            value={twilioAuthToken}
            placeholder="Auth token..."
            onChange={setTwilioAuthToken}
          />
          
          <SettingsInput
            label="SendGrid API Key"
            type="password"
            value={sendgridApiKey}
            placeholder="SG..."
            onChange={setSendgridApiKey}
          />
        </div>
        
        <div className="mt-6 pt-6 border-t border-border flex justify-end">
          <button 
            onClick={() => saveCredentialsMutation.mutate()}
            disabled={saveCredentialsMutation.isPending || integrationsSaved}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            {integrationsSaved ? (
              <span>Saved ✓</span>
            ) : saveCredentialsMutation.isPending ? (
              <span>Saving...</span>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>Save Credentials</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('company');
  
  const { isLoading } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-64 p-4">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="flex-1 p-12">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

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
