import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, FileText, PauseCircle, Star, ThumbsDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { rejectApplicants } from '@/lib/careerReject';

/**
 * Live Alerts card for new careers applicants still awaiting a decision, so
 * management can shortlist or decline without opening Careers Applications.
 */
export const CareerApplicantsAlert: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const [items, setItems] = useState<any[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('career_applications')
      .select('id, full_name, role_applied, applied_at, rejection_due_at, cv_storage_path')
      .eq('status', 'new')
      .order('applied_at', { ascending: false })
      .limit(5);
    setItems(data || []);
  }, []);

  useEffect(() => { load(); return setVisibleInterval(load, 60000); }, [load]);

  const visible = items.filter((i) => !hidden.has(i.id));
  if (!visible.length) return null;

  const shortlist = async (id: string) => {
    setBusy(id);
    await supabase.from('career_applications')
      .update({ status: 'shortlisted', decided_at: new Date().toISOString() }).eq('id', id);
    setBusy(null); load();
  };
  const viewCv = async (path: string) => {
    const w = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('career-cvs').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { w?.close(); toast.error('Could not open the CV'); return; }
    if (w) w.location.href = data.signedUrl; else window.open(data.signedUrl, '_blank');
  };
  const decline = async (id: string) => {
    setBusy(id);
    await rejectApplicants([id], 'reject');
    setBusy(null); load();
  };
  // "No action" — parks the application as on_hold: no rejection email, the
  // automatic 3-working-day sweep skips it, and it stays in Careers to decide later.
  const noAction = async (id: string) => {
    setBusy(id);
    await supabase.from('career_applications')
      .update({ status: 'on_hold', decided_at: new Date().toISOString() }).eq('id', id);
    setBusy(null); load();
    toast('Kept with no action', { description: 'No email sent — decide whenever suits you.', duration: 2500 });
  };

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.careerApplicants}>
      <div className="alert-scroll-x rounded-lg border bg-card shadow-md p-3 space-y-2 w-full">
        <button type="button" onClick={onOpen} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="h-4 w-4 text-primary" /> New job applicants ({items.length})
        </button>
        {visible.map((a) => (
          <div key={a.id} className="border-t pt-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.full_name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{a.role_applied}</div>
              </div>
              <button type="button" aria-label="Hide" onClick={() => setHidden((s) => new Set(s).add(a.id))}
                className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {a.cv_storage_path && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => viewCv(a.cv_storage_path)}>
                  <FileText className="h-3 w-3 mr-1" />View CV
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === a.id} onClick={() => shortlist(a.id)}>
                <Star className="h-3 w-3 mr-1" />Shortlist
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === a.id} onClick={() => decline(a.id)}>
                <ThumbsDown className="h-3 w-3 mr-1" />Decline &amp; email
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === a.id} onClick={() => noAction(a.id)}
                title="Keep as-is — no rejection email, no automatic decline">
                <PauseCircle className="h-3 w-3 mr-1" />No action
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AlertRailSlot>
  );
};

export default CareerApplicantsAlert;
