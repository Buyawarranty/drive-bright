import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RefreshCw, ArrowRightCircle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
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
  const [rejectedLeads, setRejectedLeads] = useState<OrphanedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRejectedOpen, setIsRejectedOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchOrphanedLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [cartsRes, rejectedCartsRes, leadsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select('id, email, phone, full_name, vehicle_reg, vehicle_make, vehicle_model, plan_name, step_abandoned, contact_status, contacted_by, created_at, is_converted')
            .gte('step_abandoned', 2)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select('id, email, phone, full_name, vehicle_reg, vehicle_make, vehicle_model, plan_name, step_abandoned, contact_status, contacted_by, created_at')
            .eq('contact_status', 'fake_lead')
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
      const rejected = rejectedCartsRes.data || [];

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

      // Filter rejected leads: only show those not already in sales pipeline
      const rejectedOrphans = rejected.filter((cart: any) => {
        if (linkedCartIds.has(cart.id)) return false;
        if (existingEmails.has(cart.email?.toLowerCase())) return false;
        return true;
      });

      setOrphanedLeads(orphans);
      setRejectedLeads(rejectedOrphans);
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
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ contact_status: 'fake_lead', is_converted: true })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success(`Dismissed "${lead.email}" — moved to rejected`);
      setOrphanedLeads(prev => prev.filter(l => l.id !== lead.id));
      setRejectedLeads(prev => [{ ...lead, contact_status: 'fake_lead' }, ...prev]);
    } catch (err: any) {
      console.error('Dismiss error:', err);
      toast.error(`Failed to dismiss: ${err.message}`);
    } finally {
      setDismissingId(null);
    }
  }, []);

  const handleRestoreLead = useCallback(async (lead: OrphanedLead) => {
    setRestoringId(lead.id);
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ contact_status: null, is_converted: false })
        .eq('id', lead.id);

      if (error) throw error;

      toast.success(`Restored "${lead.email}" — now available for recovery`);
      setRejectedLeads(prev => prev.filter(l => l.id !== lead.id));
      setOrphanedLeads(prev => [{ ...lead, contact_status: null }, ...prev]);
    } catch (err: any) {
      console.error('Restore error:', err);
      toast.error(`Failed to restore: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  }, []);

  if (loading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn(
        "rounded-lg border-2 overflow-hidden",
        orphanedLeads.length > 0 ? 'border-amber-400 bg-amber-50/40' : 'border-green-400 bg-green-50/40'
      )}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center gap-2">
              {orphanedLeads.length > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <span className="text-sm font-semibold">
                {orphanedLeads.length > 0 ? 'Recovered Leads' : 'Recovered Leads — All Synced'}
              </span>
              {orphanedLeads.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{orphanedLeads.length}</Badge>
              )}
              {rejectedLeads.length > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">{rejectedLeads.length} rejected</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {orphanedLeads.length > 0 && (
                <Button
                  onClick={(e) => { e.stopPropagation(); handleSyncToSales(); }}
                  disabled={syncing}
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                >
                  {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ArrowRightCircle className="h-3 w-3" />}
                  {syncing ? 'Syncing...' : 'Recover'}
                </Button>
              )}
              {lastSyncedAt && (
                <span className="text-[10px] text-muted-foreground">
                  Synced {format(new Date(lastSyncedAt), 'HH:mm')}
                </span>
              )}
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-4 border-t border-border/50">
            {/* Orphaned leads table */}
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

                <LeadTable
                  leads={orphanedLeads}
                  actionColumn={(lead) => (
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
                            <strong>{lead.email}</strong> will be marked as rejected. You can restore it later from the Rejected Leads section below.
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
                  )}
                />
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

            {/* Rejected leads recovery section */}
            {rejectedLeads.length > 0 && (
              <Collapsible open={isRejectedOpen} onOpenChange={setIsRejectedOpen}>
                <div className="border rounded-md bg-muted/10">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        <span>Rejected Leads</span>
                        <Badge variant="secondary" className="ml-1">{rejectedLeads.length}</Badge>
                      </div>
                      {isRejectedOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-3">
                        Previously rejected leads. Click restore to move them back to the recovery queue.
                      </p>
                      <LeadTable
                        leads={rejectedLeads}
                        actionColumn={(lead) => (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                disabled={restoringId === lead.id}
                                title="Restore this lead"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Restore this lead?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{lead.email}</strong> will be moved back to the recovery queue and can be synced to the sales pipeline.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRestoreLead(lead)}
                                  className="bg-green-600 text-white hover:bg-green-700"
                                >
                                  Restore Lead
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

/** Shared lead table used for both orphaned and rejected leads */
const LeadTable: React.FC<{
  leads: OrphanedLead[];
  actionColumn: (lead: OrphanedLead) => React.ReactNode;
}> = ({ leads, actionColumn }) => (
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
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell className="font-medium text-sm">{lead.full_name || '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{lead.email}</TableCell>
            <TableCell className="text-sm">{lead.phone || '—'}</TableCell>
            <TableCell>
              {lead.vehicle_reg ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 font-mono text-xs">
                  {lead.vehicle_reg}
                </Badge>
              ) : '—'}
            </TableCell>
            <TableCell className="text-sm">{[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}</TableCell>
            <TableCell className="text-sm">{lead.plan_name || '—'}</TableCell>
            <TableCell className="text-center text-sm">{lead.step_abandoned}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{format(new Date(lead.created_at), 'MMM d, HH:mm')}</TableCell>
            <TableCell className="text-center">{actionColumn(lead)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
