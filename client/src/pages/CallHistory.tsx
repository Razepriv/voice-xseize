import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Download,
  Phone,
  Clock,
  PhoneCall,
  Loader2,
  Plus,
  PhoneOff,
  PhoneForwarded,
  RefreshCw,
  Play,
  Pause,
  Volume2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import type { Call, AiAgent, PhoneNumber } from "@shared/schema";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status?.toLowerCase()) {
    case "completed":
      return "default";
    case "in_progress":
    case "in-progress":
    case "ringing":
    case "answered":
    case "connected":
      return "secondary";
    case "failed":
    case "busy":
    case "no-answer":
    case "no_answer":
    case "not-connected":
    case "not_connected":
    case "declined":
    case "unreachable":
      return "destructive";
    case "cancelled":
    case "canceled":
      return "outline";
    case "initiated":
    case "scheduled":
      return "outline";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  const statusLower = status?.toLowerCase();
  if (statusLower === "in_progress" || statusLower === "in-progress" ||
    statusLower === "answered" || statusLower === "connected") {
    return <Phone className="w-3 h-3 animate-pulse" />;
  }
  if (statusLower === "ringing" || statusLower === "calling") {
    return <PhoneCall className="w-3 h-3 animate-bounce" />;
  }
  if (statusLower === "completed") {
    return <PhoneForwarded className="w-3 h-3" />;
  }
  if (statusLower === "failed" || statusLower === "busy" ||
    statusLower === "no-answer" || statusLower === "no_answer" ||
    statusLower === "not-connected" || statusLower === "not_connected" ||
    statusLower === "declined" || statusLower === "unreachable") {
    return <PhoneOff className="w-3 h-3" />;
  }
  if (statusLower === "initiated" || statusLower === "scheduled") {
    return <Clock className="w-3 h-3" />;
  }
  if (statusLower === "cancelled" || statusLower === "canceled") {
    return <PhoneOff className="w-3 h-3" />;
  }
  return null;
}

// Form schema for initiating a new call
const newCallSchema = z.object({
  agentId: z.string().min(1, "Please select an AI agent"),
  recipientPhone: z.string().min(10, "Please enter a valid phone number"),
  contactName: z.string().optional(),
  leadId: z.string().optional(),
});

type NewCallFormValues = z.infer<typeof newCallSchema>;

