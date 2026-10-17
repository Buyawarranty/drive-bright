/** Only the site-default image has authoritative built-in dimensions. */
export const DEFAULT_SOCIAL_IMAGE = 'https://buyawarranty.co.uk/og-buyawarranty.jpg?v=2';
export const DEFAULT_SOCIAL_IMAGE_ALT = 'Buy A Warranty — car, van, EV and motorbike warranty from just 60p a day';

export function socialImageMetadata(image: string, options: { width?: string; height?: string; alt?: string; fallbackAlt?: string } = {}) {
  const isDefault = image === DEFAULT_SOCIAL_IMAGE;
  return {
    width: options.width ?? (isDefault ? '1200' : undefined),
    height: options.height ?? (isDefault ? '630' : undefined),
    alt: options.alt || (isDefault ? DEFAULT_SOCIAL_IMAGE_ALT : options.fallbackAlt || ''),
  };
}