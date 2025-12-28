import { Home, Users, Briefcase, FileText, CreditCard, Calendar, TrendingUp, Bot, Settings, Network, MessageSquare, Zap, Phone, Mail, FormInput, BookOpen, Cloud, MessageCircle, Store, Layers, Share2, ShieldCheck, ScrollText, Terminal } from "lucide-react";
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
  { title: "Ready Execution", url: "/ready-execution", icon: ShieldCheck },
  { title: "AI Voice", url: "/ai-receptionist", icon: Phone },
  { title: "Information AI Chat", url: "/information-ai-chat", icon: MessageSquare },
  { title: "Action Console", url: "/action-console", icon: Terminal },
  { title: "Email", url: "/emails", icon: Mail },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
];

const workManagementItems = [
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Pipeline", url: "/pipeline", icon: TrendingUp },
  { title: "Estimates", url: "/estimates", icon: FileText },
  { title: "Payments", url: "/payments", icon: CreditCard },
];

const configurationItems = [
  { title: "Price Book", url: "/pricebook", icon: BookOpen },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Intake", url: "/intake-builder", icon: FormInput },
  { title: "Google Workspace", url: "/google-workspace", icon: Cloud },
];

const oversightItems = [
  { title: "Review Queue", url: "/review-queue", icon: Network },
];

const advancedItems = [
  { title: "ActionGPT", url: "/chatgpt-actions", icon: Zap },
  { title: "AI Settings", url: "/crm-agent-config", icon: Bot },
  { title: "Automation Ledger", url: "/automation-ledger", icon: ScrollText },
  { title: "Funnels", url: "/funnels", icon: Layers },
  { title: "Social Planner", url: "/social-media", icon: Share2 },
  { title: "Marketplace", url: "/marketplace", icon: Store },
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
    <Sidebar className="bg-gradient-to-b from-sidebar via-sidebar/98 to-sidebar/95">
      <SidebarHeader className="px-4 py-8 border-b border-sidebar-border/40">
        <img src={smart_klix_header_and_Footer___copia} alt="Company Logo" className="h-40 w-auto max-w-full object-contain mx-auto" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(dailyOperationsItems)}
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
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(configurationItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Oversight</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(oversightItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Advanced</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(advancedItems)}
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
