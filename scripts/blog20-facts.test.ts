import { describe, expect, it } from 'vitest';
import blog20 from './blog20-content.json';

describe('Blog 20 structured facts', () => {
  const graph = blog20.structured_data['@graph'] as any[];
  const article = graph.find(n => n['@type'] === 'BlogPosting');
  it('has no placeholders left in the schema', () => {
    expect(JSON.stringify(blog20.structured_data)).not.toContain('REPLACE');
  });
  it('names David Yash as the author', () => {
    expect(article.author).toEqual({ '@type': 'Person', name: 'David Yash' });
  });
  it('keeps the article on the warranty hub route with breadcrumb to the hub', () => {
    expect(new URL(blog20.canonical_url).pathname).toBe('/thewarrantyhub/used-car-warranty-electrical-faults/');
    const crumbs = graph.find(n => n['@type'] === 'BreadcrumbList').itemListElement;
    expect(crumbs[1].item).toBe('https://buyawarranty.co.uk/thewarrantyhub/');
  });
  it('publishes all seven FAQs from the supplied article', () => {
    expect(graph.find(n => n['@type'] === 'FAQPage').mainEntity).toHaveLength(7);
  });
  it('states the policy diagnostic contribution of £50 or one hour', () => {
    expect(blog20.html).toContain('up to £50 or one hour of labour');
  });
});
