import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw, CheckCircle2, Phone, PhoneOff, Mail, MailX, Copy, ChevronDown, StickyNote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UnifiedNotesPanel } from './notes/UnifiedNotesPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';

// Disposable/throwaway email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','dispostable.com','mailnesia.com',
  'trashmail.com','tempail.com','fakeinbox.com','maildrop.cc','10minutemail.com',
  'temp-mail.org','emailondeck.com','getairmail.com','mohmal.com','burnermail.io',
  'getnada.com','tmail.ws','harakirimail.com','33mail.com','spam4.me',
]);

const SPAM_NAME_PATTERNS = [/^test\b/i, /^asdf/i, /^xxx/i, /^aaa+$/i, /^qwer/i, /^fake/i, /^sample/i, /^demo\b/i];

const validatePhone = (phone: string | null): { valid: boolean; reason: string } => {
  if (!phone || phone.trim() === '') return { valid: false, reason: 'Missing' };
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) return { valid: false, reason: `Too short (${digits.length} digits)` };
  if (digits.length > 15) return { valid: false, reason: 'Too long' };
  const isUkMobile = /^(0|44|440)7\d{8,9}$/.test(digits);
  const isUkLandline = /^(0|44|440)[123]\d{8,9}$/.test(digits);
  if (isUkMobile) return { valid: true, reason: 'UK Mobile' };
  if (isUkLandline) return { valid: true, reason: 'UK Landline' };
  return { valid: true, reason: 'Unknown format' };
};

const validateEmail = (email: string | null): { valid: boolean; reason: string } => {
  if (!email || email.trim() === '') return { valid: false, reason: 'Missing' };
  const em = email.toLowerCase().trim();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)) return { valid: false, reason: 'Invalid format' };
  const domain = em.split('@')[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, reason: 'Disposable email' };
  return { valid: true, reason: 'Valid' };
};

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
  total_price: number | null;
  phone_status?: { valid: boolean; reason: string };
  email_status?: { valid: boolean; reason: string };
  quality_score?: number;
  preAssignedTo?: string; // round-robin pre-assignment
}

interface SalesUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role?: string;
}

interface LostLeadsSectionProps {
  onRecovered?: () => void;
  compact?: boolean;
  inline?: boolean;
  salesUsers?: SalesUser[];
  userRole?: string;
}

