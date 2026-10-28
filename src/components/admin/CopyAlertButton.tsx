import React from 'react';
import { Copy, Check } from 'lucide-react';
import { recordLeadAccess } from '@/lib/leadAccessAudit';

interface Props {
  leadIds?: string[];
  /** Plain text placed on the clipboard. */
  text: string;
  /** Accessible label, e.g. "Copy stuck checkout alert". */
  label: string;
  /** Optional visible caption next to the icon. */
  caption?: string;
  /** Extra classes for the button. */
  className?: string;
  /**
   * Emoji placed at the start and the end of the copied text, so the message
   * stands out in a WhatsApp thread and the team can see at a glance which
   * kind of alert it is.
   */
  emoji?: string;
}

/**
 * Puts the alert's emoji at the very start and the very end of the copied
 * text, so the message stands out in a WhatsApp thread and the team can see
 * at a glance which kind of alert it is. The middle is left exactly as built
 * by the panel — nothing is reworded or reordered.
 */
export const frameAlertText = (text: string, emoji?: string): string =>
  emoji ? `${emoji} ${text} ${emoji}` : text;

/**
 * Small copy button for Live Alerts pop-ups. Copies the whole alert as plain
 * text (name, reg, plan, price, phone — not just the number) so it can be
 * pasted straight into WhatsApp or any other message to the sales team.
 */
export const CopyAlertButton: React.FC<Props> = ({ text, label, caption, className, emoji, leadIds = [] }) => {
  const [copied, setCopied] = React.useState(false);

  const payload = frameAlertText(text, emoji);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // Fallback for browsers without clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      try { if (!document.execCommand('copy')) { ta.remove(); return; } } catch { ta.remove(); return; }
      ta.remove();
    }
    for (const id of new Set(leadIds)) void recordLeadAccess(id, 'phone_copy', 'alert_text');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className={
        className ??
        'inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50'
      }
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {caption ? (copied ? 'Copied' : caption) : null}
    </button>
  );
};

export default CopyAlertButton;
