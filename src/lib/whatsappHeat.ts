/** Hot lead badges for WhatsApp conversations. Scoring itself happens server-side. */

export type WhatsAppHeat = 'hot' | 'warm' | 'normal';

export const HEAT_ORDER: Record<WhatsAppHeat, number> = { hot: 0, warm: 1, normal: 2 };

export interface HeatBadge {
  label: string;
  emoji: string;
  className: string;
}

export const HEAT_BADGES: Record<WhatsAppHeat, HeatBadge> = {
  hot: { label: 'Hot', emoji: '🔥', className: 'bg-destructive text-destructive-foreground' },
  warm: { label: 'Warm', emoji: '🟠', className: 'bg-orange-100 text-orange-800 border border-orange-300' },
  normal: { label: 'Normal', emoji: '⚪', className: 'bg-muted text-muted-foreground border border-border' },
};

export function heatBadge(heat: string | null | undefined): HeatBadge {
  const key = (heat || 'normal') as WhatsAppHeat;
  return HEAT_BADGES[key] ?? HEAT_BADGES.normal;
}

export function heatRank(heat: string | null | undefined): number {
  const key = (heat || 'normal') as WhatsAppHeat;
  return HEAT_ORDER[key] ?? 2;
}

/** Pretty UK display for a stored international number. */
export function prettyWhatsAppPhone(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('44') && d.length >= 12) {
    const local = `0${d.slice(2)}`;
    return `${local.slice(0, 5)} ${local.slice(5)}`.trim();
  }
  return raw || '';
}
