import { describe, expect, it } from 'vitest';
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_ALT, socialImageMetadata } from './socialImageMetadata';

describe('Social image metadata', () => {
  it('retains the verified 1200 by 630 default image dimensions', () => {
    expect(socialImageMetadata(DEFAULT_SOCIAL_IMAGE)).toEqual({ width: '1200', height: '630', alt: DEFAULT_SOCIAL_IMAGE_ALT });
  });
  it('does not invent dimensions for a custom article image', () => {
    expect(socialImageMetadata('https://buyawarranty.co.uk/article.jpg', { fallbackAlt: 'Article photo' })).toEqual({ width: undefined, height: undefined, alt: 'Article photo' });
  });
  it('preserves explicitly supplied dimensions and approved image descriptions', () => {
    expect(socialImageMetadata('https://buyawarranty.co.uk/article.jpg', { width: '1600', height: '900', alt: 'Approved photograph description', fallbackAlt: 'Page title' })).toEqual({ width: '1600', height: '900', alt: 'Approved photograph description' });
  });
});