import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  RefreshCw, 
  Search, 
  Mail, 
  Phone, 
  Car,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  UserMinus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { RenewalsTab } from './RenewalsTab';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketingAudienceMember {
  id: string;
  lead_id: string | null;
  reg_plate: string | null;
  mileage: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  source: string | null;
  source_type: string | null;
  lead_status: string | null;
  is_subscribed: boolean;
  last_contacted_at: string | null;
  contact_count: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  leads_processed: number;
  leads_added: number;
  leads_updated: number;
  status: string;
}

export const MarketingAudienceTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('exclude_junk');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('audience');

  // Fetch marketing audience
  const { data: audience, isLoading: audienceLoading, refetch: refetchAudience } = useQuery({
    queryKey: ['marketing-audience', searchTerm, sourceFilter, subscriptionFilter, statusFilter, sortOrder, stepFilter],
    queryFn: async () => {
      let query = supabase
        .from('marketing_audience')
        .select('*')
        .limit(2000);

      // Sort order
      if (sortOrder === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortOrder === 'oldest') {
        query = query.order('created_at', { ascending: true });
      }

      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,reg_plate.ilike.%${searchTerm}%`);
      }

      if (sourceFilter !== 'all') {
        query = query.eq('source_type', sourceFilter);
      }

      if (subscriptionFilter === 'subscribed') {
        query = query.eq('is_subscribed', true);
      } else if (subscriptionFilter === 'unsubscribed') {
        query = query.eq('is_subscribed', false);
      }

      // Status filter - exclude junk by default
      if (statusFilter === 'exclude_junk') {
        query = query.not('lead_status', 'in', '("fake_lead","not_interested","lost")');
      } else if (statusFilter === 'purchased') {
        query = query.in('lead_status', ['purchased', 'converted', 'paid']);
      } else if (statusFilter === 'abandoned_cart') {
        query = query.eq('source_type', 'abandoned_cart');
      } else if (statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter);
      }

      // Step abandoned filter
      if (stepFilter !== 'all') {
        query = query.eq('source_type', 'abandoned_cart');
        if (stepFilter === '4plus') {
          query = query.gte('step_abandoned', 4);
        } else {
          query = query.eq('step_abandoned', parseInt(stepFilter));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketingAudienceMember[];
    }
  });

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['marketing-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_audience_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as SyncLog[];
    }
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['marketing-audience-stats'],
    queryFn: async () => {
      const [totalRes, subscribedRes, salesLeadsRes, abandonedCartsRes] = await Promise.all([
        supabase.from('marketing_audience').select('*', { count: 'exact', head: true }),
        supabase.from('marketing_audience').select('*', { count: 'exact', head: true }).eq('is_subscribed', true),
        supabase.from('marketing_audience').select('*', { count: 'exact', head: true }).eq('source_type', 'sales_lead'),
        supabase.from('marketing_audience').select('*', { count: 'exact', head: true }).eq('source_type', 'abandoned_cart'),
      ]);

      return {
        total: totalRes.count ?? 0,
        subscribed: subscribedRes.count ?? 0,
        salesLeads: salesLeadsRes.count ?? 0,
        abandonedCarts: abandonedCartsRes.count ?? 0
      };
    }
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('sync_leads_to_marketing_audience');
      if (error) throw error;
      return data;
    },
    onSuccess: (rawData: any) => {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      toast.success(`Sync complete: ${data?.added ?? 0} added, ${data?.updated ?? 0} updated`);
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-audience-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('marketing_audience')
        .update({ is_subscribed: false, unsubscribed_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Members unsubscribed');
      setSelectedMembers(new Set());
      queryClient.invalidateQueries({ queryKey: ['marketing-audience'] });
    }
  });

  // Export to CSV
  const exportToCSV = () => {
    if (!audience || audience.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Email', 'Phone', 'Name', 'Reg Plate', 'Mileage', 'Source', 'Status', 'Subscribed', 'Created'];
    const rows = audience.map(m => [
      m.email || '',
      m.phone || '',
      m.full_name || '',
      m.reg_plate || '',
      m.mileage || '',
      m.source_type || '',
      m.lead_status || '',
      m.is_subscribed ? 'Yes' : 'No',
      m.created_at ? format(new Date(m.created_at), 'yyyy-MM-dd') : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-audience-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === audience?.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(audience?.map(m => m.id) || []));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMembers(newSet);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marketing Audience</h2>
          <p className="text-gray-600">Unified mailing list for email marketing & remarketing calls</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={!audience?.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Audience</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Subscribed</p>
                <p className="text-2xl font-bold">{stats?.subscribed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">From Sales Leads</p>
                <p className="text-2xl font-bold">{stats?.salesLeads || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abandoned Carts</p>
                <p className="text-2xl font-bold">{stats?.abandonedCarts || 0}</p>
              </div>
              <Car className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audience">Audience List</TabsTrigger>
          <TabsTrigger value="renewals">Call Renewals</TabsTrigger>
          <TabsTrigger value="sync-history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="audience" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by email, phone, name, or reg..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="sales_lead">Sales Leads</SelectItem>
                    <SelectItem value="abandoned_cart">Abandoned Carts</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Subscription" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="subscribed">Subscribed</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Lead Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exclude_junk">Exclude Fake/Not Interested</SelectItem>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="purchased">Purchased / Paid</SelectItem>
                    <SelectItem value="abandoned_cart">Abandoned Carts Only</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stepFilter} onValueChange={setStepFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Cart Step" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Steps</SelectItem>
                    <SelectItem value="1">Step 1 – Reg entered</SelectItem>
                    <SelectItem value="2">Step 2 – Vehicle info</SelectItem>
                    <SelectItem value="3">Step 3 – Plan select</SelectItem>
                    <SelectItem value="4plus">Step 4+ – Checkout</SelectItem>
                  </SelectContent>
                </Select>
                {selectedMembers.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => unsubscribeMutation.mutate(Array.from(selectedMembers))}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Unsubscribe ({selectedMembers.size})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audience Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={audience?.length ? selectedMembers.size === audience.length : false}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audienceLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : audience?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No audience members found. Click "Sync Now" to import leads.
                      </TableCell>
                    </TableRow>
                  ) : (
                    audience?.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedMembers.has(member.id)}
                            onCheckedChange={() => toggleSelect(member.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {member.full_name && (
                              <p className="font-medium text-sm">{member.full_name}</p>
                            )}
                            {member.email && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </div>
                            )}
                            {member.phone && (
                              <a href={`tel:${member.phone}`} className="flex items-center gap-1 text-sm text-emerald-600 hover:underline">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.reg_plate && (
                            <div className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              <span className="font-mono text-sm">{member.reg_plate}</span>
                            </div>
                          )}
                          {member.mileage && (
                            <p className="text-xs text-gray-500">{member.mileage} miles</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {member.source_type === 'sales_lead' ? 'Sales Lead' : 
                             member.source_type === 'abandoned_cart' ? 'Abandoned Cart' : 
                             member.source_type || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.lead_status && (
                            <Badge variant="secondary" className="text-xs">
                              {member.lead_status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.is_subscribed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {format(new Date(member.created_at), 'dd MMM yyyy')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals">
          <RenewalsTab />
        </TabsContent>

        <TabsContent value="sync-history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sync History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : syncLogs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No sync history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    syncLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.started_at), 'dd MMM yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.sync_type}</Badge>
                        </TableCell>
                        <TableCell>{log.leads_processed}</TableCell>
                        <TableCell className="text-green-600">+{log.leads_added}</TableCell>
                        <TableCell className="text-blue-600">{log.leads_updated}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.status === 'completed' ? 'default' : log.status === 'running' ? 'secondary' : 'destructive'}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {log.completed_at 
                            ? `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
