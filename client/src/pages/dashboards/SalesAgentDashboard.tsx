import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";
import type { Lead, Call } from "@shared/schema";
import { format } from "date-fns";

export default function SalesAgentDashboard() {
  const { user } = useAuth();

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads/my"],
  });

  const { data: calls, isLoading: callsLoading } = useQuery<Call[]>({
    queryKey: ["/api/calls/my"],
  });

  const isLoading = leadsLoading || callsLoading;

  const assignedLeads = leads?.filter(l => l.status !== 'completed') ?? [];
  const completedLeads = leads?.filter(l => l.status === 'completed') ?? [];
  const todayCalls = calls?.filter(c => 
    c.scheduledAt && format(new Date(c.scheduledAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ) ?? [];

  const stats = [
    {
      title: "Assigned Leads",
      value: assignedLeads.length,
      icon: Phone,
      description: "Active leads to contact",
      testId: "stat-assigned",
    },
    {
      title: "Calls Today",
      value: todayCalls.length,
      icon: Calendar,
      description: "Scheduled for today",
      testId: "stat-today-calls",
    },
    {
      title: "Completed",
      value: completedLeads.length,
      icon: CheckCircle2,
      description: "Successfully closed",
      testId: "stat-completed",
    },
    {
      title: "Success Rate",
      value: `${leads && leads.length > 0 ? ((completedLeads.length / leads.length) * 100).toFixed(0) : 0}%`,
      icon: TrendingUp,
      description: "Your conversion rate",
      testId: "stat-success-rate",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-64 bg-muted animate-pulse rounded" />
        </div>
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
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-dashboard">
          My Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName || 'Agent'}
        </p>
      </div>

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
          <CardTitle>Lead Queue</CardTitle>
          <CardDescription>
            Your assigned leads requiring action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignedLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer gap-3"
                onClick={() => window.location.href = `/leads/${lead.id}`}
                data-testid={`lead-${lead.id}`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {lead.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lead.company && `${lead.company} • `}
                    {lead.phone || lead.email}
                  </p>
                  {lead.aiSummary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {lead.aiSummary}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (lead.phone) window.location.href = `tel:${lead.phone}`;
                    }}
                    data-testid={`button-call-${lead.id}`}
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/leads/${lead.id}/schedule`;
                    }}
                    data-testid={`button-schedule-${lead.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                </div>
              </div>
            ))}
            {assignedLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No leads assigned. Contact your manager for lead assignments.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
