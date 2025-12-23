import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, MessageSquare, Filter, Search, Upload } from "lucide-react";
import type { ChannelPartner } from "@shared/schema";
import { DataTable, type Column } from "@/components/DataTable";

export default function SourcingManagerDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: partners, isLoading } = useQuery<ChannelPartner[]>({
    queryKey: ["/api/channel-partners"],
  });

  const filteredPartners = partners?.filter((partner) => {
    const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
    const matchesSearch = !searchQuery || 
      partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) ?? [];

  const engagedPartners = partners?.filter(p => p.status === 'engaged') ?? [];
  const interestedPartners = partners?.filter(p => p.status === 'interested') ?? [];
  const inactivePartners = partners?.filter(p => p.status === 'inactive') ?? [];
  const avgInteractions = partners && partners.length > 0
    ? Math.round(partners.reduce((sum, p) => sum + p.interactionCount, 0) / partners.length)
    : 0;

  const stats = [
    {
      title: "Total Partners",
      value: partners?.length ?? 0,
      icon: Users,
      description: "Channel partners in system",
      testId: "stat-total",
    },
    {
      title: "Engaged",
      value: engagedPartners.length,
      icon: TrendingUp,
      description: "Active and engaged",
      testId: "stat-engaged",
    },
    {
      title: "Interested",
      value: interestedPartners.length,
      icon: MessageSquare,
      description: "Showing interest",
      testId: "stat-interested",
    },
    {
      title: "Avg Interactions",
      value: avgInteractions,
      icon: MessageSquare,
      description: "Per partner",
      testId: "stat-avg-interactions",
    },
  ];

  const columns: Column<ChannelPartner>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (partner) => (
        <div>
          <p className="font-medium">{partner.name}</p>
          {partner.company && (
            <p className="text-xs text-muted-foreground">{partner.company}</p>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "Contact",
      render: (partner) => (
        <div className="text-sm">
          <p>{partner.email}</p>
          {partner.phone && (
            <p className="text-xs text-muted-foreground">{partner.phone}</p>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      render: (partner) => partner.category || "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (partner) => (
        <Badge variant={
          partner.status === 'engaged' ? 'default' :
          partner.status === 'interested' ? 'secondary' :
          'outline'
        }>
          {partner.status}
        </Badge>
      ),
    },
    {
      key: "interactionCount",
      header: "Interactions",
      sortable: true,
      render: (partner) => partner.interactionCount,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-dashboard">
            Sourcing Manager Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage channel partners and engagement
          </p>
        </div>
        <Button asChild data-testid="button-upload-partners">
          <a href="/partners/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Partners
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={stat.testId}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Partners</CardTitle>
          <CardDescription>
            All channel partners with advanced filtering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
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
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="engaged">Engaged</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            data={filteredPartners}
            columns={columns}
            onRowClick={(partner) => window.location.href = `/partners/${partner.id}`}
            emptyMessage="No partners found. Upload partners to get started."
            isLoading={isLoading}
          />

          {filteredPartners.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredPartners.length} of {partners?.length ?? 0} partners
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
