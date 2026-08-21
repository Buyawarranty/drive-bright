import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Minus } from 'lucide-react';
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
          } inset-0 rounded-none sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:rounded-2xl`}
          role="dialog"
          aria-label="Chat with Miles"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-primary px-3 py-2 text-primary-foreground">
            <img
              src={milesAvatar.url}
              alt="Miles the panda"
              width={28}
              height={28}
              className="h-7 w-7 rounded-full ring-1 ring-primary-foreground/40"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Miles · warranty assistant</p>
              <p className="truncate text-[11px] opacity-80">Instant prices · a specialist can join</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimise chat"
              className="rounded-md p-1 hover:bg-primary-foreground/15"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-md p-1 hover:bg-primary-foreground/15 sm:hidden"
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
