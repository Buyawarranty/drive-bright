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
  // Handle CORS preflight requests
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

    // Static pages with priority and change frequency
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/what-is-covered/', priority: '0.9', changefreq: 'weekly' },
      { url: '/make-a-claim/', priority: '0.9', changefreq: 'weekly' },
      { url: '/faq/', priority: '0.8', changefreq: 'weekly' },
      { url: '/contact-us/', priority: '0.7', changefreq: 'monthly' },
      { url: '/customer-dashboard/', priority: '0.7', changefreq: 'weekly' },
      { url: '/thewarrantyhub/', priority: '0.8', changefreq: 'daily' },
      { url: '/terms/', priority: '0.5', changefreq: 'monthly' },
      { url: '/privacy/', priority: '0.5', changefreq: 'monthly' },
      { url: '/cookies/', priority: '0.5', changefreq: 'monthly' },
      { url: '/complaints/', priority: '0.5', changefreq: 'monthly' },
      { url: '/business-warranties/', priority: '0.8', changefreq: 'weekly' },
      { url: '/buy-a-used-car-warranty-reliable-warranties/', priority: '0.8', changefreq: 'weekly' },
      { url: '/van-warranty-companies-uk-warranties/', priority: '0.8', changefreq: 'weekly' },
      { url: '/best-warranty-on-ev-cars-uk-warranties/', priority: '0.8', changefreq: 'weekly' },
      { url: '/motorbike-repair-warranty-uk-warranties/', priority: '0.8', changefreq: 'weekly' },
    ];

    const baseUrl = 'https://buyawarranty.co.uk';
    const currentDate = new Date().toISOString();

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    staticPages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Add blog posts
    if (posts && posts.length > 0) {
      posts.forEach((post: BlogPost) => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/blog/${post.slug}/</loc>\n`;
        xml += `    <lastmod>${post.updated_at || currentDate}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
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
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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
