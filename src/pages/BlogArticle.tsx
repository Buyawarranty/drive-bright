import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Calendar, User, Clock, Share2 } from 'lucide-react';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const BlogArticle = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

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
    "image": post.featured_image_url,
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={post.seo_title || `${post.title} | The Warranty Hub`}
        description={post.seo_description || post.excerpt || ''}
        keywords={(post.seo_keywords || []).join(', ')}
        canonical={post.canonical_url || `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}`}
        ogImage={post.featured_image_url || undefined}
      />
      
      {/* Schema.org Structured Data */}
      <OrganizationSchema type="Organization" />
      <BreadcrumbSchema 
        items={[
          { name: 'Home', url: 'https://buyawarranty.co.uk/' },
          { name: 'The Warranty Hub', url: 'https://buyawarranty.co.uk/thewarrantyhub/' },
          { name: post.title, url: `https://buyawarranty.co.uk/thewarrantyhub/${post.slug}/` }
        ]}
      />
      
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Trustpilot header */}
      <div className="w-full px-4 pt-4">
        <div className="max-w-6xl mx-auto">
          <TrustpilotHeader />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link to="/thewarrantyhub/" className="inline-flex items-center text-primary hover:text-primary/80 mb-8 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to The Warranty Hub
        </Link>

        {/* Article header */}
        <header className="mb-8">
          <Badge variant="secondary" className="mb-4">
            {post.blog_categories?.name}
          </Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4 leading-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="text-xl text-muted-foreground mb-6">
              {post.excerpt}
            </p>
          )}
          
          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              {post.blog_authors?.name}
            </div>
            <div className="flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              {new Date(post.published_at).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              {post.read_time_minutes} min read
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </header>

        {/* Featured image */}
        {post.featured_image_url && (
          <div className="mb-8">
            <img 
              src={post.featured_image_url} 
              alt={post.title}
              className="w-full h-64 md:h-96 object-cover rounded-lg shadow-lg"
            />
          </div>
        )}

        {/* Key Takeaways */}
        {post.excerpt && (
          <Card className="mb-8 p-6 bg-primary/5 border-primary/20">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <span className="text-primary">✓</span> Key Takeaways
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {post.excerpt}
            </p>
          </Card>
        )}

        {/* Article content */}
        <article className="prose prose-lg max-w-none">
          <div 
            className="whitespace-pre-wrap text-muted-foreground leading-relaxed"
            style={{ lineHeight: '1.8' }}
          >
            {contentText.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-6">
                {paragraph}
              </p>
            ))}
          </div>
        </article>

        {/* Author bio */}
        {post.blog_authors?.bio && (
          <Card className="mt-12 p-6 bg-muted/50">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">About {post.blog_authors.name}</h3>
                <p className="text-muted-foreground">
                  {post.blog_authors.bio}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Call to action */}
        <div className="mt-12 p-8 bg-primary/5 rounded-lg border">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Ready to protect your vehicle?
          </h3>
          <p className="text-muted-foreground mb-6">
            Get fast, affordable warranty cover for your car, van, SUV or motorbike today.
          </p>
          <Link to="/">
            <Button size="lg">
              Get Your Quote Now
            </Button>
          </Link>
        </div>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">More from The Warranty Hub</h3>
            <div className="grid gap-6 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <Link 
                  key={relatedPost.id} 
                  to={`/thewarrantyhub/${relatedPost.slug}`}
                  className="group"
                >
                  <div className="bg-card rounded-lg overflow-hidden shadow-sm border hover:shadow-md transition-shadow">
                    {relatedPost.featured_image_url && (
                      <img 
                        src={relatedPost.featured_image_url} 
                        alt={relatedPost.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    <div className="p-4">
                      <Badge variant="outline" className="mb-2">
                        {relatedPost.blog_categories?.name}
                      </Badge>
                      <h4 className="font-bold text-foreground group-hover:text-primary transition-colors mb-2">
                        {relatedPost.title}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BlogArticle;