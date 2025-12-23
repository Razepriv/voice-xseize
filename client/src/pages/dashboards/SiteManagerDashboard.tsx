import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, CheckCircle2, Clock } from "lucide-react";
import type { Visit } from "@shared/schema";
import { format } from "date-fns";

export default function SiteManagerDashboard() {
  const { data: visits, isLoading } = useQuery<Visit[]>({
    queryKey: ["/api/visits/my"],
  });

  const scheduledVisits = visits?.filter(v => v.status === 'scheduled') ?? [];
  const completedVisits = visits?.filter(v => v.status === 'completed') ?? [];
  const inProgressVisits = visits?.filter(v => v.status === 'in_progress') ?? [];
  const todayVisits = visits?.filter(v =>
    v.scheduledAt && format(new Date(v.scheduledAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ) ?? [];

  const stats = [
    {
      title: "Scheduled Visits",
      value: scheduledVisits.length,
      icon: Calendar,
      description: "Upcoming site visits",
      testId: "stat-scheduled",
    },
    {
      title: "Today's Visits",
      value: todayVisits.length,
      icon: Clock,
      description: "Visits scheduled today",
      testId: "stat-today",
    },
    {
      title: "In Progress",
      value: inProgressVisits.length,
      icon: MapPin,
      description: "Currently ongoing",
      testId: "stat-in-progress",
    },
    {
      title: "Completed",
      value: completedVisits.length,
      icon: CheckCircle2,
      description: "Successfully completed",
      testId: "stat-completed",
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
            Site Manager Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage site visits and inspections
          </p>
        </div>
        <Button asChild data-testid="button-schedule-visit">
          <a href="/visits/new">Schedule Visit</a>
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

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Visits</CardTitle>
          <CardDescription>
            Scheduled site visits and inspections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduledVisits.map((visit) => (
              <div
                key={visit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-md border hover-elevate cursor-pointer gap-3"
                onClick={() => window.location.href = `/visits/${visit.id}`}
                data-testid={`visit-${visit.id}`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{visit.location || 'Location TBD'}</p>
                    <Badge variant="secondary" className="text-xs">
                      {visit.status}
                    </Badge>
                  </div>
                  {visit.scheduledAt && (
                    <p className="text-xs text-muted-foreground">
                      Scheduled: {format(new Date(visit.scheduledAt), 'PPp')}
                    </p>
                  )}
                  {visit.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {visit.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/visits/${visit.id}/start`;
                    }}
                    data-testid={`button-start-${visit.id}`}
                  >
                    Start Visit
                  </Button>
                </div>
              </div>
            ))}
            {scheduledVisits.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No scheduled visits. Schedule a new site visit to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
