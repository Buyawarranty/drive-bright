import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), error: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));
import { requireCustomerDataExport } from './customerDataExport';

describe('live customer-data export check', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects revoked grants rather than using previous access', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await requireCustomerDataExport()).toBe(true);
    expect(await requireCustomerDataExport()).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it('rejects unavailable permission checks', async () => {
    mocks.rpc.mockRejectedValue(new Error('unavailable'));
    expect(await requireCustomerDataExport()).toBe(false);
  });
  it('never accepts an error response even when it contains true', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: { message: 'denied' } });
    expect(await requireCustomerDataExport()).toBe(false);
  });
});