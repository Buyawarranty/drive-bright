import { describe, it, expect } from 'vitest';
import { frameAlertText } from './CopyAlertButton';

// A stuck-checkout alert exactly as the panel builds it, so the assertions
// cover the multi-line shape that actually gets copied.
const CHECKOUT_ALERT = [
  '6 customers stuck on checkout',
  '6 ready to call now',
  '',
  'Tom',
  'stuck on checkout · came in 13:40 · 45min ago',
  'DA67 HVT · Premium Car Plan · £600',
  'Call now: 07842 752345',
].join('\n');

describe('copied alert text emoji framing', () => {
  it('puts one emoji at the very start and one at the very end', () => {
    const out = frameAlertText(CHECKOUT_ALERT, '🔒');
    expect(out.startsWith('🔒 ')).toBe(true);
    expect(out.endsWith(' 🔒')).toBe(true);
  });

  it('leaves every line of the alert untouched between the two emojis', () => {
    const out = frameAlertText(CHECKOUT_ALERT, '🔒');
    expect(out).toBe(`🔒 ${CHECKOUT_ALERT} 🔒`);
    // The phone number must still sit on its own line, not be glued to anything.
    expect(out.split('\n')[6]).toBe('Call now: 07842 752345 🔒');
  });

  it('copies the alert exactly as built when no emoji is given', () => {
    expect(frameAlertText(CHECKOUT_ALERT)).toBe(CHECKOUT_ALERT);
    expect(frameAlertText(CHECKOUT_ALERT, '')).toBe(CHECKOUT_ALERT);
  });

  it('uses a different emoji per alert kind', () => {
    expect(frameAlertText('Chat customer wants someone', '💬')).toBe('💬 Chat customer wants someone 💬');
    expect(frameAlertText('Payment failed', '⚠️')).toBe('⚠️ Payment failed ⚠️');
    expect(frameAlertText('Price beat request', '💷')).toBe('💷 Price beat request 💷');
    expect(frameAlertText('Hot WhatsApp Lead', '📲')).toBe('📲 Hot WhatsApp Lead 📲');
  });
});
