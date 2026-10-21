import { useEffect, useState } from 'react';
import { gatewayRequest } from '@/lib/loginGateway';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';

export function GatewayRenewalBanner({ role, onOpen }: { role: string | null; onOpen: () => void }) {
  const [due, setDue] = useState<string | null>(null);
  useEffect(() => {
    if (!['admin', 'super_admin'].includes(role ?? '')) return;
    const check = () => gatewayRequest({ action: 'status' }).then(data => setDue(data.can_manage && Date.parse(data.due_at) <= Date.now() + 14 * 86400000 ? data.due_at : null)).catch(() => {});
    void check();
    window.addEventListener('focus', check);
    window.addEventListener('gateway-password-changed', check);
    return () => { window.removeEventListener('focus', check); window.removeEventListener('gateway-password-changed', check); };
  }, [role]);
  if (!due || !['admin', 'super_admin'].includes(role ?? '')) return null;
  return <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-destructive bg-background p-3 text-foreground">
    <KeyRound className="h-5 w-5 text-destructive" />
    <p className="flex-1 text-sm"><strong>Gateway password renewal {Date.parse(due) <= Date.now() ? 'overdue' : 'due soon'}.</strong> Change by {new Date(due).toLocaleDateString('en-GB')}.</p>
    <Button size="sm" onClick={onOpen}>Change gateway password</Button>
  </div>;
}