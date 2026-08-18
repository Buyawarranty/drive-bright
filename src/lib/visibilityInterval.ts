/**
 * Visibility-aware polling helpers.
 *
 * Sales agents keep the CRM open all day in several tabs. Every background
 * `setInterval` kept firing while a tab was hidden, so a single machine could
 * be running dozens of Supabase round-trips per minute for tabs nobody was
 * looking at — that is the lag / freeze staff were reporting.
 *
 * These helpers keep the exact same behaviour while the tab is visible, pause
 * the work while it is hidden, and run one catch-up tick the moment the agent
 * comes back, so nothing goes stale.
 */

export const isPageVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Drop-in replacement for `setInterval` that skips ticks while the tab is
 * hidden and fires one catch-up tick when the tab becomes visible again.
 * Returns a cleanup function.
 */
export const setVisibleInterval = (
  fn: () => void,
  ms: number,
  options: { catchUpOnVisible?: boolean } = {},
): (() => void) => {
  const { catchUpOnVisible = true } = options;
  let missed = false;

  const timer = window.setInterval(() => {
    if (!isPageVisible()) {
      missed = true;
      return;
    }
    fn();
  }, ms);

  const onVisible = () => {
    if (!isPageVisible()) return;
    if (catchUpOnVisible && missed) {
      missed = false;
      fn();
    }
  };

  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
};
