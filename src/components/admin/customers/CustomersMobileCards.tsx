import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Car, Calendar, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AnyCustomer {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  registration_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  status?: string | null;
  warranty_type?: string | null;
  plan_type?: string | null;
  signup_date?: string | null;
  created_at?: string | null;
  policy_start_date?: string | null;
  policy_end_date?: string | null;
  final_amount?: number | null;
  price_paid?: number | null;
}

interface CustomersMobileCardsProps {
  customers: AnyCustomer[];
  className?: string;
  onOpen?: (customer: AnyCustomer) => void;
}

const statusTone = (s?: string | null) => {
  const v = (s || '').toLowerCase();
  if (v.includes('cancel') || v.includes('refund')) return 'bg-red-100 text-red-800 border-red-200';
  if (v.includes('active')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (v.includes('claim')) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const safeDate = (d?: string | null) => {
  if (!d) return '';
  try { return format(new Date(d), 'd MMM yyyy'); } catch { return ''; }
};

/**
 * Mobile-only card list for the Customers tab. Shown via `md:hidden`.
 * Read-only spot-check view with tap-to-call. Desktop table is unchanged.
 */
export const CustomersMobileCards: React.FC<CustomersMobileCardsProps> = ({
  customers,
  className,
  onOpen,
}) => {
  if (!customers || customers.length === 0) {
    return (
      <div className={cn('rounded-md border bg-card p-6 text-center text-sm text-muted-foreground', className)}>
        No customers found
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {customers.map((c) => {
        const name =
          c.name ||
          [c.first_name, c.last_name].filter(Boolean).join(' ') ||
          c.email ||
          '—';
        const price = c.final_amount ?? c.price_paid;
        const purchase = safeDate(c.signup_date || c.created_at);
        const expiry = safeDate(c.policy_end_date);

        return (
          <div key={c.id} className="rounded-lg border bg-card shadow-sm p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpen?.(c)}
                  className="text-left"
                >
                  <div className="font-semibold text-sm truncate">{name}</div>
                </button>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px] uppercase font-semibold border', statusTone(c.status))}>
                    {c.status || 'unknown'}
                  </Badge>
                  {(c.warranty_type || c.plan_type) && (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold border bg-blue-50 text-blue-800 border-blue-200">
                      <Shield className="h-2.5 w-2.5 mr-1" />
                      {c.warranty_type || c.plan_type}
                    </Badge>
                  )}
                </div>
              </div>
              {typeof price === 'number' && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Paid</div>
                  <div className="text-sm font-semibold">£{price.toLocaleString()}</div>
                </div>
              )}
            </div>

            {c.registration_plate && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Car className="h-3 w-3" />
                <span className="font-mono uppercase">{c.registration_plate}</span>
                {(c.vehicle_make || c.vehicle_model) && (
                  <span className="truncate">
                    · {[c.vehicle_make, c.vehicle_model].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-full px-2.5 py-1"
                >
                  <Phone className="h-3 w-3" />
                  {c.phone}
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 bg-muted"
                >
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{c.email}</span>
                </a>
              )}
            </div>

            {(purchase || expiry) && (
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                {purchase && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Purchased {purchase}
                  </span>
                )}
                {expiry && (
                  <span className="inline-flex items-center gap-1">
                    Expires {expiry}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
