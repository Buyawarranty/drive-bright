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
import BlogStickyQuoteBar from '@/components/blog/BlogStickyQuoteBar';
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
  updated_at?: string | null;
  read_time_minutes: number;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  canonical_url: string | null;
  structured_data: any;
  blog_authors: { name: string; bio: string } | null;
  blog_categories: { name: string } | null;
}


const proseClass = `prose prose-slate prose-base sm:prose-lg max-w-none
  prose-headings:font-bold prose-headings:text-[#001F3F]
  prose-h2:font-extrabold prose-h2:text-2xl sm:prose-h2:text-3xl md:prose-h2:text-4xl prose-h2:mt-10 sm:prose-h2:mt-14 prose-h2:mb-4 prose-h2:scroll-mt-24
  prose-h3:text-xl sm:prose-h3:text-2xl prose-h3:mt-8 sm:prose-h3:mt-10 prose-h3:mb-3
  prose-p:text-slate-700 prose-p:leading-[1.8]
  prose-a:text-primary hover:prose-a:text-primary/80 prose-a:font-medium prose-a:break-words
  prose-strong:text-[#001F3F]
  prose-li:text-slate-700 prose-li:leading-relaxed
  prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 sm:prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:rounded-r-lg prose-blockquote:text-[#001F3F] prose-blockquote:font-medium
  prose-img:rounded-xl prose-img:shadow-md prose-img:my-6 sm:prose-img:my-8
  prose-table:text-sm prose-th:bg-slate-100 prose-th:text-[#001F3F] prose-td:align-top
  [&_h2]:font-[Playfair_Display,Georgia,serif]
  [&_.overflow-x-auto]:-mx-4 [&_.overflow-x-auto]:px-4 sm:[&_.overflow-x-auto]:mx-0 sm:[&_.overflow-x-auto]:px-0`;

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
    if (!html) return html;
    let idx = 0;
    let out = toc.length
      ? html.replace(/<h2([^>]*)>/gi, (_f, attrs) => {
          const item = toc[idx++];
          if (!item || /\sid=/.test(attrs)) return `<h2${attrs}>`;
          return `<h2${attrs} id="${item.id}">`;
        })
      : html;
    // Image performance + accessibility hygiene (Core Web Vitals + image search)
    out = out.replace(/<img([^>]*)>/gi, (_f, attrs: string) => {
      let a = attrs;
      if (!/\sloading=/i.test(a)) a += ' loading="lazy"';
      if (!/\sdecoding=/i.test(a)) a += ' decoding="async"';
      if (!/\salt=/i.test(a)) a += ' alt=""';
      return `<img${a}>`;
    });
    return out;
  }, [html, toc]);

  // FAQ pairs (Q1./A1. style) → FAQPage schema for rich results + AI answer engines
  const faqItems = useMemo(() => {
    if (!html) return [] as { question: string; answer: string }[];
    const items: { question: string; answer: string }[] = [];
    const re = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m: RegExpExecArray | null;
    const strip = (s: string) =>
      s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    while ((m = re.exec(html))) {
      const q = strip(m[1]);
      const a = strip(m[2]);
      if (!/^Q\d+\./i.test(q)) continue;
      items.push({
        question: q.replace(/^Q\d+\.\s*/i, ''),
        answer: a.replace(/^A\d+\.\s*/i, ''),
      });
    }
    return items;
  }, [html]);

  // First substantive paragraph — used as the concise "quick answer" for AI overviews
  const quickAnswer = useMemo(() => {
    if (!html) return '';
    const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!m) return '';
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 320 ? `${text.slice(0, 317)}…` : text;
  }, [html]);


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

  const articleUrl = post.canonical_url || `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}/`;
  const heroImage = post.featured_image_url || getDefaultHeroImage(post.slug);
  const metaDescription = post.seo_description || post.excerpt || quickAnswer;
  const lastModified = post.updated_at || post.published_at;

  // Generate structured data (Article + FAQ + breadcrumb-friendly graph for AI answer engines)
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${articleUrl}#article`,
        "headline": post.title,
        "alternativeHeadline": post.seo_title || post.title,
        "description": metaDescription,
        "abstract": quickAnswer || metaDescription,
        "image": {
          "@type": "ImageObject",
          "url": heroImage,
          "width": 1600,
          "height": 900,
        },
        "datePublished": post.published_at,
        "dateModified": lastModified,
        "inLanguage": "en-GB",
        "isAccessibleForFree": true,
        "keywords": (post.seo_keywords || []).join(', '),
        "articleSection": post.blog_categories?.name || 'Warranty Guides',
        "author": {
          "@type": "Person",
          "name": post.blog_authors?.name || 'Buy a Warranty Editorial Team',
          "worksFor": { "@type": "Organization", "name": "Buy a Warranty" },
        },
        "publisher": {
          "@type": "Organization",
          "name": "Buy a Warranty",
          "url": "https://buyawarranty.co.uk/",
          "logo": {
            "@type": "ImageObject",
            "url": "https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png"
          }
        },
        "wordCount": post.content?.raw?.split(/\s+/).length || 0,
        "timeRequired": `PT${post.read_time_minutes}M`,
        "spatialCoverage": { "@type": "Country", "name": "United Kingdom" },
        "audience": { "@type": "Audience", "audienceType": "UK car owners and used car buyers", "geographicArea": { "@type": "Country", "name": "United Kingdom" } },
        "about": [
          { "@type": "Thing", "name": "Car warranty" },
          { "@type": "Thing", "name": "Used car ownership costs" },
        ],
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": ["h1", ".article-quick-answer"],
        },
        "mainEntityOfPage": { "@type": "WebPage", "@id": articleUrl },
      },
      ...(faqItems.length
        ? [{
            "@type": "FAQPage",
            "@id": `${articleUrl}#faq`,
            "inLanguage": "en-GB",
            "mainEntity": faqItems.map((f) => ({
              "@type": "Question",
              "name": f.question,
              "acceptedAnswer": { "@type": "Answer", "text": f.answer },
            })),
          }]
        : []),
    ],
  };

  // Parse content
  const contentText = typeof post.content === 'object' && post.content.raw 
    ? post.content.raw 
    : (typeof post.content === 'string' ? post.content : '');




  const publishedDate = new Date(post.published_at).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const updatedDate = new Date(lastModified).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead 
        title={post.seo_title || `${post.title} | The Warranty Hub`}
        description={metaDescription}
        keywords={(post.seo_keywords || []).join(', ')}
        canonical={articleUrl}
        ogImage={heroImage}
        ogImageAlt={post.title}
        ogType="article"
        publishedTime={post.published_at}
        modifiedTime={lastModified}
        articleSection={post.blog_categories?.name || 'Warranty Guides'}
        articleTags={post.seo_keywords || []}
        author={post.blog_authors?.name || 'Buy a Warranty'}
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

              {/* Above-the-fold reg entry (same design + journey as the homepage) */}
              <div id="blog-reg-quote-hero" className="mb-8 scroll-mt-24">
                <BlogRegQuoteCTA
                  compact
                  heading="Get my quote — enter your reg"
                  subheading="We pull your vehicle details and mileage automatically. No obligation."
                />
              </div>



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
                  <a href="https://buyawarranty.co.uk/">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wide">
                      Get My Quote
                    </Button>
                  </a>

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

      {/* Mobile sticky CTA */}
      <BlogStickyQuoteBar />
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  );
};

export default BlogArticle;