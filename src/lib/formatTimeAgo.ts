/**
 * Shared "time ago" formatter for admin pop-ups and panels.
 * Under an hour: "25min ago". Over an hour: "1hr 13min ago" / "2hr ago".
 * Over a day: "2d ago".
 */
export function formatTimeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}hr ${m}min ago` : `${h}hr ago`;
  return `${Math.floor(h / 24)}d ago`;
}
