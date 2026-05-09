import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { User } from "@shared/schema";

const USER_ROLES = [
  { value: "admin", label: "Administrator", description: "Full system access" },
  { value: "manager", label: "Manager", description: "Team and job management" },
  { value: "technician", label: "Technician", description: "Field work access" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

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

export default function UsersSection() {
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