export default function CallHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { toast } = useToast();
  const { user } = useAuth();

  // Auto-open dialog from Quick Actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setIsNewCallDialogOpen(true);
      // Clean URL: remove action param while preserving base path
      params.delete('action');
      const newUrl = params.toString() ?
        `${window.location.pathname}?${params.toString()}` :
        window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  const { data: calls = [], isLoading, refetch: refetchCalls } = useQuery<Call[]>({
    queryKey: ["/api/calls", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/calls?userId=${user?.id}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isNewCallDialogOpen, setIsNewCallDialogOpen] = useState(false);

  // Derived state for selected call - ensures real-time updates when calls list changes
  const selectedCall = useMemo(() =>
    calls.find(c => c.id === selectedCallId) || null,
    [calls, selectedCallId]);

  // Real-time call updates via WebSocket
  useWebSocketEvent<Call>('call:created', useCallback((newCall: Call) => {
    console.log('[CallHistory] Received call:created', newCall);
    // Update both query key patterns to ensure data is refreshed
    queryClient.setQueryData(['/api/calls', user?.id], (oldData: Call[] = []) => {
      // Avoid duplicates
      if (oldData.some(c => c.id === newCall.id)) return oldData;
      return [newCall, ...oldData];
    });
    // Also invalidate to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
    toast({
      title: "New call initiated",
      description: `Call to ${newCall.contactName || newCall.contactPhone} has been started.`,
    });
  }, [toast, user?.id]));

  useWebSocketEvent<Call>('call:updated', useCallback((updatedCall: Call) => {
    console.log('[CallHistory] Received call:updated', updatedCall);
    // Update with correct query key including user ID
    queryClient.setQueryData(['/api/calls', user?.id], (oldData: Call[] = []) => {
      return oldData.map(call =>
        call.id === updatedCall.id ? updatedCall : call
      );
    });



    // Show notification for status changes
    if (updatedCall.status === 'completed') {
      toast({
        title: "Call completed",
        description: `Call with ${updatedCall.contactName || updatedCall.contactPhone} has ended. Duration: ${formatDuration(updatedCall.duration)}`,
      });
    } else if (updatedCall.status === 'in_progress') {
      toast({
        title: "Call connected",
        description: `Call with ${updatedCall.contactName || updatedCall.contactPhone} is now in progress.`,
      });
    } else if (updatedCall.status === 'failed') {
      toast({
        title: "Call failed",
        description: `Call with ${updatedCall.contactName || updatedCall.contactPhone} could not connect.`,
        variant: "destructive",
      });
    }
  }, [toast, user?.id]));

  const { data: agents = [] } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
  });

  const { data: phoneNumbers = [] } = useQuery<PhoneNumber[]>({
    queryKey: ["/api/phone-numbers"],
  });

  const agentMap = useMemo(() => {
    return new Map(agents.map(agent => [agent.id, agent.name]));
  }, [agents]);

  const form = useForm<NewCallFormValues>({
    resolver: zodResolver(newCallSchema),
    defaultValues: {
      agentId: "",
      recipientPhone: "",
      contactName: "",
      leadId: "",
    },
  });

  const initiateCallMutation = useMutation({
    mutationFn: async (data: NewCallFormValues) => {
      const response = await apiRequest("POST", "/api/calls/initiate", data);
      return response;
    },
    // Optimistic update - show the call immediately in the UI
    onMutate: async (newCallData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/calls"] });

      // Snapshot the previous value
      const previousCalls = queryClient.getQueryData(["/api/calls"]);

      // Create optimistic call record
      const optimisticCall = {
        id: `temp-${Date.now()}`, // Temporary ID
        agentId: newCallData.agentId,
        contactPhone: newCallData.recipientPhone,
        contactName: newCallData.contactName || "Unknown",
        leadId: newCallData.leadId || null,
        status: "queued",
        direction: "outbound",
        startedAt: new Date().toISOString(),
        duration: 0,
        outcome: null,
        _isOptimistic: true, // Flag to identify optimistic entries
      };

      // Optimistically update the cache
      queryClient.setQueryData(["/api/calls"], (old: any[] | undefined) => {
        if (!old) return [optimisticCall];
        return [optimisticCall, ...old];
      });

      // Return context for rollback
      return { previousCalls };
    },
    onSuccess: (data) => {
      // Remove optimistic entry and let the real data come through
      // The WebSocket will handle adding the real call
      queryClient.setQueryData(["/api/calls"], (old: any[] | undefined) => {
        if (!old) return old;
        // Remove optimistic entries
        return old.filter((call: any) => !call._isOptimistic);
      });
      // Refetch to ensure we have the latest
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      toast({
        title: "Call initiated",
        description: "Your call has been successfully initiated.",
      });
      setIsNewCallDialogOpen(false);
      form.reset();
    },
    onError: (error: Error, _newCallData, context) => {
      // Rollback to previous state on error
      if (context?.previousCalls) {
        queryClient.setQueryData(["/api/calls"], context.previousCalls);
      }
      toast({
        variant: "destructive",
        title: "Failed to initiate call",
        description: error.message || "Please try again later.",
      });
    },
  });

  const onSubmit = (data: NewCallFormValues) => {
    initiateCallMutation.mutate(data);
  };

  // Export calls to CSV
  const exportCallsToCSV = () => {
    const csvContent = [
      ['Date', 'Contact Name', 'Phone', 'Agent', 'Status', 'Duration', 'Direction', 'Outcome'].join(','),
      ...filteredCalls.map(call => [
        call.startedAt ? format(new Date(call.startedAt), 'yyyy-MM-dd HH:mm:ss') : '',
        call.contactName || '',
        call.contactPhone || '',
        call.agentId ? (agentMap.get(call.agentId) || call.agentId) : '',
        call.status,
        call.duration?.toString() || '0',
        call.direction,
        call.outcome || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `calls_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Calls exported",
      description: `${filteredCalls.length} calls exported to CSV successfully.`,
    });
  };

  // Stop active call
  const stopCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      await apiRequest('POST', `/api/calls/${callId}/stop`, {});
    },
    onSuccess: () => {
      refetchCalls();
      toast({
        title: "Call stopped",
        description: "The call has been terminated.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to stop call",
        description: error.message,
      });
    },
  });

  const filteredCalls = calls.filter((call) => {
    // Calls are already filtered by organization on backend
    // All users in the organization can see all calls
    const matchesSearch =
      !searchQuery ||
      call.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.contactPhone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || call.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const activeCalls = calls.filter(c => ['in_progress', 'initiated', 'ringing'].includes(c.status)).length;
    const failedCalls = calls.filter(c => ['failed', 'cancelled'].includes(c.status)).length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgDuration = completedCalls > 0 ? totalDuration / completedCalls : 0;

    // Calculate total cost
    const totalCost = calls.reduce((sum, c) => {
      const duration = c.duration || 0;
      const costPerMin = (c.exotelCostPerMinute || 0) + (c.bolnaCostPerMinute || 0);
      return sum + (duration / 60) * costPerMin;
    }, 0);

    return {
      totalCalls,
      completedCalls,
      activeCalls,
      failedCalls,
      totalDuration,
      avgDuration,
      totalCost,
    };
  }, [calls]);

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Call History</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCallsToCSV}
            disabled={filteredCalls.length === 0}
            data-testid="button-export"
          >
            <Download className="w-4 h-4 mr-2" />
            Export ({filteredCalls.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => refetchCalls()}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsNewCallDialogOpen(true)} data-testid="button-new-call">
            <PhoneCall className="w-4 h-4 mr-2" />
            New Call
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
              </div>
              <PhoneCall className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-blue-600 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">{formatDuration(Math.round(stats.avgDuration))}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${stats.totalCost.toFixed(2)}
                </p>
              </div>
              <span className="text-2xl">💰</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Calls</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="loading-calls">
              <div className="text-muted-foreground">Loading calls...</div>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" data-testid="empty-calls">
              <Phone className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No calls found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters to see more results."
                  : "Call history will appear here once you start making calls with your AI agents."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => (
                  <TableRow
                    key={call.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedCallId(call.id)}
                    data-testid={`row-call-${call.id}`}
                  >
                    <TableCell data-testid={`text-date-${call.id}`}>
                      {call.startedAt
                        ? format(new Date(call.startedAt), "MMM d, yyyy h:mm a")
                        : call.scheduledAt
                          ? format(new Date(call.scheduledAt), "MMM d, yyyy h:mm a")
                          : "—"}
                    </TableCell>
                    <TableCell data-testid={`text-contact-${call.id}`}>
                      {call.contactName || "—"}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${call.id}`}>
                      {call.contactPhone || "—"}
                    </TableCell>
                    <TableCell data-testid={`text-agent-${call.id}`}>
                      {call.agentId ? (agentMap.get(call.agentId) || call.agentId) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(call.status)} data-testid={`badge-status-${call.id}`} className="flex items-center gap-1 w-fit">
                          {getStatusIcon(call.status)}
                          {call.status.replace(/_/g, ' ').replace(/-/g, ' ')}
                        </Badge>
                        {call.metadata && (call.metadata as any).isVoicemail && (
                          <span className="text-xs" title="Voicemail">📧</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-duration-${call.id}`}>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(call.duration)}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-cost-${call.id}`}>
                      {(() => {
                        const duration = call.duration || 0;
                        const costPerMin = (call.exotelCostPerMinute || 0) + (call.bolnaCostPerMinute || 0);
                        const totalCost = (duration / 60) * costPerMin;
                        return totalCost > 0 ? `$${totalCost.toFixed(4)}` : '—';
                      })()}
                    </TableCell>
                    <TableCell data-testid={`text-direction-${call.id}`}>
                      {call.direction}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCallId(call.id);
                          }}
                          data-testid={`button-view-${call.id}`}
                        >
                          View
                        </Button>
                        {(call.status === 'in_progress' || call.status === 'initiated' || call.status === 'ringing') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              stopCallMutation.mutate(call.id);
                            }}
                            disabled={stopCallMutation.isPending && stopCallMutation.variables === call.id}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-stop-${call.id}`}
                          >
                            {stopCallMutation.isPending && stopCallMutation.variables === call.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PhoneOff className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Call Dialog */}
      <Dialog open={isNewCallDialogOpen} onOpenChange={setIsNewCallDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate New Call</DialogTitle>
            <DialogDescription>
              Start a new AI-powered voice call with a contact
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Agent *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-agent">
                          <SelectValue placeholder="Select an AI agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents
                          .filter((agent) => agent.bolnaAgentId)
                          .map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        {agents.length > 0 && agents.every((agent) => !agent.bolnaAgentId) && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No agents configured
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>Choose the AI agent to handle this call</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Phone Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+1234567890"
                        {...field}
                        data-testid="input-recipient-phone"
                      />
                    </FormControl>
                    <FormDescription>Include country code</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        data-testid="input-contact-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewCallDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={initiateCallMutation.isPending}
                  data-testid="button-submit"
                >
                  {initiateCallMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Initiate Call
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCallId} onOpenChange={(open) => !open && setSelectedCallId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              View detailed information about this call including Bolna metrics
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <BolnaCallDetails callId={selectedCall.id} call={selectedCall} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Bolna details type
interface BolnaCallDetailsData {
  transcript?: string;
  recording_url?: string;
  duration?: number;
  status?: string;
}

// Separate component to fetch Bolna details
function BolnaCallDetails({ callId, call }: { callId: string; call: Call }) {
  const { data: bolnaDetails, isLoading } = useQuery<BolnaCallDetailsData>({
    queryKey: [`/api/calls/${callId}/bolna-details`],
    enabled: !!call.bolnaCallId,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Contact Name</h4>
          <p data-testid="dialog-contact-name">{call.contactName || "—"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Phone Number</h4>
          <p data-testid="dialog-phone">{call.contactPhone || "—"}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(call.status)} data-testid="dialog-status" className="flex items-center gap-1 w-fit">
              {getStatusIcon(call.status)}
              {call.status.replace(/_/g, ' ').replace(/-/g, ' ')}
            </Badge>
            {call.metadata && (call.metadata as any).isVoicemail && (
              <Badge variant="outline" className="text-xs">
                📧 Voicemail
              </Badge>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Duration</h4>
          <p data-testid="dialog-duration">{formatDuration(call.duration)}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Direction</h4>
          <p data-testid="dialog-direction">{call.direction}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Call Type</h4>
          <p data-testid="dialog-call-type">{call.callType}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Cost</h4>
          <p data-testid="dialog-cost">
            {(() => {
              const duration = call.duration || 0;
              const costPerMin = (call.exotelCostPerMinute || 0) + (call.bolnaCostPerMinute || 0);
              const totalCost = (duration / 60) * costPerMin;
              if (totalCost === 0) return "—";
              return (
                <span className="font-medium">
                  ${totalCost.toFixed(4)}
                  <span className="text-xs text-muted-foreground ml-1">
                    (${costPerMin.toFixed(4)}/min)
                  </span>
                </span>
              );
            })()}
          </p>
        </div>
        {call.startedAt && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Started At</h4>
            <p data-testid="dialog-started-at">
              {format(new Date(call.startedAt), "MMM d, yyyy h:mm:ss a")}
            </p>
          </div>
        )}
        {call.endedAt && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Ended At</h4>
            <p data-testid="dialog-ended-at">
              {format(new Date(call.endedAt), "MMM d, yyyy h:mm:ss a")}
            </p>
          </div>
        )}
      </div>

      {call.outcome && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Outcome</h4>
          <p data-testid="dialog-outcome">{call.outcome}</p>
        </div>
      )}

      {call.sentiment && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Sentiment</h4>
          <p data-testid="dialog-sentiment">{call.sentiment}</p>
        </div>
      )}

      {/* Transcript */}
      {/* Transcript Section */}
      {call.status === 'in_progress' || call.status === 'ringing' ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Call is in progress. Transcript will be available after the call ends.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Loading State */}
          {isLoading && call.bolnaCallId && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Fetching details from Bolna...</span>
            </div>
          )}

          {/* Transcript Display */}
          {(bolnaDetails?.transcript || call.transcription) ? (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Transcript</h4>
              <Card>
                <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                  <p className="whitespace-pre-wrap text-sm" data-testid="dialog-transcript">
                    {bolnaDetails?.transcript || call.transcription}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : call.status === 'completed' && !isLoading ? (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="p-6 text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Transcript is being processed or unavailable.</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Recording Player - Deduplicated */}
      {(bolnaDetails?.recording_url || call.recordingUrl) && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Call Recording</h4>
          <Card>
            <CardContent className="p-4 space-y-3">
              <audio
                controls
                className="w-full"
                data-testid="audio-player"
                preload="metadata"
                src={bolnaDetails?.recording_url || call.recordingUrl || ""}
              >
                Your browser does not support the audio element.
              </audio>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-download-recording"
                >
                  <a href={bolnaDetails?.recording_url || call.recordingUrl || "#"} download target="_blank">
                    <Download className="w-4 h-4 mr-2" />
                    Download Recording
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
