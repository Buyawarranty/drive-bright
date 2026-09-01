/**
 * UK-style telephone ring tone, generated with the Web Audio API so no audio
 * asset is needed. Used to alert management / staff that a sandbox chat
 * customer is waiting to be picked up by a human specialist.
 *
 * Pattern (BT "ringing tone"): two warbling tones at 400Hz + 450Hz,
 * 0.4s on, 0.2s gap, 0.4s on, then ~2s silence before the next burst.
 */

let ctx: AudioContext | null = null;
let stopAt = 0;

/** Immediately cancel both audible and already-scheduled ring bursts. */
export function stopPhoneRing() {
  const active = ctx;
  ctx = null;
  stopAt = 0;
  if (active && active.state !== 'closed') void active.close().catch(() => undefined);
}

function audioCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx || ctx.state === 'closed') ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function burst(ac: AudioContext, at: number, duration: number, volume: number) {
  const gain = ac.createGain();
  gain.connect(ac.destination);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.02);
  gain.gain.setValueAtTime(volume, at + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, at + duration);

  for (const freq of [400, 450]) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + duration);
  }
}

/** Play one double-burst ring (~1s). Safe to call repeatedly. */
export function playPhoneRing(volume = 0.16) {
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  if (now < stopAt) return; // already ringing
  burst(ac, now + 0.01, 0.4, volume);
  burst(ac, now + 0.61, 0.4, volume);
  stopAt = now + 1.05;
}

/** Ring for a few cycles so it is hard to miss. */
export function playPhoneRingBurst(cycles = 3, volume = 0.16) {
  const ac = audioCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (let i = 0; i < cycles; i += 1) {
    const base = now + 0.01 + i * 3;
    burst(ac, base, 0.4, volume);
    burst(ac, base + 0.6, 0.4, volume);
  }
  stopAt = now + cycles * 3;
}
