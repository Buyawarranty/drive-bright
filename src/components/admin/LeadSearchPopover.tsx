import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Phone, Mail, Car, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { cn } from '@/lib/utils';

export interface LeadData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  plan_interest: string | null;
  assigned_to?: string | null;
  owner_name?: string | null;
}

interface LeadSearchPopoverProps {
  onSelectLead: (lead: LeadData) => void;
  className?: string;
}

export const LeadSearchPopover: React.FC<LeadSearchPopoverProps> = ({
  onSelectLead,
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const adminMap = useAllAdminUsersMap();

  const ownerNameFor = React.useCallback((assignedTo?: string | null) => {
    if (!assignedTo) return null;
    const u = adminMap.get(assignedTo);
    if (!u) return null;
    return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
  }, [adminMap]);

  // Fetch leads when popover opens or search term changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    // Agents reported "unable to import the lead": a slow lead/cart query left the
    // popover spinning forever with no result and no error. Every request is now
    // time-bounded and degrades to whatever came back.
    const bounded = async <T,>(p: PromiseLike<T>, ms = 8000): Promise<T | { data: null; error: Error }> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<{ data: null; error: Error }>((resolve) => {
        timer = setTimeout(() => resolve({ data: null, error: new Error('Search timed out') }), ms);
      });
      try {
        return (await Promise.race([Promise.resolve(p), timeout])) as any;
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const fetchLeads = async () => {
      setLoading(true);
      try {
        const hasSearch = !!searchTerm.trim();

        // When an agent searches (usually by reg) they must be able to find the
        // record even if that lead is already paid or the cart converted —
        // filtering those out is what made reg searches look broken.
        let query = supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_interest, assigned_to')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!hasSearch) query = query.eq('is_paid', false);

        let cartQuery = supabase
          .from('abandoned_carts')
          .select('id, full_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_name, updated_at, is_converted')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (!hasSearch) cartQuery = cartQuery.eq('is_converted', false);


        // Existing customers must also be findable by reg — agents search a plate
        // expecting the customer/order to come up, not just an open lead.
        let customerQuery: any = null;

        if (searchTerm.trim()) {
          // PostgREST `or()` values must be quoted — a bare space or comma
          // (e.g. "AP69 YUX") breaks the filter parser and the whole request
          // 400s, which looked like "No leads found" for every reg search.
          const q = (v: string) => `"%${v.replace(/["\\,()]/g, ' ').trim()}%"`;
          const raw = searchTerm.trim();
          const words = raw.split(/\s+/).map(word => word.trim()).filter(Boolean).slice(0, 4);
          const compact = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const digits = raw.replace(/\D/g, '');
          const regVariants = new Set<string>([raw]);
          if (compact.length >= 5) {
            regVariants.add(compact);
            regVariants.add(`${compact.slice(0, -3)} ${compact.slice(-3)}`);
          } else if (compact) {
            regVariants.add(compact);
          }
          const regClauses = Array.from(regVariants).map(v => `vehicle_reg.ilike.${q(v)}`);
          const leadClauses = [
            `email.ilike.${q(raw)}`,
            `phone.ilike.${q(raw)}`,
            ...words.flatMap(word => [`first_name.ilike.${q(word)}`, `last_name.ilike.${q(word)}`]),
            ...regClauses,
          ];
          const cartClauses = [
            `email.ilike.${q(raw)}`,
            `full_name.ilike.${q(raw)}`,
            ...words.map(word => `full_name.ilike.${q(word)}`),
            `phone.ilike.${q(raw)}`,
            ...regClauses,
          ];
          const customerClauses = [
            `email.ilike.${q(raw)}`,
            `name.ilike.${q(raw)}`,
            `phone.ilike.${q(raw)}`,
            ...words.flatMap(word => [`first_name.ilike.${q(word)}`, `last_name.ilike.${q(word)}`]),
            ...Array.from(regVariants).map(v => `registration_plate.ilike.${q(v)}`),
          ];
          // Also match a pasted phone number after punctuation/spaces are removed.
          // UK numbers are commonly stored in several different visual formats.
          if (digits.length >= 7 && digits !== raw) {
            leadClauses.push(`phone.ilike.${q(digits)}`);
            cartClauses.push(`phone.ilike.${q(digits)}`);
            customerClauses.push(`phone.ilike.${q(digits)}`);
          }
          query = query.or(leadClauses.join(','));
          cartQuery = cartQuery.or(cartClauses.join(','));
          customerQuery = supabase
            .from('customers')
            .select('id, name, first_name, last_name, email, phone, registration_plate, vehicle_make, vehicle_model, vehicle_year, mileage, plan_type, assigned_to')
            .or(customerClauses.join(','))
            .eq('is_deleted', false)
            .order('signup_date', { ascending: false })
            .limit(25);
        }


        // The sales lead result is the primary import path. Show it as soon as it
        // lands — agents were left staring at a spinner while the optional
        // abandoned-cart enrichment finished (or timed out).
        const cartResPromise = bounded(cartQuery, 3500);
        const customerResPromise = customerQuery ? bounded(customerQuery, 4000) : null;
        let slRes: any = await bounded(query, 6000);
        if (cancelled) return;

        if (slRes.error) console.error('Error fetching leads:', slRes.error);

        // Fallback: if the combined search filter failed, try a plain reg/email
        // match so the agent still gets the lead instead of an empty list.
        if (slRes.error && searchTerm.trim()) {
          const compact = searchTerm.trim().replace(/\s+/g, '').toUpperCase();
          const spaced = compact.length >= 5 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
          slRes = await bounded(supabase
            .from('sales_leads')
            .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_interest, assigned_to')
            .in('vehicle_reg', [compact, spaced, searchTerm.trim()])
            .order('created_at', { ascending: false })
            .limit(50)) as any;
          if (cancelled) return;
        }

        setLoadError(
          slRes.error ? (slRes.error.message || 'Lead search failed — try again.') : null
        );

        // Render the lead matches immediately, then top up with cart-only rows.
        setLeads(((slRes.data as any[]) || []) as LeadData[]);
        setLoading(false);

        const cartRes: any = await cartResPromise;
        if (cancelled) return;
        if (cartRes.error) console.error('Error fetching abandoned carts:', cartRes.error);


        const merged: LeadData[] = [...((slRes.data as any[]) || [])];
        const seen = new Set(

          merged.map((l) => `${(l.email || '').toLowerCase()}|${(l.vehicle_reg || '').replace(/\s/g, '').toUpperCase()}`)
        );

        // Owner lookup so abandoned-cart rows can still show whose lead it is
        const tail9 = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-9);
        const ownerByEmail = new Map<string, string>();
        const ownerByPhone = new Map<string, string>();
        for (const l of (slRes.data as any[]) || []) {
          if (!l.assigned_to) continue;
          if (l.email) ownerByEmail.set(String(l.email).toLowerCase(), l.assigned_to);
          const t = tail9(l.phone);
          if (t.length === 9) ownerByPhone.set(t, l.assigned_to);
        }

        const cartRows = (cartRes.data as any[]) || [];
        // Resolve owners for cart emails/phones not covered by the lead result above
        const missingEmails = Array.from(
          new Set(
            cartRows
              .map((c) => (c.email || '').toLowerCase())
              .filter((e) => e && !ownerByEmail.has(e))
          )
        ).slice(0, 50);
        if (missingEmails.length > 0) {
          // Owner enrichment is cosmetic — never let it hold up the list.
          const { data: ownerRows } = (await bounded(supabase
            .from('sales_leads')
            .select('email, phone, assigned_to')
            .in('email', missingEmails)
            .not('assigned_to', 'is', null)
            .order('created_at', { ascending: false })
            .limit(200), 4000)) as any;
          if (cancelled) return;
          for (const l of (ownerRows as any[]) || []) {
            const e = String(l.email || '').toLowerCase();
            if (e && !ownerByEmail.has(e)) ownerByEmail.set(e, l.assigned_to);
            const t = tail9(l.phone);
            if (t.length === 9 && !ownerByPhone.has(t)) ownerByPhone.set(t, l.assigned_to);
          }
        }

        for (const c of cartRows) {
          const key = `${(c.email || '').toLowerCase()}|${(c.vehicle_reg || '').replace(/\s/g, '').toUpperCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const parts = (c.full_name || '').trim().split(/\s+/);
          merged.push({
            id: `cart:${c.id}`,
            first_name: parts[0] || null,
            last_name: parts.slice(1).join(' ') || null,
            email: c.email || null,
            phone: c.phone,
            vehicle_reg: c.vehicle_reg,
            vehicle_make: c.vehicle_make,
            vehicle_model: c.vehicle_model,
            vehicle_year: c.vehicle_year,
            mileage: c.mileage != null ? String(c.mileage) : null,
            plan_interest: c.plan_name || null,
            assigned_to:
              ownerByEmail.get((c.email || '').toLowerCase()) ||
              ownerByPhone.get(tail9(c.phone)) ||
              null,
          });
        }

        setLeads(merged);
      } catch (err) {
        console.error('Error fetching leads:', err);
        if (!cancelled) setLoadError('Lead search failed — try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const debounce = setTimeout(fetchLeads, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [open, searchTerm]);

  const handleSelectLead = (lead: LeadData) => {
    onSelectLead({ ...lead, owner_name: ownerNameFor(lead.assigned_to) });
    setOpen(false);
    setSearchTerm('');
  };

  const getDisplayName = (lead: LeadData) => {
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    }
    return lead.email?.split('@')[0] || lead.phone || lead.vehicle_reg || 'Lead';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" className={cn("gap-2 bg-brand-orange hover:bg-brand-orange-light text-white font-bold text-base px-6 h-12 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg border-2 border-brand-orange hover:border-brand-orange-light", className)}>
          <UserPlus className="h-5 w-5" />
          Import from Lead
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, reg..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 px-3 text-muted-foreground">
              {loadError ? (
                <span className="text-destructive text-xs">{loadError}</span>
              ) : searchTerm ? 'No leads found' : 'No unpaid leads available'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {leads.map((lead) => (
                <button
                  type="button"
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {getDisplayName(lead)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 text-[10px] font-semibold',
                            ownerNameFor(lead.assigned_to)
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          )}
                        >
                          {ownerNameFor(lead.assigned_to) || 'Unassigned'}
                        </Badge>
                      </div>

                      {lead.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {lead.vehicle_reg ? (
                        <Badge variant="outline" className="text-xs font-mono uppercase">
                          <Car className="h-3 w-3 mr-1" />
                          {lead.vehicle_reg}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
                          No reg
                        </Badge>
                      )}
                      {lead.vehicle_make && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {lead.vehicle_make} {lead.vehicle_model}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
