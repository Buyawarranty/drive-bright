import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, RefreshCw, ArrowRightCircle, CheckCircle2, XCircle, RotateCcw, Phone, PhoneOff, Mail, MailX, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Disposable/throwaway email domains commonly used for fake signups
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','dispostable.com','mailnesia.com',
  'trashmail.com','tempail.com','fakeinbox.com','maildrop.cc','10minutemail.com',
  'temp-mail.org','emailondeck.com','getairmail.com','mohmal.com','burnermail.io',
  'getnada.com','tmail.ws','harakirimail.com','33mail.com','spam4.me',
]);

// Known test/spam name patterns
const SPAM_NAME_PATTERNS = [/^test\b/i, /^asdf/i, /^xxx/i, /^aaa+$/i, /^qwer/i, /^fake/i, /^sample/i, /^demo\b/i];

/** Validate UK phone number format (admin-side only, not blocking customers) */
const validatePhone = (phone: string | null): { valid: boolean; reason: string } => {
  if (!phone || phone.trim() === '') return { valid: false, reason: 'Missing' };
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) return { valid: false, reason: `Too short (${digits.length} digits)` };
  if (digits.length > 15) return { valid: false, reason: 'Too long' };
  // UK mobile: 07xxx or +447xxx
  const isUkMobile = /^(0|44|440)7\d{8,9}$/.test(digits);
  // UK landline: 01xxx, 02xxx, 03xxx
  const isUkLandline = /^(0|44|440)[123]\d{8,9}$/.test(digits);
  // International: starts with valid country code
  const isInternational = /^(1|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\d{7,13}$/.test(digits);
  if (isUkMobile) return { valid: true, reason: 'UK Mobile' };
  if (isUkLandline) return { valid: true, reason: 'UK Landline' };
  if (isInternational) return { valid: true, reason: 'International' };
  // Has enough digits but unknown format
  return { valid: true, reason: 'Unknown format' };
};

/** Validate email format (admin-side only) */
const validateEmail = (email: string | null): { valid: boolean; reason: string } => {
  if (!email || email.trim() === '') return { valid: false, reason: 'Missing' };
  const em = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { valid: false, reason: 'Invalid format' };
  const domain = em.split('@')[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, reason: 'Disposable email' };
  return { valid: true, reason: 'Valid' };
};

/** Check name for spam patterns */
const isSpamName = (name: string | null): boolean => {
  if (!name) return false;
  return SPAM_NAME_PATTERNS.some(p => p.test(name.trim()));
};

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
  orphan_reason?: string;
  phone_status?: { valid: boolean; reason: string };
  email_status?: { valid: boolean; reason: string };
  quality_score?: number; // 0-100
}

interface LostLeadsSectionProps {
  onRecovered?: () => void;
  compact?: boolean;
  inline?: boolean;
}

