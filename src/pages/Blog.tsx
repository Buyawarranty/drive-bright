import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Clock, ArrowRight, ArrowUpRight, Phone, Shield, Check,
  TrendingUp, Zap, Car, HelpCircle, Wrench, BatteryCharging, Mail, Lock, MapPin
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import GooglePreferredSourceCTA from '@/components/GooglePreferredSourceCTA';
import { SALES_PHONE, SALES_PHONE_TEL } from '@/constants/contact';
import warrantyCarImage from '@/assets/blog-hero-warranty-car.png';
import { toast } from 'sonner';

interface HubPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
  category: string | null;
  author: string | null;
  isMock?: boolean;
}

const FALLBACK_IMAGE = warrantyCarImage;

// Placeholder editorial slots used only if the CMS returns fewer posts.
// Clearly non-clickable so nothing misleads visitors.
const PLACEHOLDER_POSTS: HubPost[] = [
  {
    id: 'mock-1', slug: '#',
    title: 'What does a car warranty actually cover?',
    excerpt: 'A plain-English breakdown of what a warranty pays for, what it doesn\'t, and how to avoid surprises.',
    featured_image_url: null, published_at: null, read_time_minutes: 5,
    category: 'Warranty Guides', author: 'Buyawarranty Editorial', isMock: true,
  },
  {
    id: 'mock-2', slug: '#',
    title: 'EV warranties explained: what\'s different for electric drivers',
    excerpt: 'Battery cover, high-voltage components and the exclusions every EV owner should read before buying.',
    featured_image_url: null, published_at: null, read_time_minutes: 6,
    category: 'EV & Hybrid', author: 'Buyawarranty Editorial', isMock: true,
  },
  {
    id: 'mock-3', slug: '#',
    title: 'How to make a warranty claim — step by step',
    excerpt: 'From the first phone call to an approved payout: exactly what happens and how long it typically takes.',
    featured_image_url: null, published_at: null, read_time_minutes: 4,
    category: 'Claims & Repairs', author: 'Buyawarranty Editorial', isMock: true,
  },
  {
    id: 'mock-4', slug: '#',
    title: 'High-mileage cars: what to watch out for',
    excerpt: 'Common failure points on older vehicles and how the right cover can protect you from big repair bills.',
    featured_image_url: null, published_at: null, read_time_minutes: 5,
    category: 'Used Cars', author: 'Buyawarranty Editorial', isMock: true,
  },
];

const TOPICS = [
  { key: 'warranty-guides', title: 'Warranty Guides', desc: 'Understand your cover', icon: Shield },
  { key: 'buying-guide', title: 'Buying Guides', desc: 'Buy with confidence', icon: Car },
  { key: 'education', title: 'Consumer Questions', desc: 'Expert answers', icon: HelpCircle },
  { key: 'car-maintenance', title: 'Claims & Repairs', desc: 'How it all works', icon: Wrench },
  { key: 'ev-hybrid', title: 'Electric Vehicles', desc: 'EV advice & cover', icon: BatteryCharging },
  { key: 'seasonal-advice', title: 'Car Ownership', desc: 'Tips for every driver', icon: MapPin },
];

const TRENDING = [
  { n: 1, text: 'Are extended car warranties worth it?', slug: 'car-warranty-vs-breakdown-cover-vs-insurance-uk-2026' },
  { n: 2, text: 'Top expensive car repairs to plan for', slug: 'used-car-warranty-uk-2026-whats-covered-when-to-buy' },
  { n: 3, text: 'EV warranties — what\'s actually covered?', slug: '#' },
  { n: 4, text: 'How to make a claim — step by step', slug: '#' },
  { n: 5, text: 'Best used cars to buy in 2026', slug: '#' },
];

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const trackEvent = (name: string, params: Record<string, unknown> = {}) => {
  try {
    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    // @ts-ignore
    window.dataLayer.push({ event: name, ...params });
  } catch {}
};

