import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import AppSidebar from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import ThemeBackground from "@/components/ThemeBackground";
import NotificationPanel, { Notification } from "@/components/NotificationPanel";
import Dashboard from "@/pages/Dashboard";
import Contacts from "@/pages/Contacts";
import ContactDetail from "@/pages/ContactDetail";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Estimates from "@/pages/Estimates";
import EstimateDetail from "@/pages/EstimateDetail";
import Invoices from "@/pages/Invoices";
import InvoiceDetail from "@/pages/InvoiceDetail";
import PaymentTerminal from "@/pages/PaymentTerminal";
import Payments from "@/pages/Payments";
import Calendar from "@/pages/Calendar";
import Pipeline from "@/pages/Pipeline";
import AdminChat from "@/pages/AdminChat";
import ChatWidget from "@/pages/ChatWidget";
import Settings from "@/pages/Settings";
import PublicContact from "@/pages/PublicContact";
import WidgetDemo from "@/pages/widget-demo";
import IntakeBuilder from "@/pages/IntakeBuilder";
import Pricebook from "@/pages/Pricebook";
import InformationAIChat from "@/pages/InformationAIChat";
import AutomationLedger from "@/pages/AutomationLedger";
import AIReceptionist from "@/pages/AIReceptionist";
import ProposalQueue from "@/pages/ProposalQueue";
import Emails from "@/pages/Emails";
import WhatsApp from "@/pages/WhatsApp";
import GoogleWorkspace from "@/pages/GoogleWorkspace";
import ChatGPTActions from "@/pages/ChatGPTActions";
import CRMAgentConfig from "@/pages/CRMAgentConfig";
import Funnels from "@/pages/Funnels";
import SocialMedia from "@/pages/SocialMedia";
import Marketplace from "@/pages/Marketplace";
import ExportCenter from "@/pages/ExportCenter";
import Campaigns from "@/pages/Campaigns";
import ProspectPool from "@/pages/ProspectPool";
import NotFound from "@/pages/not-found";

function LegacyRedirect({ to, message }: { to: string; message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Page Relocated</h1>
        <p className="text-muted-foreground">{message}</p>
        <Link href={to}>
          <Button data-testid="button-legacy-redirect">
            Go to {to === "/settings" ? "Settings" : to.replace("/", "").replace("-", " ")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * INTERNAL ROUTING SURFACE
 * All routes registered here, including features not in production sidebar.
 * Sidebar visibility controlled in AppSidebar.tsx.
 * Routes here but NOT in sidebar are accessible via direct URL for dev/testing only.
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/contacts/:id" component={ContactDetail} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/jobs/:id" component={JobDetail} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/estimates/:id" component={EstimateDetail} />
      <Route path="/estimates" component={Estimates} />
      <Route path="/invoices/:id" component={InvoiceDetail} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/payment/terminal/:id" component={PaymentTerminal} />
      <Route path="/payments" component={Payments} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/ai-assistant" component={AdminChat} />
      <Route path="/chat-widget" component={ChatWidget} />
      <Route path="/information-ai-chat" component={InformationAIChat} />
      <Route path="/automation-ledger" component={AutomationLedger} />
      <Route path="/settings" component={Settings} />
      <Route path="/pricebook" component={Pricebook} />
      <Route path="/intake-builder" component={IntakeBuilder} />
      <Route path="/public-contact" component={PublicContact} />
      <Route path="/widget-demo" component={WidgetDemo} />
      <Route path="/proposal-queue" component={ProposalQueue} />
      <Route path="/review-queue" component={ProposalQueue} />
      <Route path="/ready-execution" component={ProposalQueue} />
      <Route path="/ai-receptionist" component={AIReceptionist} />
      <Route path="/emails" component={Emails} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/google-workspace" component={GoogleWorkspace} />
      <Route path="/chatgpt-actions" component={ChatGPTActions} />
      <Route path="/crm-agent-config" component={CRMAgentConfig} />
      <Route path="/funnels" component={Funnels} />
      <Route path="/social-media" component={SocialMedia} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/exports" component={ExportCenter} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/prospect-pool" component={ProspectPool} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  // Fetch real notifications from API
  const { data: apiNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // 30 seconds
  });

  // Track read state locally (since API doesn't persist read status yet)
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Format notifications with relative timestamps
  const notifications: Notification[] = apiNotifications
    .filter(n => !dismissedIds.includes(n.id))
    .map(n => ({
      ...n,
      read: n.read || readIds.includes(n.id),
      timestamp: formatDistanceToNow(new Date(n.timestamp), { addSuffix: true }),
    }));

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setReadIds(prev => [...prev, id]);
  };

  const handleMarkAllAsRead = () => {
    setReadIds(notifications.map(n => n.id));
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <TooltipProvider>
      <ThemeBackground />
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                          data-testid="notification-badge"
                        >
                          {unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-auto" align="end">
                    <NotificationPanel
                      notifications={notifications}
                      onMarkAsRead={handleMarkAsRead}
                      onMarkAllAsRead={handleMarkAllAsRead}
                      onDismiss={handleDismiss}
                    />
                  </PopoverContent>
                </Popover>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <div className="max-w-7xl mx-auto p-6">
                <Router />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
