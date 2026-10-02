import React from 'react';
import { Label } from '@/components/ui/label';
import { POPUP_TYPES, popupKey } from '@/lib/popupAccess';

type Mode = 'default' | 'on' | 'off';

/** Pop-ups section in User Permissions: Default (by role) / On / Off per pop-up type. */
export const PopupPermissionsSection: React.FC<{
  perms: Record<string, boolean>;
  role?: string;
  onChange: (next: Record<string, boolean>) => void;
}> = ({ perms, role, onChange }) => {
  const set = (id: string, mode: Mode) => {
    const next = { ...perms };
    const k = popupKey(id);
    if (mode === 'default') delete next[k];
    else next[k] = mode === 'on';
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">Pop-ups (Live Alerts)</Label>
      <p className="text-xs text-muted-foreground">Choose which pop-ups this person sees. "Default" follows their role.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border rounded-lg p-3">
        {POPUP_TYPES.map((t) => {
          const k = popupKey(t.id);
          const mode: Mode = k in perms ? (perms[k] ? 'on' : 'off') : 'default';
          const defOn = t.defaultRoles === 'all' || t.defaultRoles.includes(role || '');
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.description}</div>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-md border text-xs">
                {(['default', 'on', 'off'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set(t.id, m)}
                    className={`px-2 py-1 ${mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  >
                    {m === 'default' ? `Default (${defOn ? 'on' : 'off'})` : m === 'on' ? 'On' : 'Off'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
