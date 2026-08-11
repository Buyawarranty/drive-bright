// Public read-only endpoint: returns the live Trustpilot TrustScore and review
// count for buyawarranty.co.uk so structured data always carries genuine
// numbers instead of hardcoded ones.
//
// Uses the Trustpilot Public Business Unit API (requires TRUSTPILOT_API_KEY).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BUSINESS_DOMAIN = 'buyawarranty.co.uk';

interface CachedRating {
  ratingValue: string;
  reviewCount: string;
  fetchedAt: number;
}

let cache: CachedRating | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600',
      },
    });

  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return json({ ...cache, cached: true });
    }

    const apiKey = Deno.env.get('TRUSTPILOT_API_KEY');
    if (!apiKey) {
      console.error('TRUSTPILOT_API_KEY is not configured');
      return json({ error: 'TRUSTPILOT_API_KEY is not configured' }, 500);
    }

    const url =
      `https://api.trustpilot.com/v1/business-units/find?name=${encodeURIComponent(BUSINESS_DOMAIN)}` +
      `&apikey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const details = await res.text();
      console.error(`Trustpilot request failed [${res.status}]: ${details}`);
      return json(
        { error: 'Trustpilot request failed', status: res.status, details },
        res.status,
      );
    }

    const data = await res.json();
    const score = data?.score?.trustScore;
    const total = data?.numberOfReviews?.total;

    if (typeof score !== 'number' || typeof total !== 'number') {
      console.error('Unexpected Trustpilot payload', JSON.stringify(data));
      return json({ error: 'Unexpected Trustpilot payload' }, 502);
    }

    cache = {
      ratingValue: score.toFixed(1),
      reviewCount: String(total),
      fetchedAt: Date.now(),
    };

    console.log(`Trustpilot rating: ${cache.ratingValue} from ${cache.reviewCount} reviews`);
    return json({ ...cache, cached: false });
  } catch (error) {
    console.error('trustpilot-rating error:', error);
    return json({ error: String(error) }, 500);
  }
});
