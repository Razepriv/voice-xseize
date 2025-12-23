import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  Bot,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  assignedAgentId: string | null;
  aiSummary: string | null;
  tags: string[] | null;
  createdAt: string;
};

const STAGES = [
  { id: "new", label: "Ice box", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { id: "contacted", label: "In Progress", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { id: "qualified", label: "Discussion", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { id: "converted", label: "Done", color: "bg-green-500/10 text-green-500 border-green-500/20" },
];

export default function Pipelines() {
  const { toast } = useToast();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('lead:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
  }, []));

  useWebSocketEvent('lead:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
  }, []));

  useWebSocketEvent('lead:deleted', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
  }, []));

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Status Updated",
        description: "Lead moved to new stage successfully.",
      });
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/leads/auto-assign");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "AI Assignment Complete",
        description: data.message,
      });
    },
  });

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedLeadId) {
      updateStatusMutation.mutate({ leadId: draggedLeadId, status: stageId });
      setDraggedLeadId(null);
    }
  };

  const filteredLeads = leads.filter((lead) =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLeadsByStage = (stageId: string) => {
    return filteredLeads.filter((lead) => {
      // Map legacy statuses to new columns if needed, or just use direct match
      if (stageId === "new" && (lead.status === "new" || !STAGES.find(s => s.id === lead.status))) return true;
      return lead.status === stageId;
    });
  };

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Manage your deal flow and lead status</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="pl-9 w-[250px] bg-background/50 backdrop-blur-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={() => autoAssignMutation.mutate()}
            disabled={autoAssignMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20"
          >
            {autoAssignMutation.isPending ? (
              <Sparkles className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Auto Assign AI
          </Button>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-[1000px] h-full">
          {STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            return (
              <div
                key={stage.id}
                className="flex-1 min-w-[300px] flex flex-col gap-4"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      {stage.label}
                    </h3>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
                      {stageLeads.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Drop Zone */}
                <div className="flex-1 rounded-xl bg-muted/30 p-2 border border-dashed border-transparent hover:border-primary/20 transition-colors">
                  <div className="flex flex-col gap-3">
                    {stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        className={cn(
                          "cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 border-none shadow-sm",
                          "bg-white dark:bg-card/50 backdrop-blur-sm"
                        )}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <h4 className="font-semibold text-sm line-clamp-1">{lead.name}</h4>
                              {lead.company && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {lead.company}
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>

                          {lead.aiSummary && (
                            <div className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-2 rounded-md flex gap-2 items-start">
                              <Bot className="h-3 w-3 mt-0.5 shrink-0" />
                              <p className="line-clamp-2">{lead.aiSummary}</p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.tags?.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <div className="flex -space-x-2">
                              {lead.assignedAgentId ? (
                                <Avatar className="h-6 w-6 border-2 border-background">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">AI</AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center border-2 border-background">
                                  <span className="text-[10px] text-muted-foreground">?</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <div className="flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                <span>{format(new Date(lead.createdAt), "MMM d")}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
