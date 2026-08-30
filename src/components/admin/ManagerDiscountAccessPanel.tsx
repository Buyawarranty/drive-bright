import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ManagerDiscountGrant } from '@/hooks/useManagerDiscountAccess';

interface Props {
  grants: ManagerDiscountGrant[];
  canManage: boolean;
  addGrant: (email: string, note?: string) => Promise<{ error?: string }>;
  setGrantEnabled: (id: string, enabled: boolean) => Promise<{ error?: string }>;
  removeGrant: (id: string) => Promise<{ error?: string }>;
}

export function ManagerDiscountAccessPanel({ grants, canManage, addGrant, setGrantEnabled, removeGrant }: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    setBusy(true);
    const res = await addGrant(email);
    setBusy(false);
    if (res.error) {
      toast({ title: 'Could not grant access', description: res.error, variant: 'destructive' });
      return;
    }
    setEmail('');
    toast({ title: 'Access granted', description: 'They can see and apply manager access codes once signed in.' });
  };

  return (
    <div className="mt-6 rounded-lg border border-amber-300 bg-white/70 p-4">
      <div className="mb-1 flex items-center gap-2">
        <h4 className="text-sm font-semibold">Who can use manager access codes</h4>
        <Badge variant="outline" className="text-xs">Managers always included</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Switch access on or off per person. Anyone listed and switched on can see these codes here and
        apply them at checkout while signed in on the same browser.
      </p>

      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground">No extra people added yet.</p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.email}</p>
                {g.note && <p className="truncate text-xs text-muted-foreground">{g.note}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{g.enabled ? 'On' : 'Off'}</span>
                <Switch
                  checked={g.enabled}
                  disabled={!canManage}
                  onCheckedChange={async (checked) => {
                    const res = await setGrantEnabled(g.id, checked);
                    if (res.error) {
                      toast({ title: 'Could not update access', description: res.error, variant: 'destructive' });
                    }
                  }}
                  aria-label={`Manager code access for ${g.email}`}
                />
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const res = await removeGrant(g.id);
                      if (res.error) {
                        toast({ title: 'Could not remove access', description: res.error, variant: 'destructive' });
                      }
                    }}
                    aria-label={`Remove ${g.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@buyawarranty.co.uk"
            className="max-w-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={busy || !email.trim()}>
            <UserPlus className="mr-2 h-4 w-4" />
            Give access
          </Button>
        </div>
      )}
    </div>
  );
}
