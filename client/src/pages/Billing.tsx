import { useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Clock, Phone } from "lucide-react";
import type { BillingMetrics } from "@shared/schema";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";

export default function Billing() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: metrics, isLoading } = useQuery<BillingMetrics>({
    queryKey: ["/api/billing/metrics"],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('call:created', useCallback(() => {
    console.log('[Billing] Received call:created event');
    queryClient.invalidateQueries({ queryKey: ['/api/billing/metrics'] });
  }, []));

  useWebSocketEvent('call:updated', useCallback(() => {
    console.log('[Billing] Received call:updated event');
    queryClient.invalidateQueries({ queryKey: ['/api/billing/metrics'] });
  }, []));

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
    }).format(amount);
  };

  const formatMinutes = (minutes: number | undefined | null) => {
    return Number(minutes ?? 0).toFixed(2);
  };

  const calculateChange = () => {
    if (!metrics?.currentMonth || !metrics?.previousMonth) return 0;
    const currentCost = metrics.currentMonth.totalCost ?? 0;
    const previousCost = metrics.previousMonth.totalCost ?? 0;
    if (previousCost === 0) return currentCost > 0 ? 100 : 0;
    return ((currentCost - previousCost) / previousCost) * 100;
  };

  const change = calculateChange();

  const stats = [
    {
      title: "Total Cost",
      value: formatCurrency(metrics?.currentMonth.totalCost ?? 0),
      icon: DollarSign,
      description: "Current month total",
      testId: "stat-total-cost",
    },
    {
      title: "Total Minutes",
      value: formatMinutes(metrics?.currentMonth.totalMinutes ?? 0),
      icon: Clock,
      description: "Call duration this month",
      testId: "stat-total-minutes",
    },
    {
      title: "Total Calls",
      value: metrics?.currentMonth.totalCalls ?? 0,
      icon: Phone,
      description: "Calls this month",
      testId: "stat-total-calls",
    },
    {
      title: "vs Last Month",
      value: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
      icon: change >= 0 ? TrendingUp : TrendingDown,
      description: "Cost comparison",
      testId: "stat-change",
      highlight: true,
    },
  ];

  return (
    <div className="space-y-4 p-2 md:p-3">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-billing">
          Billing & Usage
        </h1>
        <p className="text-muted-foreground">
          Track your usage costs and billing breakdown
        </p>
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
                  <stat.icon className={`h-4 w-4 ${stat.highlight && change > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
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

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>
                  Current month usage costs by provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Number Provider</p>
                    <p className="text-xs text-muted-foreground">
                      Voice call infrastructure
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" data-testid="cost-exotel">
                      {formatCurrency(metrics?.currentMonth.exotelCost ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Agent Provider</p>
                    <p className="text-xs text-muted-foreground">
                      AI agent processing
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" data-testid="cost-bolna">
                      {formatCurrency(metrics?.currentMonth.bolnaCost ?? 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Platform Markup</p>
                    <p className="text-xs text-muted-foreground">
                      $0.023 per minute
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" data-testid="cost-markup">
                      {formatCurrency(metrics?.currentMonth.markupCost ?? 0)}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      Platform Fee
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <p className="text-base font-bold">Total</p>
                  <p className="text-base font-bold" data-testid="cost-total">
                    {formatCurrency(metrics?.currentMonth.totalCost ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Comparison</CardTitle>
                <CardDescription>
                  Current vs previous month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Current Month</p>
                    <p className="text-sm font-bold" data-testid="current-month-cost">
                      {formatCurrency(metrics?.currentMonth.totalCost ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {formatMinutes(metrics?.currentMonth.totalMinutes ?? 0)} minutes
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metrics?.currentMonth.totalCalls ?? 0} calls
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Previous Month</p>
                    <p className="text-sm font-bold" data-testid="previous-month-cost">
                      {formatCurrency(metrics?.previousMonth.totalCost ?? 0)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {formatMinutes(metrics?.previousMonth.totalMinutes ?? 0)} minutes
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Difference</p>
                    <div className="flex items-center gap-2">
                      {change >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-chart-2" />
                      )}
                      <p className={`text-sm font-bold ${change >= 0 ? 'text-destructive' : 'text-chart-2'}`} data-testid="cost-diff">
                        {change > 0 ? '+' : ''}{change.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(Math.abs((metrics?.currentMonth.totalCost ?? 0) - (metrics?.previousMonth.totalCost ?? 0)))} 
                    {' '}{change >= 0 ? 'increase' : 'decrease'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Breakdown</CardTitle>
              <CardDescription>
                Cost distribution by provider (current month)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(metrics?.costBreakdown ?? []).map(day => ({
                  date: day.date,
                  exotelCost: Number(day.exotelCost ?? 0),
                  bolnaCost: Number(day.bolnaCost ?? 0),
                  markupCost: Number(day.markupCost ?? 0),
                  totalCost: Number(day.totalCost ?? 0),
                  minutes: Number(day.minutes ?? 0),
                }))}>
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
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="exotelCost" fill="hsl(var(--primary))" name="Number Provider" stackId="a" />
                  <Bar dataKey="bolnaCost" fill="hsl(var(--chart-2))" name="Agent Provider" stackId="a" />
                  <Bar dataKey="markupCost" fill="hsl(var(--chart-3))" name="Platform Fee" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
