import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, LifeBuoy, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReassignSaleButton } from '@/components/admin/scoreboard/ReassignSaleButton';


// Sections the backup login can never open.
export const BACKUP_BLOCKED_TABS = ['analytics', 'lead-teams', 'open-round-robin', 'orr-test-lab', 'orr-sandbox', 'vehicle-stats'];
const BLOCKED_LABELS = ['Analytics', 'Lead Allocation', 'Open Round Robin', 'ORR Test Lab', 'Vehicle Intelligence'];

interface BackupLoginPanelProps {
  /** All dashboard section ids that exist (blocked ones are filtered out here). */
  allTabIds: string[];
}

export const BackupLoginPanel: React.FC<BackupLoginPanelProps> = ({ allTabIds }) => {
  const [email, setEmail] = useState('backup@buyawarranty.co.uk');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const grantedTabs = allTabIds.filter(id => !BACKUP_BLOCKED_TABS.includes(id));

  const provision = async () => {
    if (password.trim().length < 8) {
      toast.error('Choose a password of at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-backup-login', {
        body: { email: email.trim().toLowerCase(), password: password.trim(), tabIds: grantedTabs },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        (data as any)?.created
          ? `Backup login created for ${email} — password verified.`
          : `Backup login updated for ${email} — password verified.`
      );
      setPassword('');
    } catch (e: any) {
      toast.error(e?.message || 'Could not set up the backup login.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-amber-600" />
          Backup sales login (emergency access)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          A single shared login for sales agents to use when their own account or a screen is down.
          It has the same reach as super admin, except the restricted sections below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="backup-email">Login email</Label>
            <Input id="backup-email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="backup-password">Password (min 8 characters)</Label>
            <Input
              id="backup-password"
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Set or reset the shared password"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="rounded-md border border-amber-200 bg-white p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" /> Always blocked for this login
          </p>
          <div className="flex flex-wrap gap-2">
            {BLOCKED_LABELS.map(label => (
              <Badge key={label} variant="outline" className="border-red-300 text-red-700">{label}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {grantedTabs.length} other sections are granted. The block is enforced server-side, so it
            cannot be re-enabled by editing permissions for this account.
          </p>
        </div>

        <div className="rounded-md border border-amber-200 bg-white p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <UserCog className="h-4 w-4 text-amber-600" /> Sale credit after using the backup login
          </p>
          <p className="text-xs text-muted-foreground">
            Anything sold on this shared login is attributed to “Backup Access”, not to an agent.
            Super admin or admin must reassign each of those sales to the agent who made it —
            scoreboard, targets, commission and freeze rules all read the reassigned credit.
          </p>
          <ReassignSaleButton label="Reassign backup-login sales" defaultBackupOnly />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={provision} disabled={saving}>
            {saving ? 'Setting up…' : 'Create / reset backup login'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Share the password only with sales staff who need it, and reset it after use.
          </span>
        </div>

      </CardContent>
    </Card>
  );
};

export default BackupLoginPanel;
