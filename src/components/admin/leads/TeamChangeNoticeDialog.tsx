import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureEnabled } from '@/hooks/useFeatureFlags';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users } from 'lucide-react';

interface Props {
  adminUserId: string;
}

interface NoticeRow {
  id: string;
  team_id: string;
  previous_team_id: string | null;
  team_changed_at: string | null;
  notice_seen_at: string | null;
}

/**
 * Shown once to a sales agent after a manager moves them between teams.
 * Polite, single-acknowledge dialog directing them to their performance manager
 * for more details. Sets notice_seen_at on acknowledgement.
 */
export const TeamChangeNoticeDialog = ({ adminUserId }: Props) => {
  const noticesEnabled = useFeatureEnabled('team_change_notice_enabled', false);
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<NoticeRow | null>(null);
  const [fromName, setFromName] = useState<string | null>(null);
  const [toName, setToName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!noticesEnabled) return;
      const { data } = await supabase
        .from('lead_team_members')
        .select('id, team_id, previous_team_id, team_changed_at, notice_seen_at')
        .eq('admin_user_id', adminUserId)
        .maybeSingle();
      if (cancelled || !data) return;
      const changedAt = data.team_changed_at ? new Date(data.team_changed_at).getTime() : 0;
      const seenAt = data.notice_seen_at ? new Date(data.notice_seen_at).getTime() : 0;
      if (changedAt && changedAt > seenAt) {
        setRow(data as NoticeRow);
        // Look up team names for a friendlier message.
        const ids = [data.team_id, data.previous_team_id].filter(Boolean) as string[];
        if (ids.length) {
          const { data: teams } = await supabase
            .from('lead_teams')
            .select('id, name')
            .in('id', ids);
          const map = new Map((teams || []).map((t: any) => [t.id, t.name]));
          setToName(map.get(data.team_id) || null);
          if (data.previous_team_id) setFromName(map.get(data.previous_team_id) || null);
        }
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [adminUserId, noticesEnabled]);

  const acknowledge = async () => {
    if (!row) return;
    await supabase
      .from('lead_team_members')
      .update({ notice_seen_at: new Date().toISOString() })
      .eq('id', row.id);
    setOpen(false);
  };

  if (!row) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) acknowledge(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Your team allocation has been updated
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {fromName && toName && fromName !== toName
                ? <>You've been moved from <strong>{fromName}</strong> to <strong>{toName}</strong>.</>
                : toName
                  ? <>Your allocation in <strong>{toName}</strong> has been updated — you may now have different queues (New Leads, Recontact or Renewals) assigned to you.</>
                  : <>Your queue allocation has been updated.</>}
            </span>
            <span className="block">
              Please contact your performance manager for more details.
            </span>
          </AlertDialogDescription>

        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={acknowledge}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
