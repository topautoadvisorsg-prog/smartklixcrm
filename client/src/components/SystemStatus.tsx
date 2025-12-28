import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Zap, Cloud, Workflow, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HealthResponse {
  status: string;
  timestamp: string;
  services: {
    database: string;
    redis: string;
    openai: string;
    n8n: string;
  };
}

export default function SystemStatus() {
  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['/api/health'],
    refetchInterval: 30000,
  });

  if (!health) return null;

  const services = [
    {
      name: "Database",
      status: health.services.database,
      icon: Database,
      description: "PostgreSQL storage",
    },
    {
      name: "Redis Queue",
      status: health.services.redis,
      icon: Cloud,
      description: "Background jobs",
    },
    {
      name: "AI Agent",
      status: health.services.openai,
      icon: Zap,
      description: "OpenAI integration",
    },
    {
      name: "Workflows",
      status: health.services.n8n,
      icon: Workflow,
      description: "N8N automation",
    },
  ];

  const getStatusColor = (status: string) => {
    if (status === "connected") return "text-green-600 dark:text-green-400";
    if (status === "placeholder_mode") return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-400 dark:text-gray-600";
  };

  const getStatusText = (status: string) => {
    if (status === "connected") return "Connected";
    if (status === "placeholder_mode") return "Placeholder";
    return "Not Configured";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <div key={service.name} className="flex items-start gap-3">
                <div className={`p-2 rounded-md ${service.status === "connected" ? "bg-green-100 dark:bg-green-900" : service.status === "placeholder_mode" ? "bg-yellow-100 dark:bg-yellow-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                  <IconComponent className={`w-4 h-4 ${getStatusColor(service.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{service.name}</p>
                    <Circle className={`w-2 h-2 fill-current ${getStatusColor(service.status)}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                  <p className="text-xs font-medium mt-1" style={{ color: getStatusColor(service.status).includes('green') ? '' : getStatusColor(service.status).includes('yellow') ? '' : '' }}>
                    {getStatusText(service.status)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {health.services.database !== "connected" && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Running in placeholder mode. Configure DATABASE_URL to enable persistence.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
