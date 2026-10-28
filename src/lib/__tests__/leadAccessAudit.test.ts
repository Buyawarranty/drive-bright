import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { recordLeadAccess } from '../leadAccessAudit';
const id = '005a8752-0000-4000-8000-000000000000';
describe('Lead access audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({data:'real-actor',error:null});
    mocks.insert.mockResolvedValue({error:null});
    mocks.from.mockReturnValue({insert:mocks.insert});
  });
  it('records each opening separately with authenticated identity and no client timestamp', async () => {
    await recordLeadAccess(id,'lead_open','lead_details');
    await recordLeadAccess(id,'lead_open','lead_details');
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith({lead_id:id,actor_id:'real-actor',action:'lead_open',source:'lead_details'});
  });
  it('records phone copies without the phone value', async () => {
    await recordLeadAccess(id,'phone_copy','lead_row');
    expect(mocks.insert).toHaveBeenCalledWith({lead_id:id,actor_id:'real-actor',action:'phone_copy',source:'lead_row'});
  });
  it('does not create guest events', async () => {
    mocks.rpc.mockResolvedValue({data:null,error:null});
    const warn = vi.spyOn(console,'warn').mockImplementation(() => {});
    await recordLeadAccess(id,'lead_open','lead_details');
    expect(mocks.insert).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('ignores sandbox/non-lead identifiers', async () => {
    await recordLeadAccess('test-123','lead_open','lead_details');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});