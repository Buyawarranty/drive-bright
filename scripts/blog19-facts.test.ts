import { describe, expect, it } from 'vitest';
import blog19 from './blog19-content.json';

describe('Blog 19 structured facts', () => {
  const article = blog19.structured_data['@graph'].find(node => node['@type'] === 'BlogPosting');
  it('records measured source image dimensions, not default hero dimensions', () => {
    expect(article?.image?.width).toBe(1376);
    expect(article?.image?.height).toBe(768);
  });
  it('publishes only FAQs actually present in the supplied article', () => {
    const faq = blog19.structured_data['@graph'].find(node => node['@type'] === 'FAQPage');
    expect(faq?.mainEntity).toHaveLength(5);
    expect(blog19.faqs).toHaveLength(5);
  });
  it('keeps all entities on the single existing blog route', () => {
    expect(article?.mainEntityOfPage?.['@id']).toBe(blog19.canonical_url);
    expect(article?.url).toBe(blog19.canonical_url);
    expect(new URL(blog19.canonical_url).pathname).toBe('/thewarrantyhub/bmw-x5-vs-bmw-5-series/');
  });
});