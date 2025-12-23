import React from "react";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wallet } from "@/components/Wallet";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { WebSocketProvider } from "@/lib/useWebSocket";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import AIAgents from "@/pages/AIAgents";
import CallHistory from "@/pages/CallHistory";
import Transcripts from "@/pages/Transcripts";
import Leads from "@/pages/Leads";
import Pipelines from "@/pages/Pipelines";
import Contacts from "@/pages/Contacts";
import KnowledgeBase from "@/pages/KnowledgeBase";
import Analytics from "@/pages/Analytics";
import Billing from "@/pages/Billing";
import Settings from "@/pages/Settings";
import CampaignsPage from "@/pages/campaigns/index";
import BatchesPage from "@/pages/Batches";

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/login">
        <Auth mode="login" />
      </Route>
      <Route path="/signup">
        <Auth mode="signup" />
      </Route>
      <Route path="/">
        <Auth mode="login" />
      </Route>
      <Route>{() => <Auth mode="login" />}</Route>
    </Switch>
  );
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calls" component={CallHistory} />
      <Route path="/transcripts" component={Transcripts} />
      <Route path="/agents" component={AIAgents} />
      <Route path="/leads" component={Leads} />
      <Route path="/pipelines" component={Pipelines} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/campaigns" component={CampaignsPage} />
      <Route path="/batches" component={BatchesPage} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/billing" component={Billing} />
      <Route path="/settings" component={Settings} />
      <Route component={Dashboard} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
  });

  return (
    <WebSocketProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      Platform
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto flex items-center gap-4 px-4">
              <ThemeToggle />
              <Wallet />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <AuthenticatedRouter />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  );
}

function UnauthenticatedLayout() {
  return (
    <div className="min-h-screen">
      <UnauthenticatedRouter />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedLayout /> : <UnauthenticatedLayout />;
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
