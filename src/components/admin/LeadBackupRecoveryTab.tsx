import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, RefreshCw, Search, Database, Shield, Users, Phone, Mail, User, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface BackupContact {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  full_name: string | null;
  vehicle_reg: string | null;
  source: 'sales_lead' | 'abandoned_cart';
  status: string | null;
  step_abandoned: number | null;
  created_at: string;
  in_marketing: boolean;
}

// Helper to fetch ALL rows from a table, paginating past the 1000-row limit
async function fetchAllRows(
  tableName: 'sales_leads' | 'abandoned_carts' | 'marketing_audience',
  selectFields: string,
  orderField: string = 'created_at',
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const query = supabase
      .from(tableName)
      .select(selectFields)
      .range(from, from + PAGE_SIZE - 1);

    // marketing_audience may not have created_at, so only order if applicable
    if (tableName !== 'marketing_audience') {
      query.order(orderField, { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }
  }
  return allData;
}

export const LeadBackupRecoveryTab: React.FC = () => {
  const [contacts, setContacts] = useState<BackupContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    totalContacts: 0,
    withEmail: 0,
    withPhone: 0,
    withName: 0,
    inMarketing: 0,
    missingFromMarketing: 0,
  });

  const fetchAllContacts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL contacts from all three sources using paginated helper
      const [salesData, cartsData, marketingData] = await Promise.all([
        fetchAllRows('sales_leads', 'id, email, phone, first_name, last_name, vehicle_reg, status, created_at'),
        fetchAllRows('abandoned_carts', 'id, email, phone, full_name, vehicle_reg, step_abandoned, contact_status, created_at'),
        fetchAllRows('marketing_audience', 'email, phone'),
      ]);

      const marketingEmails = new Set(
        marketingData.map((m: any) => m.email?.toLowerCase()).filter(Boolean)
      );
      const marketingPhones = new Set(
        marketingData.map((m: any) => m.phone?.replace(/\s/g, '')).filter(Boolean)
      );

      const allContacts: BackupContact[] = [];
      const seen = new Set<string>();

      // Process sales leads
      for (const lead of salesData) {
        const key = `${lead.email?.toLowerCase() || ''}-${lead.phone || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const inMarketing = marketingEmails.has(lead.email?.toLowerCase()) ||
          marketingPhones.has(lead.phone?.replace(/\s/g, ''));

        allContacts.push({
          id: lead.id,
          email: lead.email,
          phone: lead.phone,
          first_name: lead.first_name,
          full_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
          vehicle_reg: lead.vehicle_reg,
          source: 'sales_lead',
          status: lead.status,
          step_abandoned: null,
          created_at: lead.created_at,
          in_marketing: inMarketing,
        });
      }

      // Process abandoned carts (only those not already in sales_leads by email)
      for (const cart of cartsData) {
        const key = `${cart.email?.toLowerCase() || ''}-${cart.phone || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const inMarketing = marketingEmails.has(cart.email?.toLowerCase()) ||
          marketingPhones.has(cart.phone?.replace(/\s/g, ''));

        allContacts.push({
          id: cart.id,
          email: cart.email,
          phone: cart.phone,
          first_name: cart.full_name?.split(' ')[0] || null,
          full_name: cart.full_name,
          vehicle_reg: cart.vehicle_reg,
          source: 'abandoned_cart',
          status: cart.contact_status,
          step_abandoned: cart.step_abandoned,
          created_at: cart.created_at,
          in_marketing: inMarketing,
        });
      }

      setContacts(allContacts);

      setStats({
        totalContacts: allContacts.length,
        withEmail: allContacts.filter(c => c.email).length,
        withPhone: allContacts.filter(c => c.phone).length,
        withName: allContacts.filter(c => c.first_name || c.full_name).length,
        inMarketing: allContacts.filter(c => c.in_marketing).length,
        missingFromMarketing: allContacts.filter(c => !c.in_marketing && c.email).length,
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contact backup data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllContacts();
  }, [fetchAllContacts]);

  const handleSyncToMarketing = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_leads_to_marketing_audience');
      if (error) throw error;
      const result = data as any;
      if (result?.success === false) {
        toast.error(`Sync failed: ${result?.error || 'Unknown error'}`);
      } else {
        toast.success(`Marketing sync complete: ${result?.processed || 0} contacts synced`);
      }
      await fetchAllContacts();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync contacts to marketing');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    const filtered = getFilteredContacts();
    const headers = ['First Name', 'Email', 'Phone', 'Vehicle Reg', 'Source', 'Status', 'Date Created', 'In Marketing'];
    const rows = filtered.map(c => [
      c.first_name || c.full_name || '',
      c.email || '',
      c.phone || '',
      c.vehicle_reg || '',
      c.source === 'sales_lead' ? 'Sales Lead' : 'Abandoned Cart',
      c.status || '',
      c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd HH:mm') : '',
      c.in_marketing ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} contacts`);
  };

  const getFilteredContacts = () => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(c =>
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.first_name?.toLowerCase().includes(term) ||
      c.full_name?.toLowerCase().includes(term) ||
      c.vehicle_reg?.toLowerCase().includes(term)
    );
  };

  const filtered = getFilteredContacts();
  const missingFromMarketing = contacts.filter(c => !c.in_marketing && c.email);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Lead Backup & Recovery
          </h2>
          <p className="text-muted-foreground mt-1">
            Every contact from Step 2 is captured here. Export or sync to marketing at any time.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchAllContacts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleSyncToMarketing} disabled={syncing} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Database className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : `Recover ${stats.missingFromMarketing > 0 ? stats.missingFromMarketing + ' Missing' : 'All'}`}
          </Button>
        </div>
      </div>

      {/* Missing alert banner */}
      {stats.missingFromMarketing > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {stats.missingFromMarketing} contacts with email are not in marketing. Click "Recover" to sync them now.
            </span>
          </div>
          <Button size="sm" onClick={handleSyncToMarketing} disabled={syncing} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
            {syncing ? 'Recovering...' : 'Recover Now'}
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <div className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Contacts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold">{stats.withEmail.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">With Email</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <div className="text-2xl font-bold">{stats.withPhone.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">With Phone</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <User className="h-5 w-5 mx-auto text-orange-500 mb-1" />
            <div className="text-2xl font-bold">{stats.withName.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">With Name</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <div className="text-2xl font-bold">{stats.inMarketing.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">In Marketing</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-2xl font-bold text-amber-600">{stats.missingFromMarketing.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Missing from Marketing</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for All vs Missing */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Contacts ({contacts.length.toLocaleString()})</TabsTrigger>
          <TabsTrigger value="missing">
            Missing from Marketing
            {missingFromMarketing.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{missingFromMarketing.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, or reg..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          <ContactTable contacts={filtered} loading={loading} />
        </TabsContent>

        <TabsContent value="missing" className="mt-4">
          <ContactTable
            contacts={missingFromMarketing.filter(c => {
              if (!searchTerm.trim()) return true;
              const term = searchTerm.toLowerCase();
              return c.email?.toLowerCase().includes(term) || c.phone?.includes(term) || c.first_name?.toLowerCase().includes(term);
            })}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ContactTable: React.FC<{ contacts: BackupContact[]; loading: boolean }> = ({ contacts, loading }) => {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(contacts.length / pageSize);
  const paged = contacts.slice(page * pageSize, (page + 1) * pageSize);

  // Reset page when contacts change
  useEffect(() => {
    setPage(0);
  }, [contacts.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Marketing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              paged.map((contact) => (
                <TableRow key={`${contact.source}-${contact.id}`}>
                  <TableCell className="font-medium">
                    {contact.first_name || contact.full_name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{contact.email || '—'}</TableCell>
                  <TableCell className="text-sm">{contact.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {contact.vehicle_reg ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 font-mono text-xs">
                        {contact.vehicle_reg}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.source === 'sales_lead' ? 'default' : 'secondary'} className="text-xs">
                      {contact.source === 'sales_lead' ? 'Lead' : 'Cart'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{contact.status || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {contact.created_at ? format(new Date(contact.created_at), 'MMM d, yyyy HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    {contact.in_marketing ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, contacts.length)} of {contacts.length.toLocaleString()}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadBackupRecoveryTab;
