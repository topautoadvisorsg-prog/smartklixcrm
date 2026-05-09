import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Mail, Send, CheckCircle, XCircle, Clock, Loader2, Users, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft:      { label: "Draft",      variant: "secondary",    icon: <Clock className="w-3 h-3" /> },
  queued:     { label: "Queued",     variant: "outline",      icon: <Clock className="w-3 h-3" /> },
  processing: { label: "Processing", variant: "default",      icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  sending:    { label: "Sending",    variant: "default",      icon: <Send className="w-3 h-3" /> },
  completed:  { label: "Completed",  variant: "default",      icon: <CheckCircle className="w-3 h-3" /> },
  failed:     { label: "Failed",     variant: "destructive",  icon: <XCircle className="w-3 h-3" /> },
};

function CampaignStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: "outline" as const, icon: null };
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

export default function Campaigns() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/campaigns", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setOpen(false);
      setForm({ name: "", subject: "", body: "" });
      toast({ title: "Campaign created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failedCount || 0), 0);
  const active = campaigns.filter(c => ["sending", "processing", "queued"].includes(c.status)).length;

  return (
    <div className="space-y-6" data-testid="page-campaigns">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Mail className="w-6 h-6 text-primary" />
            Mass Email
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and send email campaigns to your contacts
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold">{campaigns.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Emails Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold">{totalSent.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Loader2 className={`w-4 h-4 ${active > 0 ? "text-primary animate-spin" : "text-muted-foreground"}`} />
              <span className="text-2xl font-bold">{active}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Mail className="w-10 h-10" />
              <p className="text-sm">No campaigns yet. Create your first one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[240px]">{c.subject}</p>
                      </div>
                    </TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Users className="w-3 h-3" />
                        {c.totalRecipients}
                      </span>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium text-sm">{c.sentCount}</TableCell>
                    <TableCell className="text-destructive font-medium text-sm">{c.failedCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Campaign Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="camp-name">Campaign Name</Label>
              <Input
                id="camp-name"
                placeholder="e.g. Summer Follow-up"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="camp-subject">Email Subject</Label>
              <Input
                id="camp-subject"
                placeholder="e.g. We have a special offer for you"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="camp-body">Email Body (HTML or plain text)</Label>
              <Textarea
                id="camp-body"
                placeholder="Write your email content here..."
                rows={8}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.subject || !form.body || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
