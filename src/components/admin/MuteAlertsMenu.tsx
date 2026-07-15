import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getMutedUntil,
  isAlertsMuted,
  muteAlertsFor,
  subscribeAlertsMuted,
  unmuteAlerts,
} from '@/lib/alertSoundPreference';

interface Props {
  /** Tailwind classes for the trigger button. */
  className?: string;
  /** Icon size in pixels. */
  size?: number;
}

const formatRemaining = (until: number): string => {
  const ms = until - Date.now();
  if (ms <= 0) return '';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h left`;
  return 'muted';
};

/**
 * Speaker button that opens a menu to mute ALL alert pop-up sounds for a set
 * duration. Shared across every pop-up so agents can silence beeps in one tap.
 */
export const MuteAlertsMenu: React.FC<Props> = ({ className, size = 16 }) => {
  const [muted, setMuted] = useState(() => isAlertsMuted());
  const [until, setUntil] = useState(() => getMutedUntil());

  useEffect(() => {
    const sync = () => {
      setMuted(isAlertsMuted());
      setUntil(getMutedUntil());
    };
    const off = subscribeAlertsMuted(sync);
    // Also poll every 30s so the "expired" state clears when the timer runs
    // out even if nothing else triggers a re-render.
    const t = setInterval(sync, 30000);
    return () => { off(); clearInterval(t); };
  }, []);

  const Icon = muted ? VolumeX : Volume2;
  const label = muted
    ? `Alert sounds muted (${formatRemaining(until)})`
    : 'Mute alert sounds';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            className ??
            'inline-flex items-center justify-center h-7 w-7 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40'
          }
          aria-label={label}
          title={label}
        >
          <Icon width={size} height={size} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[110] w-56 bg-popover">
        <DropdownMenuLabel className="text-xs">
          {muted ? `Muted — ${formatRemaining(until)}` : 'Mute alert sounds'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => muteAlertsFor(15)}>
          Mute for 15 minutes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => muteAlertsFor(60)}>
          Mute for 1 hour
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => muteAlertsFor(4 * 60)}>
          Mute for 4 hours
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => muteAlertsFor(Infinity)}>
          Mute until I unmute
        </DropdownMenuItem>
        {muted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => unmuteAlerts()}>
              Unmute now
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
