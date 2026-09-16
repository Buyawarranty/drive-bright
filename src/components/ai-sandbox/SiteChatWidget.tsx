import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Minus, Expand, Shrink, MessageSquare, RotateCcw } from 'lucide-react';
import SandboxChatWindow from '@/components/ai-sandbox/SandboxChatWindow';
import milesAvatar from '@/assets/miles-avatar.png.asset.json';
import {
  loadGuestChatOpen,
  saveGuestChatOpen,
  clearGuestChat,
  loadGuestMessages,
} from '@/components/ai-sandbox/guestChatStore';


const TOKEN_KEY = 'baw_chat_guest_token';
// Once the visitor has opened the chat, the launcher never auto-expands again.
const QUIET_KEY = 'baw_chat_launcher_quiet';

function launcherQuiet(): boolean {
  try {
    return window.localStorage.getItem(QUIET_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The random per-browser token that owns a website visitor's conversation.
 * Nothing personal is stored — it just lets the same visitor keep one thread.
 */
function newGuestToken(): string {
  const fresh = crypto.randomUUID();
  try {
    window.localStorage.setItem(TOKEN_KEY, fresh);
  } catch {
    /* ignore */
  }
  return fresh;
}

function getGuestToken(): string {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing && existing.length >= 16) return existing;
    return newGuestToken();
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
  greeting = 'Hi - need any help?',
}: {
  source?: string;
  greeting?: string;
}) {
  // If the visitor was mid-conversation and we sent them to another page
  // (e.g. checkout step 3), re-open the panel with their transcript intact.
  const [open, setOpen] = useState(() => loadGuestChatOpen());
  const [everOpened, setEverOpened] = useState(() => loadGuestChatOpen());
  const [expanded, setExpanded] = useState(false);
  // Bumped when a conversation is ended so the chat window remounts empty.
  const [sessionKey, setSessionKey] = useState(0);
  // The panda circle expands into the "Need help? Chat with us" pill only
  // briefly — after 15s or a meaningful scroll — then collapses again.
  const [promptExpanded, setPromptExpanded] = useState(false);
  const expansionsRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) tokenRef.current = getGuestToken();

  // Never show the chat once the visitor is inside the quote journey (steps 2-4)
  // or on checkout/cart pages — it sits over the call-to-action buttons there.
  const location = useLocation();
  const navigate = useNavigate();
  const stepParam = new URLSearchParams(location.search).get('step') || '';
  const stepNumber = parseInt(stepParam.replace(/[^0-9]/g, ''), 10);
  const onQuoteStep = Number.isFinite(stepNumber) && stepNumber > 1;
  const onCheckoutRoute = /\/(cart|checkout|warranty-plan|payment)/i.test(location.pathname);
  const hidden = onQuoteStep || onCheckoutRoute;



  // Auto-expansion: circle only on load; expand to the pill after 15s or a
  // meaningful scroll, hold ~5s, collapse. Mobile gets one expansion; desktop
  // can afford two. Once the visitor opens the chat, this never fires again.
  useEffect(() => {
    if (everOpened || launcherQuiet()) return;
    const desktop = window.matchMedia('(min-width: 640px)').matches;
    const maxExpansions = desktop ? 2 : 1;
    const holdMs = desktop ? 6000 : 5000;

    const expand = () => {
      if (expansionsRef.current >= maxExpansions) return;
      expansionsRef.current += 1;
      setPromptExpanded(true);
      timersRef.current.push(window.setTimeout(() => setPromptExpanded(false), holdMs));
    };

    timersRef.current.push(window.setTimeout(expand, 15000));

    let scrolled = false;
    const onScroll = () => {
      if (scrolled || window.scrollY < 500) return;
      scrolled = true;
      expand();
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Desktop second chance: if they ignored the first expansion, one more later.
    if (desktop) timersRef.current.push(window.setTimeout(expand, 90000));

    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      window.removeEventListener('scroll', onScroll);
    };
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
    setPromptExpanded(false);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    try {
      window.localStorage.setItem(QUIET_KEY, '1');
    } catch {
      /* ignore */
    }
    saveGuestChatOpen(true);
  };

  // Minimise: keep the transcript so the visitor can pick up where they left off.
  const closeChat = () => {
    setOpen(false);
    saveGuestChatOpen(false);
  };

  // Close (X): just closes the panel. The transcript is KEPT — visitors expect
  // to reopen the chat and still see what was said, so closing must never wipe it.
  const endChat = () => {
    setOpen(false);
    saveGuestChatOpen(false);
  };

  // The only way to wipe a conversation: an explicit "Start a new chat".
  const startNewChat = () => {
    clearGuestChat(tokenRef.current);
    tokenRef.current = newGuestToken();
    setSessionKey((k) => k + 1);
    saveGuestChatOpen(true);
    setOpen(true);
    setEverOpened(true);
  };


  // On the quote steps / checkout the panel is hidden, but a visitor who came
  // from the chat needs a one-tap way back to the chat on the main page.
  const hasTranscript = (() => {
    try {
      return loadGuestMessages(tokenRef.current ?? '').length > 0;
    } catch {
      return false;
    }
  })();

  if (hidden) {
    if (!hasTranscript) return null;
    return (
      <div className="fixed bottom-52 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          onClick={() => {
            saveGuestChatOpen(true);
            setEverOpened(true);
            setOpen(true);
            navigate('/');
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-background/95 py-1.5 pl-4 pr-1.5 text-sm font-semibold text-foreground shadow-lg shadow-black/10 backdrop-blur transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
          Back to Miles
          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            <img
              src={milesAvatar.url}
              alt="Miles the panda"
              width={36}
              height={36}
              className="h-full w-full scale-[1.35] object-cover object-center"
              loading="lazy"
            />
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Launcher — closed state: panda circle on mobile, larger labelled pill on desktop */}
      {!open && (
        <div className="fixed bottom-52 right-4 z-40 sm:bottom-6 sm:right-6">
          <button
            onClick={openChat}
            aria-label="Chat with Miles, our AI warranty assistant"
            className="group flex items-center rounded-full border border-border bg-background/95 p-1.5 shadow-lg shadow-black/10 backdrop-blur transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:gap-3 sm:pl-4 sm:pr-3"
          >
            {/* Desktop label — always visible */}
            <span className="hidden items-center gap-2 text-base font-semibold text-foreground sm:flex">
              <MessageSquare className="h-5 w-5 shrink-0 text-primary" />
              Chat with Miles
            </span>

            {/* Mobile prompt — expands briefly */}
            <span
              className={`flex items-center gap-2 overflow-hidden whitespace-nowrap text-sm font-medium text-foreground transition-all duration-300 ease-in-out sm:hidden ${
                promptExpanded ? 'max-w-[220px] pl-3 pr-1 opacity-100' : 'max-w-0 p-0 opacity-0'
              }`}
              aria-hidden={!promptExpanded}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              Need help? Chat with us
            </span>

            <span className="relative shrink-0">
              <span className="block h-12 w-12 overflow-hidden rounded-full ring-1 ring-border sm:h-14 sm:w-14">
                <img
                  src={milesAvatar.url}
                  alt="Miles the panda"
                  width={48}
                  height={48}
                  className="h-full w-full scale-[1.35] object-cover object-center"
                />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500 sm:h-3.5 sm:w-3.5" />
            </span>
          </button>
        </div>
      )}

      {/* Chat panel — kept mounted after first open so minimising keeps history */}
      {everOpened && (
        <div
          className={`fixed z-[70] flex w-full max-w-full flex-col overflow-hidden border border-border bg-background shadow-2xl ${
            open ? 'flex' : 'hidden'
          } inset-0 h-[100dvh] rounded-none sm:inset-auto sm:bottom-6 sm:right-6 sm:max-h-[calc(100vh-3rem)] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl ${
            expanded ? 'sm:h-[860px] sm:w-[680px]' : 'sm:h-[calc(100vh-6rem)] sm:w-[480px]'

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
              <p className="truncate text-lg font-bold leading-tight text-foreground">Miles</p>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                AI agent
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="font-semibold text-emerald-600">Online</span>
              </p>
            </div>
            <button
              onClick={startNewChat}
              aria-label="Start a new chat"
              title="Start a new chat"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={closeChat}
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
              onClick={endChat}
              aria-label="Close chat"
              className="rounded-md p-2 text-black transition-colors hover:bg-muted"
            >
              <X className="h-8 w-8" strokeWidth={3} />
            </button>

          </div>

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <SandboxChatWindow key={sessionKey} guestToken={tokenRef.current ?? undefined} source={source} compact autoFocus={false} />
          </div>
        </div>
      )}
    </>
  );
}
