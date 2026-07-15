import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
 Pin, PinOff, Trash2, 
 Edit2, Check, X, Loader2, Save,
 Phone, PhoneOff, Voicemail, PhoneCall, PhoneMissed, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useLeadQuickNotes, QuickNote, readPendingQueuedNotes, writePendingQueuedNotes } from '@/hooks/useLeadQuickNotes';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logPhoneEvent, type PhoneEventType } from '@/utils/phoneEventLogger';
import { useViewAs } from '@/contexts/ViewAsContext';
import {
  clearOpenPoolReservation,
  getOpenPoolReservation,
  useOpenPoolReservation,
  useReservationCountdown,
} from '@/hooks/useOpenLeadPoolReservation';
import { Clock } from 'lucide-react';

const NOTE_DRAFT_STORAGE_KEY_PREFIX = 'lead-quick-note-draft:';

/**
 * Reservation countdown badge shown inside the Quick Log Outcome header.
 * Defaults visually to 2:00 when a reservation exists so agents always see
 * the timer next to the outcome buttons without needing to look elsewhere.
 */
const ReservationTimerBadge: React.FC<{ leadId: string }> = ({ leadId }) => {
  const reservation = useOpenPoolReservation();
  const remaining = useReservationCountdown(reservation);
  if (!reservation || reservation.lead.id !== leadId) return null;

  if (reservation.phase === 'calling') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <Clock className="h-3 w-3" />
        On call — take your time
      </span>
    );
  }

  const shown = remaining > 0 ? remaining : reservation.holdSeconds;
  const mm = Math.floor(shown / 60);
  const ss = String(shown % 60).padStart(2, '0');
  const warn = remaining > 0 && remaining <= 30;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        warn
          ? 'border-amber-400 bg-amber-50 text-amber-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800',
      )}
      title="Reservation hold — click Call when you're ready. If you don't, the lead returns to the pool."
    >
      <Clock className="h-3 w-3" />
      Reserved · {mm}:{ss}
    </span>
  );
};

interface UnifiedNotesPanelProps {
  leadId: string;
  className?: string;
  compact?: boolean;
  /**
   * Explicitly hide the Open-Pool "Take / Spoken to / Couldn't connect"
   * outcome chooser. Recontact and Renewals lists must always pass `true`
   * because those leads are worked from a list at the agent's own pace and
   * never through the pool-reservation race. When omitted, the panel falls
   * back to the URL tab check.
   */
  hidePoolOutcome?: boolean;
}

