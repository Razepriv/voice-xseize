import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Upload, Mail, Phone, Building2, Loader2 } from "lucide-react";
import type { ChannelPartner } from "@shared/schema";
import { format } from "date-fns";

export default function ChannelPartners() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: partners = [], isLoading } = useQuery<ChannelPartner[]>({
    queryKey: ['/api/channel-partners'],
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ partnerId, status }: { partnerId: string; status: string }) =>
      apiRequest('PATCH', `/api/channel-partners/${partnerId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/channel-partners'] });
      toast({
        title: "Success",
        description: "Partner status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update partner status",
        variant: "destructive",
      });
    },
  });

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = 
      partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (partner.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (partner.phone?.includes(searchQuery)) ||
      (partner.company?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (partner.category?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || partner.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || partner.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(partners.map(p => p.category).filter(Boolean)));

  const virtualizer = useVirtualizer({
    count: filteredPartners.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-primary/10 text-primary border-primary/20';
      case 'inactive': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 md:p-3">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-channel-partners">
            Channel Partners
          </h1>
          <p className="text-muted-foreground">
            Manage your channel partner network ({filteredPartners.length.toLocaleString()} partners)
          </p>
        </div>
        <Button onClick={() => navigate('/partners/upload')} data-testid="button-upload-partners">
          <Upload className="h-4 w-4 mr-2" />
          Upload Partners
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter channel partners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-partners"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category, index) => (
                  <SelectItem key={`category-${index}-${category}`} value={category || ''}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div
        ref={parentRef}
        className="flex-1 overflow-auto border rounded-md"
        data-testid="partners-virtual-list"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const partner = filteredPartners[virtualRow.index];
            return (
              <div
                key={partner.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className="p-4 border-b hover-elevate bg-background"
                  data-testid={`partner-card-${partner.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold" data-testid={`partner-name-${partner.id}`}>
                          {partner.name}
                        </h3>
                        <Badge
                          className={getStatusColor(partner.status)}
                          data-testid={`partner-status-badge-${partner.id}`}
                        >
                          {partner.status}
                        </Badge>
                        {partner.category && (
                          <Badge variant="outline" data-testid={`partner-category-${partner.id}`}>
                            {partner.category}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {partner.email && (
                          <div className="flex items-center gap-1" data-testid={`partner-email-${partner.id}`}>
                            <Mail className="h-4 w-4" />
                            <span>{partner.email}</span>
                          </div>
                        )}
                        {partner.phone && (
                          <div className="flex items-center gap-1" data-testid={`partner-phone-${partner.id}`}>
                            <Phone className="h-4 w-4" />
                            <span>{partner.phone}</span>
                          </div>
                        )}
                        {partner.company && (
                          <div className="flex items-center gap-1" data-testid={`partner-company-${partner.id}`}>
                            <Building2 className="h-4 w-4" />
                            <span>{partner.company}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {partner.lastInteractionAt && (
                          <div data-testid={`partner-last-interaction-${partner.id}`}>
                            Last interaction: {format(new Date(partner.lastInteractionAt), 'PPP')}
                          </div>
                        )}
                        {partner.interactionCount > 0 && (
                          <div data-testid={`partner-interaction-count-${partner.id}`}>
                            Interactions: {partner.interactionCount}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-[150px]">
                      <Select
                        value={partner.status}
                        onValueChange={(status) => updateStatusMutation.mutate({ partnerId: partner.id, status })}
                      >
                        <SelectTrigger data-testid={`select-status-${partner.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {filteredPartners.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No partners match your filters'
              : 'No channel partners yet'}
          </p>
        </div>
      )}
    </div>
  );
}
