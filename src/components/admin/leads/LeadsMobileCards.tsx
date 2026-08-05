import React, { useMemo, useState } from 'react';
import { Lead } from '@/hooks/useLeads';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Car, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeadDetailsPanel } from './LeadDetailsPanel';
import { useRepeatCustomers } from '@/hooks/useRepeatCustomers';
import { RepeatCustomerBadge } from './RepeatCustomerBadge';
import { ManualLeadBadge } from './ManualLeadBadge';

interface LeadsMobileCardsProps {
  leads: Lead[];
  className?: string;
  quotesByEmail?: Record<string, any[]>;
  onLogActivity: (leadId: string, type: string, description: string) => void;
  onUpdateNotes: (leadId: string, notes: string, replaceAll?: boolean) => void | Promise<void>;
  onRefresh?: () => void;
  onSendQuote?: (lead: Lead) => void;
}

const statusTone: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-amber-100 text-amber-800 border-amber-200',
  qualified: 'bg-violet-100 text-violet-800 border-violet-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-slate-100 text-slate-700 border-slate-200',
  fake_lead: 'bg-red-100 text-red-800 border-red-200',
};

/**
 * Mobile-only card list for the leads tab. Shown on small screens via `md:hidden`.
 * Designed for spot-check use: key info at a glance + tap-to-call + tap-to-expand details.
 * Does NOT replace the desktop table — that path is unchanged.
 */
export const LeadsMobileCards: React.FC<LeadsMobileCardsProps> = ({
  leads,
  className,
  quotesByEmail = {},
  onLogActivity,
  onUpdateNotes,
  onRefresh,
  onSendQuote,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { repeatByLeadId } = useRepeatCustomers(
    useMemo(() => leads.map(l => ({ id: l.id, email: l.email, vehicle_reg: l.vehicle_reg, created_at: l.created_at })), [leads])
  );

  if (leads.length === 0) {
    return (
      <div className={cn('rounded-md border bg-card p-6 text-center text-sm text-muted-foreground', className)}>
        No leads found
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {leads.map((lead) => {
        const name = lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—';
        const isOpen = expanded === lead.id;
        const tone = statusTone[lead.status] || 'bg-slate-100 text-slate-700 border-slate-200';
        const leadDate = lead.created_at ? format(new Date(lead.created_at), 'd MMM, HH:mm') : '';

        return (
          <div
            key={lead.id}
            className="rounded-lg border bg-card shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : lead.id)}
              className="w-full text-left p-3 active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{name}</span>
                    <Badge variant="outline" className={cn('text-[10px] uppercase font-semibold border', tone)}>
                      {lead.status?.replace(/_/g, ' ')}
                    </Badge>
                    {lead.is_paid && (
                      <Badge className="bg-emerald-600 text-white text-[10px]">Paid</Badge>
                    )}
                    {repeatByLeadId[lead.id] ? (
                      <RepeatCustomerBadge info={repeatByLeadId[lead.id]} />
                    ) : (lead as any).manual_entry ? (
                      <ManualLeadBadge />
                    ) : null}
                  </div>
                  {lead.vehicle_reg && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span className="font-mono uppercase">{lead.vehicle_reg}</span>
                      {(lead.vehicle_make || lead.vehicle_model) && (
                        <span className="truncate">
                          · {[lead.vehicle_make, lead.vehicle_model].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>
                  )}
                  {leadDate && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {leadDate}
                    </div>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-full px-2.5 py-1"
                  >
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 bg-muted"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[180px]">{lead.email}</span>
                  </a>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/20">
                <LeadDetailsPanel
                  lead={lead}
                  onUpdateNotes={onUpdateNotes}
                  onLogActivity={onLogActivity}
                  onRefresh={onRefresh}
                  onNavigateToQuote={onSendQuote ? () => onSendQuote(lead) : undefined}
                  hasQuotesSent={(quotesByEmail[lead.email?.toLowerCase()] || []).length > 0}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
