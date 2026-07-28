import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneMissed, Phone, Check, X, ExternalLink, UserPlus, Copy, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { dialWithZoiper } from '@/utils/zoiperDial';

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
  offered_to: string | null;
  offer_expires_at: string | null;
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
const HIDDEN_KEY = 'bw:missed-call-hidden-ids';

const loadHidden = (): string[] => {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
};
const saveHidden = (ids: string[]) => {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-200))); } catch { /* ignore */ }
};

export const MissedCallAlertBar: React.FC<Props> = ({ userRole, onOpenLead }) => {
  const { toast } = useToast();
  const allowed = ['admin', 'super_admin', 'sales', 'sales_lead', 'lead_gen', 'performance_manager', 'sales_manager', 'claims_agent'].includes(userRole || '');
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(loadHidden()));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [leadOwners, setLeadOwners] = useState<Record<string, { adminId: string | null; name: string | null; active: boolean; isPaid: boolean; status: string | null }>>({});
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminName, setCurrentAdminName] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepTimerRef = useRef<number | null>(null);

  /** Hide locally first so the card always closes, even if the DB write fails. */
  const hideLocally = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveHidden(Array.from(next));
      return next;
    });
    setCalls((prev) => prev.filter((c) => c.id !== id));
  }, []);


  const fetchActive = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('missed_calls')
      .select('id,provider,caller_phone,caller_name,tracking_number,call_status,matched_lead_id,matched_customer_id,status,created_at,offered_to,offer_expires_at')
      .eq('status', 'active')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    setCalls(((data as MissedCall[]) || []).filter((c) => !hiddenIds.has(c.id)));
  }, [hiddenIds]);


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

  // Rotating offer: each waiting call is offered to ONE agent for 10 seconds.
  // If they don't accept, the server hands it to the next agent, looping round
  // until someone takes it — so two people can never ring the same customer.
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase.rpc('missed_call_rotate_offers' as any);
      if (!cancelled && (data as number | null)) fetchActive();
    };
    tick();
    const t = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [allowed, fetchActive]);

  // Local 1s ticker so the countdown on the offer is live.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const passCall = useCallback(async (id: string) => {
    // Not a permanent hide — the server may loop it back if nobody takes it.
    setCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase.rpc('missed_call_pass' as any, { p_call_id: id });
    fetchActive();
  }, [fetchActive]);


  // Load owners for the matched leads currently visible
  useEffect(() => {
    const leadIds = Array.from(new Set(calls.map(c => c.matched_lead_id).filter(Boolean))) as string[];
    if (leadIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('sales_leads')
        .select('id, assigned_to, is_paid, status, admin_users:assigned_to(first_name, last_name, email, is_active)')
        .in('id', leadIds);
      const map: Record<string, { adminId: string | null; name: string | null; active: boolean; isPaid: boolean; status: string | null }> = {};
      (data || []).forEach((row: any) => {
        const admin = row.admin_users;
        const name = admin ? (`${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email || null) : null;
        const active = admin ? admin.is_active !== false : true;
        map[row.id] = {
          adminId: row.assigned_to || null,
          name,
          active,
          isPaid: !!row.is_paid,
          status: row.status || null,
        };
      });
      setLeadOwners(map);
    })();
  }, [calls]);

  /**
   * Atomic claim gate. The FIRST agent to flip this missed_calls row from
   * 'active' to 'acknowledged' owns it — everyone else's conditional update
   * matches zero rows and they get told it's gone. This runs BEFORE any lead
   * is created/assigned or any dial happens, so two agents can never take the
   * same inbound call.
   */
  const claimCallRow = async (call: MissedCall): Promise<boolean> => {
    if (!currentAdminId) return false;
    const { data, error } = await supabase
      .from('missed_calls')
      .update({
        status: 'acknowledged',
        acknowledged_by: currentAdminId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', call.id)
      .eq('status', 'active')
      .select('id');
    if (error) {
      toast({ title: 'Could not take the call', description: error.message, variant: 'destructive' });
      return false;
    }
    if (!data || data.length === 0) {
      hideLocally(call.id);
      toast({
        title: 'Taken by another agent',
        description: 'Someone else got to this call first.',
        variant: 'destructive',
      });
      fetchActive();
      return false;
    }
    return true;
  };

  const assignToMe = async (call: MissedCall): Promise<boolean> => {
    if (!call.matched_lead_id || !currentAdminId) return false;
    // Win the race first — if we lose, nothing else happens.
    if (!(await claimCallRow(call))) return false;
    hideLocally(call.id);

    // Only take the lead if it is still free (or the previous owner has left).
    const prevOwnerId = leadOwners[call.matched_lead_id]?.adminId ?? null;
    let q = supabase
      .from('sales_leads')
      .update({ assigned_to: currentAdminId, assigned_at: new Date().toISOString() })
      .eq('id', call.matched_lead_id);
    q = prevOwnerId ? q.eq('assigned_to', prevOwnerId) : q.is('assigned_to', null);
    const { data: updated, error: leadErr } = await q.select('id');
    if (leadErr) {
      toast({ title: 'Could not assign lead', description: leadErr.message, variant: 'destructive' });
      fetchActive();
      return false;
    }
    if (!updated || updated.length === 0) {
      toast({
        title: 'Taken by another agent',
        description: 'This lead was claimed a moment ago — opening it read-only.',
        variant: 'destructive',
      });
      onOpenLead?.(call.matched_lead_id);
      return false;
    }
    toast({ title: 'Lead is now yours', description: 'Please call the customer back now.' });
    onOpenLead?.(call.matched_lead_id);
    return true;
  };

  // For an unmatched missed call there is no existing lead to take, so we mint
  // a fresh sales_leads row from the caller info and assign it to this agent
  // in one click — mirrors the Open Lead Pool "take next lead" flow.
  const takeUnmatched = async (call: MissedCall): Promise<boolean> => {
    if (!currentAdminId) return false;
    if (call.matched_lead_id) return false; // safety
    // Atomic gate: only one agent can ever get past this point for this call.
    if (!(await claimCallRow(call))) return false;

    const phoneDigits = (call.caller_phone || '').replace(/[^\d]/g, '');

    // Duplicate guard: if a sales_leads row already exists for this phone
    // (matched on the trailing 10 digits to ignore country-code variants),
    // never mint a new one. Link the missed call to that existing lead and
    // either open it (if owned by me / unassigned) or refuse (if owned by
    // another active agent — this caller is already in someone's pipeline).
    if (phoneDigits.length >= 7) {
      const tail = phoneDigits.slice(-10);
      const { data: existingLeads } = await supabase
        .from('sales_leads')
        .select('id, assigned_to, first_name, last_name, status, last_contacted_at, last_activity_date, admin_users:assigned_to(first_name, last_name, email, is_active)')
        .ilike('phone', `%${tail}%`)
        .limit(5);
      const existing = (existingLeads || [])[0] as any;
      if (existing) {
        // Recent-contact guard: if this lead was contacted within the last 24h,
        // do NOT take it (even if it's mine) — surface the last-contacted time so
        // the agent can decide whether to open it or leave it alone.
        const lastContactRaw = existing.last_contacted_at || existing.last_activity_date;
        if (lastContactRaw) {
          const lastContactMs = Date.now() - new Date(lastContactRaw).getTime();
          if (lastContactMs < 24 * 60 * 60 * 1000) {
            await supabase
              .from('missed_calls')
              .update({ matched_lead_id: existing.id })
              .eq('id', call.id);
            setCalls((prev) => prev.filter((c) => c.id !== call.id));
            const rel = formatDistanceToNow(new Date(lastContactRaw), { addSuffix: true });
            toast({
              title: 'Already contacted recently',
              description: `Last contacted ${rel}. Not creating a duplicate — open the existing lead if you need to follow up.`,
              variant: 'destructive',
            });
            fetchActive();
            return;
          }
        }

        // Link missed call to the existing lead so it stops re-surfacing as unmatched
        await supabase
          .from('missed_calls')
          .update({ matched_lead_id: existing.id })
          .eq('id', call.id);

        const ownerId = existing.assigned_to as string | null;
        const ownerActive = existing.admin_users ? existing.admin_users.is_active !== false : true;
        const ownerName = existing.admin_users
          ? (`${existing.admin_users.first_name || ''} ${existing.admin_users.last_name || ''}`.trim() || existing.admin_users.email || 'another agent')
          : 'another agent';

        if (ownerId && ownerId !== currentAdminId && ownerActive) {
          // Owned by another active agent — do not take, do not create a duplicate
          setCalls((prev) => prev.filter((c) => c.id !== call.id));
          toast({
            title: 'Already in pipeline',
            description: `This caller is an existing lead owned by ${ownerName}. Not taking a duplicate.`,
            variant: 'destructive',
          });
          fetchActive();
          return;
        }

        // Mine, unassigned, or owner has left — claim/open the existing lead
        if (!ownerId || !ownerActive) {
          await supabase
            .from('sales_leads')
            .update({ assigned_to: currentAdminId, assigned_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
        await supabase
          .from('missed_calls')
          .update({
            status: 'acknowledged',
            acknowledged_by: currentAdminId,
            acknowledged_at: new Date().toISOString(),
          })
          .eq('id', call.id);
        setCalls((prev) => prev.filter((c) => c.id !== call.id));
        toast({
          title: ownerId === currentAdminId ? 'Already your lead — opening it' : 'Existing lead — opened and assigned to you',
          description: 'Continuing on the existing pipeline record; no duplicate created.',
        });
        onOpenLead?.(existing.id);
        return;
      }
    }

    // No existing lead — mint a fresh one.
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
    hideLocally(id);
    const { error } = await supabase
      .from('missed_calls')
      .update({ status: 'acknowledged', acknowledged_by: currentAdminId, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.warn('missed_calls acknowledge failed (hidden locally):', error.message);
  };

  const dismiss = async (id: string) => {
    hideLocally(id);
    const { error } = await supabase
      .from('missed_calls')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.warn('missed_calls dismiss failed (hidden locally):', error.message);
  };


  const copyNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: 'Number copied', description: phone });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  // A matched lead that is already a paid/converted sale, or has moved past the
  // "new" state (contacted, callback, lost, fake, upsold, etc), must NEVER
  // surface as a hot inbound — the customer relationship is already owned and
  // tracked elsewhere. Only genuinely fresh (status new/null AND unpaid) leads
  // remain eligible.
  const isMatchedLeadStillNew = (leadId: string | null): boolean => {
    if (!leadId) return true; // unmatched — treated as fresh
    const o = leadOwners[leadId];
    if (!o) return false; // not loaded yet — hide until known
    if (o.isPaid) return false;
    const s = (o.status || 'new').toLowerCase();
    return s === 'new' || s === '' || s === 'null';
  };

  // Derive whether at least one call is actionable for THIS user (same rules as visibleCalls below).
  const managerRolesForBeep = new Set(['admin', 'super_admin', 'sales_manager', 'performance_manager', 'lead_gen']);
  const isManagerForBeep = managerRolesForBeep.has(userRole || '');
  const hasActionable = allowed && calls.some((c) => {
    if (!currentAdminId || c.offered_to !== currentAdminId) return false; // offered to someone else
    if (!isMatchedLeadStillNew(c.matched_lead_id)) return false;
    if (isManagerForBeep) return true;
    if (!c.matched_lead_id) return true;
    const o = leadOwners[c.matched_lead_id];
    if (!o) return false;
    if (!o.adminId) return true;
    if (currentAdminId && o.adminId === currentAdminId) return true;
    if (o.active === false) return true;
    return false;
  });

  // Periodic beep while any missed calls are active (respects mute + user gesture)
  useEffect(() => {
    const active = hasActionable && !muted;
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
  }, [hasActionable, muted]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Managers/admins see every hot inbound. Agents only see calls that are
  // theirs to action: unmatched, unassigned matched, matched-to-me, or matched
  // to an inactive (left-the-company) agent. A call already owned by another
  // active agent (e.g. sales@) must never surface for other agents.
  const managerRoles = new Set(['admin', 'super_admin', 'sales_manager', 'performance_manager', 'lead_gen']);
  const isManager = managerRoles.has(userRole || '');
  const visibleCalls = (isManager ? calls : calls.filter((c) => {
        if (!c.matched_lead_id) return true; // unmatched — up for grabs
        const o = leadOwners[c.matched_lead_id];
        if (!o) return false; // owner not loaded yet — hide until known to avoid flashing to wrong agents
        if (!o.adminId) return true; // matched but unassigned
        if (currentAdminId && o.adminId === currentAdminId) return true; // mine
        if (o.active === false) return true; // previous owner left — up for grabs
        return false; // owned by another active agent — hide
      })).filter((c) => isMatchedLeadStillNew(c.matched_lead_id)).filter((c) => !hiddenIds.has(c.id))
      // One agent at a time: only the agent this call is currently offered to
      // sees the pop-up. The server rotates the offer every 10 seconds.
      .filter((c) => !!currentAdminId && c.offered_to === currentAdminId);

  if (!allowed || visibleCalls.length === 0) return null;

  const top = visibleCalls[0];
  const extra = visibleCalls.length - 1;
  const provider = PROVIDER_LABEL[top.provider] || top.provider;
  const who = top.caller_name || top.caller_phone || 'Unknown caller';
  const ago = formatDistanceToNow(new Date(top.created_at), { addSuffix: true });
  const secondsLeft = top.offer_expires_at
    ? Math.max(0, Math.ceil((new Date(top.offer_expires_at).getTime() - nowTs) / 1000))
    : null;
  const owner = top.matched_lead_id ? leadOwners[top.matched_lead_id] : undefined;
  const ownedByMe = !!(owner && currentAdminId && owner.adminId === currentAdminId);
  const ownerInactive = !!(owner?.adminId && owner.active === false);
  const canClaim = !!top.matched_lead_id && (!owner?.adminId || ownerInactive);
  const canTakeUnmatched = !top.matched_lead_id && !!currentAdminId;
  const mustAcceptFirst = canClaim || canTakeUnmatched;

  return (
    <div className="fixed top-4 left-4 z-[100] w-[300px] max-w-[calc(100vw-2rem)] rounded-md bwmc-halo animate-in slide-in-from-left-4">
      <style>{`
        @keyframes bwmc-halo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.85), 0 0 0 0 rgba(251, 191, 36, 0.6); }
          50%      { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.0),  0 0 16px 5px rgba(251, 191, 36, 0.5); }
        }
        .bwmc-halo { animation: bwmc-halo-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="bg-blue-600 text-white shadow-2xl border border-blue-800 rounded-md">
      {/* Header: always shows mute + close, never pushed off by long content */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-blue-500/60">
        <PhoneMissed className="h-3.5 w-3.5 shrink-0" />
        <span className="px-1 py-0.5 rounded bg-amber-400 text-blue-950 text-[10px] font-black uppercase tracking-wide">Missed call</span>
        {secondsLeft !== null && mustAcceptFirst && (
          <span
            className={`px-1 py-0.5 rounded text-[10px] font-black tabular-nums ${secondsLeft <= 3 ? 'bg-red-500 text-white' : 'bg-white text-blue-800'}`}
            title="Accept within this time or it moves to the next agent"
          >
            {secondsLeft}s
          </span>
        )}
        <span className="text-[10px] opacity-80 truncate">{ago}</span>
        <button
          type="button"
          onClick={toggleMute}
          className="ml-auto h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/25"
          title={muted ? 'Unmute beep' : 'Mute beep'}
          aria-label={muted ? 'Unmute beep' : 'Mute beep'}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => (mustAcceptFirst ? passCall(top.id) : dismiss(top.id))}
          className="h-6 w-6 inline-flex items-center justify-center rounded bg-blue-800 hover:bg-blue-900"
          title="Close this alert"
          aria-label="Close this alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-2 py-1.5 space-y-1.5">
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{who}</div>
          {top.caller_phone && (
            mustAcceptFirst ? (
              <div className="text-[11px] opacity-95 font-mono select-none" title="Accept the lead first to call or copy this number">
                {top.caller_phone}
              </div>
            ) : (
              <div className="text-[11px] opacity-95 inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => dialWithZoiper(top.caller_phone!, {
                    leadId: top.matched_lead_id ?? null,
                    leadType: top.matched_lead_id ? 'sales_lead' : null,
                    customerName: top.caller_name ?? null,
                    sourcePage: 'missed_call_bar_inline',
                  })}
                  className="hover:underline font-mono"
                  title="Call this number via Zoiper / Dial9"
                >
                  {top.caller_phone}
                </button>
                <button
                  type="button"
                  onClick={() => copyNumber(top.caller_phone!)}
                  className="inline-flex items-center justify-center rounded p-0.5 hover:bg-white/20"
                  title="Copy number"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )
          )}
          {top.matched_lead_id && (
            <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${ownerInactive ? 'bg-amber-500 text-blue-950' : 'bg-blue-800'}`}>
              {!owner?.adminId
                ? 'Unassigned lead'
                : ownedByMe
                  ? 'Your lead'
                  : ownerInactive
                    ? `${owner.name || 'Agent'} left — up for grabs`
                    : `Owned by ${owner.name || 'agent'}`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">

          {/* Plain call back only once the call is owned — an unclaimed call
              must be taken first so two agents can't ring the same customer. */}
          {top.caller_phone && !canClaim && !canTakeUnmatched && (
            <button
              type="button"
              onClick={() => dialWithZoiper(top.caller_phone!, {
                leadId: top.matched_lead_id ?? null,
                leadType: top.matched_lead_id ? 'sales_lead' : null,
                customerName: top.caller_name ?? null,
                sourcePage: 'missed_call_bar',
              })}
              className="bg-white text-blue-700 hover:bg-blue-50 px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5"
              title="Call back via Zoiper / Dial9"
            >
              <Phone className="h-3.5 w-3.5" /> Call back
            </button>
          )}
          {canClaim && (
            <button
              disabled={busyId === top.id}
              onClick={async () => {
                if (busyId) return;
                setBusyId(top.id);
                try {
                  // Take it FIRST — only dial once the lead is confirmed ours.
                  const won = await assignToMe(top);
                  if (won && top.caller_phone) {
                    dialWithZoiper(top.caller_phone, {
                      leadId: top.matched_lead_id ?? null,
                      leadType: 'sales_lead',
                      customerName: top.caller_name ?? null,
                      sourcePage: 'missed_call_bar_assign',
                    });
                  }
                } finally {
                  setBusyId(null);
                }
              }}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5"
              title="Take ownership of this lead and call the customer back"
            >
              <UserPlus className="h-3.5 w-3.5" /> {busyId === top.id ? 'Accepting…' : 'Accept lead'}
            </button>
          )}
          {canTakeUnmatched && (
            <button
              disabled={busyId === top.id}
              onClick={async () => {
                if (busyId) return;
                setBusyId(top.id);
                try {
                  const won = await takeUnmatched(top);
                  if (won && top.caller_phone) {
                    dialWithZoiper(top.caller_phone, {
                      leadType: 'sales_lead',
                      customerName: top.caller_name ?? null,
                      sourcePage: 'missed_call_bar_take',
                    });
                  }
                } finally {
                  setBusyId(null);
                }
              }}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1.5"
              title="Create a lead from this caller and assign it to you"
            >
              <UserPlus className="h-3.5 w-3.5" /> {busyId === top.id ? 'Accepting…' : 'Accept lead'}
            </button>
          )}
          {top.matched_lead_id && onOpenLead && (
            <button
              onClick={() => onOpenLead(top.matched_lead_id!)}
              className="bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open lead
            </button>
          )}
          {!mustAcceptFirst && (
            <button
              onClick={() => acknowledge(top.id)}
              className="bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1.5"
              title="Mark as seen"
            >
              <Check className="h-3.5 w-3.5" /> Got it
            </button>
          )}
          {mustAcceptFirst ? (
            <button
              onClick={() => passCall(top.id)}
              className="bg-blue-800 hover:bg-blue-900 px-2 py-1 rounded text-[11px] font-medium"
              title="Pass this call straight to the next agent"
            >
              Pass
            </button>
          ) : (
            <button
              onClick={() => dismiss(top.id)}
              className="bg-blue-800 hover:bg-blue-900 px-2 py-1 rounded text-[11px] font-medium"
              title="Close this alert"
            >
              Close
            </button>
          )}
          {extra > 0 && (
            <span className="text-[10px] opacity-85 px-1">+{extra} waiting</span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
