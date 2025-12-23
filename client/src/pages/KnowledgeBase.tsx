import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Trash2, Edit, BookOpen, X, Upload, Link, Unlink, RefreshCw, Globe, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import type { KnowledgeBase as KnowledgeBaseType, AiAgent } from "@shared/schema";
import { createKnowledgeBaseSchema, updateKnowledgeBaseSchema } from "@shared/schema";

const formSchema = createKnowledgeBaseSchema.extend({
  tags: z.array(z.string()).default([]),
});

const editFormSchema = updateKnowledgeBaseSchema.extend({
  tags: z.array(z.string()).optional(),
});

type KnowledgeFormValues = z.infer<typeof formSchema>;
type KnowledgeEditValues = z.infer<typeof editFormSchema>;

// Bolna Knowledge Base type
interface BolnaKnowledgeBase {
  rag_id: string;
  file_name?: string;
  name?: string;
  source_type?: 'pdf' | 'url';
  status?: 'processing' | 'processed' | 'error';
  chunk_size?: number;
  similarity_top_k?: number;
  overlapping?: number;
  humanized_created_at?: string;
  created_at?: string;
  updated_at?: string;
}

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeBaseType | null>(null);
  const [itemToDelete, setItemToDelete] = useState<KnowledgeBaseType | null>(null);
  const [tagInput, setTagInput] = useState("");
  
  // New state for Bolna integration
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [selectedAgentForSync, setSelectedAgentForSync] = useState<string>("");
  const [selectedBolnaKB, setSelectedBolnaKB] = useState<BolnaKnowledgeBase | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  // Auto-open dialog from Quick Actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create') {
      setDialogMode('create');
      setIsDialogOpen(true);
      params.delete('action');
      const newUrl = params.toString() ?
        `${window.location.pathname}?${params.toString()}` :
        window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  const createForm = useForm<KnowledgeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      contentType: "text",
      category: "",
      tags: [],
      agentId: undefined,
      status: "active",
    },
  });

  const editForm = useForm<KnowledgeEditValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: "",
      content: "",
      contentType: "text",
      category: "",
      tags: [],
      agentId: null,
      status: "active",
    },
  });

  const { data: knowledgeBase = [], isLoading } = useQuery<KnowledgeBaseType[]>({
    queryKey: ["/api/knowledge-base"],
  });

  // Real-time updates via WebSocket
  useWebSocketEvent('knowledge_base:created', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
  }, []));

  useWebSocketEvent('knowledge_base:updated', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
  }, []));

  useWebSocketEvent('knowledge_base:deleted', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
  }, []));

  const { data: agents = [] } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
  });

  // Fetch Bolna knowledge bases
  const { data: bolnaKnowledgeBases = [], isLoading: bolnaLoading, refetch: refetchBolnaKB } = useQuery<BolnaKnowledgeBase[]>({
    queryKey: ["/api/bolna/knowledge-bases"],
  });

  // Upload file to Bolna
  const uploadToBolnaMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/knowledge-base/upload-to-bolna", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bolna/knowledge-bases"] });
      setIsUploadDialogOpen(false);
      toast({
        title: "Upload successful",
        description: `Knowledge base "${data.platformEntry?.title || 'Document'}" uploaded to Bolna.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file to Bolna.",
        variant: "destructive",
      });
    },
  });

  // Create KB from URL
  const createFromUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest("POST", "/api/bolna/knowledge-base/from-url", { url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bolna/knowledge-bases"] });
      setIsUrlDialogOpen(false);
      setUrlInput("");
      toast({
        title: "Processing URL",
        description: "Knowledge base creation from URL initiated. It may take a few minutes to process.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create knowledge base from URL.",
        variant: "destructive",
      });
    },
  });

  // Attach KB to agent
  const attachToAgentMutation = useMutation({
    mutationFn: async ({ ragId, agentId }: { ragId: string; agentId: string }) => {
      return await apiRequest("POST", `/api/bolna/knowledge-bases/${ragId}/attach/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bolna/knowledge-bases"] });
      setIsSyncDialogOpen(false);
      setSelectedBolnaKB(null);
      setSelectedAgentForSync("");
      toast({
        title: "Knowledge base attached",
        description: "Knowledge base has been linked to the agent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to attach knowledge base to agent.",
        variant: "destructive",
      });
    },
  });

  // Detach KB from agent
  const detachFromAgentMutation = useMutation({
    mutationFn: async ({ ragId, agentId }: { ragId: string; agentId: string }) => {
      return await apiRequest("POST", `/api/bolna/knowledge-bases/${ragId}/detach/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bolna/knowledge-bases"] });
      toast({
        title: "Knowledge base detached",
        description: "Knowledge base has been unlinked from the agent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to detach knowledge base from agent.",
        variant: "destructive",
      });
    },
  });

  // Delete Bolna KB
  const deleteBolnaKBMutation = useMutation({
    mutationFn: async (ragId: string) => {
      return await apiRequest("DELETE", `/api/bolna/knowledge-bases/${ragId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bolna/knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({
        title: "Knowledge base deleted",
        description: "Knowledge base has been removed from Bolna.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete knowledge base.",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeFormValues) => {
      // Clean and prepare data - remove null/undefined optional fields and deduplicate tags
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...data,
          tags: Array.from(new Set(data.tags)),
        }).filter(([_, value]) => value !== null && value !== undefined && value !== '')
      );
      return await apiRequest("POST", "/api/knowledge-base", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setIsDialogOpen(false);
      createForm.reset();
      setTagInput("");
      toast({
        title: "Knowledge base item created",
        description: "Your knowledge base item has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create knowledge base item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KnowledgeEditValues }) => {
      // Deduplicate tags before sending
      const deduplicatedData = {
        ...data,
        tags: data.tags ? Array.from(new Set(data.tags)) : undefined,
      };
      return await apiRequest("PATCH", `/api/knowledge-base/${id}`, deduplicatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      editForm.reset();
      setTagInput("");
      toast({
        title: "Knowledge base item updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update knowledge base item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/knowledge-base/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setItemToDelete(null);
      toast({
        title: "Knowledge base item deleted",
        description: "The item has been removed from your knowledge base.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete knowledge base item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncToBolnaMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/knowledge-base/${id}/sync-to-bolna`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      toast({
        title: "Knowledge base synced",
        description: "Successfully synced to Bolna AI system.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync to Bolna. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSyncToBolna = (id: string) => {
    syncToBolnaMutation.mutate(id);
  };

  const handleOpenCreateDialog = () => {
    createForm.reset();
    setTagInput("");
    setDialogMode('create');
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: KnowledgeBaseType) => {
    setSelectedItem(item);
    editForm.reset({
      title: item.title,
      content: item.content,
      contentType: item.contentType,
      category: item.category || "",
      tags: item.tags || [],
      agentId: item.agentId,
      status: item.status,
    });
    setTagInput("");
    setIsEditDialogOpen(true);
  };

  // File upload handler for Bolna
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("category", "document");
    
    uploadToBolnaMutation.mutate(formData);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Open sync dialog for a Bolna KB
  const handleOpenSyncDialog = (kb: BolnaKnowledgeBase) => {
    setSelectedBolnaKB(kb);
    setSelectedAgentForSync("");
    setIsSyncDialogOpen(true);
  };

  // Attach KB to selected agent
  const handleAttachToAgent = () => {
    if (selectedBolnaKB && selectedAgentForSync) {
      attachToAgentMutation.mutate({
        ragId: selectedBolnaKB.rag_id,
        agentId: selectedAgentForSync,
      });
    }
  };

  // Check if a KB is attached to any agent
  const getAttachedAgents = (ragId: string): AiAgent[] => {
    return agents.filter(agent => 
      agent.knowledgeBaseIds?.includes(ragId)
    );
  };

  type GenericForm = UseFormReturn<KnowledgeFormValues> | UseFormReturn<KnowledgeEditValues>;

  const handleAddTag = (form: GenericForm) => {
    const trimmedTag = tagInput.trim();
    if (!trimmedTag) return;

    const currentTags = ((form.getValues() as { tags?: string[] }).tags) || [];
    // Deduplicate - only add if not already present
    if (!currentTags.includes(trimmedTag)) {
      form.setValue("tags" as any, [...currentTags, trimmedTag]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (form: GenericForm, tagToRemove: string) => {
    const currentTags = ((form.getValues() as { tags?: string[] }).tags) || [];
    form.setValue("tags" as any, currentTags.filter(tag => tag !== tagToRemove));
  };

  const onCreateSubmit = (data: KnowledgeFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: KnowledgeEditValues) => {
    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data });
    }
  };

  const handleDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete.id);
    }
  };

  const filteredItems = knowledgeBase.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(knowledgeBase.map(item => item.category).filter(Boolean)));

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Knowledge Base</h1>
          <p className="text-muted-foreground mt-2">Manage AI training data and documentation</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.txt,.doc,.docx"
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadToBolnaMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadToBolnaMutation.isPending ? "Uploading..." : "Upload to Bolna"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsUrlDialogOpen(true)}
          >
            <Globe className="w-4 h-4 mr-2" />
            Add from URL
          </Button>
          <Button onClick={handleOpenCreateDialog} data-testid="button-create">
            <Plus className="w-4 h-4 mr-2" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {/* Bolna Knowledge Bases Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Bolna Knowledge Bases
              </CardTitle>
              <CardDescription>
                Knowledge bases synced with Bolna AI. Attach them to agents for enhanced responses.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchBolnaKB()}
              disabled={bolnaLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${bolnaLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bolnaLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading Bolna knowledge bases...</div>
          ) : bolnaKnowledgeBases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No knowledge bases in Bolna yet.</p>
              <p className="text-sm">Upload a PDF or add a URL to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bolnaKnowledgeBases.map((kb) => {
                const attachedAgents = getAttachedAgents(kb.rag_id);
                return (
                  <Card key={kb.rag_id} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm font-medium truncate">
                            {kb.file_name || kb.name || kb.rag_id.slice(0, 8)}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={kb.status === 'processed' ? 'default' : kb.status === 'error' ? 'destructive' : 'secondary'}>
                              {kb.status === 'processed' && <CheckCircle className="w-3 h-3 mr-1" />}
                              {kb.status === 'processing' && <Clock className="w-3 h-3 mr-1" />}
                              {kb.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                              {kb.status || 'unknown'}
                            </Badge>
                            {kb.source_type && (
                              <Badge variant="outline" className="text-xs">
                                {kb.source_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {attachedAgents.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Attached to:</p>
                          <div className="flex flex-wrap gap-1">
                            {attachedAgents.map(agent => (
                              <Badge key={agent.id} variant="secondary" className="text-xs">
                                {agent.name}
                                <button
                                  onClick={() => detachFromAgentMutation.mutate({ ragId: kb.rag_id, agentId: agent.id })}
                                  className="ml-1 hover:text-destructive"
                                  title="Detach from agent"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {kb.humanized_created_at && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Created: {kb.humanized_created_at}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSyncDialog(kb)}
                          disabled={kb.status !== 'processed'}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          Attach
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteBolnaKBMutation.mutate(kb.rag_id)}
                          disabled={deleteBolnaKBMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Local Knowledge Base Search & Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Local Knowledge</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category!}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12" data-testid="loading-knowledge">
          <div className="text-muted-foreground">Loading knowledge base...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12" data-testid="empty-knowledge">
          <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No knowledge base items</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            {searchQuery || categoryFilter !== "all"
              ? "Try adjusting your filters to see more results."
              : "Start building your AI knowledge base by adding training data and documentation."}
          </p>
          {!searchQuery && categoryFilter === "all" && (
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Knowledge
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`card-knowledge-${item.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg" data-testid={`text-title-${item.id}`}>{item.title}</CardTitle>
                      {item.bolnaKbId && (
                        <Badge variant="secondary" className="text-xs">
                          Synced
                        </Badge>
                      )}
                    </div>
                    {item.category && (
                      <Badge variant="outline" className="mt-2" data-testid={`badge-category-${item.id}`}>
                        {item.category}
                      </Badge>
                    )}
                  </div>
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <CardDescription className="line-clamp-2" data-testid={`text-content-${item.id}`}>
                  {item.content}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {item.agentId && (
                    <div className="text-sm text-muted-foreground">
                      Assigned to: {agents.find(a => a.id === item.agentId)?.name || item.agentId}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncToBolna(item.id)}
                      disabled={syncToBolnaMutation.isPending}
                      data-testid={`button-sync-${item.id}`}
                      title={item.bolnaKbId ? "Resync to Bolna" : "Sync to Bolna"}
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${syncToBolnaMutation.isPending ? 'animate-spin' : ''}`} />
                      {item.bolnaKbId ? "Resync" : "Sync"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDialog(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemToDelete(item)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog with react-hook-form */}
      <Dialog open={isDialogOpen && dialogMode === 'create'} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">Add Knowledge Base Item</DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              Add training data, documentation, or FAQs for your AI agents.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter title"
                        {...field}
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter content or training data"
                        rows={6}
                        {...field}
                        data-testid="input-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-content-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="faq">FAQ</SelectItem>
                          <SelectItem value="script">Script</SelectItem>
                          <SelectItem value="documentation">Documentation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Sales, Support"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          data-testid="input-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Agent (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-agent">
                          <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No agent</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(createForm);
                      }
                    }}
                    placeholder="Add a tag"
                    data-testid="input-tag"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddTag(createForm)}
                    variant="outline"
                    data-testid="button-add-tag"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(createForm.watch("tags") || []).map((tag) => (
                    <Badge key={tag} variant="secondary" data-testid={`badge-tag-${tag}`}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(createForm, tag)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-tag-${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog with react-hook-form */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit">
          <DialogHeader>
            <DialogTitle data-testid="text-edit-dialog-title">Edit Knowledge Base Item</DialogTitle>
            <DialogDescription>
              Update the knowledge base item information and content.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content *</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        data-testid="input-edit-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-content-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="faq">FAQ</SelectItem>
                          <SelectItem value="script">Script</SelectItem>
                          <SelectItem value="documentation">Documentation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          data-testid="input-edit-category"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Agent (Optional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-agent">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No agent</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label htmlFor="edit-tags">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="edit-tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(editForm);
                      }
                    }}
                    placeholder="Add a tag"
                    data-testid="input-edit-tag"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddTag(editForm)}
                    variant="outline"
                    data-testid="button-add-edit-tag"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(editForm.watch("tags") || []).map((tag) => (
                    <Badge key={tag} variant="secondary" data-testid={`badge-edit-tag-${tag}`}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(editForm, tag)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-edit-tag-${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Knowledge Base Item?</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              This will permanently delete "{itemToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* URL Dialog for creating KB from URL */}
      <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base from URL</DialogTitle>
            <DialogDescription>
              Enter a URL to scrape and ingest as a knowledge base. The content will be processed and indexed for AI responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/docs"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createFromUrlMutation.mutate(urlInput)}
              disabled={!urlInput || createFromUrlMutation.isPending}
            >
              {createFromUrlMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync/Attach Dialog */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Knowledge Base to Agent</DialogTitle>
            <DialogDescription>
              Select an agent to attach this knowledge base to. The agent will use this knowledge to provide more accurate responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Knowledge Base</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedBolnaKB?.file_name || selectedBolnaKB?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">ID: {selectedBolnaKB?.rag_id?.slice(0, 12)}...</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select value={selectedAgentForSync} onValueChange={setSelectedAgentForSync}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                      {agent.knowledgeBaseIds?.includes(selectedBolnaKB?.rag_id || '') && ' (already attached)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAttachToAgent}
              disabled={!selectedAgentForSync || attachToAgentMutation.isPending}
            >
              {attachToAgentMutation.isPending ? "Attaching..." : "Attach to Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
