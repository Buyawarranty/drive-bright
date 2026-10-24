import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALL_STATS_REFRESH_MS, startCallRefresh } from './callRefresh';
afterEach(() => vi.useRealTimers());
describe('live call refresh', () => {
  it('reads again every 30 seconds instead of keeping the opening totals', async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => {});
    const visibility = { visibilityState: 'visible' as DocumentVisibilityState, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const watcher = startCallRefresh(read, visibility);
    await vi.advanceTimersByTimeAsync(250);
    expect(read).toHaveBeenCalledTimes(1);
    expect(CALL_STATS_REFRESH_MS).toBe(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(2);
    watcher.stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('pauses behind the dialler and reads fresh totals when visible again', async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => {});
    const visibility = { visibilityState: 'hidden' as DocumentVisibilityState, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const watcher = startCallRefresh(read, visibility);
    await vi.advanceTimersByTimeAsync(30_250);
    expect(read).not.toHaveBeenCalled();
    visibility.visibilityState = 'visible';
    await watcher.refresh();
    expect(read).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});