export const LostLeadsSection: React.FC<LostLeadsSectionProps> = ({ onRecovered, compact = false, inline = false }) => {
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
      const [cartsRes, rejectedCartsRes, leadsRes, terminalLeadsRes] = await Promise.all([
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
            .select('id, email, abandoned_cart_id, status')
        ),
        // Fetch terminal leads to classify orphan reasons
        fetchAllRows(() =>
          supabase
            .from('sales_leads')
            .select('email, status, phone')
            .in('status', ['converted', 'lost', 'fake_lead'])
        ),
      ]);

      const carts = cartsRes.data || [];
      const leads = leadsRes.data || [];
      const rejected = rejectedCartsRes.data || [];
      const terminalLeads = terminalLeadsRes.data || [];

      const linkedCartIds = new Set(
        leads.filter((l: any) => l.abandoned_cart_id).map((l: any) => l.abandoned_cart_id)
      );
      const existingEmails = new Set(
        leads.map((l: any) => l.email?.toLowerCase()).filter(Boolean)
      );

      // Build terminal status lookup by email
      const terminalByEmail = new Map<string, string>();
      terminalLeads.forEach((tl: any) => {
        const em = tl.email?.toLowerCase();
        if (em) terminalByEmail.set(em, tl.status);
      });
      // Build terminal status lookup by phone
      const terminalByPhone = new Map<string, string>();
      terminalLeads.forEach((tl: any) => {
        const ph = (tl.phone || '').replace(/[^0-9]/g, '');
        if (ph.length >= 10) terminalByPhone.set(ph, tl.status);
      });

      // Count how many times each email appears in abandoned_carts (for duplicate detection)
      const emailCounts = new Map<string, number>();
      carts.forEach((c: any) => {
        const em = c.email?.toLowerCase();
        if (em) emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
      });

      const classifyOrphanReason = (cart: any): string => {
        const em = cart.email?.toLowerCase();
        const ph = (cart.phone || '').replace(/[^0-9]/g, '');

        // Check terminal guard
        if (em && terminalByEmail.has(em)) {
          const status = terminalByEmail.get(em)!;
          const label = status === 'fake_lead' ? 'Fake' : status === 'lost' ? 'Lost' : 'Converted';
          return `Terminal — ${label}`;
        }
        if (ph.length >= 10 && terminalByPhone.has(ph)) {
          const status = terminalByPhone.get(ph)!;
          const label = status === 'fake_lead' ? 'Fake' : status === 'lost' ? 'Lost' : 'Converted';
          return `Terminal — ${label}`;
        }

        // Check duplicate submissions
        const dupCount = em ? (emailCounts.get(em) || 0) : 0;
        if (dupCount > 1) {
          return `Duplicate (×${dupCount})`;
        }

        // Check if step 1 only
        if ((cart.step_abandoned || 0) < 2) {
          return 'Step 1 only';
        }

        // Check for suspicious indicators
        const phoneResult = validatePhone(cart.phone);
        const emailResult = validateEmail(cart.email);
        const spamName = isSpamName(cart.full_name);

        if (spamName && !phoneResult.valid) return 'Suspicious — Spam name + bad phone';
        if (!phoneResult.valid && !emailResult.valid) return 'Suspicious — No valid contact';
        if (emailResult.reason === 'Disposable email') return 'Suspicious — Disposable email';
        if (spamName) return 'Suspicious — Spam name';

        return 'Genuine — New';
      };

      /** Calculate a 0-100 quality score */
      const calcQuality = (cart: any): number => {
        let score = 50;
        const phoneResult = validatePhone(cart.phone);
        const emailResult = validateEmail(cart.email);
        if (phoneResult.valid) score += 20; else score -= 20;
        if (emailResult.valid) score += 10; else score -= 10;
        if (emailResult.reason === 'Disposable email') score -= 15;
        if (cart.full_name && !isSpamName(cart.full_name)) score += 5;
        if (isSpamName(cart.full_name)) score -= 15;
        if (cart.vehicle_reg) score += 5;
        if (cart.plan_name) score += 5;
        if (cart.step_abandoned >= 3) score += 5;
        return Math.max(0, Math.min(100, score));
      };

      const orphans = carts.filter((cart: any) => {
        if (linkedCartIds.has(cart.id)) return false;
        if (existingEmails.has(cart.email?.toLowerCase())) return false;
        if (cart.is_converted === true) return false;
        if (cart.contact_status && ['contacted', 'follow_up', 'quote_sent', 'converted', 'lost', 'fake_lead'].includes(cart.contact_status)) return false;
        return true;
      }).map((cart: any) => ({
        ...cart,
        orphan_reason: classifyOrphanReason(cart),
        phone_status: validatePhone(cart.phone),
        email_status: validateEmail(cart.email),
        quality_score: calcQuality(cart),
      })).sort((a: any, b: any) => b.quality_score - a.quality_score);

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

  /** Sync all valid contacts from orphaned leads to marketing_audience */
  const handleSyncToMarketing = useCallback(async () => {
    const validContacts = orphanedLeads.filter(l => 
      (l.email_status?.valid || l.phone_status?.valid)
    );
    if (validContacts.length === 0) {
      toast.info('No valid contacts to sync');
      return;
    }
    
    try {
      // Upsert each valid contact into marketing_audience
      const rows = validContacts.map(l => ({
        lead_id: l.id,
        email: l.email?.toLowerCase().trim() || null,
        phone: l.phone?.trim() || null,
        full_name: l.full_name || null,
        source: 'orphaned_cart',
        source_type: 'abandoned_cart' as const,
        lead_status: l.contact_status || 'orphaned',
        step_abandoned: l.step_abandoned,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('marketing_audience')
        .upsert(rows, { onConflict: 'email' });

      if (error) throw error;
      toast.success(`📧 Synced ${validContacts.length} contact${validContacts.length > 1 ? 's' : ''} to marketing audience`);
    } catch (err: any) {
      console.error('Marketing sync error:', err);
      toast.error(`Marketing sync failed: ${err.message}`);
    }
  }, [orphanedLeads]);

  const handleDismissLead = useCallback(async (lead: OrphanedLead) => {
    setDismissingId(lead.id);
    try {
      // Mark as fake in abandoned_carts but keep is_converted false 
      // so marketing_audience sync still picks up the contact
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ contact_status: 'fake_lead' })
        .eq('id', lead.id);

      if (error) throw error;

      // Also preserve in marketing_audience if valid contact
      if (lead.email_status?.valid || lead.phone_status?.valid) {
        await supabase
          .from('marketing_audience')
          .upsert({
            lead_id: lead.id,
            email: lead.email?.toLowerCase().trim() || null,
            phone: lead.phone?.trim() || null,
            full_name: lead.full_name || null,
            source: 'orphaned_cart',
            source_type: 'abandoned_cart',
            lead_status: 'fake_lead',
            step_abandoned: lead.step_abandoned,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'email' });
      }

      toast.success(`Dismissed "${lead.email}" — contact preserved for marketing`);
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

  if (compact) {
    return (
      <div className="relative">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "rounded-xl border-2 h-12 flex items-center justify-between px-3 cursor-pointer hover:bg-muted/20 transition-colors",
                orphanedLeads.length > 0 ? 'border-amber-400 bg-amber-50/40' : 'border-green-400 bg-green-50/40'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {orphanedLeads.length > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                )}
                <span className="text-xs font-semibold truncate">
                  {orphanedLeads.length > 0 ? 'Recovered Leads' : 'All Synced'}
                </span>
                {orphanedLeads.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px] shrink-0">{orphanedLeads.length}</Badge>
                )}
                {orphanedLeads.filter(l => l.orphan_reason?.startsWith('Genuine')).length > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px] shrink-0 bg-green-100 text-green-800 border-green-300">
                    {orphanedLeads.filter(l => l.orphan_reason?.startsWith('Genuine')).length} genuine
                  </Badge>
                )}
                {rejectedLeads.length > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground shrink-0">{rejectedLeads.length} rejected</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {orphanedLeads.length > 0 && (
                  <>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleSyncToMarketing(); }}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] gap-1"
                      title="Sync all valid emails & phones to marketing audience"
                    >
                      <Mail className="h-3 w-3" />
                      Marketing
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleSyncToSales(); }}
                      disabled={syncing}
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1"
                    >
                      {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ArrowRightCircle className="h-3 w-3" />}
                      {syncing ? 'Syncing...' : 'Recover'}
                    </Button>
                  </>
                )}
                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="absolute right-0 top-full z-50 mt-2 w-[480px] max-h-[400px] overflow-y-auto rounded-lg border-2 border-border bg-background p-3 space-y-4 shadow-xl">
              {orphanedLeads.length > 0 && (
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
                            <strong>{lead.email}</strong> will be marked as rejected. You can restore it later.
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
              )}

              {/* Rejected leads */}
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
                        <LeadTable
                          leads={rejectedLeads}
                          actionColumn={(lead) => (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleRestoreLead(lead)}
                              disabled={restoringId === lead.id}
                              title="Restore this lead"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

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
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

/** Reason badge color helper */
const getReasonBadge = (reason?: string) => {
  if (!reason) return null;
  if (reason.startsWith('Genuine')) {
    return <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px] px-1.5 whitespace-nowrap"><ShieldCheck className="h-3 w-3 mr-0.5 inline" />{reason}</Badge>;
  }
  if (reason.startsWith('Terminal — Fake')) {
    return <Badge variant="destructive" className="text-[10px] px-1.5 whitespace-nowrap"><ShieldAlert className="h-3 w-3 mr-0.5 inline" />{reason}</Badge>;
  }
  if (reason.startsWith('Terminal — Lost')) {
    return <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px] px-1.5 whitespace-nowrap"><ShieldAlert className="h-3 w-3 mr-0.5 inline" />{reason}</Badge>;
  }
  if (reason.startsWith('Terminal — Converted')) {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] px-1.5 whitespace-nowrap">{reason}</Badge>;
  }
  if (reason.startsWith('Duplicate')) {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 whitespace-nowrap">{reason}</Badge>;
  }
  if (reason.startsWith('Suspicious')) {
    return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] px-1.5 whitespace-nowrap"><ShieldAlert className="h-3 w-3 mr-0.5 inline" />{reason}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] px-1.5 whitespace-nowrap">{reason}</Badge>;
};

