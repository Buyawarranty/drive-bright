import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Lock, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * WARRANTIES 2000 / WARRANTIES REGISTER — PERMANENT KILL SWITCH
 * ---------------------------------------------------------------------------
 * The integration is switched OFF permanently and cannot be re-enabled from
 * the UI. Every sending path has been deleted:
 *  - edge functions process-scheduled-w2000, send-to-warranties-2000 and
 *    warranties-2000-registration are deleted
 *  - the daily 08:00 scheduled job has been removed
 *  - the connectivity test no longer contacts their API
 * No data of any kind may ever be sent to Warranties 2000 again.
 */
export const WarrantiesRegisterKillSwitch = () => (
  <Card className="border-2 border-destructive/40">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <ShieldOff className="h-5 w-5 text-destructive" />
        Warranties 2000 (Warranties Register) API
        <Badge variant="destructive" className="ml-1">Permanently off</Badge>
      </CardTitle>
      <CardDescription>
        This connection is closed for good. Nothing is sent to Warranties 2000 in any format, so
        there is no cost from them.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" /> Send policy data to Warranties 2000
          </Label>
          <p className="text-xs text-muted-foreground">
            Locked off. This switch cannot be turned back on.
          </p>
        </div>
        <Switch
          checked={false}
          disabled
          onCheckedChange={() =>
            toast.error('Permanently disabled', {
              description: 'The Warranties 2000 API connection has been removed and cannot be re-enabled.',
            })
          }
        />
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>• All API functions for Warranties 2000 have been deleted.</li>
        <li>• The daily 8am scheduled send has been removed.</li>
        <li>• Every queued or retrying policy is marked permanently disabled.</li>
        <li>• The connectivity test no longer contacts their API.</li>
      </ul>
    </CardContent>
  </Card>
);

export default WarrantiesRegisterKillSwitch;