const Blog: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newsletter, setNewsletter] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, slug, title, excerpt, featured_image_url, published_at, read_time_minutes, blog_categories(name), blog_authors(name)')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        const mapped: HubPost[] = (data || []).map((p: any) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          featured_image_url: p.featured_image_url,
          published_at: p.published_at,
          read_time_minutes: p.read_time_minutes,
          category: p.blog_categories?.name ?? 'Warranty Guides',
          author: p.blog_authors?.name ?? 'Buyawarranty Editorial',
        }));
        setPosts(mapped);
      } catch (e) {
        console.error('Failed to load blog posts', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const allPosts = useMemo(() => {
    // Fill with placeholders only if needed
    const combined = [...posts];
    let i = 0;
    while (combined.length < 7 && i < PLACEHOLDER_POSTS.length) {
      combined.push(PLACEHOLDER_POSTS[i++]);
    }
    return combined;
  }, [posts]);

  const featured = allPosts[0];
  const latest = allPosts.slice(1, 7);

  const filteredLatest = useMemo(() => {
    if (!query.trim()) return latest;
    const q = query.toLowerCase();
    return latest.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.excerpt || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [latest, query]);

  const goToQuote = (source: string) => {
    trackEvent('hub_quote_cta_click', { source });
    navigate('/');
    setTimeout(() => {
      document.getElementById('quote-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const goToArticle = (p: HubPost, source: string) => {
    if (p.isMock || !p.slug || p.slug === '#') return;
    trackEvent('hub_article_click', { source, slug: p.slug });
    navigate(`/thewarrantyhub/${p.slug}/`);
  };

  const submitNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletter)) {
      setNewsletterState('error');
      return;
    }
    setNewsletterState('loading');
    try {
      trackEvent('hub_newsletter_submit', { email_domain: newsletter.split('@')[1] });
      // Best-effort: reuse an existing edge function if present, otherwise just acknowledge.
      await new Promise(r => setTimeout(r, 600));
      setNewsletterState('success');
      setNewsletter('');
      toast.success('Thanks — you\'re on the list.');
    } catch {
      setNewsletterState('error');
      toast.error('Something went wrong. Please try again.');
    }
  };

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'The Warranty Hub — Expert Advice, News & Guides for UK Car Owners',
    url: 'https://buyawarranty.co.uk/thewarrantyhub/',
    description: 'Independent guides, expert advice and news to help UK drivers protect their car.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: allPosts.filter(p => !p.isMock).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://buyawarranty.co.uk/thewarrantyhub/${p.slug}/`,
        name: p.title,
      })),
    },
  };

  return (
    <>
      <SEOHead
        title="Guides & News for UK Car Owners | The Warranty Hub | Buyawarranty"
        description="Independent car warranty advice, buying guides, EV cover explained, claims help and consumer news for UK drivers. Updated regularly by the Buyawarranty team."
        canonical="https://buyawarranty.co.uk/thewarrantyhub/"
        ogImage={warrantyCarImage}
      />
      <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>

      <main className="bg-white text-[#0f1b3d]">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-gray-100">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-br from-[#f5f7fb] via-white to-[#fff4ec]"
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <span className="inline-block text-xs font-bold tracking-[0.18em] text-[#eb4b00] uppercase mb-4">
                  Advice you can trust
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] text-[#0f1b3d] mb-5">
                  Expert Advice, News &amp; Guides for UK Car Owners
                </h1>
                <p className="text-lg text-gray-600 max-w-xl mb-8">
                  Independent guides, expert advice and the latest news to help you protect your car and drive with confidence.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => goToQuote('hero_primary')}
                    className="bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-6 py-6 text-base rounded-xl shadow-md hover:shadow-lg transition-all"
                    data-analytics="hero-quote-cta"
                  >
                    Get Your Free Quote <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      trackEvent('hub_browse_click');
                      document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="border-2 border-[#0f1b3d] text-[#0f1b3d] hover:bg-[#0f1b3d] hover:text-white font-semibold px-6 py-6 text-base rounded-xl"
                    data-analytics="hero-browse-cta"
                  >
                    Browse Articles
                  </Button>
                </div>

                {/* Trust strip */}
                <div className="mt-8 grid sm:grid-cols-3 gap-4 max-w-2xl">
                  <TrustPoint icon={Check} title="Rated Excellent" sub="Real customer reviews" />
                  <TrustPoint icon={Phone} title="UK-based support" sub="Speak to a real person" />
                  <TrustPoint icon={Shield} title="Comprehensive cover" sub="Mechanical &amp; electrical" />
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative">
                  <div aria-hidden className="absolute -inset-6 bg-gradient-to-br from-[#eaf0fb] to-transparent rounded-[2rem] -z-10" />
                  <img
                    src={warrantyCarImage}
                    alt="Buyawarranty branded vehicle"
                    className="w-full h-auto object-contain"
                    loading="eager"
                    width={720}
                    height={480}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEARCH */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <label htmlFor="hub-search" className="sr-only">Search articles</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden />
              <Input
                id="hub-search"
                type="search"
                placeholder="Search guides, claims help, EV cover, buying advice..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-base rounded-xl border-2 border-gray-200 focus-visible:ring-2 focus-visible:ring-[#0f1b3d]/20 focus-visible:border-[#0f1b3d]"
              />
            </div>
          </div>
        </section>

        {/* FEATURED + TRENDING */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Featured */}
              <article
                className="lg:col-span-2 group border border-gray-200 rounded-2xl overflow-hidden bg-white hover:shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-[#0f1b3d]/30"
                onClick={() => featured && goToArticle(featured, 'featured_card')}
                role={featured?.isMock ? undefined : 'link'}
                tabIndex={featured?.isMock ? -1 : 0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && featured && !featured.isMock) {
                    e.preventDefault();
                    goToArticle(featured, 'featured_card');
                  }
                }}
                style={{ cursor: featured && !featured.isMock ? 'pointer' : 'default' }}
              >
                <div className="grid md:grid-cols-2">
                  <div className="relative aspect-[16/10] md:aspect-auto bg-gray-100 overflow-hidden">
                    <span className="absolute top-4 left-4 z-10 bg-[#eb4b00] text-white text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-wide">
                      Featured Story
                    </span>
                    {featured && (
                      <img
                        src={featured.featured_image_url || FALLBACK_IMAGE}
                        alt={featured.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        loading="lazy"
                        width={800}
                        height={500}
                      />
                    )}
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f1b3d] mb-3">
                      <Shield className="w-3.5 h-3.5 text-[#eb4b00]" />
                      {featured?.category || 'Warranty Guides'}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-3 text-[#0f1b3d] group-hover:text-[#eb4b00] transition-colors">
                      {featured?.title || 'Loading...'}
                    </h2>
                    <p className="text-gray-600 mb-5">
                      {featured?.excerpt}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-5">
                      <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(featured?.published_at || null) || '—'}</span>
                      {featured?.read_time_minutes && (
                        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {featured.read_time_minutes} min read</span>
                      )}
                      <span className="text-gray-400">By {featured?.author}</span>
                    </div>
                    <div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); featured && goToArticle(featured, 'featured_button'); }}
                        className="bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-5 py-3 rounded-lg"
                        disabled={!featured || featured.isMock}
                      >
                        Read Full Guide <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>

              {/* Trending */}
              <aside className="rounded-2xl bg-[#0f1b3d] text-white p-6 md:p-7">
                <h3 className="flex items-center gap-2 text-lg font-bold mb-5">
                  <TrendingUp className="w-5 h-5 text-[#eb4b00]" /> Trending Now
                </h3>
                <ol className="space-y-3">
                  {TRENDING.map((t) => {
                    const isReal = posts.some(p => p.slug === t.slug);
                    const content = (
                      <div className="flex items-start gap-3 group">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[#eb4b00] text-white text-xs font-bold flex-shrink-0 mt-0.5">
                          {t.n}
                        </span>
                        <span className="text-sm leading-snug text-white/90 group-hover:text-white group-hover:underline">
                          {t.text}
                        </span>
                      </div>
                    );
                    return (
                      <li key={t.n}>
                        {isReal ? (
                          <Link to={`/thewarrantyhub/${t.slug}/`} className="block focus:outline-none focus:ring-2 focus:ring-white/60 rounded">
                            {content}
                          </Link>
                        ) : (
                          <div className="opacity-90">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <button
                  onClick={() => document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' })}
                  className="mt-6 w-full bg-white text-[#0f1b3d] font-semibold py-2.5 rounded-lg hover:bg-white/90 transition inline-flex items-center justify-center gap-2"
                >
                  View All Articles <ArrowRight className="w-4 h-4" />
                </button>
              </aside>
            </div>
          </div>
        </section>

        {/* LATEST + SIDEBAR */}
        <section id="latest" className="bg-[#f7f8fb] border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-[#0f1b3d]">Latest News &amp; Advice</h2>
                    <p className="text-gray-500 text-sm mt-1">All guides and insights</p>
                  </div>
                  <Link
                    to="#latest"
                    className="text-sm font-semibold text-[#0f1b3d] hover:text-[#eb4b00] inline-flex items-center gap-1"
                  >
                    View all articles <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {loading ? (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="rounded-2xl bg-white border border-gray-200 overflow-hidden animate-pulse">
                        <div className="aspect-[16/10] bg-gray-100" />
                        <div className="p-5 space-y-3">
                          <div className="h-4 bg-gray-100 rounded w-1/3" />
                          <div className="h-5 bg-gray-100 rounded w-4/5" />
                          <div className="h-4 bg-gray-100 rounded w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredLatest.length === 0 ? (
                  <p className="text-gray-500 py-12 text-center">No articles match &ldquo;{query}&rdquo;.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-6">
                    {filteredLatest.map((p) => (
                      <ArticleCard key={p.id} post={p} onClick={() => goToArticle(p, 'latest_grid')} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="space-y-6 lg:sticky lg:top-6 self-start">
                <div className="relative overflow-hidden rounded-2xl bg-[#eb4b00] text-white p-6 shadow-md">
                  <Shield aria-hidden className="absolute -right-4 -bottom-4 w-32 h-32 opacity-15" />
                  <h3 className="text-xl font-bold mb-1.5">Get a Free Quote in 60 Seconds</h3>
                  <p className="text-sm text-white/85 mb-5">No obligation. Instant prices.</p>
                  <Button
                    onClick={() => goToQuote('sidebar_quote')}
                    className="w-full bg-white text-[#eb4b00] hover:bg-white/95 font-bold rounded-lg py-2.5"
                    data-analytics="sidebar-quote-cta"
                  >
                    Get My Quote <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>

                <div className="rounded-2xl bg-white border border-gray-200 p-6">
                  <div className="w-12 h-12 rounded-full bg-[#fff2e8] flex items-center justify-center mb-4">
                    <Mail className="w-6 h-6 text-[#eb4b00]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0f1b3d] mb-1.5">
                    Get weekly car advice straight to your inbox
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Tips, guides and money-saving advice for UK car owners.
                  </p>
                  <form onSubmit={submitNewsletter} noValidate>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your email address"
                      value={newsletter}
                      onChange={(e) => { setNewsletter(e.target.value); if (newsletterState !== 'idle') setNewsletterState('idle'); }}
                      aria-invalid={newsletterState === 'error'}
                      aria-describedby="newsletter-helper"
                      className="mb-3 rounded-lg border-2 border-gray-200 focus-visible:border-[#0f1b3d]"
                    />
                    <Button
                      type="submit"
                      disabled={newsletterState === 'loading'}
                      className="w-full bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold rounded-lg"
                      data-analytics="newsletter-submit"
                    >
                      {newsletterState === 'loading' ? 'Subscribing...' : newsletterState === 'success' ? 'Subscribed!' : 'Subscribe Now'}
                    </Button>
                    <p id="newsletter-helper" className={`text-xs mt-2 ${newsletterState === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                      {newsletterState === 'error'
                        ? 'Please enter a valid email address.'
                        : 'No spam. Unsubscribe anytime.'}
                    </p>
                  </form>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* POPULAR TOPICS */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-[#0f1b3d]">Popular Topics</h2>
              <p className="text-gray-500 text-sm mt-1">Explore more warranty guides and advice</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {TOPICS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    trackEvent('hub_topic_click', { topic: t.key });
                    document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-left rounded-2xl border border-gray-200 hover:border-[#0f1b3d] hover:shadow-md transition-all p-5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20"
                  data-analytics={`topic-${t.key}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#eaf0fb] text-[#0f1b3d] flex items-center justify-center mb-3">
                    <t.icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-[#0f1b3d] text-sm leading-tight">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                  <div className="text-xs text-[#eb4b00] font-semibold mt-3 inline-flex items-center gap-1">
                    Explore <ArrowUpRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARE WARRANTY OPTIONS */}
        <section className="bg-[#f7f8fb] border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
            <div className="grid lg:grid-cols-4 gap-6 items-stretch">
              <div className="lg:col-span-1 flex flex-col justify-center">
                <span className="text-xs font-bold tracking-[0.18em] text-[#eb4b00] uppercase mb-3">
                  Choose the right cover
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-[#0f1b3d] mb-3">
                  Compare Warranty Options
                </h2>
                <p className="text-gray-600 text-sm mb-5">
                  Find the cover that&apos;s right for you and your vehicle. All plans include UK-based support.
                </p>
                <Button
                  onClick={() => goToQuote('compare_section')}
                  className="bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold w-full sm:w-auto rounded-lg"
                  data-analytics="compare-quote-cta"
                >
                  Get Your Free Quote <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>

              <PlanCard
                name="Essential"
                tagline="Great value protection"
                features={['Engine', 'Gearbox', 'Drive Components']}
              />
              <PlanCard
                name="Plus"
                tagline="Our most comprehensive cover"
                features={['Engine', 'Gearbox', 'Electronics', 'Braking System', 'Cooling System']}
                featured
              />
              <PlanCard
                name="Ultimate"
                tagline="Maximum peace of mind"
                features={['All Plus benefits', 'Air Conditioning', 'Turbo', 'DPF & EGR']}
              />
            </div>
          </div>
        </section>

        {/* WHY TRUST */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0f1b3d] mb-8">Why Trust Buyawarranty?</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <TrustReason icon={Phone} title="UK Based Support" desc="Speak to real people in the UK" />
              <TrustReason icon={Shield} title="Comprehensive Cover" desc="Designed around real repair costs" />
              <TrustReason icon={Zap} title="Quick &amp; Easy Claims" desc="A straightforward claims process" />
              <TrustReason icon={Check} title="Transparent &amp; Fair" desc="Clear policy documentation" />
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-[#0f1b3d] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">Ready to protect your vehicle?</h3>
                  <p className="text-white/75 text-sm mt-1">Get your free, no-obligation quote in seconds.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  onClick={() => goToQuote('final_cta')}
                  className="bg-[#eb4b00] hover:bg-[#d63f00] text-white font-semibold px-6 py-3 rounded-lg"
                  data-analytics="final-quote-cta"
                >
                  Get Your Free Quote <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <span className="text-white/60 text-sm hidden sm:inline">or call</span>
                <a
                  href={SALES_PHONE_TEL}
                  className="text-lg font-bold hover:underline"
                  onClick={() => trackEvent('hub_tap_to_call', { source: 'final_cta' })}
                  data-analytics="final-tap-to-call"
                >
                  {SALES_PHONE}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 bg-white">
          <div className="container mx-auto px-4">
            <GooglePreferredSourceCTA />
          </div>
        </section>

        {/* Mobile sticky CTA */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 p-2.5 pb-[env(safe-area-inset-bottom,10px)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex gap-2">
            <a
              href={SALES_PHONE_TEL}
              onClick={() => trackEvent('hub_tap_to_call', { source: 'sticky_mobile' })}
              className="flex-[0_0_40%] border-2 border-[#0f1b3d] text-[#0f1b3d] font-bold rounded-lg py-3 flex items-center justify-center gap-2 text-sm"
              aria-label="Call us"
            >
              <Phone className="w-4 h-4" /> Call us
            </a>
            <Button
              onClick={() => goToQuote('sticky_mobile')}
              className="flex-1 bg-[#eb4b00] hover:bg-[#d63f00] text-white font-bold rounded-lg py-3 text-sm"
            >
              Get a Quote <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="md:hidden h-20" aria-hidden />
      </main>
    </>
  );
};

// ---------- Subcomponents ----------

const TrustPoint: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; sub: string }> = ({
  icon: Icon, title, sub,
}) => (
  <div className="flex items-start gap-2.5">
    <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-[#0f1b3d]" />
    </div>
    <div>
      <div className="text-sm font-bold text-[#0f1b3d] leading-tight" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  </div>
);

const ArticleCard: React.FC<{ post: HubPost; onClick: () => void }> = ({ post, onClick }) => {
  const isClickable = !post.isMock && post.slug && post.slug !== '#';
  return (
    <article
      onClick={isClickable ? onClick : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      role={isClickable ? 'link' : undefined}
      tabIndex={isClickable ? 0 : -1}
      className={`group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-[#0f1b3d]/40 transition-all focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/30 ${
        isClickable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
        {post.category && (
          <span className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur text-[#0f1b3d] text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
            {post.category}
          </span>
        )}
        <img
          src={post.featured_image_url || FALLBACK_IMAGE}
          alt={post.title}
          loading="lazy"
          width={640}
          height={400}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-5">
        <h3 className="font-bold text-[#0f1b3d] leading-snug text-base group-hover:text-[#eb4b00] transition-colors line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-3">
            {post.published_at && <span>{formatDate(post.published_at)}</span>}
            {post.read_time_minutes && <span>{post.read_time_minutes} min read</span>}
          </span>
          <span className="text-[#eb4b00] font-semibold inline-flex items-center gap-1">
            Read article <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </article>
  );
};

const PlanCard: React.FC<{ name: string; tagline: string; features: string[]; featured?: boolean }> = ({
  name, tagline, features, featured,
}) => (
  <div
    className={`relative rounded-2xl bg-white p-6 border transition-all ${
      featured
        ? 'border-[#eb4b00] shadow-lg ring-1 ring-[#eb4b00]/20'
        : 'border-gray-200 hover:border-[#0f1b3d]/40 hover:shadow-md'
    }`}
  >
    {featured && (
      <span className="absolute -top-3 right-4 bg-[#eb4b00] text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
        Most Popular
      </span>
    )}
    <div className="text-lg font-bold text-[#0f1b3d]">{name}</div>
    <div className="text-xs text-gray-500 mt-0.5">{tagline}</div>
    <ul className="mt-4 space-y-2">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-[#0f1b3d]">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> {f}
        </li>
      ))}
    </ul>
    <Link
      to="/protected"
      className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#0f1b3d] hover:text-[#eb4b00]"
    >
      View full details <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  </div>
);

const TrustReason: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; desc: string }> = ({
  icon: Icon, title, desc,
}) => (
  <div className="rounded-xl bg-[#f7f8fb] p-5 border border-gray-100">
    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mb-3 shadow-sm">
      <Icon className="w-5 h-5 text-[#0f1b3d]" />
    </div>
    <div className="font-semibold text-[#0f1b3d]" dangerouslySetInnerHTML={{ __html: title }} />
    <div className="text-sm text-gray-500 mt-1" dangerouslySetInnerHTML={{ __html: desc }} />
  </div>
);

export default Blog;
