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
      {/* Launcher — closed state */}
      {!open && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-end gap-2 sm:bottom-6 sm:right-6">
          {showNudge && (
            <button
              onClick={openChat}
              className="mb-2 hidden max-w-[220px] rounded-2xl rounded-br-sm border border-border bg-background px-3 py-2 text-left text-sm shadow-lg sm:block"
            >
              {greeting}
            </button>
          )}
          <button
            onClick={openChat}
            aria-label="Chat with Miles, our AI warranty assistant"
            className="group flex items-center gap-3 rounded-full border-2 border-[#1F2A5B] bg-background py-2 pl-2 pr-5 shadow-xl transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className="relative shrink-0">
              <span className="block h-12 w-12 overflow-hidden rounded-full ring-1 ring-border">
                <img
                  src={milesAvatar.url}
                  alt="Miles the panda"
                  width={48}
                  height={48}
                  className="h-full w-full scale-[1.35] object-cover object-center"
                />
              </span>
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-green-500" />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-base font-bold text-foreground">Ask Miles</span>
              <span className="block text-sm text-muted-foreground">AI assistant + live team</span>
            </span>
            <MessageCircle className="h-5 w-5 text-muted-foreground sm:hidden" />
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
            <span className="relative shrink-0">
              <span className="block h-11 w-11 overflow-hidden rounded-full ring-1 ring-border">
                <img
                  src={milesAvatar.url}
                  alt="Miles the panda"
                  width={44}
                  height={44}
                  className="h-full w-full scale-[1.35] object-cover object-center"
                  loading="lazy"
                />
              </span>
              <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
            </span>
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
