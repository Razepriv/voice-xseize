import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Upload, 
  Play, 
  Square, 
  Download, 
  Trash2, 
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { UploadBatchDialog } from "@/components/UploadBatchDialog";

interface Batch {
  batch_id: string;
  file_name: string;
  valid_contacts: number;
  total_contacts: number;
  status: 'created' | 'scheduled' | 'queued' | 'executed' | 'stopped';
  created_at: string;
  scheduled_at?: string;
  execution_status?: Record<string, number>;
  from_phone_number?: string;
  agent_id: string;
}

export default function Batches() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Real-time updates via WebSocket
  useWebSocketEvent('batch:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
  }, []));

  useWebSocketEvent('batch:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
  }, []));

  const { data: batches, isLoading } = useQuery<Batch[]>({
    queryKey: ['/api/batches'],
    refetchInterval: 10000, // Refetch every 10 seconds for status updates
  });

  // Stop batch mutation
  const stopBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest('POST', `/api/batches/${batchId}/stop`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      toast({
        title: "Success",
        description: "Batch stopped successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to stop batch",
        variant: "destructive",
      });
    },
  });

  // Run now mutation
  const runNowMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest('POST', `/api/batches/${batchId}/run`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      toast({
        title: "Success",
        description: "Batch started successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start batch",
        variant: "destructive",
      });
    },
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest('DELETE', `/api/batches/${batchId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete batch",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      created: "outline",
      scheduled: "secondary",
      queued: "default",
      executed: "secondary",
      stopped: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatExecutionStatus = (status?: Record<string, number>) => {
    if (!status) return "N/A";
    return Object.entries(status)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  return (
    <div className="space-y-4 p-2 md:p-3">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Agent Batches</h1>
          <p className="text-muted-foreground">
            Upload CSV files for bulk calling campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Batch
          </Button>
        </div>
      </div>

      {/* Template Download Link */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Download a template sheet:</span>
        <a href="/template.csv" className="text-blue-500 hover:underline">link</a>
      </div>

      {/* Batches Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : batches && batches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>File name</TableHead>
                  <TableHead>Uploaded contacts</TableHead>
                  <TableHead>Execution Status</TableHead>
                  <TableHead>Batch Status</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Run Now</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Delete</TableHead>
                  <TableHead>Call Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.batch_id}>
                    <TableCell className="font-mono text-xs">{batch.batch_id.slice(0, 8)}...</TableCell>
                    <TableCell>{batch.file_name}</TableCell>
                    <TableCell>
                      <span className="text-green-600">{batch.valid_contacts}</span>
                      {" / "}
                      {batch.total_contacts}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatExecutionStatus(batch.execution_status)}
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(batch.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        disabled={batch.status === 'executed' || batch.status === 'queued' || runNowMutation.isPending}
                        onClick={() => runNowMutation.mutate(batch.batch_id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        disabled={batch.status !== 'queued' && batch.status !== 'scheduled'}
                        onClick={() => stopBatchMutation.mutate(batch.batch_id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteBatchMutation.mutate(batch.batch_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No batches found</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Upload your first batch to start calling
              </p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Batch
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Batch Dialog */}
      <UploadBatchDialog 
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}
