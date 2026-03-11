import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RefreshCw, ArrowRightCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface OrphanedLead {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  plan_name: string | null;
  step_abandoned: number;
  contact_status: string | null;
  contacted_by: string | null;
  created_at: string;
}

interface LostLeadsSectionProps {
  onRecovered?: () => void;
}

export const LostLeadsSection: React.FC<LostLeadsSectionProps> = ({ onRecovered }) => {
  const [orphanedLeads, setOrphanedLeads] = useState<OrphanedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchOrphanedLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [cartsRes, leadsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select('id, email, phone, full_name, vehicle_reg, vehicle_make, vehicle_model, plan_name, step_abandoned, contact_status, contacted_by, created_at, is_converted')
            .gte('step_abandoned', 2)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() =>
          supabase
            .from('sales_leads')
            .select('id, email, abandoned_cart_id')
        ),
      ]);

      const carts = cartsRes.data || [];
      const leads = leadsRes.data || [];

      const linkedCartIds = new Set(
        leads.filter((l: any) => l.abandoned_cart_id).map((l: any) => l.abandoned_cart_id)
      );
      const existingEmails = new Set(
        leads.map((l: any) => l.email?.toLowerCase()).filter(Boolean)
      );

      const orphans = carts.filter((cart: any) => {
        if (linkedCartIds.has(cart.id)) return false;
        if (existingEmails.has(cart.email?.toLowerCase())) return false;
        if (cart.is_converted === true) return false;
        if (cart.contact_status && ['contacted', 'follow_up', 'quote_sent', 'converted', 'lost', 'fake_lead'].includes(cart.contact_status)) return false;
        return true;
      });

      setOrphanedLeads(orphans);
      if (orphans.length > 0) {
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Error fetching orphaned leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrphanedLeads();
  }, [fetchOrphanedLeads]);

  const handleSyncToSales = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('recover_orphaned_leads');
      if (error) throw error;

      const result = data as any;
      const recovered = result?.recovered || 0;
      const skipped = result?.skipped || 0;

      if (recovered > 0) {
        toast.success(`✅ Recovered ${recovered} lost lead${recovered > 1 ? 's' : ''} to sales pipeline`);
        setLastSyncedAt(new Date().toISOString());
        await fetchOrphanedLeads();
        onRecovered?.();
      } else if (skipped > 0) {
        toast.info(`No new leads to recover (${skipped} skipped as duplicates)`);
      } else {
        toast.info('All leads are already synced — no recovery needed');
      }
    } catch (err: any) {
      console.error('Recovery error:', err);
      toast.error(`Recovery failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [fetchOrphanedLeads, onRecovered]);

  const handleDismissLead = useCallback(async (lead: OrphanedLead) => {
    setDismissingId(lead.id);
    try {
      // Mark abandoned cart as fake_lead so it's excluded from future recovery
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ contact_status: 'fake_lead', is_converted: true })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success(`Dismissed "${lead.email}" — will not be recovered`);
      setOrphanedLeads(prev => prev.filter(l => l.id !== lead.id));
    } catch (err: any) {
      console.error('Dismiss error:', err);
      toast.error(`Failed to dismiss: ${err.message}`);
    } finally {
      setDismissingId(null);
    }
  }, []);

  if (loading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={orphanedLeads.length > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-green-300 bg-green-50/30'}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {orphanedLeads.length > 0 ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span>Recovered Leads</span>
                    <Badge variant="destructive" className="ml-1">{orphanedLeads.length}</Badge>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Recovered Leads — All Synced</span>
                  </>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {lastSyncedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last synced: {format(new Date(lastSyncedAt), 'HH:mm')}
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
            {orphanedLeads.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {orphanedLeads.length} lead{orphanedLeads.length > 1 ? 's' : ''} found in backup but missing from sales pipeline. Sync to recover.
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {orphanedLeads.length > 0 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Button
                    onClick={handleSyncToSales}
                    disabled={syncing}
                    className="gap-2"
                    size="sm"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <ArrowRightCircle className="h-4 w-4" />
                        Recover {orphanedLeads.length} Lead{orphanedLeads.length > 1 ? 's' : ''} to Sales
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchOrphanedLeads}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                <div className="rounded-md border overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[160px]">Name</TableHead>
                        <TableHead className="w-[200px]">Email</TableHead>
                        <TableHead className="w-[120px]">Phone</TableHead>
                        <TableHead className="w-[100px]">Reg Plate</TableHead>
                        <TableHead className="w-[120px]">Vehicle</TableHead>
                        <TableHead className="w-[100px]">Plan</TableHead>
                        <TableHead className="w-[60px]">Step</TableHead>
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead className="w-[80px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orphanedLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">
                            {lead.full_name || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lead.email}
                          </TableCell>
                          <TableCell className="text-sm">
                            {lead.phone || '—'}
                          </TableCell>
                          <TableCell>
                            {lead.vehicle_reg ? (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 font-mono text-xs">
                                {lead.vehicle_reg}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {lead.plan_name || '—'}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {lead.step_abandoned}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(lead.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell className="text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={dismissingId === lead.id}
                                  title="Reject this lead"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject this lead?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{lead.email}</strong> will be marked as a fake lead and won't appear in future recovery. This cannot be undone from here.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDismissLead(lead)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Reject Lead
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {orphanedLeads.length === 0 && lastSyncedAt && (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  All backup leads are synced with the sales pipeline. No recovered leads detected.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
