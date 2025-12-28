import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
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
import ApprovalHub from "@/pages/MasterArchitect";
import ChatWidget from "@/pages/ChatWidget";
import ChatGPTActions from "@/pages/ChatGPTActions";
import SystemWatcher from "@/pages/SystemWatcher";
import CRMAgentConfig from "@/pages/CRMAgentConfig";
import CRMAgentChat from "@/pages/CRMAgentChat";
import AIReceptionistConfig from "@/pages/AIReceptionistConfig";
import Settings from "@/pages/Settings";
import PublicContact from "@/pages/PublicContact";
import WidgetDemo from "@/pages/widget-demo";
import Emails from "@/pages/Emails";
import IntakeBuilder from "@/pages/IntakeBuilder";
import Pricebook from "@/pages/Pricebook";
import GoogleWorkspace from "@/pages/GoogleWorkspace";
import WhatsApp from "@/pages/WhatsApp";
import Marketplace from "@/pages/Marketplace";
import Funnels from "@/pages/Funnels";
import SocialMediaPlanner from "@/pages/SocialMediaPlanner";
import InformationAIChat from "@/pages/InformationAIChat";
import ActionConsole from "@/pages/ActionConsole";
import ReadyExecution from "@/pages/ReadyExecution";
import AutomationLedger from "@/pages/AutomationLedger";
import ReviewQueue from "@/pages/ReviewQueue";
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
      <Route path="/approval-hub" component={() => <LegacyRedirect to="/review-queue" message="Approval Hub has been replaced by the Review Queue." />} />
      <Route path="/chat-widget" component={ChatWidget} />
      <Route path="/chatgpt-actions" component={ChatGPTActions} />
      <Route path="/crm-agent-config" component={CRMAgentConfig} />
      <Route path="/crm-agent-chat" component={() => <LegacyRedirect to="/information-ai-chat" message="Chat with AI has been renamed to Information AI Chat." />} />
      <Route path="/read-chat" component={() => <LegacyRedirect to="/information-ai-chat" message="Read Chat has been renamed to Information AI Chat." />} />
      <Route path="/information-ai-chat" component={InformationAIChat} />
      <Route path="/action-console" component={ActionConsole} />
      <Route path="/ready-execution" component={ReadyExecution} />
      <Route path="/automation-ledger" component={AutomationLedger} />
      <Route path="/review-queue" component={ReviewQueue} />
      <Route path="/gpt-actions" component={() => <LegacyRedirect to="/chatgpt-actions" message="GPT Actions has been merged into ChatGPT Actions." />} />
      <Route path="/actiongpt-config" component={() => <LegacyRedirect to="/chatgpt-actions" message="ActionGPT Config has been renamed to ChatGPT Actions." />} />
      <Route path="/master-architect" component={() => <LegacyRedirect to="/review-queue" message="Master Architect has been replaced by the Review Queue." />} />
      <Route path="/ai-receptionist" component={AIReceptionistConfig} />
      <Route path="/system-watcher" component={SystemWatcher} />
      <Route path="/intelligence-bot" component={() => <LegacyRedirect to="/ai-assistant" message="Intelligence Bot has been renamed to AI Assistant." />} />
      <Route path="/user-management" component={() => <LegacyRedirect to="/settings" message="User Management is now in Settings > Users tab." />} />
      <Route path="/audit-log" component={() => <LegacyRedirect to="/settings" message="Audit Log is now in Settings > System tab." />} />
      <Route path="/ai-memory" component={() => <LegacyRedirect to="/settings" message="AI Memory is now in Settings > AI Control tab." />} />
      <Route path="/notes" component={() => <LegacyRedirect to="/contacts" message="Notes have been integrated into Contact and Job detail pages." />} />
      <Route path="/metrics" component={() => <LegacyRedirect to="/" message="Metrics are now displayed on the Dashboard." />} />
      <Route path="/settings" component={Settings} />
      <Route path="/pricebook" component={Pricebook} />
      <Route path="/emails" component={Emails} />
      <Route path="/intake-builder" component={IntakeBuilder} />
      <Route path="/google-workspace" component={GoogleWorkspace} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/funnels" component={Funnels} />
      <Route path="/social-media" component={SocialMediaPlanner} />
      <Route path="/public-contact" component={PublicContact} />
      <Route path="/widget-demo" component={WidgetDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "New Contact Added",
      message: "John Smith was added to your contacts",
      timestamp: "2 minutes ago",
      read: false,
      type: "success",
    },
    {
      id: "2",
      title: "Job Status Updated",
      message: "Website Redesign moved to In Progress",
      timestamp: "1 hour ago",
      read: false,
      type: "info",
    },
    {
      id: "3",
      title: "Payment Received",
      message: "Invoice #1234 has been paid - $2,500",
      timestamp: "3 hours ago",
      read: true,
      type: "success",
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
    </QueryClientProvider>
  );
}
