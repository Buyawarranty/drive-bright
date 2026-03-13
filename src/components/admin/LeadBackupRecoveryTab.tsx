import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Download, RefreshCw, Search, Database, Shield, Users, Phone, Mail, User, Calendar, AlertTriangle, CheckCircle, Clock, Zap, Filter, XCircle, RotateCcw } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, endOfDay, startOfDay } from 'date-fns';
import { DateRangeFilter } from './DateRangeFilter';
import { DateRange } from 'react-day-picker';

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

interface Step2Attempt {
  id: string;
  session_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  attempt_status: string;
  error_message: string | null;
  error_source: string | null;
  created_at: string;
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

type LeadTypeFilter = 'all' | 'real' | 'fake';

export const LeadBackupRecoveryTab: React.FC = () => {
  const [contacts, setContacts] = useState<BackupContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [recoveringSales, setRecoveringSales] = useState(false);
  const [lastRecoveryAt, setLastRecoveryAt] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadTypeFilter>('all');
  const [step2Attempts, setStep2Attempts] = useState<Step2Attempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [stats, setStats] = useState({
    totalContacts: 0,
    withEmail: 0,
    withPhone: 0,
    withName: 0,
    inMarketing: 0,
    missingFromMarketing: 0,
    missingFromSales: 0,
  });

  // Known fake indicators
  const isFakeIndicator = (contact: BackupContact): boolean => {
    return getFakeReason(contact) !== null;
  };

  // Returns the reason a contact is flagged as fake, or null if real
  const getFakeReason = (contact: BackupContact): string | null => {
    const fakeStatuses = ['fake_lead', 'fake'];
    const testNames = ['kamran', 'prajwal', 'praj', 'test'];
    const testPhones = ['07960111131', '07000000000', '07777777777'];
    
    if (fakeStatuses.includes(contact.status?.toLowerCase() || '')) return 'Manually marked as fake by admin';
    const name = (contact.first_name || contact.full_name || '').toLowerCase();
    const matchedName = testNames.find(t => name.includes(t));
    if (matchedName) return `Name matches test pattern: "${matchedName}"`;
    const phone = (contact.phone || '').replace(/\s/g, '');
    if (testPhones.includes(phone)) return `Phone matches test number: ${phone}`;
    return null;
  };

  const fetchLastRecovery = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_event_logs')
        .select('created_at')
        .eq('event_type', 'lead_recovery_run')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastRecoveryAt(data[0].created_at);
      }
    } catch {
      // silently ignore
    }
  }, []);

  const fetchStep2Attempts = useCallback(async () => {
    setLoadingAttempts(true);
    try {
      let query = supabase
        .from('step2_submission_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (dateRange?.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setStep2Attempts(data || []);
    } catch (err) {
      console.error('Error fetching Step 2 attempts:', err);
    } finally {
      setLoadingAttempts(false);
    }
  }, [dateRange]);

  const fetchAllContacts = useCallback(async () => {
    setLoading(true);
    try {
      const [salesData, cartsData, marketingData] = await Promise.all([
        fetchAllRows('sales_leads', 'id, email, phone, first_name, last_name, vehicle_reg, status, created_at, abandoned_cart_id'),
        fetchAllRows('abandoned_carts', 'id, email, phone, full_name, vehicle_reg, step_abandoned, contact_status, created_at'),
        fetchAllRows('marketing_audience', 'email, phone'),
      ]);

      const marketingEmails = new Set(
        marketingData.map((m: any) => m.email?.toLowerCase()).filter(Boolean)
      );
      const marketingPhones = new Set(
        marketingData.map((m: any) => m.phone?.replace(/\s/g, '')).filter(Boolean)
      );

      const linkedCartIds = new Set(
        salesData.filter((sl: any) => sl.abandoned_cart_id).map((sl: any) => sl.abandoned_cart_id)
      );
      const salesEmails = new Set(
        salesData.map((sl: any) => sl.email?.toLowerCase()).filter(Boolean)
      );

      let orphanedCount = 0;
      for (const cart of cartsData) {
        if (
          cart.email &&
          cart.step_abandoned >= 2 &&
          !linkedCartIds.has(cart.id) &&
          !salesEmails.has(cart.email?.toLowerCase())
        ) {
          orphanedCount++;
        }
      }

      const allContacts: BackupContact[] = [];
      const seen = new Set<string>();

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
        missingFromSales: orphanedCount,
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
    fetchLastRecovery();
  }, [fetchAllContacts, fetchLastRecovery]);

  useEffect(() => {
    fetchStep2Attempts();
  }, [fetchStep2Attempts]);

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

  const handleRecoverToSales = async () => {
    setRecoveringSales(true);
    try {
      const { data, error } = await supabase.rpc('recover_orphaned_leads');
      if (error) throw error;
      const result = data as any;
      if (result?.success === false) {
        toast.error(`Recovery failed: ${result?.error || 'Unknown error'}`);
      } else {
        toast.success(`Recovered ${result?.recovered || 0} leads to Sales (${result?.skipped || 0} skipped)`);
      }
      await Promise.all([fetchAllContacts(), fetchLastRecovery()]);
    } catch (error) {
      console.error('Recovery error:', error);
      toast.error('Failed to recover orphaned leads');
    } finally {
      setRecoveringSales(false);
    }
  };

  // Apply date range + type filter + search
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Date filter
    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
      result = result.filter(c => {
        const d = new Date(c.created_at);
        return d >= from && d <= to;
      });
    }

    // Lead type filter
    if (leadTypeFilter === 'real') {
      result = result.filter(c => !isFakeIndicator(c));
    } else if (leadTypeFilter === 'fake') {
      result = result.filter(c => isFakeIndicator(c));
    }

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.first_name?.toLowerCase().includes(term) ||
        c.full_name?.toLowerCase().includes(term) ||
        c.vehicle_reg?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [contacts, dateRange, leadTypeFilter, searchTerm]);

  // Filtered stats (respects date + type filter)
  const filteredStats = useMemo(() => {
    const real = filteredContacts.filter(c => !isFakeIndicator(c));
    const fake = filteredContacts.filter(c => isFakeIndicator(c));
    return {
      total: filteredContacts.length,
      real: real.length,
      fake: fake.length,
      withEmail: filteredContacts.filter(c => c.email).length,
      withPhone: filteredContacts.filter(c => c.phone).length,
    };
  }, [filteredContacts]);

  // Step 2 attempt stats
  const attemptStats = useMemo(() => {
    const total = step2Attempts.length;
    const success = step2Attempts.filter(a => a.attempt_status === 'success').length;
    const failed = step2Attempts.filter(a => a.attempt_status === 'failed').length;
    const pending = step2Attempts.filter(a => a.attempt_status === 'attempted').length;
    return { total, success, failed, pending };
  }, [step2Attempts]);

  const handleExportCSV = () => {
    const headers = ['First Name', 'Email', 'Phone', 'Vehicle Reg', 'Source', 'Status', 'Type', 'Date Created', 'In Marketing'];
    const rows = filteredContacts.map(c => [
      c.first_name || c.full_name || '',
      c.email || '',
      c.phone || '',
      c.vehicle_reg || '',
      c.source === 'sales_lead' ? 'Sales Lead' : 'Abandoned Cart',
      c.status || '',
      isFakeIndicator(c) ? 'Fake' : 'Real',
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
    toast.success(`Exported ${filteredContacts.length} contacts`);
  };

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
          {lastRecoveryAt && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last auto-recovery: {format(new Date(lastRecoveryAt), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { fetchAllContacts(); fetchStep2Attempts(); }} disabled={loading}>
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

      {/* Date Range + Quick Buttons + Lead Type Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={dateRange?.from && dateRange?.to && format(dateRange.from, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && format(dateRange.to, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => {
            const today = new Date();
            setDateRange({ from: today, to: today });
          }}
        >
          Today
        </Button>
        <Button
          variant={dateRange?.from && dateRange?.to && format(dateRange.from, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd') && format(dateRange.to, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => {
            const yesterday = subDays(new Date(), 1);
            setDateRange({ from: yesterday, to: yesterday });
          }}
        >
          Yesterday
        </Button>
        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="flex items-center gap-1 border-2 border-border rounded-lg p-1">
          <Button
            variant={leadTypeFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setLeadTypeFilter('all')}
          >
            All ({filteredStats.total.toLocaleString()})
          </Button>
          <Button
            variant={leadTypeFilter === 'real' ? 'default' : 'ghost'}
            size="sm"
            className={`h-7 text-xs ${leadTypeFilter === 'real' ? 'bg-green-600 hover:bg-green-700' : 'text-green-700 hover:bg-green-50'}`}
            onClick={() => setLeadTypeFilter('real')}
          >
            ✅ Real ({filteredStats.real.toLocaleString()})
          </Button>
          <Button
            variant={leadTypeFilter === 'fake' ? 'default' : 'ghost'}
            size="sm"
            className={`h-7 text-xs ${leadTypeFilter === 'fake' ? 'bg-red-600 hover:bg-red-700' : 'text-red-700 hover:bg-red-50'}`}
            onClick={() => setLeadTypeFilter('fake')}
          >
            🚫 Fake ({filteredStats.fake.toLocaleString()})
          </Button>
        </div>
      </div>

      {/* Missing from Sales alert banner */}
      {stats.missingFromSales > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {stats.missingFromSales} abandoned carts never reached New Leads! Click "Recover to Sales" to create the missing sales leads now.
            </span>
          </div>
          <Button size="sm" onClick={handleRecoverToSales} disabled={recoveringSales} className="bg-red-600 hover:bg-red-700 text-white">
            <Zap className={`h-3 w-3 mr-1 ${recoveringSales ? 'animate-spin' : ''}`} />
            {recoveringSales ? 'Recovering...' : 'Recover to Sales'}
          </Button>
        </div>
      )}

      {/* Missing from Marketing alert banner */}
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <div className="text-2xl font-bold">{filteredStats.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {dateRange?.from ? 'Filtered' : 'Total'} Contacts
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <div className="text-2xl font-bold text-green-700">{filteredStats.real.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Real Leads</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <div className="text-2xl font-bold text-red-600">{filteredStats.fake.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Fake / Test</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <div className="text-2xl font-bold">{filteredStats.withEmail.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">With Email</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Phone className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <div className="text-2xl font-bold">{filteredStats.withPhone.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">With Phone</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="text-2xl font-bold text-amber-600">{stats.missingFromMarketing.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Missing Marketing</div>
          </CardContent>
        </Card>
        <Card className={stats.missingFromSales > 0 ? 'border-red-300 bg-red-50/50' : ''}>
          <CardContent className="p-4 text-center">
            <Zap className={`h-5 w-5 mx-auto mb-1 ${stats.missingFromSales > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
            <div className={`text-2xl font-bold ${stats.missingFromSales > 0 ? 'text-red-600' : ''}`}>
              {stats.missingFromSales.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Missing Sales</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for All / Missing / Step 2 Attempts */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Contacts ({filteredContacts.length.toLocaleString()})</TabsTrigger>
          <TabsTrigger value="missing">
            Missing from Marketing
            {missingFromMarketing.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{missingFromMarketing.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="step2_attempts">
            Step 2 Attempts
            {attemptStats.failed > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{attemptStats.failed} failed</Badge>
            )}
            {attemptStats.pending > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">{attemptStats.pending} pending</Badge>
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
          <ContactTable contacts={filteredContacts} loading={loading} isFakeIndicator={isFakeIndicator} getFakeReason={getFakeReason} onRefresh={fetchAllContacts} />
        </TabsContent>

        <TabsContent value="missing" className="mt-4">
          <ContactTable
            contacts={missingFromMarketing.filter(c => {
              if (!searchTerm.trim()) return true;
              const term = searchTerm.toLowerCase();
              return c.email?.toLowerCase().includes(term) || c.phone?.includes(term) || c.first_name?.toLowerCase().includes(term);
            })}
            loading={loading}
            isFakeIndicator={isFakeIndicator}
            getFakeReason={getFakeReason}
            onRefresh={fetchAllContacts}
          />
        </TabsContent>

        <TabsContent value="step2_attempts" className="mt-4">
          <Step2AttemptsSection
            attempts={step2Attempts}
            loading={loadingAttempts}
            stats={attemptStats}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Step 2 Attempts Section
const Step2AttemptsSection: React.FC<{
  attempts: Step2Attempt[];
  loading: boolean;
  stats: { total: number; success: number; failed: number; pending: number };
}> = ({ attempts, loading, stats }) => {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pageSize = 50;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return attempts;
    return attempts.filter(a => a.attempt_status === statusFilter);
  }, [attempts, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => { setPage(0); }, [filtered.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Attempts</div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.success}</div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending / Abandoned</div>
          </CardContent>
        </Card>
      </div>

      {stats.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Conversion rate: <span className="font-semibold text-foreground">{stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0}%</span> of attempts succeeded.
          {stats.failed > 0 && <span className="text-red-600 ml-2">⚠ {stats.failed} submissions failed — potential lost leads.</span>}
          {stats.pending > 0 && <span className="text-amber-600 ml-2">⏳ {stats.pending} attempts never completed (user may have closed the page).</span>}
        </p>
      )}

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({stats.total})</SelectItem>
          <SelectItem value="success">✅ Success ({stats.success})</SelectItem>
          <SelectItem value="failed">❌ Failed ({stats.failed})</SelectItem>
          <SelectItem value="attempted">⏳ Pending ({stats.pending})</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {stats.total === 0 ? 'No Step 2 attempts tracked yet. Data will appear after users start submitting the form.' : 'No matching attempts'}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((attempt) => (
                <TableRow key={attempt.id} className={attempt.attempt_status === 'failed' ? 'bg-red-50/50' : attempt.attempt_status === 'attempted' ? 'bg-amber-50/50' : ''}>
                  <TableCell>
                    <Badge
                      variant={attempt.attempt_status === 'success' ? 'default' : attempt.attempt_status === 'failed' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {attempt.attempt_status === 'success' ? '✅ Success' : attempt.attempt_status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{attempt.email || '—'}</TableCell>
                  <TableCell className="text-sm">{attempt.phone || '—'}</TableCell>
                  <TableCell className="text-sm">{attempt.first_name || '—'}</TableCell>
                  <TableCell>
                    {attempt.vehicle_reg ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 font-mono text-xs">
                        {attempt.vehicle_reg}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                    {attempt.error_message || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(attempt.created_at), 'MMM d, HH:mm:ss')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

// Reusable numbered pagination bar
const PaginationBar: React.FC<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => {
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
      return pages;
    }

    // Always show first page
    pages.push(0);

    const start = Math.max(1, currentPage - 1);
    const end = Math.min(totalPages - 2, currentPage + 1);

    if (start > 1) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 2) pages.push('...');

    // Always show last page
    pages.push(totalPages - 1);
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startItem.toLocaleString()}–{endItem.toLocaleString()}</span> of <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="h-8"
        >
          Previous
        </Button>
        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              variant={currentPage === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(p)}
              className="h-8 w-8 p-0 text-xs"
            >
              {p + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage >= totalPages - 1}
          className="h-8"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

const ContactTable: React.FC<{
  contacts: BackupContact[];
  loading: boolean;
  isFakeIndicator: (c: BackupContact) => boolean;
  getFakeReason?: (c: BackupContact) => string | null;
  onRefresh?: () => void;
}> = ({ contacts, loading, isFakeIndicator, getFakeReason, onRefresh }) => {
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const pageSize = 50;
  const totalPages = Math.ceil(contacts.length / pageSize);
  const paged = contacts.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [contacts.length]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [contacts]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map(c => c.id)));
    }
  };

  const handleRestoreToNew = async (ids: string[]) => {
    if (ids.length === 0) return;
    setRestoring(true);
    try {
      // Update sales_leads status back to 'new'
      const { error: salesError } = await supabase
        .from('sales_leads')
        .update({ status: 'new' })
        .in('id', ids);

      if (salesError) throw salesError;

      // Also reset contact_status on abandoned_carts if they exist
      const matchingContacts = contacts.filter(c => ids.includes(c.id));
      const emails = matchingContacts.map(c => c.email?.toLowerCase()).filter(Boolean);
      if (emails.length > 0) {
        await supabase
          .from('abandoned_carts')
          .update({ contact_status: 'not_contacted' })
          .in('email', emails);
      }

      toast.success(`Restored ${ids.length} lead${ids.length > 1 ? 's' : ''} back to New Leads`);
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore leads');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  const selectedFakeCount = Array.from(selectedIds).filter(id => {
    const c = contacts.find(ct => ct.id === id);
    return c && isFakeIndicator(c);
  }).length;

  return (
    <div>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected
            {selectedFakeCount > 0 && ` (${selectedFakeCount} marked fake)`}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleRestoreToNew(Array.from(selectedIds))}
              disabled={restoring}
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              <RotateCcw className={`h-3 w-3 ${restoring ? 'animate-spin' : ''}`} />
              {restoring ? 'Restoring...' : 'Restore to New Leads'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={paged.length > 0 && selectedIds.size === paged.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              paged.map((contact) => {
                const isFake = isFakeIndicator(contact);
                return (
                  <TableRow key={`${contact.source}-${contact.id}`} className={isFake ? 'bg-red-50/30' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {isFake ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="text-xs">Fake</Badge>
                          {getFakeReason && (
                            <span className="text-[10px] text-red-500 max-w-[140px] leading-tight">
                              {getFakeReason(contact)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Real</Badge>
                      )}
                    </TableCell>
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
                      {isFake && contact.source === 'sales_lead' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => handleRestoreToNew([contact.id])}
                          disabled={restoring}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                      ) : (
                        contact.in_marketing ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          totalItems={contacts.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default LeadBackupRecoveryTab;
