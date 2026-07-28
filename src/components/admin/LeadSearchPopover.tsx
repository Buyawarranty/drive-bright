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
  email: string;
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

    const fetchLeads = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_interest, assigned_to')
          .eq('is_paid', false)
          .order('created_at', { ascending: false })
          .limit(50);

        let cartQuery = supabase
          .from('abandoned_carts')
          .select('id, full_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_name, updated_at, is_converted')
          .eq('is_converted', false)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (searchTerm) {
          const term = `%${searchTerm}%`;
          // Reg plate variants: strip spaces, and add a spaced variant (e.g. "AP69YUX" ↔ "AP69 YUX")
          const compact = searchTerm.replace(/\s+/g, '').toUpperCase();
          const regVariants = new Set<string>([searchTerm]);
          if (compact.length >= 5) {
            regVariants.add(compact);
            regVariants.add(`${compact.slice(0, -3)} ${compact.slice(-3)}`);
          }
          const regClauses = Array.from(regVariants).map(v => `vehicle_reg.ilike.%${v}%`).join(',');
          query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},${regClauses}`);
          cartQuery = cartQuery.or(`email.ilike.${term},full_name.ilike.${term},phone.ilike.${term},${regClauses}`);
        }

        const [slRes, cartRes] = await Promise.all([query, cartQuery]);

        if (slRes.error) console.error('Error fetching leads:', slRes.error);
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
          const { data: ownerRows } = await supabase
            .from('sales_leads')
            .select('email, phone, assigned_to')
            .in('email', missingEmails)
            .not('assigned_to', 'is', null)
            .order('created_at', { ascending: false })
            .limit(200);
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
            email: c.email,
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
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchLeads, 300);
    return () => clearTimeout(debounce);
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
    return lead.email.split('@')[0];
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className={cn("gap-2 bg-brand-orange hover:bg-brand-orange-light text-white font-bold text-base px-6 h-12 shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg border-2 border-brand-orange hover:border-brand-orange-light", className)}>
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
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No leads found' : 'No unpaid leads available'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {leads.map((lead) => (
                <button
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

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {lead.vehicle_reg && (
                        <Badge variant="outline" className="text-xs font-mono uppercase">
                          <Car className="h-3 w-3 mr-1" />
                          {lead.vehicle_reg}
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
