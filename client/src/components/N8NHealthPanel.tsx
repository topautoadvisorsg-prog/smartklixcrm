import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Send, 
  Settings, 
  XCircle,
  Link2,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type N8NHealthData = {
  webhookUrl: string | null;
  isConfigured: boolean;
  stats: {
    total: number;
    success: number;
    failures: number;
    errors: number;
  };
  lastSuccess: {
    timestamp: string;
    statusCode: number;
    duration: number;
  } | null;
  lastFailure: {
    timestamp: string;
    statusCode: number;
    error: string;
  } | null;
  recentEvents: Array<{
    id: string;
    url: string;
    statusCode: number | null;
    duration: number | null;
    error: string | null;
    createdAt: string;
  }>;
};

type TestResult = {
  success: boolean;
  statusCode: number | null;
  duration: number;
  response: unknown;
  error: string | null;
  eventId: string;
};

export default function N8NHealthPanel() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data: health, isLoading, refetch } = useQuery<N8NHealthData>({
    queryKey: ["/api/n8n/health"],
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("PATCH", "/api/n8n/settings", { webhookUrl: url });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/n8n/health"] });
      toast({
        title: "Settings Saved",
        description: "N8N webhook URL has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Failed to Save",
        description: "Could not update N8N settings",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (url: string): Promise<TestResult> => {
      const res = await apiRequest("POST", "/api/n8n/test", { url });
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/n8n/health"] });
      if (data.success) {
        toast({
          title: "Test Successful",
          description: `Webhook responded in ${data.duration}ms`,
        });
      } else {
        toast({
          title: "Test Failed",
          description: data.error || `Status code: ${data.statusCode}`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (webhookUrl) {
      saveMutation.mutate(webhookUrl);
    }
  };

  const handleTest = () => {
    const urlToTest = testUrl || health?.webhookUrl;
    if (urlToTest) {
      testMutation.mutate(urlToTest);
    } else {
      toast({
        title: "No URL",
        description: "Please enter a webhook URL to test",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card data-testid="card-n8n-config">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            N8N Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure and monitor your N8N webhook integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                placeholder="https://your-n8n-instance.com/webhook/..."
                value={webhookUrl || health?.webhookUrl || ""}
                onChange={(e) => setWebhookUrl(e.target.value)}
                data-testid="input-n8n-webhook-url"
              />
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !webhookUrl}
                data-testid="button-save-n8n-url"
              >
                {saveMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </Button>
            </div>
            {health?.isConfigured && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Webhook URL is configured
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Test Webhook
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={health?.webhookUrl || "Enter URL to test..."}
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                data-testid="input-test-url"
              />
              <Button
                onClick={handleTest}
                disabled={testMutation.isPending}
                data-testid="button-test-n8n"
              >
                {testMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Test Ping
                  </>
                )}
              </Button>
            </div>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <AlertDescription>
                <div className="space-y-1">
                  <p>
                    {testResult.success ? "Connection successful!" : "Connection failed"}
                  </p>
                  <div className="text-xs space-y-1">
                    <p>Status: {testResult.statusCode || "N/A"}</p>
                    <p>Duration: {testResult.duration}ms</p>
                    {testResult.error && <p>Error: {testResult.error}</p>}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-n8n-health">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Health Status
            </CardTitle>
            <CardDescription>
              Monitor webhook delivery status and history
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-health"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold" data-testid="text-total-events">
                {health?.stats.total || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-success-count">
                {health?.stats.success || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Failures</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-failure-count">
                {health?.stats.failures || 0}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-error-count">
                {health?.stats.errors || 0}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            {health?.lastSuccess && (
              <div className="space-y-1 p-3 rounded-md bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Last Success</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(health.lastSuccess.timestamp)}
                </p>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {health.lastSuccess.statusCode}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {health.lastSuccess.duration}ms
                  </Badge>
                </div>
              </div>
            )}

            {health?.lastFailure && (
              <div className="space-y-1 p-3 rounded-md bg-red-50 dark:bg-red-950/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium">Last Failure</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(health.lastFailure.timestamp)}
                </p>
                <div className="space-y-1">
                  {health.lastFailure.statusCode && (
                    <Badge variant="destructive" className="text-xs">
                      {health.lastFailure.statusCode}
                    </Badge>
                  )}
                  {health.lastFailure.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 truncate">
                      {health.lastFailure.error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {health?.recentEvents && health.recentEvents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Events</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {health.recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-2 rounded-md border"
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {event.statusCode && event.statusCode >= 200 && event.statusCode < 300 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                          )}
                          <span className="text-xs text-muted-foreground truncate">
                            {event.url}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.statusCode && (
                            <Badge
                              variant={event.statusCode >= 200 && event.statusCode < 300 ? "secondary" : "destructive"}
                              className="text-xs"
                            >
                              {event.statusCode}
                            </Badge>
                          )}
                          {event.duration && (
                            <span className="text-xs text-muted-foreground">
                              {event.duration}ms
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {(!health?.recentEvents || health.recentEvents.length === 0) && (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No webhook events recorded yet</p>
              <p className="text-sm">Test your webhook to create the first event</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
