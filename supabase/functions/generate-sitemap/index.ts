import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlogPost {
  slug: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating sitemap...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch published blog posts
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching blog posts:', error);
    }

    // All static pages from the provided sitemap
    const staticPages = [
      { url: '/', priority: '1.0' },
      { url: '/what-is-covered/', priority: '0.9' },
      { url: '/make-a-claim/', priority: '0.9' },
      { url: '/faq/', priority: '0.9' },
      { url: '/contact-us/', priority: '0.9' },
      { url: '/buy-a-used-car-warranty-reliable-warranties/', priority: '0.9' },
      { url: '/van-warranty/', priority: '0.9' },
      { url: '/ev-warranty/', priority: '0.9' },
      { url: '/motorcycle-warranty/', priority: '0.9' },
      { url: '/car-extended-warranty/', priority: '0.9' },
      { url: '/warranty-types/', priority: '0.9' },
      { url: '/privacy/', priority: '0.9' },
      { url: '/terms/', priority: '0.9' },
      { url: '/cookies/', priority: '0.9' },
      { url: '/complaints/', priority: '0.9' },
      { url: '/thewarrantyhub/', priority: '0.9' },
      { url: '/thewarrantyhub/platinum-warranty-cover-modifications-uk-vehicle-protection-guide/', priority: '0.8' },
      { url: '/thewarrantyhub/top-rated-car-warranty-uk-buyer-guide/', priority: '0.8' },
      { url: '/thewarrantyhub/tesla-warranty-uk-2026-battery-cover-repair-costs-extended-options/', priority: '0.8' },
      { url: '/thewarrantyhub/tesla-car-price-extended-warranty-uk-2026-ownership-guide/', priority: '0.8' },
      { url: '/thewarrantyhub/petrol-diesel-vehicle-warranty-cover-complete-uk-drivers-guide/', priority: '0.8' },
      { url: '/thewarrantyhub/land-rover-extended-warranty-cost-uk-2026-prices-repair-costs/', priority: '0.8' },
      { url: '/used-car-warranty-uk/', priority: '0.9' },
      { url: '/cancel-warranty/', priority: '0.9' },
      { url: '/warranty-plan/', priority: '0.9' },
      { url: '/warranty-types/vans-warranty/', priority: '0.8' },
      { url: '/warranty-types/ev-warranty/', priority: '0.8' },
      { url: '/warranty-types/hybrid-warranty/', priority: '0.8' },
      { url: '/warranty-types/phev-warranty/', priority: '0.8' },
      { url: '/warranty-types/bmw-warranty/', priority: '0.8' },
      { url: '/warranty-types/mercedes-warranty/', priority: '0.8' },
      { url: '/warranty-types/honda-warranty/', priority: '0.8' },
      { url: '/warranty-types/toyota-warranty/', priority: '0.8' },
      { url: '/warranty-types/ford-warranty/', priority: '0.8' },
      { url: '/warranty-types/kia-warranty/', priority: '0.8' },
      { url: '/warranty-types/hyundai-warranty/', priority: '0.8' },
      { url: '/warranty-types/citroen-warranty/', priority: '0.8' },
      { url: '/warranty-types/mg-warranty/', priority: '0.8' },
      { url: '/warranty-types/skoda-warranty/', priority: '0.8' },
      { url: '/warranty-types/audi-warranty/', priority: '0.8' },
      { url: '/warranty-types/nissan-warranty/', priority: '0.8' },
      { url: '/warranty-types/peugeot-warranty/', priority: '0.8' },
      { url: '/warranty-types/vauxhall-warranty/', priority: '0.8' },
      { url: '/warranty-types/volvo-warranty/', priority: '0.8' },
      { url: '/warranty-types/volkswagen-warranty/', priority: '0.8' },
      { url: '/warranty-types/motorbike-motorcycle-warranty/', priority: '0.8' },
      { url: '/warranty-types/tesla-warranty/', priority: '0.8' },
      { url: '/warranty-types/dacia-warranty/', priority: '0.8' },
      { url: '/warranty-types/jeep-warranty/', priority: '0.8' },
      { url: '/warranty-types/smart-warranty/', priority: '0.8' },
      { url: '/warranty-types/subaru-warranty/', priority: '0.8' },
      { url: '/warranty-types/porsche-warranty/', priority: '0.8' },
      { url: '/warranty-types/lexus-warranty/', priority: '0.8' },
      { url: '/warranty-types/mini-warranty/', priority: '0.8' },
      { url: '/warranty-types/alfa-romeo-warranty/', priority: '0.8' },
      { url: '/warranty-types/suzuki-warranty/', priority: '0.8' },
      { url: '/warranty-types/mitsubishi-warranty/', priority: '0.8' },
      { url: '/warranty-types/byd-warranty/', priority: '0.8' },
      { url: '/warranty-types/chevrolet-warranty/', priority: '0.8' },
      { url: '/warranty-types/chrysler-warranty/', priority: '0.8' },
      { url: '/warranty-types/dodge-warranty/', priority: '0.8' },
      { url: '/warranty-types/infiniti-warranty/', priority: '0.8' },
      { url: '/warranty-types/cadillac-warranty/', priority: '0.8' },
      { url: '/car-extended-warranty/audi/', priority: '0.8' },
      { url: '/car-extended-warranty/bmw/', priority: '0.8' },
      { url: '/car-extended-warranty/ford/', priority: '0.8' },
      { url: '/car-extended-warranty/hyundai/', priority: '0.8' },
      { url: '/car-extended-warranty/jaguar/', priority: '0.8' },
      { url: '/car-extended-warranty/land-rover/', priority: '0.8' },
      { url: '/car-extended-warranty/mercedes-benz/', priority: '0.8' },
      { url: '/car-extended-warranty/nissan/', priority: '0.8' },
      { url: '/car-extended-warranty/skoda/', priority: '0.8' },
      { url: '/car-extended-warranty/volkswagen/', priority: '0.8' },
    ];

    const baseUrl = 'https://buyawarranty.co.uk';
    const lastmod = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Add blog posts dynamically
    if (posts && posts.length > 0) {
      posts.forEach((post: BlogPost) => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/blog/${post.slug}/</loc>\n`;
        xml += `    <lastmod>${post.updated_at ? post.updated_at.split('T')[0] : lastmod}</lastmod>\n`;
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      });
    }

    xml += '</urlset>';

    console.log('Sitemap generated successfully');

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate sitemap' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