/** Quality score visual */
const QualityDot: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1" title={`Quality: ${score}/100`}>
      <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
      <span className="text-[10px] text-muted-foreground font-mono">{score}</span>
    </div>
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
          <TableHead className="w-[30px]">Q</TableHead>
          <TableHead className="w-[130px]">Reason</TableHead>
          <TableHead className="w-[120px]">Name</TableHead>
          <TableHead className="w-[170px]">Email</TableHead>
          <TableHead className="w-[120px]">Phone</TableHead>
          <TableHead className="w-[80px]">Reg</TableHead>
          <TableHead className="w-[100px]">Vehicle</TableHead>
          <TableHead className="w-[80px]">Plan</TableHead>
          <TableHead className="w-[90px]">Date</TableHead>
          <TableHead className="w-[60px] text-center">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id} className={cn(
            lead.orphan_reason?.startsWith('Genuine') && 'bg-green-50/30',
            lead.orphan_reason?.startsWith('Suspicious') && 'bg-red-50/20',
          )}>
            <TableCell>{lead.quality_score !== undefined ? <QualityDot score={lead.quality_score} /> : null}</TableCell>
            <TableCell>{getReasonBadge(lead.orphan_reason)}</TableCell>
            <TableCell className={cn("font-medium text-sm", isSpamName(lead.full_name) && "line-through text-muted-foreground")}>{lead.full_name || '—'}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {lead.email_status?.valid ? (
                  <Mail className="h-3 w-3 text-green-600 shrink-0" />
                ) : (
                  <MailX className="h-3 w-3 text-red-500 shrink-0" />
                )}
                <span className="text-sm text-muted-foreground truncate max-w-[140px]" title={`${lead.email} — ${lead.email_status?.reason || ''}`}>
                  {lead.email}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {lead.phone ? (
                  lead.phone_status?.valid ? (
                    <Phone className="h-3 w-3 text-green-600 shrink-0" />
                  ) : (
                    <PhoneOff className="h-3 w-3 text-red-500 shrink-0" />
                  )
                ) : null}
                <span className="text-sm" title={lead.phone_status?.reason || ''}>
                  {lead.phone || '—'}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {lead.vehicle_reg ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300 font-mono text-xs">
                  {lead.vehicle_reg}
                </Badge>
              ) : '—'}
            </TableCell>
            <TableCell className="text-sm">{[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ') || '—'}</TableCell>
            <TableCell className="text-sm">{lead.plan_name || '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{format(new Date(lead.created_at), 'MMM d, HH:mm')}</TableCell>
            <TableCell className="text-center">{actionColumn(lead)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
