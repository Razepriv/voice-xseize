import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Phone, Mail, Building2, MoreHorizontal, Plus, Filter, User, Upload, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { LeadDialog } from "@/components/LeadDialog";
import type { Lead, AiAgent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketEvent } from "@/lib/useWebSocket";
import { useToast } from "@/hooks/use-toast";

export default function Contacts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>(undefined);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [callContact, setCallContact] = useState<Lead | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch AI agents for call selection
  const { data: agents = [] } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Contact Deleted",
        description: "The contact has been permanently removed.",
      });
    },
  });

  // Bulk upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/contacts/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Upload Successful",
        description: `${data.count} contacts imported successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Call mutation
  const callMutation = useMutation({
    mutationFn: async (data: { agentId: string; recipientPhone: string; contactName: string; leadId: string }) => {
      const res = await apiRequest('POST', '/api/calls/initiate', data);
      return res.json();
    },
    onSuccess: () => {
      setIsCallDialogOpen(false);
      setCallContact(null);
      setSelectedAgentId("");
      toast({
        title: "Call Initiated",
        description: "Call has been started successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate call",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedLead(undefined);
    setIsDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      event.target.value = ''; // Reset input
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = 'name,email,phone,company,notes\nJohn Doe,john@example.com,+1234567890,Acme Corp,Important client\nJane Smith,jane@example.com,+0987654321,Tech Inc,New lead';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_contacts.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCall = (contact: Lead) => {
    if (!contact.phone) {
      toast({
        title: "No Phone Number",
        description: "This contact doesn't have a phone number",
        variant: "destructive",
      });
      return;
    }
    setCallContact(contact);
    setSelectedAgentId("");
    setIsCallDialogOpen(true);
  };

  const filteredContacts = leads.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter agents that have bolnaAgentId (synced with Bolna)
  const syncedAgents = agents.filter(a => a.bolnaAgentId);

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Directory of all your customers and leads</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <Button variant="outline" onClick={downloadSampleCsv}>
            <Download className="mr-2 h-4 w-4" />
            Sample CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploadMutation.isPending ? 'Uploading...' : 'Bulk Upload'}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-900/10 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{leads.length}</div>
            <div className="text-sm text-blue-600/80 dark:text-blue-400/80">Total Contacts</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/10 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {leads.filter(l => l.status === 'converted').length}
            </div>
            <div className="text-sm text-green-600/80 dark:text-green-400/80">Active Customers</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/10 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {leads.filter(l => l.lastContactedAt).length}
            </div>
            <div className="text-sm text-purple-600/80 dark:text-purple-400/80">Recently Active</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-900/10 border-none shadow-sm">
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {leads.filter(l => l.status === 'new').length}
            </div>
            <div className="text-sm text-orange-600/80 dark:text-orange-400/80">New Opportunities</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white/50 dark:bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Contact List</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-9 w-[250px] bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last Contacted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No contacts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className="group">
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {contact.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>
                        {contact.company ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.company}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {contact.lastContactedAt
                          ? format(new Date(contact.lastContactedAt), "MMM d, yyyy")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {contact.phone && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleCall(contact)}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(contact)}>Edit Contact</DropdownMenuItem>
                              {contact.phone && (
                                <DropdownMenuItem onClick={() => handleCall(contact)}>
                                  <Phone className="h-4 w-4 mr-2" />
                                  Call Contact
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>Send Email</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(contact.id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LeadDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        lead={selectedLead}
      />

      {/* Call Dialog */}
      <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call {callContact?.name}</DialogTitle>
            <DialogDescription>
              Select an AI agent to make the call to {callContact?.phone}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent">AI Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {syncedAgents.length === 0 ? (
                    <SelectItem value="__none__" disabled>No agents available</SelectItem>
                  ) : (
                    syncedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {syncedAgents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Please create and sync an AI agent first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (callContact && selectedAgentId) {
                  callMutation.mutate({
                    agentId: selectedAgentId,
                    recipientPhone: callContact.phone!,
                    contactName: callContact.name,
                    leadId: callContact.id,
                  });
                }
              }}
              disabled={!selectedAgentId || callMutation.isPending}
            >
              {callMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Call Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
