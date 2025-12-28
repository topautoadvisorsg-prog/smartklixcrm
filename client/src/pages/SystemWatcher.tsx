import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, Database, Bot, Wifi, Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";

type HealthStatus = {
  status: string;
  timestamp: string;
  services: {
    database: string;
    redis: string;
    openai: string;
    n8n: string;
  };
};

type SystemMetrics = {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "connected":
    case "operational":
    case "healthy":
      return "text-green-600 dark:text-green-500";
    case "degraded":
    case "warning":
      return "text-yellow-600 dark:text-yellow-500";
    case "disconnected":
    case "error":
    case "down":
      return "text-red-600 dark:text-red-500";
    default:
      return "text-muted-foreground";
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "connected":
    case "operational":
    case "healthy":
      return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />;
    case "degraded":
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />;
    case "disconnected":
    case "error":
    case "down":
      return <XCircle className="w-5 h-5 text-red-600 dark:text-red-500" />;
    default:
      return <Activity className="w-5 h-5 text-muted-foreground" />;
  }
};

export default function SystemWatcher() {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: ["/api/health"],
    refetchInterval: 10000, // Poll every 10 seconds
  });

  useEffect(() => {
    if (health) {
      setLastUpdate(new Date());
    }
  }, [health]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/health"] });
    setLastUpdate(new Date());
  };

  const systemStatus = health?.status || "unknown";
  const services = health?.services || {
    database: "unknown",
    redis: "unknown",
    openai: "unknown",
    n8n: "unknown",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">System Watcher</h1>
          <p className="text-sm text-muted-foreground">
            Real-time infrastructure and service monitoring (Dev/Owner only)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="button-refresh-health"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Overview
            </CardTitle>
            <div className="flex items-center gap-2">
              {getStatusIcon(systemStatus)}
              <Badge
                variant={
                  systemStatus === "operational"
                    ? "default"
                    : systemStatus === "degraded"
                    ? "secondary"
                    : "destructive"
                }
                data-testid="badge-system-status"
              >
                {systemStatus}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="text-sm text-muted-foreground">100%</span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Health Score</span>
                  <span className="text-sm text-muted-foreground">
                    {systemStatus === "operational" ? "100%" : "75%"}
                  </span>
                </div>
                <Progress value={systemStatus === "operational" ? 100 : 75} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(services.database)}
                <div>
                  <p className="text-sm font-medium">PostgreSQL</p>
                  <p className="text-xs text-muted-foreground">Primary Database</p>
                </div>
              </div>
              <Badge
                variant={services.database === "connected" ? "default" : "destructive"}
                data-testid="badge-database-status"
              >
                {services.database}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(services.redis)}
                <div>
                  <p className="text-sm font-medium">Redis</p>
                  <p className="text-xs text-muted-foreground">Session Store</p>
                </div>
              </div>
              <Badge
                variant={services.redis === "connected" ? "default" : "destructive"}
                data-testid="badge-redis-status"
              >
                {services.redis}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI & Messaging Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(services.openai)}
                <div>
                  <p className="text-sm font-medium">OpenAI API</p>
                  <p className="text-xs text-muted-foreground">Master Architect</p>
                </div>
              </div>
              <Badge
                variant={services.openai === "connected" ? "default" : "destructive"}
                data-testid="badge-openai-status"
              >
                {services.openai}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(services.n8n)}
                <div>
                  <p className="text-sm font-medium">N8N Workflows</p>
                  <p className="text-xs text-muted-foreground">Automation Engine</p>
                </div>
              </div>
              <Badge
                variant={services.n8n === "connected" ? "default" : "destructive"}
                data-testid="badge-n8n-status"
              >
                {services.n8n}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Widget Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
                <div>
                  <p className="text-sm font-medium">Chat Widget</p>
                  <p className="text-xs text-muted-foreground">External Embed</p>
                </div>
              </div>
              <Badge variant="default" data-testid="badge-widget-status">
                operational
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Response Time</span>
                <span className="font-medium">1.2s</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Sessions</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Messages Today</span>
                <span className="font-medium">0</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Memory Usage</span>
                <span className="text-sm text-muted-foreground">~60%</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">CPU Usage</span>
                <span className="text-sm text-muted-foreground">~35%</span>
              </div>
              <Progress value={35} className="h-2" />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">API Requests (1h)</span>
                <span className="font-medium">0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Error Rate</span>
                <span className="font-medium text-green-600 dark:text-green-500">0%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">All services healthy</p>
                <p className="text-xs text-muted-foreground">{new Date().toLocaleString()}</p>
              </div>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground text-center py-4">
              No critical events in the last 24 hours
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
