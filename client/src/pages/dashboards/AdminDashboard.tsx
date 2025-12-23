import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Megaphone, TrendingUp, Phone } from "lucide-react";
import type { Campaign, Lead, AnalyticsMetrics } from "@shared/schema";

export default function AdminDashboard() {
  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<AnalyticsMetrics>({
    queryKey: ["/api/analytics/metrics"],
  });

  const isLoading = campaignsLoading || leadsLoading || metricsLoading;

  const stats = [
    {
      title: "Total Campaigns",
      value: campaigns?.length ?? 0,
      icon: Megaphone,
      description: "Active automation campaigns",
      testId: "stat-campaigns",
    },
    {
      title: "Total Leads",
      value: metrics?.totalLeads ?? 0,
      icon: Users,
      description: "Across all campaigns",
      testId: "stat-leads",
    },
    {
      title: "Total Calls",
      value: metrics?.totalCalls ?? 0,
      icon: Phone,
      description: "Voice & chat interactions",
      testId: "stat-calls",
    },
    {
      title: "Conversion Rate",
      value: `${(metrics?.conversionRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      description: "Lead to customer conversion",
      testId: "stat-conversion",
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-dashboard">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage campaigns, users, and analytics
          </p>
        </div>
        <Button asChild data-testid="button-create-campaign">
          <a href="/campaigns/new">Create Campaign</a>
        </Button>
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

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>
              Latest automation campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns?.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                  onClick={() => window.location.href = `/campaigns/${campaign.id}`}
                  data-testid={`campaign-${campaign.id}`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.totalLeads} leads • {campaign.completedLeads} completed
                    </p>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-md ${
                    campaign.status === 'active' ? 'bg-primary/10 text-primary' :
                    campaign.status === 'completed' ? 'bg-muted' :
                    'bg-secondary'
                  }`}>
                    {campaign.status}
                  </div>
                </div>
              ))}
              {(!campaigns || campaigns.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No campaigns yet. Create your first campaign to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
            <CardDescription>
              Latest lead activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads?.slice(0, 5).map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate cursor-pointer"
                  onClick={() => window.location.href = `/leads/${lead.id}`}
                  data-testid={`lead-${lead.id}`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.company || lead.email || lead.phone}
                    </p>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-md ${
                    lead.status === 'qualified' ? 'bg-primary/10 text-primary' :
                    lead.status === 'contacted' ? 'bg-secondary' :
                    'bg-muted'
                  }`}>
                    {lead.status}
                  </div>
                </div>
              ))}
              {(!leads || leads.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No leads yet. Upload leads or start a campaign.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
