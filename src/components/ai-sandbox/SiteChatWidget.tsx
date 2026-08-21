import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Minus, Expand, Shrink } from 'lucide-react';
import SandboxChatWindow from '@/components/ai-sandbox/SandboxChatWindow';
import milesAvatar from '@/assets/miles-avatar.png.asset.json';

const TOKEN_KEY = 'baw_chat_guest_token';

/**
 * The random per-browser token that owns a website visitor's conversation.
 * Nothing personal is stored — it just lets the same visitor keep one thread.
 */
function getGuestToken(): string {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing && existing.length >= 16) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Floating "chat with Miles" widget for public website pages.
 *
 * Desktop: a 400x600 panel anchored bottom-right, above the page content.
 * Mobile: a full-height sheet so the keyboard and conversation both fit.
 *
 * The window stays mounted once opened so minimising keeps the conversation.
 */
export default function SiteChatWidget({
  source = 'website',
  greeting = 'Hi — need a warranty price?',
}: {
  source?: string;
  greeting?: string;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) tokenRef.current = getGuestToken();

  useEffect(() => {
    if (everOpened) return;
    const t = window.setTimeout(() => setShowNudge(true), 6000);
    return () => window.clearTimeout(t);
  }, [everOpened]);

  // Lock background scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const mobile = window.matchMedia('(max-width: 639px)').matches;
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const openChat = () => {
    setOpen(true);
    setEverOpened(true);
    setShowNudge(false);
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-end gap-2 sm:bottom-6 sm:right-6">
          {showNudge && (
            <button
              onClick={openChat}
              className="mb-1 hidden max-w-[220px] rounded-2xl rounded-br-sm border border-border bg-background px-3 py-2 text-left text-sm shadow-lg sm:block"
            >
              {greeting}
            </button>
          )}
          <button
            onClick={openChat}
            aria-label="Chat with Miles, our AI warranty assistant"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Chat panel — kept mounted after first open so minimising keeps history */}
      {everOpened && (
        <div
          className={`fixed z-[70] flex flex-col overflow-hidden border border-border bg-background shadow-2xl ${
            open ? 'flex' : 'hidden'
          } inset-0 rounded-none sm:inset-auto sm:bottom-6 sm:right-6 sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl ${
            expanded ? 'sm:h-[760px] sm:w-[520px]' : 'sm:h-[600px] sm:w-[400px]'
          }`}
          role="dialog"
          aria-label="Chat with Miles"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
            <img
              src={milesAvatar.url}
              alt="Miles the panda"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full ring-1 ring-border"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">Miles · Warranty Assistant</p>
              <p className="truncate text-sm text-muted-foreground">AI assistant · Specialist available</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimise chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Shrink chat' : 'Expand chat'}
              className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
            >
              {expanded ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <SandboxChatWindow guestToken={tokenRef.current!} source={source} compact autoFocus={false} />
          </div>
        </div>
      )}
    </>
  );
}
