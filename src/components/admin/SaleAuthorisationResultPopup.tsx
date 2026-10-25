import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRealAdminId } from '@/hooks/useCurrentAdminId';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { usePopupLeadOwnership } from '@/hooks/usePopupLeadOwnership';
import { useViewAs } from '@/contexts/ViewAsContext';
import { isSalesPopupRole } from '@/lib/popupAccess';
import {
  saleAuthPopupCutoff,
  isSaleAuthWithinPopupWindow,
  saleAuthAgentActions,
} from '@/lib/saleAuthorisationPopupWindow';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';

/**
 * Sales agent pop-up: a manager has decided on one of the agent's sales that
 * needed authorisation. Green tick = authorised; neutral X = speak to manager.
 *
 * It lives in the Live Alerts rail on the left — never the right or bottom
 * corner. It reappears on every dashboard visit (re-checked every 30 seconds)
 * until the agent replies with one of the action buttons, and stops after 3
 * days. The reply is stored on the record for management.
 */
export const SaleAuthorisationResultPopup: React.FC = () => {
  const adminId = useRealAdminId();
  const [items, setItems] = useState<any[]>([]);
  const { effectiveRole } = useViewAs();
  const canShow = usePopupLeadOwnership(items.flatMap(i => i.lead_id ? [i.lead_id] : []));
  const visibleItems = items.filter(i => canShow(i.lead_id));

  const load = useCallback(async () => {
    if (!adminId) return;
    const { data } = await (supabase as any)
      .from('sale_authorisations')
      .select('id, policy_id, status, customer_name, warranty_number, paid_amount, decided_by_name, updated_at')
      .eq('agent_admin_id', adminId)
      .is('agent_seen_at', null)
      .gte('updated_at', saleAuthPopupCutoff())
      .order('updated_at', { ascending: false })
      .limit(10);
    const recent = (data || []).filter((i: any) => isSaleAuthWithinPopupWindow(i.updated_at));
    if (!isSalesPopupRole(effectiveRole)) { setItems(recent); return; }
    // Recipient history is not ownership: resolve the policy's customer to today's lead.
    const resolved = await Promise.all(recent.map(async (item: any) => {
      try {
        const { data: policy } = await supabase.from('customer_policies').select('customer_id').eq('id', item.policy_id).maybeSingle();
        if (!policy?.customer_id) return { ...item, lead_id: null };
        const { data: customer } = await supabase.from('customers').select('email, phone').eq('id', policy.customer_id).maybeSingle();
        const phone9 = (customer?.phone || '').replace(/\D/g, '').slice(-9);
        const { data: leads } = await supabase.rpc('find_lead_owner_by_contact', {
          _email: customer?.email?.trim().toLowerCase() || null,
          _phone9: phone9.length === 9 ? phone9 : null,
        });
        return { ...item, lead_id: leads?.[0]?.id || null };
      } catch { return { ...item, lead_id: null }; }
    }));
    setItems(resolved);
  }, [adminId, effectiveRole]);

  useEffect(() => {
    if (!adminId) return;
    load();
    return setVisibleInterval(load, 30000);
  }, [adminId, load]);

  const respond = async (
    id: string,
    response: 'accepted' | 'will_speak_to_manager' | 'acknowledged',
  ) => {
    setItems((x) => x.filter((i) => i.id !== id));
    await (supabase as any)
      .from('sale_authorisations')
      .update({ agent_response: response, agent_seen_at: new Date().toISOString() })
      .eq('id', id);
  };

  if (!visibleItems.length) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.saleAuthorisationResult}>
      <div className="flex flex-col gap-2">
        {visibleItems.map((i) => {
          const ok = i.status === 'approved';
          return (
            <div
              key={i.id}
              role="alert"
              className={`alert-scroll-x rounded-xl border p-3 shadow-sm ${
                ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-muted text-foreground'
              }`}
            >
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">{ok ? 'Sale authorised' : 'Speak to your manager'}</div>
                  <div className="text-xs opacity-90">
                    {i.customer_name || 'Customer'}
                    {i.warranty_number ? ` · ${i.warranty_number}` : ''}
                    {i.paid_amount != null ? ` · £${Number(i.paid_amount).toFixed(2)}` : ''}
                  </div>
                  <div className="text-xs opacity-90">
                    {ok
                      ? `Authorised by ${i.decided_by_name || 'management'}`
                      : `Please speak to ${i.decided_by_name || 'your manager'} about authorising this sale`}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {saleAuthAgentActions(i.status).map((a) => (
                  <Button
                    key={a.key}
                    size="sm"
                    variant={a.variant}
                    className="h-7 px-2.5 text-xs font-semibold"
                    onClick={() => respond(i.id, a.key)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AlertRailSlot>
  );
};

export default SaleAuthorisationResultPopup;