export const UnifiedNotesPanel: React.FC<UnifiedNotesPanelProps> = ({
  leadId,
  className,
  compact = false,
  hidePoolOutcome: hidePoolOutcomeProp,
}) => {
  const { notes, loading, addNote, updateNote, togglePin, deleteNote, refetch, isAbandonedCart, isSaving: hookIsSaving } = useLeadQuickNotes(leadId);
  const draftStorageKey = `${NOTE_DRAFT_STORAGE_KEY_PREFIX}${leadId}`;
  const { isImpersonating, viewAsAgent } = useViewAs();
  // The Open-Pool "Take / Spoken to / Couldn't connect" chooser only belongs on
  // live New Leads where agents compete for the next call. Recontact, Renewals
  // and Lost leads are worked from a list at the agent's own pace — no
  // urgency, no race — so callers pass `hidePoolOutcome` and we skip the whole
  // block. Fall back to the URL tab as a safety net when a caller forgets.
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');
  const hidePoolOutcome =
    hidePoolOutcomeProp ??
    (activeTab === 'recontact-leads' || activeTab === 'renewals');
  
  // Quick note input state
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Undo state
  const [deletedNote, setDeletedNote] = useState<QuickNote | null>(null);
  const [outcomeStep, setOutcomeStep] = useState<'choose' | 'spoken' | 'no_answer'>('choose');
  const [keptStatus, setKeptStatus] = useState<{ label: string } | null>(null);
  const [conversationSummary, setConversationSummary] = useState('');
  const [pendingNextAction, setPendingNextAction] = useState<SubOutcome | null>(null);
  const [savingConversation, setSavingConversation] = useState(false);
  const [retryMinutes, setRetryMinutes] = useState<number>(15);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read the admin-configured "Protected retry window" once on mount so all
  // agent-facing copy (timer, tooltip, banner) reflects the current setting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('shark_tank_settings')
        .select('retry_minutes')
        .eq('id', 1)
        .maybeSingle();
      if (!cancelled && data?.retry_minutes) setRetryMinutes(data.retry_minutes);
    })();
    return () => { cancelled = true; };
  }, []);



  // Track latest values in refs for cleanup
  const quickNoteRef = useRef(quickNoteValue);
  const addNoteRef = useRef(addNote);
  const isSavingRef = useRef(isSaving);
  const pendingDraftIdRef = useRef<string | null>(null);
  quickNoteRef.current = quickNoteValue;
  addNoteRef.current = addNote;
  isSavingRef.current = isSaving;

  const queuePendingNote = useCallback((noteText: string) => {
    const trimmed = noteText.trim();
    if (!trimmed) return null;

    const queueId = pendingDraftIdRef.current || `${leadId}:${Date.now()}`;
    pendingDraftIdRef.current = queueId;

    const nextQueue = [
      ...readPendingQueuedNotes().filter(note => note.id !== queueId),
      {
        id: queueId,
        leadId,
        noteText: trimmed,
        createdAt: new Date().toISOString(),
      },
    ];

    writePendingQueuedNotes(nextQueue);
    return queueId;
  }, [leadId]);

  const clearQueuedPendingNote = useCallback((queueId: string | null) => {
    if (!queueId) return;

    writePendingQueuedNotes(readPendingQueuedNotes().filter(note => note.id !== queueId));
    if (pendingDraftIdRef.current === queueId) {
      pendingDraftIdRef.current = null;
    }
  }, []);

  const handleQuickNoteChange = useCallback((value: string) => {
    setQuickNoteValue(value);
    quickNoteRef.current = value;

    if (value.trim()) {
      queuePendingNote(value);
    } else {
      clearQueuedPendingNote(pendingDraftIdRef.current);
    }
  }, [queuePendingNote, clearQueuedPendingNote]);

  const flushPendingNoteRef = useRef<() => Promise<void>>(async () => {});

  const persistDraft = useCallback((value: string) => {
    if (typeof window === 'undefined') return;

    const trimmed = value.trim();
    if (trimmed) {
      window.sessionStorage.setItem(draftStorageKey, value);
    } else {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  const commitNote = useCallback(async (noteText: string, options?: { silent?: boolean }) => {
    const pending = noteText.trim();
    if (!pending || isSavingRef.current || hookIsSaving) return false;

    const queueId = queuePendingNote(pending);
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      await addNoteRef.current(pending);
      quickNoteRef.current = '';
      handleQuickNoteChange('');
      persistDraft('');
      clearQueuedPendingNote(queueId);
      if (!options?.silent) {
        toast.success('Note saved');
      }
      return true;
    } catch (error: any) {
      if (!options?.silent) {
        toast.error(error?.message === 'Session expired' ? 'Session expired — please log in again' : 'Failed to save note');
      }
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [hookIsSaving, queuePendingNote, persistDraft, clearQueuedPendingNote, handleQuickNoteChange]);

  const flushPendingNote = useCallback(async () => {
    await commitNote(quickNoteRef.current, { silent: true });
  }, [commitNote]);

  flushPendingNoteRef.current = flushPendingNote;

  // Auto-save unsaved note on unmount (e.g. collapsing the panel)
  useEffect(() => {
    return () => {
      void flushPendingNoteRef.current();
    };
  }, [leadId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushPendingNote();
      }
    };

    const handlePageHide = () => {
      void flushPendingNote();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [flushPendingNote]);

  // Reset state when lead changes
  useEffect(() => {
    const savedDraft = typeof window !== 'undefined'
      ? window.sessionStorage.getItem(draftStorageKey) || ''
      : '';

    handleQuickNoteChange(savedDraft);
    setIsSaving(false);
    setEditingNoteId(null);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
  }, [draftStorageKey, leadId, handleQuickNoteChange]);

  useEffect(() => {
    persistDraft(quickNoteValue);
  }, [quickNoteValue, persistDraft]);

  useEffect(() => {
    const pendingQueueItem = readPendingQueuedNotes().find(note => note.leadId === leadId);
    if (!pendingQueueItem) return;

    pendingDraftIdRef.current = pendingQueueItem.id;
    setQuickNoteValue(prev => prev || pendingQueueItem.noteText);
    void commitNote(pendingQueueItem.noteText, { silent: true });
  }, [leadId, commitNote]);

  // Safety reset: if isSaving is stuck for >10s, auto-reset
  useEffect(() => {
    if (isSaving) {
      savingTimerRef.current = setTimeout(() => {
        setIsSaving(false);
        setIsSaving(false);
      }, 10000);
    } else {
      if (savingTimerRef.current) {
        clearTimeout(savingTimerRef.current);
        savingTimerRef.current = null;
      }
    }
    return () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, [isSaving]);

  const handleSaveNote = async () => {
    if (isSaving || hookIsSaving) return;
    await commitNote(quickNoteValue);
  };

  const handleStartEdit = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setEditValue(note.note_text);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editValue.trim()) {
      setEditingNoteId(null);
      setEditValue('');
      return;
    }
    
    try {
      await updateNote(editingNoteId, editValue.trim());
      toast.success('Note updated');
    } catch (error) {
      toast.error('Failed to update note');
    }
    
    setEditingNoteId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditValue('');
  };

  const handleDelete = async (note: QuickNote) => {
    setDeletedNote(note);
    
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    toast.success('Note deleted', {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => handleUndo(note)
      }
    });
    
    undoTimeoutRef.current = setTimeout(async () => {
      try {
        await deleteNote(note.id);
        setDeletedNote(null);
      } catch (error) {
        toast.error('Failed to delete note');
      }
    }, 10000);
  };

  const handleUndo = async (note: QuickNote) => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    setDeletedNote(null);
    toast.success('Note restored');
    await refetch();
  };

  // Combine real notes + optimistic notes, filter out deleted
  const visibleNotes = useMemo(() => {
    return notes.filter(note => !(deletedNote && note.id === deletedNote.id));
  }, [notes, deletedNote]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notes...
        </div>
      </div>
    );
  }

  type PoolOutcome =
    | 'no_answer'
    | 'voicemail_left'
    | 'callback_requested'
    | 'not_interested'
    | 'wrong_number'
    | 'quote_sent'
    | 'spoke_to_customer';

  type SubOutcome = {
    label: string;
    text: string;
    tone: string;
    outcome: PoolOutcome;
    releases?: boolean;
    needsReason?: boolean;
    hint?: string;
  };

  // All non-releasing outcomes here KEEP the lead assigned to the current agent
  // (green confirmation banner shown after selection).
  // Labels here mirror the lead status dropdown (New, Spoken to, Follow-up,
  // Quote sent, Negotiating, Converted, Not interested, Fake / 404,
  // Urgent call-back) so agents see the same language everywhere.
  // NOTE: Lost is NOT shown here — a lead can only be marked Lost after the
  // full 7-dial attempt rule has been exhausted.
  const SPOKEN_SUB_OUTCOMES: SubOutcome[] = [
    { label: 'Follow-up', text: '📞 Follow-up scheduled', tone: 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100', outcome: 'callback_requested', hint: 'Lead becomes yours — pick a date/time to follow up' },
    { label: 'Quote sent', text: '✉️ Quote sent', tone: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100', outcome: 'quote_sent', hint: 'Lead becomes yours — emailed the quote, follow up later' },
    { label: 'Negotiating', text: '💬 Negotiating', tone: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100', outcome: 'spoke_to_customer', hint: 'Lead becomes yours — in active discussion on price/terms' },
    { label: 'Converted', text: '✅ Converted', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100', outcome: 'spoke_to_customer', hint: 'Lead becomes yours — customer paid / policy activated' },
    { label: 'Not interested', text: '🚫 Not interested', tone: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100', outcome: 'not_interested', releases: true, needsReason: true, hint: 'Closes the lead and releases it — asks for reason' },
  ];

  // NOTE: "releases: true" here means the reservation slot is freed so you can
  // take another lead — the LEAD itself stays locked to you for the protected
  // retry window (default 15 min, configurable in Lead Teams → Open Lead Pool).
  // No other agent can grab it during that window. If you don't retry in time,
  // it converts to a chase lock and then recycles back into the pool.
  const NO_ANSWER_SUB_OUTCOMES: SubOutcome[] = [
    { label: 'No answer', text: '⏱ No answer — retry later', tone: 'border-amber-300 text-amber-800 hover:bg-amber-50', outcome: 'no_answer', releases: true, hint: 'This lead is saved for your next attempt.' },
    { label: 'Voicemail', text: '📞 Left voicemail', tone: 'border-violet-300 text-violet-800 hover:bg-violet-50', outcome: 'voicemail_left', releases: true, hint: 'This lead is saved for your next attempt.' },
    { label: 'Line busy', text: '📞 Line busy', tone: 'border-sky-300 text-sky-800 hover:bg-sky-50', outcome: 'no_answer', releases: true, hint: 'This lead is saved for your next attempt.' },
    { label: 'Number issue', text: '❌ Number issue', tone: 'border-rose-300 text-rose-800 hover:bg-rose-50', outcome: 'wrong_number', releases: true, needsReason: true, hint: 'Tell us what happened so the customer details can be checked.' },
  ];

  const logOutcomeRpc = async (params: {
    outcome: PoolOutcome;
    label: string;
    text: string;
    reason?: string;
    nextActionAt?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false as const };

    // Note the outcome in the timeline
    await commitNote(params.text);

    // When a super_admin impersonates an agent via "View As", credit the
    // outcome to the impersonated agent so assigned_to / owner_agent land on
    // them, not the real logged-in super_admin account.
    const effectiveAgentUserId = (isImpersonating && viewAsAgent?.userId) || user.id;

    const { error } = await supabase.rpc('open_pool_log_outcome', {
      _lead_id: leadId,
      _agent: effectiveAgentUserId,
      _outcome: params.outcome,
      _reason: params.reason,
      _next_action_at: params.nextActionAt,
    });

    if (error) {
      console.error('open_pool_log_outcome failed:', error);
      toast.error(`Could not update pool: ${error.message}`);
      return { ok: false as const };
    }

    const outcomeToEventType: Record<string, PhoneEventType> = {
      spoken_to: 'spoken_to_selected',
      connected: 'spoken_to_selected',
      spoke_to_customer: 'spoken_to_selected',
      no_answer: 'no_answer_selected',
      voicemail_left: 'voicemail_selected',
      busy: 'busy_selected',
      callback_requested: 'callback_requested',
      wrong_number: 'wrong_number_selected',
      not_interested: 'not_interested_selected',
    };
    logPhoneEvent({
      eventType: outcomeToEventType[params.outcome] || 'spoken_to_selected',
      leadId,
      leadType: 'sales_lead',
      selectedOutcome: params.outcome,
      reservationId: null,
      metadata: { label: params.label, reason: params.reason || null },
    });
    return { ok: true as const };
  };

  // Called when the agent clicks the top-level "📞 Spoken to" CTA.
  // This alone is a valid outcome: status → Spoken to (contacted), lead becomes
  // owned by the agent (keep_lock=true). Sub-outcomes below are optional
  // refinements they can pick afterwards (Follow-up, Quote sent, etc.).
  const handleSpokenToTop = async () => {
    if (isSaving || hookIsSaving || keptStatus) {
      setOutcomeStep('spoken');
      return;
    }
    const result = await logOutcomeRpc({
      outcome: 'spoke_to_customer',
      label: 'Spoken to',
      text: '📞 Spoken to customer',
    });
    if (!result.ok) return;
    clearOpenPoolReservation();
    setKeptStatus({ label: 'Spoken to' });
    setOutcomeStep('choose');
    toast.success('✅ This lead is now yours — Spoken to', {
      description: 'Status set to Spoken to. Open the row again anytime to add a refinement.',
    });
    // Collapse the row so it displays like every other owned lead — no more
    // orange-bordered outcome box hanging around after the agent has spoken.
    window.dispatchEvent(new CustomEvent('lead-row:collapse', { detail: { leadId } }));
  };

  const handleQuickAction = async (action: SubOutcome) => {
    if (isSaving || hookIsSaving) return;

    // If we haven't claimed yet, we need an active reservation for this lead.
    // After "Spoken to" has been logged, keptStatus is set and the lead is
    // already locked to the agent server-side — no reservation needed.
    if (!keptStatus) {
      const reservation = getOpenPoolReservation();
      if (!reservation || reservation.lead.id !== leadId) {
        // Still log the note so nothing is lost
        await commitNote(action.text);
        return;
      }
    }

    let reason: string | undefined;
    if (action.needsReason) {
      const input = window.prompt(`Reason for "${action.label}"?`);
      if (!input || !input.trim()) {
        toast.error('Reason required — outcome not logged');
        return;
      }
      reason = input.trim();
    }

    let nextActionAt: string | undefined;
    if (action.outcome === 'callback_requested') {
      const when = window.prompt(
        'Callback date/time (YYYY-MM-DD HH:MM)?',
        format(new Date(Date.now() + 60 * 60 * 1000), 'yyyy-MM-dd HH:mm')
      );
      if (!when) return;
      const parsed = new Date(when.replace(' ', 'T'));
      if (isNaN(parsed.getTime())) {
        toast.error('Invalid date — outcome not logged');
        return;
      }
      nextActionAt = parsed.toISOString();
    }

    const result = await logOutcomeRpc({
      outcome: action.outcome,
      label: action.label,
      text: action.text,
      reason,
      nextActionAt,
    });
    if (!result.ok) return;

    if (action.releases) {
      clearOpenPoolReservation();
      setKeptStatus(null);
      toast.success('Lead released — moving to next one', {
        description: `${action.label} · Retry saved for ${retryMinutes} min`,
      });
      setOutcomeStep('choose');
      // Auto-collapse the row and immediately hand the agent the next lead so
      // they don't have to close this panel manually before continuing.
      window.dispatchEvent(new CustomEvent('lead-row:collapse', { detail: { leadId } }));
      window.dispatchEvent(new CustomEvent('open-pool:take-next'));
    } else {
      clearOpenPoolReservation();
      setKeptStatus({ label: action.label });
      toast.success(`✅ This lead is now yours — ${action.label}`, {
        description: 'Logged. It stays assigned to you.',
      });
      // Collapse the row so it renders like every other owned lead instead of
      // staying stuck in the orange outcome box.
      window.dispatchEvent(new CustomEvent('lead-row:collapse', { detail: { leadId } }));
    }
  };


  // Sort: pinned first, then newest
  const sortedNotes = useMemo(() => {
    return [...visibleNotes].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [visibleNotes]);

  // Reset the outcome chooser whenever we switch leads.
  useEffect(() => {
    setOutcomeStep('choose');
    setKeptStatus(null);
    setConversationSummary('');
    setPendingNextAction(null);
  }, [leadId]);


  const activeSubOutcomes =
    outcomeStep === 'spoken' ? SPOKEN_SUB_OUTCOMES :
    outcomeStep === 'no_answer' ? NO_ANSWER_SUB_OUTCOMES : [];

  // Track whether this lead has ever been reserved by the current agent while
  // the panel was mounted. If the reservation later disappears, we know it was
  // auto-released back to the Open Pool and outcome logging is no longer valid.
  const liveReservation = useOpenPoolReservation();
  const wasReservedRef = useRef(false);
  useEffect(() => {
    if (liveReservation && liveReservation.lead.id === leadId) {
      wasReservedRef.current = true;
    }
  }, [liveReservation?.lead.id, leadId]);
  const isReleasedFromPool =
    wasReservedRef.current &&
    (!liveReservation || liveReservation.lead.id !== leadId);

  // The Quick-log outcome block belongs ONLY to leads the agent picked up from
  // the Open Lead Pool. When Round Robin is on (leads auto-assigned), the agent
  // never reserved the lead, so we hide the whole block.
  const isPoolLead =
    (liveReservation && liveReservation.lead.id === leadId) ||
    wasReservedRef.current ||
    !!keptStatus;

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {/* Quick log — Open-Pool only (hidden on Recontact / Renewals and RR-assigned leads) */}
      {!hidePoolOutcome && isPoolLead && (
      <div className="px-4 pt-4 pb-3 border-b border-border">

        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quick log outcome
          </p>
          <div className="flex items-center gap-2">
            {outcomeStep !== 'spoken' && !keptStatus && <ReservationTimerBadge leadId={leadId} />}
            {!isReleasedFromPool && (outcomeStep !== 'choose' || keptStatus) && (
              <button
                type="button"
                onClick={() => {
                  setOutcomeStep('choose');
                  setKeptStatus(null);
                  setConversationSummary('');
                  setPendingNextAction(null);
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline"
              >
                ← Change
              </button>
            )}

          </div>
        </div>

        {keptStatus ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900 flex items-start gap-2.5">
              <Check className="h-4 w-4 mt-0.5 text-emerald-700 shrink-0" />
              <div>
                {keptStatus.label === 'Spoken to' ? (
                  <>
                    <div className="font-semibold mb-0.5">Customer reached — this lead is now yours to continue.</div>
                    <div className="text-emerald-800/90">Add a quick summary and choose the next step.</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold mb-0.5">Saved — status set to {keptStatus.label}.</div>
                    <div className="text-emerald-800/90">The lead stays assigned to you.</div>
                  </>
                )}
              </div>
            </div>


            {keptStatus.label === 'Spoken to' && (
              <>
                <div>
                  <label htmlFor={`conv-summary-${leadId}`} className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Conversation summary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id={`conv-summary-${leadId}`}
                    value={conversationSummary}
                    onChange={(e) => setConversationSummary(e.target.value.slice(0, 1000))}
                    placeholder="Add a short note about the conversation…"
                    rows={4}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 resize-y"
                  />
                  <div className="text-[11px] text-slate-400 text-right mt-0.5">{conversationSummary.length} / 1000</div>
                </div>

                <div>
                  <div className="text-[12px] font-semibold text-slate-700 mb-1.5">
                    What happens next? <span className="text-rose-500">*</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {SPOKEN_SUB_OUTCOMES.map((action) => {
                      const selected = pendingNextAction?.label === action.label;
                      return (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => setPendingNextAction(action)}
                          disabled={savingConversation}
                          title={action.hint}
                          className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            action.tone,
                            selected && "ring-2 ring-offset-1 ring-emerald-500"
                          )}
                        >
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    disabled={savingConversation || !pendingNextAction || !conversationSummary.trim()}
                    onClick={async () => {
                      if (!pendingNextAction || !conversationSummary.trim()) return;
                      setSavingConversation(true);
                      try {
                        await commitNote(conversationSummary.trim());
                        await handleQuickAction(pendingNextAction);
                        setConversationSummary('');
                        setPendingNextAction(null);
                      } finally {
                        setSavingConversation(false);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {savingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save conversation
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setConversationSummary('');
                      setPendingNextAction(null);
                    }}
                    disabled={savingConversation}
                    className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>

        ) : isReleasedFromPool ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <div className="font-semibold mb-0.5">Lead released back to the Open Pool</div>
            <div className="text-amber-800/90">
              You can no longer log an outcome for this lead. Reserve it again from the pool if you still need to work it.
            </div>
          </div>
        ) : outcomeStep === 'choose' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSpokenToTop}
                disabled={isSaving || hookIsSaving}
                className="group flex items-center gap-3 rounded-lg border border-emerald-600 bg-emerald-600 text-white px-4 py-5 shadow-sm hover:bg-emerald-700 hover:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Phone className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-lg font-bold">Spoken to</span>
                  <span className="text-sm font-medium text-emerald-50/90">Connected with the customer</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOutcomeStep('no_answer')}
                disabled={isSaving || hookIsSaving}
                className="group flex items-center gap-3 rounded-lg border border-orange-500 bg-orange-500 text-white px-4 py-5 shadow-sm hover:bg-orange-600 hover:border-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <PhoneOff className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-lg font-bold">Couldn't connect</span>
                  <span className="text-sm font-medium text-orange-50/90">The customer wasn't available this time</span>
                </span>
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">Select the call result to continue.</p>
          </div>

        ) : (
          <div className="space-y-3">
            {outcomeStep === 'no_answer' && (
              <>
                <p className="text-sm font-semibold text-foreground">What happened?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NO_ANSWER_SUB_OUTCOMES.map((action) => {
                    const Icon =
                      action.label === 'No answer' ? PhoneMissed :
                      action.label === 'Voicemail' ? Voicemail :
                      action.label === 'Line busy' ? PhoneCall : PhoneOff;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        disabled={isSaving || hookIsSaving}
                        title={action.hint}
                        className={cn(
                          "flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-md border-2 bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                          action.tone
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold">Lead stays yours for {retryMinutes} min · {String(retryMinutes).padStart(2, '0')}:00</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 underline decoration-amber-800/30 underline-offset-2 hover:decoration-amber-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm"
                          >
                            <HelpCircle className="h-4 w-4" /> What each option does
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" sideOffset={8} className="max-w-xs">
                          <div className="space-y-2 text-sm leading-snug">
                            <p className="font-semibold">What each option does</p>
                            <p>
                              <strong>No answer, Voicemail, and Line busy do not block you out.</strong> The lead stays locked to you for {retryMinutes} minutes and you can redial it as many times as you like — no other agent can take it.
                            </p>
                            <p>
                              <strong>Number issue</strong> is the only option that releases the lead immediately so you can take a new one. It’s flagged for data-quality review instead of counting as a failed attempt.
                            </p>
                            <p>
                              Each “No answer”, “Voicemail”, or “Line busy” counts as one attempt. After 7 attempts, the lead is marked as lost and won’t be offered again.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-amber-800/90">No answer, Voicemail, and Line busy keep it for you to retry. Only Number issue releases it.</p>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('lead-row:collapse', { detail: { leadId } }));
                        window.dispatchEvent(new CustomEvent('open-pool:take-next'));
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    >
                      Close & take next lead
                    </button>
                  </div>
                </div>
              </>
            )}
            {outcomeStep === 'spoken' && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] leading-snug text-emerald-900">
                <span className="font-semibold">Spoken to — the lead is yours.</span> Pick the next action below.
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  {SPOKEN_SUB_OUTCOMES.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      disabled={isSaving || hookIsSaving}
                      title={action.hint}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        action.tone
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}



      <div className="px-4 py-3 max-h-[320px] overflow-y-auto">
        {sortedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">No notes yet — use a quick log above or type below.</p>
        ) : (
          <div className="space-y-1.5">
            {sortedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const isOptimistic = note.id.startsWith('temp_');
              const noteDate = new Date(note.created_at);
              const datePrefix = format(noteDate, 'dd/MM');
              const timeStr = format(noteDate, 'HH:mm');

              return (
                <div
                  key={note.id}
                  className={cn(
                    "group flex items-start gap-2 py-2 px-2.5 rounded-md border transition-colors",
                    note.is_pinned
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                      : "bg-background border-transparent hover:bg-muted/50 hover:border-border",
                    isOptimistic && "opacity-60"
                  )}
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                          if (e.key === 'Escape') { handleCancelEdit(); }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {note.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-semibold">
                              <Pin className="h-2.5 w-2.5" />
                              PINNED
                            </span>
                          )}
                          {isOptimistic && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <span className="text-muted-foreground text-[11px] font-mono tabular-nums">
                            {datePrefix} · {timeStr}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed break-words">{note.note_text}</p>
                      </div>

                      {!isOptimistic && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
                          {!isAbandonedCart && (
                            <button
                              onClick={() => togglePin(note.id, note.is_pinned)}
                              className={cn(
                                "p-1.5 rounded hover:bg-background",
                                note.is_pinned && "opacity-100 text-amber-600"
                              )}
                              title={note.is_pinned ? 'Unpin' : 'Pin this note'}
                            >
                              {note.is_pinned ? (
                                <PinOff className="h-3.5 w-3.5" />
                              ) : (
                                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(note)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(note)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add note input */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 rounded-b-lg">
        <div className="flex gap-2">
          <Input
            value={quickNoteValue}
            onChange={(e) => handleQuickNoteChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveNote(); }
            }}
            onBlur={() => { if (quickNoteValue.trim()) void flushPendingNote(); }}
            placeholder="Add a note…"
            className="flex-1 h-9 text-sm bg-background"
            disabled={isSaving || hookIsSaving}
          />
          <Button
            size="sm"
            onClick={handleSaveNote}
            disabled={!quickNoteValue.trim() || isSaving || hookIsSaving}
            className="h-9 px-4"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
