import { useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone } from "lucide-react";
import type { Campaign } from "@shared/schema";
import { format } from "date-fns";

export default function Campaigns() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Real-time updates via WebSocket
  useWebSocketEvent('campaign:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, []));

  useWebSocketEvent('campaign:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, []));

  useWebSocketEvent('campaign:deleted', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, []));

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

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-4 p-2 md:p-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-campaigns">
            Campaigns
          </h1>
          <p className="text-muted-foreground">
            Manage your automation campaigns
          </p>
        </div>
        <Button asChild data-testid="button-create-campaign">
          <a href="/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </a>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="hover-elevate cursor-pointer"
              onClick={() => window.location.href = `/campaigns/${campaign.id}`}
              data-testid={`campaign-${campaign.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  </div>
                  <Badge variant={
                    campaign.status === 'active' ? 'default' :
                    campaign.status === 'completed' ? 'secondary' :
                    'outline'
                  }>
                    {campaign.status}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {campaign.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Leads</span>
                  <span className="font-medium">{campaign.totalLeads}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{campaign.completedLeads}</span>
                </div>
                {campaign.startDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">
                      {format(new Date(campaign.startDate), 'PP')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Create your first campaign to start automating your voice and chat interactions
            </p>
            <Button asChild>
              <a href="/campaigns/new">
                <Plus className="h-4 w-4 mr-2" />
                Create First Campaign
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
