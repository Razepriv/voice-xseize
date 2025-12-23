import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Edit, Trash2, Loader2, Upload, Users, CheckCircle2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Campaign, Lead } from "@shared/schema";
import { format } from "date-fns";

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', params?.id],
    enabled: !!params?.id,
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
    select: (data) => data.filter(lead => lead.campaignId === params?.id),
    enabled: !!params?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/campaigns/${params?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
      navigate('/campaigns');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button onClick={() => navigate('/campaigns')} data-testid="button-back-to-campaigns">
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary/10 text-primary border-primary/20';
      case 'completed': return 'bg-muted text-muted-foreground border-border';
      case 'paused': return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const completionRate = campaign.totalLeads > 0
    ? Math.round((campaign.completedLeads / campaign.totalLeads) * 100)
    : 0;

  return (
    <div className="space-y-4 p-2 md:p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/campaigns')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-campaign-name">
              {campaign.name}
            </h1>
            <p className="text-muted-foreground">
              Campaign Details
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
            data-testid="button-edit-campaign"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-campaign">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the campaign "{campaign.name}" and all associated data.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Campaign'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-leads">
              {campaign.totalLeads}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed-leads">
              {campaign.completedLeads}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">
              {completionRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Information</CardTitle>
          <CardDescription>
            Details and status of this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge className={`mt-1 ${getStatusColor(campaign.status)}`} data-testid="badge-campaign-status">
                {campaign.status}
              </Badge>
            </div>
            {campaign.description && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="mt-1" data-testid="text-campaign-description">{campaign.description}</p>
              </div>
            )}
            {campaign.startDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                <p className="mt-1" data-testid="text-campaign-start-date">
                  {format(new Date(campaign.startDate), 'PPP')}
                </p>
              </div>
            )}
            {campaign.endDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">End Date</p>
                <p className="mt-1" data-testid="text-campaign-end-date">
                  {format(new Date(campaign.endDate), 'PPP')}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="mt-1" data-testid="text-campaign-created">
                {campaign.createdAt ? format(new Date(campaign.createdAt), 'PPP') : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              {leads.length} leads in this campaign
            </CardDescription>
          </div>
          <Button
            onClick={() => navigate(`/campaigns/${campaign.id}/upload-leads`)}
            data-testid="button-upload-leads"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Leads
          </Button>
        </CardHeader>
        <CardContent>
          {leads.length > 0 ? (
            <div className="space-y-2">
              {leads.slice(0, 10).map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                  data-testid={`lead-${lead.id}`}
                >
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {lead.email || lead.phone || 'No contact info'}
                    </p>
                  </div>
                  <Badge
                    variant={lead.status === 'contacted' ? 'default' : 'secondary'}
                    data-testid={`badge-lead-status-${lead.id}`}
                  >
                    {lead.status}
                  </Badge>
                </div>
              ))}
              {leads.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {leads.length - 10} more leads...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No leads in this campaign yet</p>
              <Button
                onClick={() => navigate(`/campaigns/${campaign.id}/upload-leads`)}
                data-testid="button-upload-leads-empty"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Leads
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
