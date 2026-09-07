import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { AccessEvent, fetchAccessHistory, formatLondon } from '@/lib/adminAccessLog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUserId: string | null;
  staffName: string;
};

const StaffAccessHistoryDialog: React.FC<Props> = ({ open, onOpenChange, adminUserId, staffName }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AccessEvent[]>([]);

  useEffect(() => {
    if (!open || !adminUserId) return;
    let cancelled = false;
    setLoading(true);
    fetchAccessHistory(adminUserId).then((rows) => {
      if (!cancelled) {
        setEvents(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, adminUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Switched on / off history — {staffName}</DialogTitle>
          <DialogDescription>
            Every time this login was switched on or off, who did it and where from. Times are UK time.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No on/off changes recorded for this person yet.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-3">
                <Badge
                  variant="outline"
                  className={
                    e.turnedOn
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 shrink-0'
                      : 'border-red-300 bg-red-50 text-red-800 shrink-0'
                  }
                >
                  {e.turnedOn ? <Power className="mr-1 h-3 w-3" /> : <PowerOff className="mr-1 h-3 w-3" />}
                  {e.turnedOn ? 'Switched on' : 'Switched off'}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatLondon(e.at)}</p>
                  <p className="text-sm text-muted-foreground">By {e.byName}</p>
                  {e.reason && <p className="text-xs text-muted-foreground mt-0.5">{e.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StaffAccessHistoryDialog;
