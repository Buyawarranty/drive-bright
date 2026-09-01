import React from 'react';
import { PhoneCall, X, Volume2, VolumeX, Headset } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSandboxHandoverAlert } from '@/hooks/useSandboxHandoverAlert';
import { useChatbotPopupAccess } from '@/hooks/useChatbotPopupAccess';
import { Button } from '@/components/ui/button';


const since = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

/**
 * Ringing pop-up for management / staff when a sandbox chat customer asks to
 * speak to a human warranty specialist. Plays a telephone ring on arrival and
 * keeps ringing while anyone is still waiting.
 */
export const SandboxHandoverAlerts: React.FC = () => {
  const { allowed } = useChatbotPopupAccess();
  const { waiting, muted, setMuted, dismiss, claim } = useSandboxHandoverAlert({
    enabled: allowed,
    audioEnabled: allowed,
  });
  const navigate = useNavigate();
  const [, force] = React.useState(0);

  React.useEffect(() => {
    if (waiting.length === 0) return;
    const t = window.setInterval(() => { if (document.hidden) return; force((n) => n + 1); }, 1000);
    return () => window.clearInterval(t);
  }, [waiting.length]);

  if (!allowed || waiting.length === 0) return null;

  return (
    <div className="fixed left-2 bottom-2 z-[120] flex w-[300px] max-w-[calc(100vw-1rem)] flex-col gap-2">
      {waiting.map((w) => (
        <div
          key={w.id}
          className="animate-in slide-in-from-left-4 rounded-lg border-2 border-primary bg-card p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <PhoneCall className="h-4 w-4 animate-pulse" />
              Customer waiting for a specialist
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={muted ? 'Ring is muted — click to unmute' : 'Mute the ring'}
                aria-label={muted ? 'Unmute ring' : 'Mute ring'}
                onClick={() => setMuted(!muted)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  muted
                    ? 'border-muted bg-muted text-muted-foreground'
                    : 'border-primary/30 text-primary hover:bg-primary/10'
                }`}
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {muted ? 'Muted' : 'Mute'}
              </button>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(w.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">
              {w.customer_name || 'AI sandbox chat'}
              {w.registration ? ` · ${w.registration}` : ''}
            </div>
            {w.cover_summary && <div>{w.cover_summary}</div>}
            {w.quoted_price ? <div>Quoted £{Math.round(w.quoted_price)}</div> : null}
            {w.reason && <div>Reason: {w.reason.replace(/_/g, ' ')}</div>}
            <div>Waiting {since(w.created_at)}</div>
          </div>

          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="h-7 flex-1 px-2 text-xs"
              onClick={async () => {
                await claim(w.id);
                navigate(`/ai-sandbox/${w.thread_id}`);
              }}
            >
              <Headset className="mr-1 h-3.5 w-3.5" />
              Take the chat
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SandboxHandoverAlerts;
