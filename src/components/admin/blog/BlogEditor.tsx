import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bold, Italic, Underline, Link, List, ListOrdered, Quote, Code, 
  Image, Video, Save, Eye, Clock, Upload
} from 'lucide-react';

interface BlogEditorProps {
  postId?: string;
}

export const BlogEditor = ({ postId }: BlogEditorProps) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [authors, setAuthors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Load authors and categories
  useEffect(() => {
    const loadData = async () => {
      const { data: authorsData } = await supabase
        .from('blog_authors')
        .select('*')
        .eq('is_active', true);
      
      const { data: categoriesData } = await supabase
        .from('blog_categories')
        .select('*')
        .eq('is_active', true);
      
      if (authorsData) setAuthors(authorsData);
      if (categoriesData) setCategories(categoriesData);
    };
    
    loadData();
  }, []);

  // Load existing post if editing
  useEffect(() => {
    if (!postId) return;
    
    const loadPost = async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', postId)
        .single();
      
      if (error) {
        toast.error('Failed to load post');
        return;
      }
      
      if (data) {
        setTitle(data.title);
        setSlug(data.slug);
        setContent(typeof data.content === 'string' ? data.content : JSON.stringify(data.content));
        setExcerpt(data.excerpt || '');
        setFeaturedImage(data.featured_image_url || '');
        setAuthorId(data.author_id || '');
        setCategoryId(data.category_id || '');
        const postStatus = data.status as 'draft' | 'published' | 'scheduled';
        setStatus(postStatus);
        setSeoTitle(data.seo_title || '');
        setSeoDescription(data.seo_description || '');
        setSeoKeywords(data.seo_keywords || []);
      }
    };
    
    loadPost();
  }, [postId]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slug && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setSlug(generatedSlug);
    }
  }, [title, slug]);

  // Calculate word count and reading time
  useEffect(() => {
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    setWordCount(words);
    setReadTime(Math.ceil(words / 200));
  }, [content]);

  // Auto-generate SEO fields
  useEffect(() => {
    if (!seoTitle && title) setSeoTitle(title);
    if (!seoDescription && excerpt) setSeoDescription(excerpt);
  }, [title, excerpt, seoTitle, seoDescription]);

  const handleSave = async (publishNow = false) => {
    if (!title || !content || !authorId || !categoryId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    
    try {
      const postData = {
        title,
        slug,
        content: { raw: content },
        excerpt,
        featured_image_url: featuredImage,
        author_id: authorId,
        category_id: categoryId,
        status: publishNow ? 'published' : status,
        published_at: publishNow ? new Date().toISOString() : null,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
        canonical_url: `https://buyawarranty.co.uk/thewarrantyhub/${slug}`,
        word_count: wordCount,
        read_time_minutes: readTime,
        structured_data: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": title,
          "description": excerpt,
          "wordCount": wordCount,
          "datePublished": publishNow ? new Date().toISOString() : null
        }
      };

      let error;
      if (postId) {
        const result = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', postId);
        error = result.error;
      } else {
        const result = await supabase
          .from('blog_posts')
          .insert([postData]);
        error = result.error;
      }

      if (error) throw error;

      setLastSaved(new Date());
      toast.success(publishNow ? 'Post published successfully!' : 'Post saved as draft');
    } catch (error: any) {
      toast.error('Failed to save post: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Smart Blog Editor</CardTitle>
              <CardDescription>Write and format your content with professional tools</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-muted-foreground mr-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSave(false)}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => handleSave(true)}
                disabled={isSaving}
              >
                <Upload className="w-4 h-4 mr-2" />
                {status === 'published' ? 'Update' : 'Publish'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Article Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Article Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your article title..."
              className="text-lg font-semibold"
            />
          </div>

          {/* URL Slug */}
          <div>
            <label className="block text-sm font-medium mb-2">URL Slug *</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="article-url-slug"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL: buyawarranty.co.uk/thewarrantyhub/{slug || 'your-slug'}
            </p>
          </div>

          {/* Author and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Author *</label>
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent>
                  {authors.map((author) => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Featured Image URL</label>
            <Input
              value={featuredImage}
              onChange={(e) => setFeaturedImage(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-2">Excerpt</label>
            <Textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Write a compelling excerpt that summarizes your article..."
              rows={3}
            />
          </div>

          <Separator />

          {/* SEO Section */}
          <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4" />
              SEO Optimization
            </h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">SEO Title</label>
              <Input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Optimized title for search engines (max 60 chars)"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {seoTitle.length}/60 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SEO Description</label>
              <Textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Optimized description for search engines (max 160 chars)"
                rows={2}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {seoDescription.length}/160 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Keywords (comma-separated)</label>
              <Input
                value={seoKeywords.join(', ')}
                onChange={(e) => setSeoKeywords(e.target.value.split(',').map(k => k.trim()))}
                placeholder="car warranty, vehicle protection, UK drivers"
              />
            </div>
          </div>

          <Separator />

          {/* Main Content Editor */}
          <div>
            <label className="block text-sm font-medium mb-2">Content</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your article content here..."
              rows={20}
              className="font-mono text-sm"
            />
          </div>

          {/* Editor Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-6">
              <span>Words: {wordCount}</span>
              <span>Reading time: {readTime} min</span>
              <span>Characters: {content.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-primary"
            >
              <Upload className="w-4 h-4 mr-2" />
              {status === 'published' ? 'Update Post' : 'Publish Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};