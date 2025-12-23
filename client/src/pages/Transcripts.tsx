import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Phone,
  Clock,
  FileText,
  PlayCircle,
  User,
  Calendar,
  Filter,
  Loader2,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
} from "lucide-react";

type Call = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  duration: number | null;
  startedAt: string | null;
  endedAt: string | null;
  transcription: string | null;
  recordingUrl: string | null;
  bolnaCallId: string | null;
  agentId: string | null;
  direction: string;
  callType: string;
  sentiment: string | null;
  aiSummary: string | null;
};

type Agent = {
  id: string;
  name: string;
};

type BolnaDetails = {
  transcript?: string;
  recording_url?: string;
  status?: string;
};

export default function Transcripts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedCallBolnaDetails, setSelectedCallBolnaDetails] = useState<any>(null);
  const [loadingBolnaDetails, setLoadingBolnaDetails] = useState(false);

  const { data: calls = [], isLoading: isLoadingCalls } = useQuery<Call[]>({
    queryKey: ["/api/calls"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/ai-agents"],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('call:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
  }, []));

  useWebSocketEvent('call:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
  }, []));

  useWebSocketEvent('agent:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/ai-agents'] });
  }, []));

  const { data: bolnaDetails, isLoading: isLoadingBolna } = useQuery<BolnaDetails>({
    queryKey: [`/api/calls/${selectedCall?.id}/bolna-details`],
    enabled: !!selectedCall?.bolnaCallId,
  });

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      const hasTranscriptOrRecording = call.transcription || call.recordingUrl || call.bolnaCallId;
      if (!hasTranscriptOrRecording) return false;

      const matchesSearch =
        call.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.contactPhone?.includes(searchQuery) ||
        call.transcription?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || call.status === statusFilter;
      const matchesAgent = agentFilter === "all" || call.agentId === agentFilter;

      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [calls, searchQuery, statusFilter, agentFilter]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default";
      case "in_progress":
      case "in-progress":
      case "ringing":
      case "answered":
        return "secondary";
      case "failed":
      case "busy":
      case "no-answer":
        return "destructive";
      case "cancelled":
        return "outline";
      case "initiated":
      case "scheduled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === "in_progress" || statusLower === "in-progress" || statusLower === "answered") {
      return <Phone className="w-3 h-3 animate-pulse" />;
    }
    if (statusLower === "ringing") {
      return <PhoneCall className="w-3 h-3 animate-bounce" />;
    }
    if (statusLower === "completed") {
      return <PhoneForwarded className="w-3 h-3" />;
    }
    if (statusLower === "failed" || statusLower === "busy" || statusLower === "no-answer") {
      return <PhoneOff className="w-3 h-3" />;
    }
    if (statusLower === "initiated" || statusLower === "scheduled") {
      return <Clock className="w-3 h-3" />;
    }
    return null;
  };

  const getSentimentBadgeVariant = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
        return "default";
      case "neutral":
        return "secondary";
      case "negative":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCallClick = (call: Call) => {
    setSelectedCall(call);
  };

  const totalCalls = filteredCalls.length;
  const completedCalls = filteredCalls.filter((c) => c.status === "completed").length;
  const avgDuration =
    filteredCalls.length > 0
      ? Math.round(
          filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / filteredCalls.length
        )
      : 0;
  const callsWithRecordings = filteredCalls.filter(
    (c) => c.recordingUrl || c.bolnaCallId
  ).length;

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-transcripts">
            Call Transcripts & Recordings
          </h1>
          <p className="text-muted-foreground mt-1">
            View and search all call transcripts and recordings
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calls</p>
                <p className="text-3xl font-bold mt-2">{totalCalls}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-2">{completedCalls}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-3xl font-bold mt-2">{formatDuration(avgDuration)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">With Recordings</p>
                <p className="text-3xl font-bold mt-2">{callsWithRecordings}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find specific call transcripts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-transcripts"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger data-testid="select-agent-filter">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoadingCalls ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : filteredCalls.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transcripts or recordings found</p>
            </CardContent>
          </Card>
        ) : (
          filteredCalls.map((call) => {
            const agent = agents.find((a) => a.id === call.agentId);
            const hasRecording = call.recordingUrl || call.bolnaCallId;
            const hasTranscript = call.transcription || call.bolnaCallId;

            return (
              <Card
                key={call.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCallClick(call)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Phone className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold text-lg">
                              {call.contactName || "Unknown Contact"}
                            </h3>
                            <Badge variant={getStatusBadgeVariant(call.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(call.status)}
                              {call.status.replace(/_/g, ' ').replace(/-/g, ' ')}
                            </Badge>
                            {call.sentiment && (
                              <Badge variant={getSentimentBadgeVariant(call.sentiment)}>
                                {call.sentiment}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            {call.contactPhone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{call.contactPhone}</span>
                              </div>
                            )}
                            {agent && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{agent.name}</span>
                              </div>
                            )}
                            {call.startedAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDuration(call.duration)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {hasTranscript && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Transcript
                            </Badge>
                          )}
                          {hasRecording && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <PlayCircle className="h-3 w-3" />
                              Recording
                            </Badge>
                          )}
                        </div>
                      </div>

                      {call.aiSummary && (
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-sm font-medium mb-1">AI Summary</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {call.aiSummary}
                          </p>
                        </div>
                      )}

                      {call.transcription && (
                        <div className="bg-muted/30 p-3 rounded-md">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {call.transcription}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Call Details & Transcript</DialogTitle>
            <DialogDescription>
              View full transcript and recording for this call
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6">
              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Contact</h4>
                  <p className="font-medium">{selectedCall.contactName || "Unknown"}</p>
                  {selectedCall.contactPhone && (
                    <p className="text-sm text-muted-foreground">{selectedCall.contactPhone}</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                  <Badge variant={getStatusBadgeVariant(selectedCall.status)} className="flex items-center gap-1 w-fit">
                    {getStatusIcon(selectedCall.status)}
                    {selectedCall.status.replace(/_/g, ' ').replace(/-/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Duration</h4>
                  <p>{formatDuration(selectedCall.duration)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Date & Time</h4>
                  <p>
                    {selectedCall.startedAt
                      ? format(new Date(selectedCall.startedAt), "MMM d, yyyy h:mm:ss a")
                      : "—"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Transcript & Recording */}
              {isLoadingBolna && selectedCall.bolnaCallId && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Loading transcript and recording...
                  </span>
                </div>
              )}

              {bolnaDetails?.transcript && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Transcript
                  </h4>
                  <Card>
                    <CardContent className="p-4">
                      <p className="whitespace-pre-wrap text-sm">{bolnaDetails.transcript}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {bolnaDetails?.recording_url && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Recording
                  </h4>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <audio controls className="w-full" src={bolnaDetails.recording_url}>
                        Your browser does not support the audio element.
                      </audio>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(bolnaDetails.recording_url, "_blank")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Recording
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Local Transcript */}
              {!bolnaDetails?.transcript && selectedCall.transcription && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Transcript</h4>
                  <Card>
                    <CardContent className="p-4">
                      <p className="whitespace-pre-wrap text-sm">{selectedCall.transcription}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* AI Summary */}
              {selectedCall.aiSummary && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Summary</h4>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm">{selectedCall.aiSummary}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Local Recording */}
              {selectedCall.recordingUrl && !bolnaDetails?.recording_url && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Call Recording</h4>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <audio controls className="w-full" preload="metadata">
                        <source src={selectedCall.recordingUrl} type="audio/mpeg" />
                        <source src={selectedCall.recordingUrl} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={selectedCall.recordingUrl} download>
                            <Download className="w-4 h-4 mr-2" />
                            Download Recording
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={selectedCall.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Open in New Tab
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
