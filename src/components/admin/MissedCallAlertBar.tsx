import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneMissed, Phone, Check, X, ChevronDown, ExternalLink, UserPlus, Copy, Volume2, VolumeX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface MissedCall {
  id: string;
  provider: string;
  caller_phone: string | null;
  caller_name: string | null;
  tracking_number: string | null;
  call_status: string | null;
  matched_lead_id: string | null;
  matched_customer_id: string | null;
  status: string;
  created_at: string;
}

interface Props {
  userRole: string | null;
  onOpenLead?: (leadId: string) => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  callrail: 'CallRail',
  zoiper: 'Zoiper',
  dial9: 'Dial9',
};

const MUTE_KEY = 'bw:missed-call-beep-muted';

export const MissedCallAlertBar: React.FC<Props> = ({ userRole, onOpenLead }) => {
  const { toast } = useToast();
  const allowed = ['admin', 'super_admin', 'sales', 'sales_lead', 'lead_gen', 'performance_manager', 'sales_manager', 'claims_agent'].includes(userRole || '');
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [leadOwners, setLeadOwners] = useState<Record<string, { adminId: string | null; name: string | null; active: boolean }>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepTimerRef = useRef<number | null>(null);

  const fetchActive = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('missed_calls')
      .select('id,provider,caller_phone,caller_name,tracking_number,call_status,matched_lead_id,matched_customer_id,status,created_at')
      .eq('status', 'active')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    setCalls((data as MissedCall[]) || []);
  }, []);

  // Resolve current admin
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: au } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (au) {
        setCurrentAdminId(au.id);
        setCurrentAdminName(`${au.first_name || ''} ${au.last_name || ''}`.trim() || au.email || 'you');
      }
    })();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    fetchActive();
    const channel = supabase
      .channel('missed-calls-alert-bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missed_calls' }, () => fetchActive())
      .subscribe();
    const t = window.setInterval(fetchActive, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [allowed, fetchActive]);

  // Load owners for the matched leads currently visible
  useEffect(() => {
    const leadIds = Array.from(new Set(calls.map(c => c.matched_lead_id).filter(Boolean))) as string[];
    if (leadIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('sales_leads')
        .select('id, assigned_to, admin_users:assigned_to(first_name, last_name, email, is_active)')
        .in('id', leadIds);
      const map: Record<string, { adminId: string | null; name: string | null; active: boolean }> = {};
      (data || []).forEach((row: any) => {
        const admin = row.admin_users;
        const name = admin ? (`${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email || null) : null;
        const active = admin ? admin.is_active !== false : true;
        map[row.id] = { adminId: row.assigned_to || null, name, active };
      });
      setLeadOwners(map);
    })();
  }, [calls]);

  const assignToMe = async (call: MissedCall) => {
    if (!call.matched_lead_id || !currentAdminId) return;
    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    const { error: leadErr } = await supabase
      .from('sales_leads')
      .update({ assigned_to: currentAdminId, assigned_at: new Date().toISOString() })
      .eq('id', call.matched_lead_id);
    if (leadErr) {
      toast({ title: 'Could not assign lead', description: leadErr.message, variant: 'destructive' });
      fetchActive();
      return;
    }
    await supabase
      .from('missed_calls')
      .update({ status: 'acknowledged', acknowledged_by: currentAdminId, acknowledged_at: new Date().toISOString() })
      .eq('id', call.id);
    toast({ title: 'Lead assigned to you', description: 'Please call the customer back now.' });
    onOpenLead?.(call.matched_lead_id);
  };

  // For an unmatched missed call there is no existing lead to take, so we mint
  // a fresh sales_leads row from the caller info and assign it to this agent
  // in one click — mirrors the Open Lead Pool "take next lead" flow.
  const takeUnmatched = async (call: MissedCall) => {
    if (!currentAdminId) return;
    if (call.matched_lead_id) return; // safety
    const phoneDigits = (call.caller_phone || '').replace(/[^\d]/g, '');
    // email is NOT NULL on sales_leads — synthesize a stable placeholder so the
    // insert succeeds; the agent can edit it once they speak to the customer.
    const placeholderEmail = phoneDigits
      ? `missed-call-${phoneDigits}-${Date.now().toString(36)}@buyawarranty.internal`
      : `missed-call-${call.id}@buyawarranty.internal`;
    const rawName = (call.caller_name || '').trim();
    const firstName = rawName && rawName.toLowerCase() !== 'unavailable' ? rawName.split(' ')[0] : null;
    const lastName = rawName && rawName.toLowerCase() !== 'unavailable' && rawName.includes(' ')
      ? rawName.split(' ').slice(1).join(' ')
      : null;

    setCalls((prev) => prev.filter((c) => c.id !== call.id));
    const { data: inserted, error: insErr } = await supabase
      .from('sales_leads')
      .insert({
        email: placeholderEmail,
        first_name: firstName,
        last_name: lastName,
        phone: call.caller_phone || null,
        status: 'new',
        assigned_to: currentAdminId,
        assigned_at: new Date().toISOString(),
        lead_source: 'callrail_missed_call',
        notes: `Auto-created from missed CallRail call at ${new Date(call.created_at).toLocaleString()}${call.tracking_number ? ` on ${call.tracking_number}` : ''}.`,
      } as any)
      .select('id')
      .maybeSingle();

    if (insErr || !inserted) {
      toast({
        title: 'Could not take the call',
        description: insErr?.message || 'Unable to create the lead. Please refresh.',
        variant: 'destructive',
      });
      fetchActive();
      return;
    }

    await supabase
      .from('missed_calls')
      .update({
        status: 'acknowledged',
        acknowledged_by: currentAdminId,
        acknowledged_at: new Date().toISOString(),
        matched_lead_id: inserted.id,
      })
      .eq('id', call.id);

    toast({
      title: 'Lead taken — call the customer back',
      description: `${call.caller_phone || 'Unknown number'} is now yours. Update their details after the call.`,
    });
    onOpenLead?.(inserted.id);
  };

  const acknowledge = async (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase
      .from('missed_calls')
      .update({ status: 'acknowledged', acknowledged_by: currentAdminId, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
  };

  const dismiss = async (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase
      .from('missed_calls')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
  };

  const copyNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: 'Number copied', description: phone });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  // Periodic beep while any missed calls are active (respects mute + user gesture)
  useEffect(() => {
    const active = allowed && calls.length > 0 && !muted;
    const playBeep = () => {
      try {
        if (!audioCtxRef.current) {
          const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
          if (!Ctx) return;
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current!;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } catch { /* ignore */ }
    };
    if (active) {
      playBeep();
      beepTimerRef.current = window.setInterval(playBeep, 4000);
    }
    return () => {
      if (beepTimerRef.current) { window.clearInterval(beepTimerRef.current); beepTimerRef.current = null; }
    };
  }, [allowed, calls.length, muted]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  if (!allowed || calls.length === 0) return null;

  const top = calls[0];
  const extra = calls.length - 1;
  const provider = PROVIDER_LABEL[top.provider] || top.provider;
  const who = top.caller_name || top.caller_phone || 'Unknown caller';
  const ago = formatDistanceToNow(new Date(top.created_at), { addSuffix: true });
  const telHref = top.caller_phone ? `tel:${top.caller_phone.replace(/\s/g, '')}` : null;
  const owner = top.matched_lead_id ? leadOwners[top.matched_lead_id] : undefined;
  const ownedByMe = !!(owner && currentAdminId && owner.adminId === currentAdminId);
  const ownerInactive = !!(owner?.adminId && owner.active === false);
  const canClaim = !!top.matched_lead_id && (!owner?.adminId || ownerInactive);
  const canTakeUnmatched = !top.matched_lead_id && !!currentAdminId;

  return (
    <div className="relative mb-2 rounded-md bwmc-halo">
      <style>{`
        @keyframes bwmc-halo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.85), 0 0 0 0 rgba(251, 191, 36, 0.6); }
          50%      { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.0),  0 0 24px 8px rgba(251, 191, 36, 0.55); }
        }
        .bwmc-halo { animation: bwmc-halo-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="bg-blue-600 text-white shadow-lg border-b-2 border-blue-800 rounded-md">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PhoneMissed className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium break-words">
            <span className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-blue-950 text-[11px] font-black tracking-wide uppercase">🔥 Hot inbound</span>
            Missed call — call back now from <strong>{who}</strong>
            {top.caller_phone && top.caller_name && (
              <span className="opacity-90 inline-flex items-center gap-1 align-middle">
                {' · '}
                <a
                  href={telHref || undefined}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-sm"
                  title="Call this number"
                >
                  {top.caller_phone}
                </a>
                <button
                  type="button"
                  onClick={() => copyNumber(top.caller_phone!)}
                  className="inline-flex items-center justify-center rounded p-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  title="Copy number"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="opacity-75"> · {ago}</span>
            {top.matched_lead_id && (
              <span className={`ml-2 px-2 py-0.5 rounded text-[11px] font-semibold ${ownerInactive ? 'bg-amber-500 text-blue-950' : 'bg-blue-800'}`}>
                {!owner?.adminId
                  ? 'Unassigned lead'
                  : ownedByMe
                    ? 'Your lead'
                    : ownerInactive
                      ? `Previous owner ${owner.name || 'agent'} (left) — up for grabs`
                      : `Owned by ${owner.name || 'agent'}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {telHref && (
            <a
              href={telHref}
              className="bg-white text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> Call back
            </a>
          )}
          {canClaim && (
            <button
              onClick={() => assignToMe(top)}
              className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
              title="Take ownership of this lead and call the customer back"
            >
              <UserPlus className="h-3.5 w-3.5" /> Assign to me
            </button>
          )}
          {canTakeUnmatched && (
            <button
              onClick={() => takeUnmatched(top)}
              className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
              title="Create a lead from this caller and assign it to you"
            >
              <UserPlus className="h-3.5 w-3.5" /> Take lead
            </button>
          )}
          {top.matched_lead_id && onOpenLead && (
            <button
              onClick={() => onOpenLead(top.matched_lead_id!)}
              className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open lead
            </button>
          )}
          {!canClaim && !canTakeUnmatched && (
            <button
              onClick={() => acknowledge(top.id)}
              className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
              title="Mark as seen"
            >
              <Check className="h-3.5 w-3.5" /> Got it
            </button>
          )}
          <button
            onClick={toggleMute}
            className="bg-blue-700 hover:bg-blue-800 p-1.5 rounded"
            title={muted ? 'Unmute beep' : 'Mute beep'}
            aria-label={muted ? 'Unmute beep' : 'Mute beep'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => dismiss(top.id)}
            className="bg-blue-700 hover:bg-blue-800 p-1.5 rounded"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          {extra > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-blue-800 hover:bg-blue-900 px-2.5 py-1.5 rounded text-sm font-semibold inline-flex items-center gap-1">
                +{extra} more <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-md w-96">
                {calls.slice(1).map((c) => {
                  const cOwner = c.matched_lead_id ? leadOwners[c.matched_lead_id] : undefined;
                  const cOwnerInactive = !!(cOwner?.adminId && cOwner.active === false);
                  const cCanClaim = !!c.matched_lead_id && (!cOwner?.adminId || cOwnerInactive);
                  const cCanTakeUnmatched = !c.matched_lead_id && !!currentAdminId;
                  return (
                    <DropdownMenuItem key={c.id} className="flex flex-col items-start gap-1 cursor-default" onSelect={(e) => e.preventDefault()}>
                      <div className="text-sm font-medium">
                        🔥 {c.caller_name || c.caller_phone || 'Unknown caller'}
                      </div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1 flex-wrap">
                        {c.caller_phone ? (
                          <>
                            <a href={`tel:${c.caller_phone.replace(/\s/g, '')}`} className="hover:underline">
                              {c.caller_phone}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyNumber(c.caller_phone!)}
                              className="inline-flex items-center justify-center rounded p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              title="Copy number"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </>
                        ) : ''}
                        {' · '}{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        {c.matched_lead_id && (
                          <span className="ml-2">
                            {!cOwner?.adminId
                              ? 'Unassigned'
                              : cOwnerInactive
                                ? `Previous owner ${cOwner.name || 'agent'} (left) — up for grabs`
                                : `Owned by ${cOwner.name || 'agent'}`}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {c.caller_phone && (
                          <a href={`tel:${c.caller_phone.replace(/\s/g, '')}`} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Call</a>
                        )}
                        {cCanClaim && (
                          <button onClick={() => assignToMe(c)} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded font-semibold">Assign to me</button>
                        )}
                        {cCanTakeUnmatched && (
                          <button onClick={() => takeUnmatched(c)} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded font-semibold">Take lead</button>
                        )}
                        {c.matched_lead_id && onOpenLead && (
                          <button onClick={() => onOpenLead(c.matched_lead_id!)} className="text-xs bg-gray-200 px-2 py-1 rounded">Open lead</button>
                        )}
                        {!cCanClaim && !cCanTakeUnmatched && (
                          <button onClick={() => acknowledge(c.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Got it</button>
                        )}
                        <button onClick={() => dismiss(c.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Dismiss</button>
                        <button onClick={() => dismiss(c.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Dismiss</button>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
