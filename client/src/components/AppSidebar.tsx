/**
 * PRODUCTION SURFACE — Sidebar Navigation
 * 
 * This sidebar defines the production-visible UI surface.
 * RULE: If a feature has full backend integration and governance compliance — it MUST appear here.
 * 
 * Features NOT in sidebar (dev/stub surface — accessible via direct URL only):
 * - Action Console (/action-console)   — STUB, no backend flow
 * - Email (/emails)                    — STUB, unified inbox (not yet built)
 * - Campaigns (/campaigns)             — PROMOTED to sidebar (Mass Email, full backend)
 * - ActionGPT (/chatgpt-actions)       — STUB, no backend flow
 * - AI Settings (/crm-agent-config)    — STUB, no backend flow
 * - Funnels (/funnels)                 — STUB
 * - Social Media (/social-media)       — STUB
 * - Marketplace (/marketplace)         — STUB
 * - Google Workspace (/google-workspace) — STUB
 * - WhatsApp (/whatsapp)               — STUB
 * 
 * To promote a feature to production: add it here ONLY after confirming
 * full backend integration and governance compliance.
 * 
 * Last Updated: April 20, 2026
 * Restored missing AI modules that were incorrectly hidden during cleanup
 */

import { Home, Users, Briefcase, FileText, CreditCard, Calendar, TrendingUp, Settings, Network, MessageSquare, Phone, FormInput, BookOpen, ShieldCheck, ScrollText, Download, Brain, CheckCircle, BarChart3, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import defaultLogoImage from "@assets/smart-klix-logo.png";
import { useQuery } from "@tanstack/react-query";

import smart_klix_header_and_Footer from "@assets/smart klix header and Footer.png";

import smart_klix_header_and_Footer___copia from "@assets/smart klix header and Footer - copia.png";

interface AppSettings {
  logoUrl?: string | null;
}

const dailyOperationsItems = [
  { title: "Dashboard", url: "/", icon: Home },
];

const aiBrainsItems = [
  { title: "Proposal Agent", url: "/ai-assistant", icon: Brain },
  { title: "Query Agent", url: "/information-ai-chat", icon: MessageSquare },
  { title: "Review Queue", url: "/review-queue", icon: CheckCircle },
  { title: "Ready Execution", url: "/ready-execution", icon: ShieldCheck },
  { title: "Automation Ledger", url: "/automation-ledger", icon: ScrollText },
];

const workManagementItems = [
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Projects", url: "/jobs", icon: Briefcase },
  { title: "Pipeline", url: "/pipeline", icon: TrendingUp },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Estimates", url: "/estimates", icon: FileText },
  { title: "Invoices", url: "/invoices", icon: CreditCard },
  { title: "Mass Email", url: "/campaigns", icon: Mail },
  { title: "Export Center", url: "/exports", icon: Download },
];

const toolsAndIntegrationsItems = [
  { title: "AI Voice", url: "/ai-receptionist", icon: Phone },
  { title: "Intake Builder", url: "/intake-builder", icon: FormInput },
  { title: "Price Book", url: "/pricebook", icon: BookOpen },
];

const configurationItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
  avatar: string | null;
}

export default function AppSidebar() {
  const [location] = useLocation();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users/me"],
    retry: false,
  });

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const displayName = currentUser?.fullName || currentUser?.username || "User";
  const displayEmail = currentUser?.email || "";
  const initials = displayName.substring(0, 2).toUpperCase();
  const logoSrc = appSettings?.logoUrl || defaultLogoImage;

  const renderMenuItems = (items: typeof dailyOperationsItems) => (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = location === item.url;
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <Link href={item.url}>
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar className="bg-sidebar border-r border-sidebar-border/60">
      <SidebarHeader className="px-4 py-8 border-b border-sidebar-border/40">
        <img src={smart_klix_header_and_Footer___copia} alt="Company Logo" className="h-40 w-auto max-w-full object-contain mx-auto" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(dailyOperationsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">AI Brains</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(aiBrainsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Work Management</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(workManagementItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Tools & Integrations</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(toolsAndIntegrationsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(configurationItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={currentUser?.avatar || ""} />
            <AvatarFallback className="text-xs bg-[#FFC107] text-[#1565C0]">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
