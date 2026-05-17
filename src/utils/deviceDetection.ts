/**
 * Detect the device type the customer is using.
 * Returns 'mobile' | 'tablet' | 'desktop'.
 * Falls back to 'desktop' in non-browser contexts.
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return 'desktop';
  }

  const ua = (navigator.userAgent || '').toLowerCase();

  // Tablet detection first (iPad, Android tablet, Surface, Kindle)
  const isTablet =
    /ipad/.test(ua) ||
    (/android/.test(ua) && !/mobile/.test(ua)) ||
    /tablet|kindle|silk|playbook/.test(ua) ||
    // Modern iPadOS reports as Mac; fall back to touch + large screen
    (/macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);

  if (isTablet) return 'tablet';

  const isMobile =
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini|iemobile/.test(ua);

  if (isMobile) return 'mobile';

  // Last-resort viewport check for very small screens
  if (window.innerWidth && window.innerWidth < 640) return 'mobile';

  return 'desktop';
}
