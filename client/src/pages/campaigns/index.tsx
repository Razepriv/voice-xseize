import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { 
  Plus, 
  Upload, 
  Pause, 
  Trash2, 
  Calendar, 
  Phone, 
  Users, 
  Clock, 
  CheckCircle2, 
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Bot,
  Megaphone
} from "lucide-react";
import Papa from "papaparse";
import { format } from "date-fns";
import type { Campaign, AiAgent, PhoneNumber } from "@shared/schema";

interface BatchDetails {
  batch_id: string;
  humanized_created_at?: string;
  created_at?: string;
  updated_at?: string;
  status: 'scheduled' | 'created' | 'queued' | 'executed' | 'stopped';
  scheduled_at?: string;
  from_phone_number?: string;
  file_name?: string;
  valid_contacts: number;
  total_contacts: number;
  execution_status?: Record<string, number>;
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Form states
  const [showCreate, setShowCreate] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Schedule dialog
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleCampaignId, setScheduleCampaignId] = useState<string>("");
  const [scheduleBatchId, setScheduleBatchId] = useState<string>("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  
  // Batch details dialog
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);

  // Real-time updates
  useWebSocketEvent('campaign:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, []));

  useWebSocketEvent('campaign:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
  }, []));

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: isAuthenticated,
  });

  // Fetch AI Agents
  const { data: agents } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
    enabled: isAuthenticated,
  });

  // Fetch Phone Numbers
  const { data: phoneNumbers } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
    enabled: isAuthenticated,
  });

  // Auth check
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

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    if (f) {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setLeads(results.data as any[]);
        },
        error: () => {
          toast({ title: "Error", description: "Failed to parse file", variant: "destructive" });
        },
      });
    }
  };

  // Create campaign and batch
  const handleCreateCampaign = async () => {
    if (!campaignName || leads.length === 0 || !selectedAgent) {
      toast({ 
        title: "Error", 
        description: "Campaign name, agent, and leads file are required", 
        variant: "destructive" 
      });
      return;
    }

    setIsUploading(true);
    try {
      // First create the campaign in our database
      const campaignRes = await apiRequest('POST', '/api/campaigns', {
        name: campaignName,
        status: 'draft',
        totalLeads: leads.length,
        agentId: selectedAgent,
        fromPhoneNumber: selectedPhone,
      });
      
      if (!campaignRes.ok) throw new Error("Failed to create campaign");
      const campaign = await campaignRes.json();

      // Then create the batch in Bolna
      const formData = new FormData();
      formData.append('agent_id', selectedAgent);
      formData.append('campaign_id', campaign.id);
      if (file) {
        formData.append('file', file);
      }
      if (selectedPhone) {
        formData.append('from_phone_number', selectedPhone);
      }

      const batchRes = await fetch('/api/batches', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!batchRes.ok) {
        const error = await batchRes.json();
        throw new Error(error.message || "Failed to create batch");
      }
      
      const batch = await batchRes.json();

      // Update campaign with batch info
      await apiRequest('PATCH', `/api/campaigns/${campaign.id}`, {
        batchId: batch.batch_id,
        batchStatus: batch.state,
        validContacts: batch.total_contacts,
      });

      toast({ 
        title: "Success", 
        description: `Campaign created with ${batch.total_contacts} contacts. Ready to schedule.` 
      });
      
      // Reset form
      setCampaignName("");
      setSelectedAgent("");
      setSelectedPhone("");
      setFile(null);
      setLeads([]);
      setShowCreate(false);
      refetchCampaigns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Schedule batch
  const handleScheduleBatch = async () => {
    if (!scheduleBatchId || !scheduleDate || !scheduleTime) {
      toast({ title: "Error", description: "Please select date and time", variant: "destructive" });
      return;
    }

    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      
      const res = await apiRequest('POST', `/api/batches/${scheduleBatchId}/schedule`, {
        scheduled_at: scheduledAt,
        bypass_call_guardrails: false,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to schedule batch");
      }

      // Update campaign status
      await apiRequest('PATCH', `/api/campaigns/${scheduleCampaignId}`, {
        status: 'active',
        batchStatus: 'scheduled',
        scheduledAt: scheduledAt,
      });

      toast({ title: "Success", description: "Campaign scheduled successfully" });
      setShowSchedule(false);
      setScheduleDate("");
      setScheduleTime("");
      refetchCampaigns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Stop batch
  const handleStopBatch = async (campaignId: string, batchId: string) => {
    try {
      const res = await apiRequest('POST', `/api/batches/${batchId}/stop`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to stop batch");
      }

      await apiRequest('PATCH', `/api/campaigns/${campaignId}`, {
        status: 'paused',
        batchStatus: 'stopped',
      });

      toast({ title: "Success", description: "Campaign stopped" });
      refetchCampaigns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Delete batch and campaign
  const handleDeleteCampaign = async (campaignId: string, batchId?: string | null) => {
    try {
      // Delete batch from Bolna if exists
      if (batchId) {
        await apiRequest('DELETE', `/api/batches/${batchId}`);
      }

      // Delete campaign from our database
      const res = await apiRequest('DELETE', `/api/campaigns/${campaignId}`);
      
      if (!res.ok) {
        throw new Error("Failed to delete campaign");
      }

      toast({ title: "Success", description: "Campaign deleted" });
      refetchCampaigns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Fetch batch details
  const fetchBatchDetails = async (batchId: string) => {
    setLoadingBatch(true);
    try {
      const res = await apiRequest('GET', `/api/batches/${batchId}`);
      if (!res.ok) throw new Error("Failed to fetch batch details");
      const data = await res.json();
      setBatchDetails(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingBatch(false);
    }
  };

  const openBatchDetails = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowBatchDetails(true);
    fetchBatchDetails(batchId);
  };

  // Get status badge
  const getStatusBadge = (status: string | null | undefined) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      'draft': { variant: 'outline', label: 'Draft' },
      'created': { variant: 'secondary', label: 'Created' },
      'scheduled': { variant: 'default', label: 'Scheduled' },
      'queued': { variant: 'default', label: 'Running' },
      'active': { variant: 'default', label: 'Active' },
      'executed': { variant: 'secondary', label: 'Completed' },
      'completed': { variant: 'secondary', label: 'Completed' },
      'stopped': { variant: 'destructive', label: 'Stopped' },
      'paused': { variant: 'destructive', label: 'Paused' },
    };
    const config = statusConfig[status || 'draft'] || statusConfig['draft'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get agent name by ID
  const getAgentName = (agentId: string | null | undefined) => {
    if (!agentId || !agents) return 'Not assigned';
    const agent = agents.find(a => a.bolnaAgentId === agentId || a.id === agentId);
    return agent?.name || 'Unknown Agent';
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-8 w-8" />
            Campaigns
          </h1>
          <p className="text-muted-foreground">
            Create and manage batch calling campaigns with your AI agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchCampaigns()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
            <DialogDescription>
              Set up a batch calling campaign with your AI agent
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input 
                value={campaignName} 
                onChange={e => setCampaignName(e.target.value)} 
                placeholder="Enter campaign name" 
              />
            </div>

            <div className="space-y-2">
              <Label>Select AI Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent for calls" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.bolnaAgentId || agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Phone Number (Optional)</Label>
              <Select value={selectedPhone || "__default__"} onValueChange={(val) => setSelectedPhone(val === "__default__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select caller ID" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use default</SelectItem>
                  {phoneNumbers?.map((phone) => (
                    <SelectItem key={phone.id} value={phone.phoneNumber}>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {phone.phoneNumber} ({phone.provider})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload Leads (CSV)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <Input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload CSV file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Must contain 'phone_number' or 'recipient_phone_number' column
                  </p>
                </label>
              </div>
              {file && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {file.name}
                </p>
              )}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">💡 Available Variables</p>
                <p className="text-blue-600 dark:text-blue-400">
                  Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{{contact_name}}"}</code> in your agent's prompt to personalize calls.
                </p>
                <p className="text-blue-500 dark:text-blue-500 mt-1">
                  Auto-extracted from: name, contact_name, first_name, full_name columns
                </p>
              </div>
            </div>

            {leads.length > 0 && (
              <div className="border rounded-lg p-3 max-h-40 overflow-auto bg-muted/50">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Preview ({leads.length} contacts)
                </div>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(leads[0]).slice(0, 4).map((k) => (
                        <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-muted">
                        {Object.values(row).slice(0, 4).map((v, j) => (
                          <td key={j} className="px-2 py-1">{v as string}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leads.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ...and {leads.length - 5} more contacts
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCampaign} 
              disabled={isUploading || !campaignName || !selectedAgent || leads.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
            <DialogDescription>
              Set when the calls should start
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input 
                type="time" 
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchedule(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleBatch}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Details Dialog */}
      <Dialog open={showBatchDetails} onOpenChange={setShowBatchDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
          </DialogHeader>
          
          {loadingBatch ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : batchDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(batchDetails.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">{batchDetails.humanized_created_at || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Contacts</Label>
                  <p className="text-sm font-medium">{batchDetails.total_contacts}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valid Contacts</Label>
                  <p className="text-sm font-medium">{batchDetails.valid_contacts}</p>
                </div>
                {batchDetails.scheduled_at && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Scheduled At</Label>
                    <p className="text-sm">{format(new Date(batchDetails.scheduled_at), 'PPpp')}</p>
                  </div>
                )}
              </div>

              {batchDetails.execution_status && Object.keys(batchDetails.execution_status).length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Execution Status</Label>
                  <div className="space-y-2">
                    {Object.entries(batchDetails.execution_status).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{status.replace(/-/g, ' ')}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No details available</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDetails(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => fetchBatchDetails(selectedBatchId)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaigns List */}
      {campaignsLoading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg line-clamp-1">{campaign.name}</CardTitle>
                  </div>
                  {getStatusBadge(campaign.batchStatus || campaign.status)}
                </div>
                {campaign.description && (
                  <CardDescription className="line-clamp-2">
                    {campaign.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Total Contacts
                  </span>
                  <span className="font-medium">{campaign.totalLeads || 0}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </span>
                  <span className="font-medium">{campaign.completedLeads || 0}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Bot className="h-4 w-4" />
                    Agent
                  </span>
                  <span className="font-medium text-xs truncate max-w-[120px]">
                    {getAgentName(campaign.agentId)}
                  </span>
                </div>

                {campaign.scheduledAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Scheduled
                    </span>
                    <span className="font-medium text-xs">
                      {format(new Date(campaign.scheduledAt), 'PP p')}
                    </span>
                  </div>
                )}

                {campaign.totalLeads > 0 && (
                  <Progress 
                    value={(campaign.completedLeads / campaign.totalLeads) * 100} 
                    className="h-2"
                  />
                )}
              </CardContent>

              <CardFooter className="flex gap-2 flex-wrap pt-3 border-t">
                {campaign.batchId && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openBatchDetails(campaign.batchId!)}
                  >
                    View Details
                  </Button>
                )}
                
                {(campaign.batchStatus === 'created' || campaign.status === 'draft') && campaign.batchId && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => {
                      setScheduleCampaignId(campaign.id);
                      setScheduleBatchId(campaign.batchId!);
                      setShowSchedule(true);
                    }}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                )}

                {(campaign.batchStatus === 'scheduled' || campaign.batchStatus === 'queued') && campaign.batchId && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleStopBatch(campaign.id, campaign.batchId!)}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                )}

                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteCampaign(campaign.id, campaign.batchId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Megaphone className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first batch calling campaign to start making automated calls with your AI agents
            </p>
            <Button onClick={() => setShowCreate(true)} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Campaign
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
