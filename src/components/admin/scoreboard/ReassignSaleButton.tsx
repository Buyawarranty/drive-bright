import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCog, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { SaleCreditOverrideDialog } from './SaleCreditOverrideDialog';

interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  registration_plate: string | null;
  final_amount: number | null;
  created_at: string;
  assigned_to: string | null;
  payment_confirmed_by: string | null;
  quote_sent_by: string | null;
  sale_credit_admin_user_id: string | null;
}

interface AdminMap { [id: string]: string }

export const ReassignSaleButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [admins, setAdmins] = useState<AdminMap>({});
  const [loading, setLoading] = useState(false);
  const [override, setOverride] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .in('role', ['sales', 'sales_lead']);
      const map: AdminMap = {};
      (data || []).forEach((u: any) => {
        map[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
      });
      setAdmins(map);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      let q = supabase
        .from('customers')
        .select('id, name, email, registration_plate, final_amount, created_at, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      const term = search.trim();
      if (term) {
        const like = `%${term}%`;
        const compact = term.replace(/\s+/g, '').toUpperCase();
        const regVariants = new Set<string>([term]);
        if (compact.length >= 5) {
          regVariants.add(compact);
          regVariants.add(`${compact.slice(0, -3)} ${compact.slice(-3)}`);
        }
        const regClauses = Array.from(regVariants).map(v => `registration_plate.ilike.%${v}%`).join(',');
        q = q.or(`name.ilike.${like},email.ilike.${like},${regClauses}`);
      }
      const { data } = await q;
      if (!cancelled) setRows((data || []) as any);
      setLoading(false);
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, search]);

  const creditedTo = (c: CustomerRow) =>
    c.sale_credit_admin_user_id || c.payment_confirmed_by || c.quote_sent_by || c.assigned_to;

  const refreshRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog className="h-4 w-4 mr-2" />
        Reassign a sale
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reassign sale credit</DialogTitle>
            <DialogDescription>
              Search any recent sale and give credit to the correct agent.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or reg plate…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-96 overflow-y-auto divide-y border rounded-md">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No sales found.</div>
            ) : (
              rows.map(c => {
                const creditId = creditedTo(c);
                const creditName = creditId ? (admins[creditId] || 'Unknown') : 'Unassigned';
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.name || c.email || '(no name)'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {c.registration_plate && (
                          <span className="font-mono bg-yellow-50 border border-yellow-300 text-yellow-800 px-1.5 rounded">
                            {c.registration_plate}
                          </span>
                        )}
                        <span>{format(new Date(c.created_at), 'dd MMM yyyy')}</span>
                        <span>· Credit: <strong>{creditName}</strong></span>
                        {c.sale_credit_admin_user_id && (
                          <span className="text-[10px] uppercase bg-secondary px-1.5 py-0.5 rounded">overridden</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-semibold text-emerald-600 text-sm">£{(c.final_amount || 0).toLocaleString()}</span>
                      <Button size="sm" variant="ghost" onClick={() => setOverride(c)}>
                        <UserCog className="h-3.5 w-3.5 mr-1" />
                        Reassign
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {override && (
        <SaleCreditOverrideDialog
          open={!!override}
          onOpenChange={(o) => { if (!o) setOverride(null); }}
          customerId={override.id}
          customerName={override.name || override.email}
          currentCreditAdminUserId={override.sale_credit_admin_user_id}
          defaultAgentId={override.assigned_to}
          onSaved={() => {
            const id = override.id;
            setOverride(null);
            refreshRow(id);
          }}
        />
      )}
    </>
  );
};

export default ReassignSaleButton;
