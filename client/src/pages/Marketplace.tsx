import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Check, 
  ExternalLink,
  Mail,
  Calendar,
  FileText,
  Webhook,
  CreditCard,
  MessageSquare,
  Database,
  Cloud,
  Phone,
  BarChart3,
  Users,
  Link2
} from "lucide-react";
import { SiStripe, SiMailchimp, SiHubspot, SiZoom, SiDropbox, SiQuickbooks, SiTwilio, SiCalendly } from "react-icons/si";

const SlackLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
  </svg>
);

const GoogleLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GmailLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
  </svg>
);

const GoogleCalendarLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M18.316 5.684H24v12.632h-5.684z" fill="#1A73E8"/>
    <path d="M5.684 18.316H0V5.684h5.684z" fill="#EA4335"/>
    <path d="M18.316 24H5.684v-5.684h12.632z" fill="#34A853"/>
    <path d="M5.684 0h12.632v5.684H5.684z" fill="#188038"/>
    <path d="M18.316 5.684v12.632H5.684V5.684h12.632z" fill="#fff"/>
    <path d="M15.789 9.474H12.63v1.579h3.158v1.578H12.63v1.58h3.158v1.578H11.053V7.895h4.736v1.579z" fill="#1A73E8"/>
    <path d="M10.526 16.105H8.947v-4.21H7.368V9.79h3.158v6.316z" fill="#1A73E8"/>
  </svg>
);

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  connected: boolean;
  popular?: boolean;
}

const integrations: Integration[] = [
  { id: "gmail", name: "Gmail", description: "Send and receive emails directly from your CRM", category: "email", icon: <GmailLogo className="w-6 h-6" />, connected: false, popular: true },
  { id: "google-calendar", name: "Google Calendar", description: "Sync appointments and schedule meetings", category: "calendar", icon: <GoogleCalendarLogo className="w-6 h-6" />, connected: true, popular: true },
  { id: "stripe", name: "Stripe", description: "Process payments and manage subscriptions", category: "payments", icon: <SiStripe className="w-6 h-6" style={{ color: '#635BFF' }} />, connected: true, popular: true },
  { id: "slack", name: "Slack", description: "Get notifications and updates in your workspace", category: "communication", icon: <SlackLogo className="w-6 h-6" />, connected: false, popular: true },
  { id: "mailchimp", name: "Mailchimp", description: "Sync contacts for email marketing campaigns", category: "email", icon: <SiMailchimp className="w-6 h-6" style={{ color: '#FFE01B' }} />, connected: false },
  { id: "hubspot", name: "HubSpot", description: "Two-way sync with HubSpot CRM", category: "crm", icon: <SiHubspot className="w-6 h-6" style={{ color: '#FF7A59' }} />, connected: false },
  { id: "zoom", name: "Zoom", description: "Schedule and launch video meetings", category: "calendar", icon: <SiZoom className="w-6 h-6" style={{ color: '#2D8CFF' }} />, connected: false, popular: true },
  { id: "dropbox", name: "Dropbox", description: "Store and share files with your team", category: "storage", icon: <SiDropbox className="w-6 h-6" style={{ color: '#0061FF' }} />, connected: false },
  { id: "quickbooks", name: "QuickBooks", description: "Sync invoices and financial data", category: "payments", icon: <SiQuickbooks className="w-6 h-6" style={{ color: '#2CA01C' }} />, connected: false },
  { id: "twilio", name: "Twilio", description: "Send SMS and voice notifications", category: "communication", icon: <SiTwilio className="w-6 h-6" style={{ color: '#F22F46' }} />, connected: true },
  { id: "calendly", name: "Calendly", description: "Let customers book appointments online", category: "calendar", icon: <SiCalendly className="w-6 h-6" style={{ color: '#006BFF' }} />, connected: false },
  { id: "webhooks", name: "Custom Webhooks", description: "Connect any app with custom webhooks", category: "developer", icon: <Webhook className="w-6 h-6 text-primary" />, connected: false },
];

const categories = [
  { id: "all", label: "All Apps", icon: <Link2 className="w-4 h-4" /> },
  { id: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" /> },
  { id: "payments", label: "Payments", icon: <CreditCard className="w-4 h-4" /> },
  { id: "communication", label: "Communication", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "storage", label: "File Storage", icon: <FileText className="w-4 h-4" /> },
  { id: "crm", label: "CRM", icon: <Users className="w-4 h-4" /> },
  { id: "developer", label: "Developer", icon: <Database className="w-4 h-4" /> },
];

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory;
    const matchesTab = activeTab === "all" || (activeTab === "connected" && integration.connected);
    return matchesSearch && matchesCategory && matchesTab;
  });

  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Marketplace</h1>
          <p className="text-muted-foreground">Connect your favorite apps and tools to streamline your workflow</p>
        </div>
        <Badge variant="secondary" data-testid="badge-connected-count">
          {connectedCount} Connected
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all-apps">All Apps</TabsTrigger>
            <TabsTrigger value="connected" data-testid="tab-connected">Connected</TabsTrigger>
          </TabsList>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-apps"
            />
          </div>
        </div>

        <div className="flex gap-6 mt-6">
          <div className="hidden md:block w-48 shrink-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground mb-3">Categories</p>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setSelectedCategory(category.id)}
                data-testid={`category-${category.id}`}
              >
                {category.icon}
                {category.label}
              </Button>
            ))}
          </div>

          <div className="flex-1">
            <TabsContent value="all" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{filteredIntegrations.length} apps available</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredIntegrations.map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
              {filteredIntegrations.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No apps found matching your search.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="connected" className="mt-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{filteredIntegrations.length} connected apps</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredIntegrations.map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
              {filteredIntegrations.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No connected apps yet. Browse all apps to get started.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <Card data-testid={`integration-card-${integration.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted">
              {integration.icon}
            </div>
            <div>
              <CardTitle className="text-base">{integration.name}</CardTitle>
              {integration.popular && (
                <Badge variant="outline" className="text-xs mt-1">Popular</Badge>
              )}
            </div>
          </div>
          {integration.connected && (
            <Badge variant="default" className="shrink-0">
              <Check className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <CardDescription className="line-clamp-2">{integration.description}</CardDescription>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant={integration.connected ? "outline" : "default"}
          className="w-full"
          data-testid={`button-connect-${integration.id}`}
        >
          {integration.connected ? (
            <>Manage</>
          ) : (
            <>Connect</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
