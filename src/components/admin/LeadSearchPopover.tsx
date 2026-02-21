import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Phone, Mail, Car, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  // Fetch leads when popover opens or search term changes
  useEffect(() => {
    if (!open) return;

    const fetchLeads = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('sales_leads')
          .select('id, first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage, plan_interest')
          .eq('is_paid', false)
          .order('created_at', { ascending: false })
          .limit(50);

        if (searchTerm) {
          const term = `%${searchTerm}%`;
          query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},vehicle_reg.ilike.${term}`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching leads:', error);
          return;
        }

        setLeads(data || []);
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
    onSelectLead(lead);
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
                      <div className="font-medium text-sm truncate">
                        {getDisplayName(lead)}
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
