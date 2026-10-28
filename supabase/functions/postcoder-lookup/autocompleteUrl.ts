/** Autocomplete uses a shared endpoint with the server key in the query. */
export function autocompleteUrl(apiKey: string, action: 'find' | 'retrieve', term: string, id = ''): string {
  const url = new URL(`https://ws.postcoder.com/pcw/autocomplete/${action}`);
  url.search = new URLSearchParams({ apikey: apiKey, query: term, country: 'uk', format: 'json', ...(id ? { [action === 'find' ? 'pathfilter' : 'id']: id } : {}) }).toString();
  return url.toString();
}