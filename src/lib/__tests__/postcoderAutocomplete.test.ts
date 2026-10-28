import { describe, expect, it } from 'vitest';
import { autocompleteUrl } from '../../../supabase/functions/postcoder-lookup/autocompleteUrl';

describe('Postcoder address search', () => {
  it('searches Wembley using the supported autocomplete endpoint', () => {
    const url = new URL(autocompleteUrl('test-key', 'find', 'wembley'));
    expect(url.pathname).toBe('/pcw/autocomplete/find');
    expect(url.searchParams.get('query')).toBe('wembley');
    expect(url.searchParams.get('apikey')).toBe('test-key');
  });
  it('preserves 7 silchester apartments in an apartment search', () => {
    expect(new URL(autocompleteUrl('test-key', 'find', '7 silchester apartments')).searchParams.get('query')).toBe('7 silchester apartments');
  });
  it('drills into towns with pathfilter rather than retrieving them as addresses', () => {
    const url = new URL(autocompleteUrl('test-key', 'find', 'wembley', 'UK@LOC|Wembley'));
    expect(url.searchParams.get('pathfilter')).toBe('UK@LOC|Wembley');
    expect(url.searchParams.has('id')).toBe(false);
  });
  it('retrieves the selected apartment ID', () => {
    const url = new URL(autocompleteUrl('test-key', 'retrieve', '7 silchester apartments', '54281258'));
    expect(url.pathname).toBe('/pcw/autocomplete/retrieve');
    expect(url.searchParams.get('id')).toBe('54281258');
  });
});