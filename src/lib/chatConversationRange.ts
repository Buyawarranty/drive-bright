/**
 * One shared rule for whether a chat conversation belongs in the selected date
 * range. Waiting-for-a-reply conversations used to be added to the list no
 * matter the date; now every conversation obeys the filter except one opened
 * straight from a chat pop-up (chatThread deep link).
 */
export function conversationInRange(
  createdAt: string,
  opts: { fromIso?: string | null; toIso?: string | null; rangeDays?: string | number | null; nowMs?: number },
): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;

  if (opts.fromIso || opts.toIso) {
    if (opts.fromIso && t < new Date(opts.fromIso).getTime()) return false;
    if (opts.toIso && t > new Date(opts.toIso).getTime()) return false;
    return true;
  }

  const days = Number(opts.rangeDays);
  if (opts.rangeDays != null && String(opts.rangeDays) !== 'all' && Number.isFinite(days) && days > 0) {
    const now = opts.nowMs ?? Date.now();
    return t >= now - days * 24 * 60 * 60 * 1000;
  }

  return true;
}
