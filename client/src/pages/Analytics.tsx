import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Phone, Users, Target } from "lucide-react";
import type { AnalyticsMetrics, CallMetrics, AgentPerformance } from "@shared/schema";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";

export default function Analytics() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: metrics, isLoading: metricsLoading } = useQuery<AnalyticsMetrics>({
    queryKey: [`/api/analytics/metrics?timeRange=${timeRange}`],
  });

  const { data: callMetrics, isLoading: callMetricsLoading } = useQuery<CallMetrics[]>({
    queryKey: [`/api/analytics/calls?timeRange=${timeRange}`],
  });

  const { data: agentPerformance, isLoading: agentPerformanceLoading } = useQuery<AgentPerformance[]>({
    queryKey: [`/api/analytics/agents?timeRange=${timeRange}`],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('call:created', useCallback(() => {
    console.log('[Analytics] Received call:created event');
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/metrics?timeRange=${timeRange}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/calls?timeRange=${timeRange}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/agents?timeRange=${timeRange}`] });
  }, [timeRange]));

  useWebSocketEvent('call:updated', useCallback(() => {
    console.log('[Analytics] Received call:updated event');
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/metrics?timeRange=${timeRange}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/calls?timeRange=${timeRange}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/agents?timeRange=${timeRange}`] });
  }, [timeRange]));

  useWebSocketEvent('lead:created', useCallback(() => {
    console.log('[Analytics] Received lead:created event');
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/metrics?timeRange=${timeRange}`] });
  }, [timeRange]));

  useWebSocketEvent('lead:updated', useCallback(() => {
    console.log('[Analytics] Received lead:updated event');
    queryClient.invalidateQueries({ queryKey: [`/api/analytics/metrics?timeRange=${timeRange}`] });
  }, [timeRange]));

  const isLoading = metricsLoading || callMetricsLoading || agentPerformanceLoading;

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const stats = [
    {
      title: "Total Calls",
      value: metrics?.totalCalls ?? 0,
      icon: Phone,
      description: "All voice & chat interactions",
      testId: "stat-calls",
    },
    {
      title: "Total Leads",
      value: metrics?.totalLeads ?? 0,
      icon: Users,
      description: "Leads contacted",
      testId: "stat-leads",
    },
    {
      title: "Response Rate",
      value: `${(metrics?.responseRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      description: "Lead response percentage",
      testId: "stat-response",
    },
    {
      title: "Conversion Rate",
      value: `${(metrics?.conversionRate ?? 0).toFixed(1)}%`,
      icon: Target,
      description: "Lead to customer conversion",
      testId: "stat-conversion",
    },
  ];

  return (
    <div className="space-y-4 p-2 md:p-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-analytics">
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Performance metrics and insights
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid={stat.testId}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Call Activity</CardTitle>
              <CardDescription>
                Daily call volume and duration trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={callMetrics ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tickLine={false}
                  />
                  <YAxis className="text-xs" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Calls"
                  />
                  <Line
                    type="monotone"
                    dataKey="successful"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Successful"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>
                Performance metrics by agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentPerformance ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="agentName"
                    className="text-xs"
                    tickLine={false}
                  />
                  <YAxis className="text-xs" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="totalCalls" fill="hsl(var(--primary))" name="Total Calls" />
                  <Bar dataKey="successfulCalls" fill="hsl(var(--chart-2))" name="Successful" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
