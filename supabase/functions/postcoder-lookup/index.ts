import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface PostcoderAddress {
  summaryline?: string;
  organisation?: string;
  buildingname?: string;
  buildingnumber?: string;
  premise?: string;
  street?: string;
  dependentlocality?: string;
  posttown?: string;
  county?: string;
  postcode?: string;
  addressline1?: string;
  addressline2?: string;
  addressline3?: string;
}

/** Normalise a Postcoder address into the shape the front end expects. */
const normalise = (a: PostcoderAddress) => {
  const line1 = (a.addressline1 || [a.organisation, a.premise, a.street].filter(Boolean).join(' ')).trim();
  const line2 = (a.addressline2 && a.addressline2 !== a.posttown ? a.addressline2 : a.dependentlocality || '').trim();
  return {
    line_1: line1,
    line_2: line2,
    line_3: (a.addressline3 || '').trim(),
    town_or_city: (a.posttown || '').trim(),
    county: (a.county || '').trim(),
    postcode: (a.postcode || '').trim(),
    building_number: (a.buildingnumber || '').trim(),
    building_name: (a.buildingname || '').trim(),
    street: (a.street || '').trim(),
    posttown: (a.posttown || '').trim(),
    formatted_address: a.summaryline || [line1, line2, a.posttown, a.county, a.postcode].filter(Boolean).join(', '),
  };
};

type Normalised = ReturnType<typeof normalise>;

/**
 * Postcoder-style drill-down: when a broad search (town, area, partial street)
 * returns many addresses, return clickable "container" groups instead, e.g.
 * "London Road, Portsmouth (12 addresses)". The client re-searches with the
 * container's label until the results fit on one screen, then shows the final
 * addresses.
 */
const buildSuggestions = (term: string, addresses: Normalised[]) => {
  const looksLikePostcode = /[0-9][A-Z]{2}$/i.test(term.replace(/\s+/g, ''));

  const toFinal = (list: Normalised[]) =>
    list.map((a, i) => ({
      id: `as-${i}`,
      address: a.formatted_address,
      url: '',
      count: 1,
      type: 'address',
      resolved: a,
    }));

  // Full postcodes and small result sets show final addresses straight away.
  if (looksLikePostcode || addresses.length <= 15) return toFinal(addresses);

  // Group by street + town; fall back to town alone when there are too many streets.
  const group = (keyFn: (a: Normalised) => string) => {
    const map = new Map<string, { label: string; count: number }>();
    for (const a of addresses) {
      const label = keyFn(a);
      if (!label) continue;
      const entry = map.get(label) || { label, count: 0 };
      entry.count += 1;
      map.set(label, entry);
    }
    return [...map.values()];
  };

  const streetKey = (a: Normalised) =>
    [a.street, a.posttown].filter(Boolean).join(', ');
  const townKey = (a: Normalised) => [a.posttown, a.county].filter(Boolean).join(', ');

  let groups = group(streetKey);
  if (groups.length > 20) groups = group(townKey);
  // A single group means the search is already narrow enough - show addresses.
  if (groups.length <= 1) return toFinal(addresses.slice(0, 50));

  return groups.map((g, i) => ({
    id: `c-${i}`,
    address: g.label,
    url: '',
    count: g.count,
    type: 'container',
    container: true,
    drill: g.label,
  }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('POSTCODER_API_KEY');
    if (!apiKey) {
      console.error('POSTCODER_API_KEY not configured');
      return json({ error: 'Address lookup is not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const term = typeof body?.term === 'string' ? body.term.trim() : '';
    const postcode = typeof body?.postcode === 'string' ? body.postcode.trim() : '';
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const drillDown = body?.drillDown === true;
    const base = `https://ws.postcoder.com/pcw/${encodeURIComponent(apiKey)}`;

    /** Free-text address search (postcode, street or town) via the address endpoint. */
    const addressSearch = async (query: string) => {
      const url = `${base}/address/uk/${encodeURIComponent(query)}?format=json&lines=2&maximumresults=100`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error('Postcoder address search error', res.status, text);
        return null;
      }
      const rows = (await res.json()) as PostcoderAddress[];
      return (Array.isArray(rows) ? rows : []).map(normalise);
    };

    if (action === 'autocomplete' || action === 'search') {
      if (term.length < 3) return json({ suggestions: [] });

      // A container has already been selected. Resolve that exact street/area
      // into its individual addresses instead of grouping it into itself again.
      if (drillDown) {
        const addresses = await addressSearch(term);
        if (!addresses) return json({ suggestions: [], error: 'Lookup failed' }, 502);
        return json({ suggestions: addresses.slice(0, 100).map((a, i) => ({
          id: `as-${i}`,
          address: a.formatted_address,
          url: '',
          count: 1,
          type: 'address',
          resolved: a,
        })) });
      }

      // Preferred: Postcoder autocomplete (needs the autocomplete product on the key)
      const url = `${base}/autocomplete/find?query=${encodeURIComponent(term)}&country=uk&format=json&maximumresults=25`;
      const res = await fetch(url);
      if (res.ok) {
        const rows = (await res.json()) as Array<Record<string, unknown>>;
        const suggestions = (Array.isArray(rows) ? rows : []).map((r) => ({
          id: String(r.id ?? ''),
          address: [r.summaryline, r.locationsummary].filter(Boolean).join(', '),
          url: '',
          count: Number(r.count ?? 1),
          type: String(r.type ?? ''),
        }));
        if (suggestions.length > 0) return json({ suggestions });
      } else {
        console.warn('Postcoder autocomplete unavailable', res.status, '- using address search');
      }

      // Fallback: full address search works for postcodes, streets and towns
      const addresses = await addressSearch(term);
      if (!addresses) return json({ suggestions: [], error: 'Lookup failed' }, 502);
      return json({ suggestions: buildSuggestions(term, addresses) });
    }


    if (action === 'get') {
      if (!id) return json({ error: 'Address id is required' }, 400);
      const url = `${base}/autocomplete/retrieve?id=${encodeURIComponent(id)}&query=${encodeURIComponent(term)}&country=uk&format=json&lines=2`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error('Postcoder retrieve error', res.status, text);
        return json({ error: `Lookup failed (${res.status})` }, 502);
      }
      const rows = (await res.json()) as PostcoderAddress[];
      const first = Array.isArray(rows) ? rows[0] : undefined;
      if (!first) return json({ error: 'Address not found' }, 404);
      // If the id resolved to a container (e.g. a street), return the list instead.
      if (Array.isArray(rows) && rows.length > 1) {
        return json({ ...normalise(first), addresses: rows.map(normalise) });
      }
      return json(normalise(first));
    }

    if (action === 'find') {
      const clean = postcode.replace(/\s+/g, '').toUpperCase();
      if (!clean) return json({ error: 'Postcode is required' }, 400);
      const url = `${base}/address/UK/${encodeURIComponent(clean)}?format=json&lines=2`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error('Postcoder find error', res.status, text);
        if (res.status === 404) return json({ addresses: [], message: 'No addresses found' });
        return json({ addresses: [], error: `Lookup failed (${res.status})` }, 502);
      }
      const rows = (await res.json()) as PostcoderAddress[];
      const addresses = (Array.isArray(rows) ? rows : []).map(normalise);
      return json({ addresses, postcode: addresses[0]?.postcode || clean });
    }

    return json({ error: 'Invalid action. Use: autocomplete, get or find' }, 400);
  } catch (error) {
    console.error('postcoder-lookup error', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
