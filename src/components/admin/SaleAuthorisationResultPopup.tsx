import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealAdminId } from '@/hooks/useCurrentAdminId';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { saleAuthPopupCutoff, isSaleAuthWithinPopupWindow } from '@/lib/saleAuthorisationPopupWindow';

/**
 * Sales agent pop-up: a manager has decided on one of the agent's sales that
 * needed authorisation. Green tick = authorised; neutral X = speak to manager.
 */
export const SaleAuthorisationResultPopup: React.FC = () => {
  const adminId = useRealAdminId();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!adminId) return;
    const { data } = await (supabase as any)
      .from('sale_authorisations')
      .select('id, status, customer_name, warranty_number, paid_amount, decided_by_name, updated_at')
      .eq('agent_admin_id', adminId)
      .is('agent_seen_at', null)
      .gte('updated_at', saleAuthPopupCutoff())
      .order('updated_at', { ascending: false })
      .limit(10);
    setItems((data || []).filter((i: any) => isSaleAuthWithinPopupWindow(i.updated_at)));
  }, [adminId]);

  useEffect(() => {
    if (!adminId) return;
    load();
    return setVisibleInterval(load, 30000);
  }, [adminId, load]);

  const dismiss = async (id: string) => {
    setItems((x) => x.filter((i) => i.id !== id));
    await (supabase as any).from('sale_authorisations').update({ agent_seen_at: new Date().toISOString() }).eq('id', id);
  };

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {items.map((i) => {
        const ok = i.status === 'approved';
        return (
          <div
            key={i.id}
            role="alert"
            className={`rounded-xl border p-3 shadow-lg ${ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-muted text-foreground'}`}
          >
            <div className="flex items-start gap-2">
              {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-semibold">{ok ? 'Sale authorised' : 'Speak to your manager'}</div>
                <div className="text-xs opacity-90">
                  {i.customer_name || 'Customer'}{i.warranty_number ? ` · ${i.warranty_number}` : ''}{i.paid_amount != null ? ` · £${Number(i.paid_amount).toFixed(2)}` : ''}
                </div>
                <div className="text-xs opacity-90">
                  {ok ? `Authorised by ${i.decided_by_name || 'management'}` : `Please speak to ${i.decided_by_name || 'your manager'} about authorising this sale`}
                </div>
              </div>
            </div>
            <Button size="sm" variant={ok ? 'secondary' : 'outline'} className="mt-2 h-7 w-full text-xs" onClick={() => dismiss(i.id)}>
              OK, got it
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default SaleAuthorisationResultPopup;
