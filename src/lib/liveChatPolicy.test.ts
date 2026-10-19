import { describe, expect, it } from 'vitest';
import { liveChatAllowed } from '../../supabase/functions/_shared/live-chat-policy';
describe('main live-chat switch', () => {
  it('off blocks live offers with a specialist online', () => expect(liveChatAllowed(false, true)).toBe(false));
  it('missing setting fails closed', () => expect(liveChatAllowed(undefined, true)).toBe(false));
  it('on requires a fresh specialist', () => expect(liveChatAllowed(true, false)).toBe(false));
  it('on and available permits a request', () => expect(liveChatAllowed(true, true)).toBe(true));
});
