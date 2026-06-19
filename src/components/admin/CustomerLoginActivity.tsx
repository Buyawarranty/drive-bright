import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  KeyRound,
  ShieldCheck,
  UserCog,
  Mail,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface LoginEvent {
  id: string;
  source: 'app' | 'supabase_auth';
  event_type: string;
  success: boolean;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  triggered_by_admin_id?: string | null;
}

interface Props {
  email: string;
  customerId: string;
}

const EVENT_LABELS: Record<string, string> = {
  login_success: 'Login success',
  login_failed: 'Login failed',
  password_reset_requested: 'Password reset requested',
  credentials_resent: 'Credentials resent (Forgot Password)',
  admin_password_reset: 'Admin sent password reset',
  admin_impersonate: 'Admin impersonated customer',
  admin_magic_link: 'Admin sent magic link',
  admin_details_edited: 'Admin edited customer details',
  user_signedup: 'Signed up',
  user_recovery_requested: 'Auth: recovery requested',
  user_updated_password: 'Auth: password updated',
  login: 'Auth: login',
  logout: 'Auth: logout',
  token_refreshed: 'Auth: token refreshed',
  user_modified: 'Auth: user modified',
};

const iconFor = (ev: LoginEvent) => {
  if (ev.event_type.startsWith('admin_')) return <UserCog className="h-4 w-4 text-blue-600" />;
  if (ev.event_type.includes('password') || ev.event_type.includes('credentials'))
    return <KeyRound className="h-4 w-4 text-amber-600" />;
  if (ev.event_type === 'login_success' || ev.success)
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (ev.event_type === 'login_failed' || !ev.success)
    return <XCircle className="h-4 w-4 text-red-600" />;
  return <ShieldCheck className="h-4 w-4 text-muted-foreground" />;
};

const shortDevice = (ua?: string | null) => {
  if (!ua) return '';
  const lower = ua.toLowerCase();
  const browser = lower.includes('edg/') ? 'Edge'
    : lower.includes('chrome') ? 'Chrome'
    : lower.includes('safari') ? 'Safari'
    : lower.includes('firefox') ? 'Firefox'
    : 'Browser';
  const os = lower.includes('windows') ? 'Windows'
    : lower.includes('mac os') || lower.includes('macintosh') ? 'Mac'
    : lower.includes('iphone') || lower.includes('ios') ? 'iOS'
    : lower.includes('android') ? 'Android'
    : lower.includes('linux') ? 'Linux'
    : '';
  return os ? `${browser} / ${os}` : browser;
};

export const CustomerLoginActivity: React.FC<Props> = ({ email, customerId }) => {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-login-history', {
        body: { email, customer_id: customerId },
      });
      if (error) throw error;
      setEvents((data as any)?.events ?? []);
    } catch (e) {
      console.error('Failed to load login history', e);
    } finally {
      setLoading(false);
    }
  }, [email, customerId]);

  useEffect(() => {
    if (email || customerId) load();
  }, [email, customerId, load]);

  const exportCsv = () => {
    const rows = [
      ['Timestamp', 'Source', 'Event', 'Success', 'Email', 'IP', 'Device', 'Failure reason'],
      ...events.map(e => [
        e.created_at,
        e.source,
        e.event_type,
        e.success ? 'yes' : 'no',
        e.email,
        e.ip_address ?? '',
        shortDevice(e.user_agent),
        e.failure_reason ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-history-${email}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-border rounded-lg">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
            Recent login activity
            <Badge variant="secondary" className="ml-1">{events.length}</Badge>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 px-2">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!events.length} className="h-7 px-2">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {loading && events.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && events.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No login activity yet for this customer.
              </div>
            )}
            {events.map(ev => (
              <div key={ev.id} className="px-3 py-2 text-sm flex items-start gap-2 hover:bg-muted/30">
                <div className="pt-0.5">{iconFor(ev)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {EVENT_LABELS[ev.event_type] || ev.event_type}
                    </span>
                    {ev.success ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">success</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">failed</Badge>
                    )}
                    {ev.source === 'supabase_auth' && (
                      <Badge variant="outline" className="text-xs">auth</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span title={format(new Date(ev.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                    </span>
                    {ev.ip_address && <> · IP {ev.ip_address}</>}
                    {ev.user_agent && <> · {shortDevice(ev.user_agent)}</>}
                  </div>
                  {ev.failure_reason && (
                    <div className="text-xs text-red-600 mt-0.5">Reason: {ev.failure_reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default CustomerLoginActivity;
