import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Bot, Activity, TrendingUp, MessageSquare, DollarSign, Clock, PhoneCall, Plus, BookOpen, BarChart3, CreditCard, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import type { DashboardMetrics } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
  });

  // Real-time updates via WebSocket
  // Real-time updates handled globally by WebSocketProvider


  useWebSocketEvent('lead:created', useCallback(() => {
    console.log('[Dashboard] Received lead:created event');
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
  }, []));

  useWebSocketEvent('lead:updated', useCallback(() => {
    console.log('[Dashboard] Received lead:updated event');
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
  }, []));

  useWebSocketEvent('agent:created', useCallback(() => {
    console.log('[Dashboard] Received agent:created event');
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
  }, []));

  useWebSocketEvent('agent:updated', useCallback(() => {
    console.log('[Dashboard] Received agent:updated event');
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
  }, []));

  const quickActions = [
    {
      title: "Create AI Agent",
      description: "Set up a new AI voice agent",
      icon: Bot,
      action: () => setLocation("/agents?action=create"),
      variant: "default" as const,
      testId: "action-create-agent",
    },
    {
      title: "Initiate Call",
      description: "Start a new AI-powered call",
      icon: PhoneCall,
      action: () => setLocation("/calls?action=new"),
      variant: "default" as const,
      testId: "action-initiate-call",
    },
    {
      title: "Add Knowledge",
      description: "Train your AI with new data",
      icon: BookOpen,
      action: () => setLocation("/knowledge-base?action=create"),
      variant: "outline" as const,
      testId: "action-add-knowledge",
    },
    {
      title: "Manage Leads",
      description: "View and organize leads",
      icon: Users,
      action: () => setLocation("/leads"),
      variant: "outline" as const,
      testId: "action-manage-leads",
    },
    {
      title: "View Analytics",
      description: "Track performance metrics",
      icon: BarChart3,
      action: () => setLocation("/analytics"),
      variant: "outline" as const,
      testId: "action-view-analytics",
    },
    {
      title: "Billing & Usage",
      description: "Monitor costs and usage",
      icon: CreditCard,
      action: () => setLocation("/billing"),
      variant: "outline" as const,
      testId: "action-billing",
    },
  ];

  const metricCards = [
    {
      title: "Total Calls",
      value: metrics?.totalCalls ?? 0,
      icon: Phone,
      testId: "metric-total-calls",
    },
    {
      title: "Total AI Agents",
      value: metrics?.totalAgents ?? 0,
      icon: Bot,
      testId: "metric-total-agents",
    },
    {
      title: "Active Agents",
      value: metrics?.activeAgents ?? 0,
      icon: Activity,
      testId: "metric-active-agents",
    },
    {
      title: "Success Rate",
      value: `${(metrics?.successRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      testId: "metric-success-rate",
    },
    {
      title: "Conversations Today",
      value: metrics?.conversationsToday ?? 0,
      icon: MessageSquare,
      testId: "metric-conversations-today",
    },
    {
      title: "Usage Cost Today",
      value: `$${(metrics?.usageCostToday ?? 0).toFixed(2)}`,
      icon: DollarSign,
      testId: "metric-usage-cost",
    },
    {
      title: "Avg Call Duration",
      value: `${Math.round(metrics?.avgCallDuration ?? 0)}s`,
      icon: Clock,
      testId: "metric-avg-duration",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-2">
        <h1 className="text-3xl font-bold tracking-tight mb-6" data-testid="heading-dashboard">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(7)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-4 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-500 via-purple-400 to-orange-300 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="heading-dashboard">Welcome back!</h1>
          <p className="text-purple-50 text-lg max-w-2xl" data-testid="text-dashboard-subtitle">
            Here's what's happening with your AI Voice Agents today.
          </p>

          <div className="mt-8 flex gap-4">
            <Button
              onClick={() => setLocation("/agents?action=create")}
              className="bg-white text-purple-600 hover:bg-purple-50 border-none shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Agent
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/analytics")}
              className="bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-sm"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-20 -mb-20 h-64 w-64 rounded-full bg-orange-400/20 blur-3xl" />
      </div>

      {/* Metrics Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4 px-1">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} className="border-none shadow-sm hover:shadow-md transition-all duration-200 bg-white/60 backdrop-blur-sm" data-testid={`card-${metric.testId}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                    <Icon className="h-4 w-4" data-testid={`icon-${metric.testId}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-foreground" data-testid={`value-${metric.testId}`}>
                    {metric.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4 px-1">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.testId}
                onClick={action.action}
                className="group cursor-pointer relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:shadow-md border border-transparent hover:border-purple-100"
                data-testid={action.testId}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${action.variant === 'default' ? 'bg-purple-100 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-purple-600 transition-colors">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