export const LostLeadsSection: React.FC<LostLeadsSectionProps> = ({ onRecovered, compact = false, inline = false, salesUsers = [], userRole }) => {
  const { user, loading: authLoading } = useAuth();
  const showCbColumn = userRole === 'super_admin' || userRole === 'admin' || userRole === 'lead_gen';
  const [orphanedLeads, setOrphanedLeads] = useState<OrphanedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = React.useRef(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // Agent distribution caps for correct sort_order
  const [agentCaps, setAgentCaps] = useState<{ admin_user_id: string; sort_order: number; daily_cap: number; assigned_today: number; paused: boolean }[]>([]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    supabase
      .from('agent_distribution_caps')
      .select('admin_user_id, sort_order, daily_cap, assigned_today, paused')
      .eq('paused', false)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setAgentCaps(data);
      });
  }, [authLoading, user?.id]);

  // Get active sales agents sorted by distribution sort_order (same as main leads flow)
  const activeAgents = useMemo(() => {
    const capMap = new Map(agentCaps.map(c => [c.admin_user_id, c]));
    return salesUsers
      .filter(u => (u.role === 'sales' || u.role === 'sales_lead') && capMap.has(u.id) && !capMap.get(u.id)!.paused)
      .sort((a, b) => {
        const sortA = capMap.get(a.id)?.sort_order ?? 999;
        const sortB = capMap.get(b.id)?.sort_order ?? 999;
        return sortA - sortB;
      });
  }, [salesUsers, agentCaps]);

  const fetchOrphanedLeads = useCallback(async () => {
    if (authLoading || !user?.id) return;

    if (!initialLoadDone.current) {
      setLoading(true);
    }
    try {
      const [cartsRes, leadsRes] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('abandoned_carts')
            .select('id, email, phone, full_name, vehicle_reg, vehicle_make, vehicle_model, plan_name, step_abandoned, contact_status, contacted_by, created_at, is_converted, total_price')
            .gte('step_abandoned', 2)
            .order('created_at', { ascending: false })
        ),
        fetchAllRows(() =>
          supabase
            .from('sales_leads')
            .select('id, email, abandoned_cart_id, status, phone')
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
      // Build phone set from existing leads for phone-based dedup
      const existingPhones = new Set(
        leads.map((l: any) => l.phone?.replace(/[^0-9]/g, '')).filter((p: string) => p && p.length >= 10)
      );

      // Terminal leads lookup
      const terminalEmails = new Set(
        leads.filter((l: any) => ['converted', 'lost', 'fake_lead'].includes(l.status))
          .map((l: any) => l.email?.toLowerCase()).filter(Boolean)
      );

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

      // Identify duplicates to auto-mark permanently
      const duplicateIds: string[] = [];
      const genuineOrphans: any[] = [];

      for (const cart of carts) {
        // Skip already-processed carts
        if (cart.is_converted === true) continue;
        if (cart.contact_status && ['contacted', 'follow_up', 'quote_sent', 'converted', 'lost', 'fake_lead', 'duplicate'].includes(cart.contact_status)) continue;

        const cartEmail = cart.email?.toLowerCase();
        const cartPhone = cart.phone?.replace(/[^0-9]/g, '') || '';

        // Check if this cart is a duplicate of an existing sales_lead
        const isDuplicate =
          linkedCartIds.has(cart.id) ||
          (cartEmail && existingEmails.has(cartEmail)) ||
          (cartEmail && terminalEmails.has(cartEmail)) ||
          (cartPhone.length >= 10 && existingPhones.has(cartPhone));

        if (isDuplicate) {
          duplicateIds.push(cart.id);
        } else {
          genuineOrphans.push(cart);
        }
      }

      // Auto-mark duplicates permanently in the database (fire and forget)
      if (duplicateIds.length > 0) {
        // Batch in chunks of 50
        for (let i = 0; i < duplicateIds.length; i += 50) {
          const chunk = duplicateIds.slice(i, i + 50);
          supabase
            .from('abandoned_carts')
            .update({ contact_status: 'duplicate' })
            .in('id', chunk)
            .then(({ error }) => {
              if (error) console.error('Auto-dedup error:', error);
            });
        }
        console.log(`Auto-deduplicated ${duplicateIds.length} recovery leads`);
      }

      const orphans = genuineOrphans.map((cart: any) => ({
        ...cart,
        phone_status: validatePhone(cart.phone),
        email_status: validateEmail(cart.email),
        quality_score: calcQuality(cart),
      })).sort((a: any, b: any) => b.quality_score - a.quality_score)
        .map((cart: any, index: number) => ({
          ...cart,
          preAssignedTo: activeAgents.length > 0 ? activeAgents[index % activeAgents.length]?.id : undefined,
        }));

      setOrphanedLeads(orphans);
    } catch (err) {
      console.error('Error fetching orphaned leads:', err);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [authLoading, user?.id, activeAgents]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    fetchOrphanedLeads();
  }, [authLoading, user?.id, fetchOrphanedLeads]);

  /** Handle status change — recover or dismiss based on status */
  const handleStatusChange = useCallback(async (lead: OrphanedLead, newStatus: string) => {
    setDismissingId(lead.id);
    try {
      // Terminal statuses → dismiss from list
      if (['fake_lead', 'lost', 'duplicate'].includes(newStatus)) {
        const { error } = await supabase
          .from('abandoned_carts')
          .update({ contact_status: newStatus })
          .eq('id', lead.id);
        if (error) throw error;

        // Preserve in marketing if valid contact
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
              lead_status: newStatus,
              step_abandoned: lead.step_abandoned,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'email' });
        }

        const label = newStatus === 'fake_lead' ? 'Fake 404' : newStatus === 'duplicate' ? 'Duplicate' : 'Lost';
        toast.success(`Marked as ${label} — removed from recovery`);
        setOrphanedLeads(prev => prev.filter(l => l.id !== lead.id));
      } else {
        // Active status → recover into sales_leads with the pre-assigned agent
        const agentId = lead.preAssignedTo || null;
        const { data, error } = await supabase.rpc('recover_single_lead', {
          p_cart_id: lead.id,
          p_agent_id: agentId,
        });
        if (error) throw error;
        const result = data as any;
        if (!result?.success) {
          toast.error(result?.error || 'Recovery failed');
          return;
        }

        // If the status is not 'new', update it after recovery
        if (newStatus !== 'new' && result?.lead_id) {
          await supabase.rpc('update_lead_status', {
            p_lead_id: result.lead_id,
            p_status: newStatus,
          });
        }

        // Update the abandoned_cart contact_status so it reflects in the queue
        await supabase
          .from('abandoned_carts')
          .update({ contact_status: newStatus })
          .eq('id', lead.id);

        const agentName = agentId
          ? salesUsers.find(u => u.id === agentId)?.first_name || 'agent'
          : 'auto-assigned';
        toast.success(`✅ Status → ${newStatus} (${agentName})`);
        // Keep lead in list — update its local status
        setOrphanedLeads(prev => prev.map(l => l.id === lead.id ? { ...l, contact_status: newStatus } : l));
        onRecovered?.();
      }
    } catch (err: any) {
      console.error('Status change error:', err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setDismissingId(null);
    }
  }, [salesUsers, onRecovered]);

  /** Handle agent assignment change — recover with specific agent */
  const handleAssignChange = useCallback(async (lead: OrphanedLead, agentId: string) => {
    setDismissingId(lead.id);
    try {
      const { data, error } = await supabase.rpc('recover_single_lead', {
        p_cart_id: lead.id,
        p_agent_id: agentId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || 'Recovery failed');
        return;
      }
      const agentName = salesUsers.find(u => u.id === agentId)?.first_name || 'agent';
      toast.success(`✅ Recovered & assigned to ${agentName}`);
      setOrphanedLeads(prev => prev.filter(l => l.id !== lead.id));
      onRecovered?.();
    } catch (err: any) {
      console.error('Assign error:', err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setDismissingId(null);
    }
  }, [salesUsers, onRecovered]);

  const getAgentInfo = useCallback((agentId?: string) => {
    if (!agentId) return null;
    return salesUsers.find(u => u.id === agentId);
  }, [salesUsers]);

  if (authLoading || loading) {
    if (inline) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }
    return null;
  }

  if (!user?.id) return null;

  if (orphanedLeads.length === 0) {
    if (inline) {
      return (
        <div className="text-center py-8">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">All caught up — no recovered leads pending.</p>
        </div>
      );
    }
    return null;
  }

  // Inline mode — matches main LeadsTable layout
  if (inline) {
    return (
      <div className="space-y-0">
        {/* Header matching main table style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-900" />
            <span className="text-sm font-bold tracking-tight text-amber-900">Recovery Queue</span>
            <Badge className="text-[10px] font-mono tabular-nums h-5 bg-amber-900 text-white border-0">
              {orphanedLeads.length} lead{orphanedLeads.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <Button
            onClick={fetchOrphanedLeads}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Table matching main LeadsTable columns */}
        <div className="rounded-md border-2 border-border overflow-x-auto">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b-2 border-border">
                  <TableHead className="sticky left-0 bg-muted/20 z-10 w-[110px] min-w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</TableHead>
                  <TableHead className="w-[95px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[60px] text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calls</TableHead>
                  <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  <TableHead className="w-[110px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="w-[150px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                  <TableHead className="w-[170px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                  <TableHead className="w-[85px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg</TableHead>
                  <TableHead className="w-[80px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</TableHead>
                  <TableHead className="w-[90px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</TableHead>
                  <TableHead className="w-[100px] py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanedLeads.map((lead) => {
                  const preAgent = getAgentInfo(lead.preAssignedTo);
                  const agentInitial = preAgent?.first_name?.[0]?.toUpperCase() || '?';
                  const AGENT_COLOR_MAP: Record<string, { bg: string; badge: string }> = {
                    'isobel': { bg: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                    'james': { bg: 'bg-blue-600', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
                    'ash': { bg: 'bg-violet-600', badge: 'bg-violet-100 text-violet-800 border-violet-300' },
                  };
                  const FALLBACK_BADGE_COLORS = [
                    'bg-orange-100 text-orange-800 border-orange-300',
                    'bg-pink-100 text-pink-800 border-pink-300',
                    'bg-indigo-100 text-indigo-800 border-indigo-300',
                    'bg-teal-100 text-teal-800 border-teal-300',
                  ];
                  const firstName = (preAgent?.first_name || '').toLowerCase();
                  const colorEntry = AGENT_COLOR_MAP[firstName];
                  const agentBadgeColor = colorEntry?.badge
                    || FALLBACK_BADGE_COLORS[salesUsers.findIndex(u => u.id === lead.preAssignedTo) % FALLBACK_BADGE_COLORS.length];
                  const agentAvatarBg = colorEntry?.bg || 'bg-gray-600';

                  return (
                    <React.Fragment key={lead.id}>
                    <TableRow
                      className={cn(
                        'transition-colors',
                        dismissingId === lead.id && 'opacity-50 pointer-events-none',
                      )}
                    >
                      {/* Agent */}
                      <TableCell className="sticky left-0 bg-background z-10">
                        <Select onValueChange={(agentId) => handleAssignChange(lead, agentId)}>
                          <SelectTrigger className={cn("h-7 w-[100px] text-[11px] border rounded-md font-medium gap-1", agentBadgeColor)}>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white", agentAvatarBg)}>
                                {agentInitial}
                              </span>
                              <span className="truncate">{preAgent?.first_name || '—'}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {salesUsers
                              .filter(u => u.role === 'sales' || u.role === 'sales_lead')
                              .map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.first_name} {user.last_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Select value={lead.contact_status || 'new'} onValueChange={(val) => handleStatusChange(lead, val)}>
                          <SelectTrigger className="h-7 w-[85px] text-[11px] border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="follow_up">Follow-up</SelectItem>
                            <SelectItem value="quote_sent">Quote Sent</SelectItem>
                            <SelectItem value="urgent_callback">Urgent Call-back</SelectItem>
                            <SelectItem value="negotiating">Negotiating</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                            <SelectItem value="fake_lead">Fake 404</SelectItem>
                            <SelectItem value="duplicate">Duplicate</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Calls */}
                      <TableCell className="text-center text-xs text-muted-foreground">0</TableCell>

                      {/* Actions — expand toggle + copy buttons (matches main leads) */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <Button
                                variant={expandedLeadId === lead.id ? "default" : "outline"}
                                size="icon"
                                className={cn(
                                  "h-9 w-9 transition-all duration-150",
                                  expandedLeadId === lead.id
                                    ? "bg-primary text-primary-foreground shadow-lg scale-105"
                                    : "border-2 border-primary hover:border-primary hover:bg-primary hover:text-primary-foreground"
                                )}
                                onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                              >
                                <ChevronDown className={cn("h-5 w-5 transition-transform duration-180", expandedLeadId === lead.id && "rotate-180")} strokeWidth={3} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {expandedLeadId === lead.id ? "Close" : "Click to open"}
                            </TooltipContent>
                          </Tooltip>

                          {lead.phone && (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(lead.phone || ''); toast.success('Phone copied'); }}>
                                  <Phone className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy phone</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 relative"
                                onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                              >
                                <StickyNote className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Add note</TooltipContent>
                          </Tooltip>

                          {lead.email && (
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(lead.email || ''); toast.success('Email copied'); }}>
                                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy email</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className={cn(
                          "font-medium text-sm truncate block max-w-[100px]",
                          isSpamName(lead.full_name) && "line-through text-muted-foreground"
                        )}>
                          {lead.full_name || lead.email?.split('@')[0] || '—'}
                        </span>
                      </TableCell>

                      {/* Phone */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {lead.phone ? (
                            lead.phone_status?.valid ? (
                              <Phone className="h-3 w-3 text-green-600 shrink-0" />
                            ) : (
                              <PhoneOff className="h-3 w-3 text-red-500 shrink-0" />
                            )
                          ) : null}
                          <a
                            href={lead.phone ? `tel:${lead.phone}` : undefined}
                            className={cn(
                              "text-sm",
                              lead.phone && "text-green-700 font-medium hover:underline cursor-pointer"
                            )}
                          >
                            {lead.phone || '—'}
                          </a>
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {lead.email_status?.valid ? (
                            <Mail className="h-3 w-3 text-green-600 shrink-0" />
                          ) : (
                            <MailX className="h-3 w-3 text-red-500 shrink-0" />
                          )}
                          <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={lead.email}>
                            {lead.email}
                          </span>
                        </div>
                      </TableCell>

                      {/* Reg — matching main leads yellow plate style */}
                      <TableCell>
                        {lead.vehicle_reg ? (
                          <Badge variant="outline" className="font-mono text-xs bg-yellow-400 text-black border-yellow-500 rounded-sm">
                            {lead.vehicle_reg}
                          </Badge>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>

                      {/* Payment */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {lead.total_price ? `£${lead.total_price.toFixed(0)}` : '—'}
                        </span>
                      </TableCell>

                      {/* Activity */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </span>
                      </TableCell>

                      {/* Created */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </TableCell>
                    </TableRow>

                    {/* Expanded notes panel */}
                    {expandedLeadId === lead.id && (
                      <TableRow>
                        <TableCell colSpan={11} className="p-0 bg-muted/20">
                          <div className="p-4">
                            <UnifiedNotesPanel
                              leadId={lead.id}
                              compact
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          Showing {orphanedLeads.length} recovered lead{orphanedLeads.length !== 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  // Compact/default mode — simple banner (unchanged for other use cases)
  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50/40 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold">{orphanedLeads.length} recovered leads</span>
      </div>
    </div>
  );
};
