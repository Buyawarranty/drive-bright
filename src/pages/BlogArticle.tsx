import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, User, Share2, CheckCircle2, Info } from 'lucide-react';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import GooglePreferredSourceCTA from '@/components/GooglePreferredSourceCTA';
import BlogRegQuoteCTA from '@/components/blog/BlogRegQuoteCTA';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import defaultBlogHero from '@/assets/blog/used-car-warranty-uk-hero-2026.png.asset.json';
import comparisonVehicles from '@/assets/blog/uk-vehicles-comparison-warranty-2026.png.asset.json';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: any;
  featured_image_url: string | null;
  published_at: string;
  read_time_minutes: number;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  canonical_url: string | null;
  structured_data: any;
  blog_authors: { name: string; bio: string } | null;
  blog_categories: { name: string } | null;
}

const getDefaultHeroImage = (slug: string) => {
  const comparisonSlugs = ['breakdown', 'insurance', 'compare', 'vs', 'versus'];
  if (comparisonSlugs.some((k) => slug.toLowerCase().includes(k))) {
    return comparisonVehicles.url;
  }
  return defaultBlogHero.url;
};

const BlogArticle = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive TOC + enriched HTML (hooks must run every render — before any early return)
  const html: string = (post && typeof post.content === 'object' && post.content?.html) ? post.content.html : '';
  const toc = useMemo(() => {
    if (!html) return [] as { id: string; text: string }[];
    const items: { id: string; text: string }[] = [];
    const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(html))) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `section-${i}`;
      items.push({ id, text });
      i++;
    }
    return items;
  }, [html]);
  const enrichedHtml = useMemo(() => {
    if (!html || toc.length === 0) return html;
    let idx = 0;
    return html.replace(/<h2([^>]*)>/gi, (_f, attrs) => {
      const item = toc[idx++];
      if (!item || /\sid=/.test(attrs)) return `<h2${attrs}>`;
      return `<h2${attrs} id="${item.id}">`;
    });
  }, [html, toc]);

  // Split the article at a mid-point <h2> so we can drop a reg CTA into the flow
  const [htmlPartOne, htmlPartTwo] = useMemo(() => {
    if (!enrichedHtml) return ['', ''] as [string, string];
    const positions: number[] = [];
    const re = /<h2[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(enrichedHtml))) positions.push(m.index);
    if (positions.length < 4) return [enrichedHtml, ''] as [string, string];
    const cut = positions[Math.floor(positions.length / 2)];
    return [enrichedHtml.slice(0, cut), enrichedHtml.slice(cut)] as [string, string];
  }, [enrichedHtml]);


  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    setLoading(true);
    try {
      // Load main post
      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select(`
          *,
          blog_authors(name, bio),
          blog_categories(name, id)
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (postError) throw postError;
      if (postData) {
        setPost(postData);

        // Increment view count
        await supabase
          .from('blog_posts')
          .update({ view_count: (postData.view_count || 0) + 1 })
          .eq('id', postData.id);

        // Load related posts from same category
        if (postData.blog_categories) {
          const { data: relatedData } = await supabase
            .from('blog_posts')
            .select(`
              *,
              blog_authors(name, bio),
              blog_categories(name)
            `)
            .eq('status', 'published')
            .eq('category_id', postData.blog_categories.id)
            .neq('id', postData.id)
            .limit(2);

          if (relatedData) setRelatedPosts(relatedData);
        }
      }
    } catch (error: any) {
      toast.error('Failed to load article');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || '',
          url: window.location.href
        });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead 
          title="Article Not Found | The Warranty Hub"
          description="The article you're looking for doesn't exist."
        />
        <div className="w-full px-4 pt-4">
          <div className="max-w-6xl mx-auto">
            <TrustpilotHeader />
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Article Not Found</h1>
            <p className="text-xl text-muted-foreground mb-8">The article you're looking for doesn't exist.</p>
            <Link to="/thewarrantyhub">
              <Button variant="default">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to The Warranty Hub
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Generate structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "image": post.featured_image_url || getDefaultHeroImage(post.slug),
    "datePublished": post.published_at,
    "author": {
      "@type": "Person",
      "name": post.blog_authors?.name
    },
    "publisher": {
      "@type": "Organization",
      "name": "Buy a Warranty",
      "logo": {
        "@type": "ImageObject",
        "url": "https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png"
      }
    },
    "wordCount": post.content?.raw?.split(/\s+/).length || 0,
    "timeRequired": `PT${post.read_time_minutes}M`,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": post.canonical_url || `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}`
    }
  };

  // Parse content
  const contentText = typeof post.content === 'object' && post.content.raw 
    ? post.content.raw 
    : (typeof post.content === 'string' ? post.content : '');




  const publishedDate = new Date(post.published_at).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead 
        title={post.seo_title || `${post.title} | The Warranty Hub`}
        description={post.seo_description || post.excerpt || ''}
        keywords={(post.seo_keywords || []).join(', ')}
        canonical={post.canonical_url || `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}`}
        ogImage={post.featured_image_url || getDefaultHeroImage(post.slug)}
      />

      <OrganizationSchema type="Organization" />
      <BreadcrumbSchema 
        items={[
          { name: 'Home', url: 'https://buyawarranty.co.uk/' },
          { name: 'The Warranty Hub', url: 'https://buyawarranty.co.uk/thewarrantyhub/' },
          { name: post.title, url: `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}/` }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Editorial serif for headings */}
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      <div className="w-full px-4 pt-4">
        <div className="max-w-6xl mx-auto">
          <TrustpilotHeader />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <article className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          {/* Article Header */}
          <header className="pt-10 md:pt-14 pb-8 px-6 md:px-16 border-b border-slate-100">
            <nav className="mb-8 flex items-center flex-wrap gap-2 text-sm text-slate-500 font-medium">
              <Link to="/thewarrantyhub/" className="hover:text-primary transition-colors inline-flex items-center">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {post.blog_categories?.name || 'Warranty Guides'}
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 line-clamp-1">{post.title}</span>
            </nav>

            <div className="max-w-4xl">
              {post.blog_categories?.name && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-6">
                  {post.blog_categories.name}
                </span>
              )}
              <h1
                className="text-4xl md:text-6xl font-extrabold text-[#001F3F] leading-[1.08] mb-6"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-8">
                  {post.excerpt}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-6 text-sm py-6 border-t border-slate-100">
                {post.blog_authors?.name && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{post.blog_authors.name}</p>
                      <p className="text-slate-500 text-xs">Automotive Specialist</p>
                    </div>
                  </div>
                )}
                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                <div className="text-slate-500">
                  <span className="block font-medium text-slate-900">Published</span>
                  {publishedDate}
                </div>
                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                <div className="text-slate-500">
                  <span className="block font-medium text-slate-900">Read Time</span>
                  {post.read_time_minutes} min
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="ml-auto flex items-center gap-2 text-slate-600 hover:text-primary"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </header>

          {/* Hero Image */}
          <div className="px-6 md:px-16 -mt-4">
            <div className="relative aspect-[21/9] bg-slate-100 rounded-xl overflow-hidden shadow-xl">
              <img
                src={post.featured_image_url || getDefaultHeroImage(post.slug)}
                alt={post.title}
                width={1600}
                height={900}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content Layout */}
          <div className="px-6 md:px-16 py-12 flex flex-col lg:flex-row gap-12 lg:gap-16">
            {/* Sticky sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-8 space-y-8">
                {toc.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                      In this guide
                    </h4>
                    <nav className="space-y-3">
                      {toc.map((item, idx) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-sm font-medium border-l-2 pl-4 transition-all ${
                            idx === 0
                              ? 'text-primary border-primary font-semibold'
                              : 'text-slate-500 hover:text-slate-900 border-transparent hover:border-slate-300'
                          }`}
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                <div className="p-6 bg-[#001F3F] rounded-xl text-white">
                  <p className="text-sm font-bold mb-2 text-white">Instant Protection</p>
                  <p className="text-xs text-slate-300 mb-4">
                    Get a quote in 30 seconds for your specific vehicle.
                  </p>
                  <Link to="/">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wide">
                      Get My Quote
                    </Button>
                  </Link>
                </div>
              </div>
            </aside>

            {/* Main body */}
            <div className="flex-1 min-w-0 max-w-3xl">
              {/* Top-of-article reg quote CTA */}
              <div id="blog-reg-quote" className="mb-10 scroll-mt-24 sm:mb-12">
                <BlogRegQuoteCTA
                  compact
                  heading="Get an instant warranty price"
                  subheading="Enter your reg — we pull your vehicle details and mileage automatically."
                />
              </div>

              {/* Key Takeaways (legacy posts without rich HTML) */}
              {post.excerpt && !(typeof post.content === 'object' && post.content?.html) && (
                <section className="mb-12 p-6 md:p-8 bg-primary/5 border-l-4 border-primary rounded-r-xl shadow-sm">
                  <h2 className="text-lg font-bold text-[#001F3F] mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Key Takeaways
                  </h2>
                  <p className="text-slate-700 leading-relaxed">{post.excerpt}</p>
                </section>
              )}

              {/* Article content */}
              {enrichedHtml ? (
                <>
                  <article
                    className={proseClass}
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                    dangerouslySetInnerHTML={{ __html: htmlPartOne }}
                  />

                  {/* Mid-article reg CTA */}
                  {htmlPartTwo && (
                    <div className="my-10 sm:my-12">
                      <BlogRegQuoteCTA
                        compact
                        heading="Still reading? Check your price first"
                        subheading="Enter your reg — takes 60 seconds and there’s no obligation."
                      />
                    </div>
                  )}

                  {htmlPartTwo && (
                    <article
                      className={proseClass}
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: htmlPartTwo }}
                    />
                  )}
                </>
              ) : (
                <article className="prose prose-slate prose-lg max-w-none">
                  <div className="text-slate-700" style={{ lineHeight: '1.8' }}>
                    {contentText.split('\n\n').map((paragraph, index) => (
                      <p key={index} className="mb-6">{paragraph}</p>
                    ))}
                  </div>
                </article>
              )}

              {/* End-of-article Reg-plate CTA (reg-only journey, same as homepage) */}
              <div className="my-10 sm:my-12">
                <BlogRegQuoteCTA
                  heading="Ready to protect your car?"
                  subheading="Enter your reg for an instant, no-obligation price — cover can start today."
                />
              </div>




              {/* Google Preferred Source CTA */}
              <div className="mt-12">
                <GooglePreferredSourceCTA />
              </div>

              {/* Author bio */}
              {post.blog_authors?.bio && (
                <Card className="mt-12 p-6 bg-slate-50 border-slate-200">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#001F3F] mb-2">
                        About {post.blog_authors.name}
                      </h3>
                      <p className="text-slate-600 leading-relaxed">
                        {post.blog_authors.bio}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Share + tag footer */}
              <footer className="mt-16 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex gap-2 flex-wrap">
                  {(post.seo_keywords || []).slice(0, 3).map((k) => (
                    <span
                      key={k}
                      className="px-4 py-2 bg-slate-100 rounded text-xs font-semibold text-slate-600"
                    >
                      #{k.replace(/\s+/g, '')}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">Share this guide</span>
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold uppercase"
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        </article>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-16">
            <h2
              className="text-3xl font-bold text-[#001F3F] mb-8"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              More from The Warranty Hub
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  to={`/thewarrantyhub/${relatedPost.slug}`}
                  className="group block bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-shadow"
                >
                  {relatedPost.featured_image_url && (
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      <img
                        src={relatedPost.featured_image_url}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {relatedPost.blog_categories?.name && (
                      <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mb-3">
                        {relatedPost.blog_categories.name}
                      </span>
                    )}
                    <h3
                      className="text-xl font-bold text-[#001F3F] group-hover:text-primary transition-colors mb-2 leading-snug"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {relatedPost.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {relatedPost.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BlogArticle;