import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Save, Eye, Globe, Search, Image, Link, FileText, 
  Plus, Trash2, Check, AlertCircle, Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LandingPageEditorProps {
  pageId?: string;
  onSave?: () => void;
}

interface FAQ {
  question: string;
  answer: string;
}

interface InternalLink {
  text: string;
  url: string;
}

export const LandingPageEditor = ({ pageId, onSave }: LandingPageEditorProps) => {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  
  // Core fields
  const [slug, setSlug] = useState('');
  const [brandName, setBrandName] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  
  // SEO fields
  const [h1Headline, setH1Headline] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Open Graph
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  
  // Images
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  
  // Content sections
  const [heroSubheadline, setHeroSubheadline] = useState('');
  const [heroDescription, setHeroDescription] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [newBenefit, setNewBenefit] = useState('');
  
  // FAQs
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  
  // Internal linking
  const [internalLinks, setInternalLinks] = useState<InternalLink[]>([]);
  const [showInMainNav, setShowInMainNav] = useState(false);
  const [showInFooter, setShowInFooter] = useState(false);
  const [showOnHomepage, setShowOnHomepage] = useState(false);
  
  // Schema options
  const [includeOrgSchema, setIncludeOrgSchema] = useState(true);
  const [includeLocalSchema, setIncludeLocalSchema] = useState(true);
  const [includeProductSchema, setIncludeProductSchema] = useState(true);
  const [includeFaqSchema, setIncludeFaqSchema] = useState(true);
  const [includeReviewSchema, setIncludeReviewSchema] = useState(true);
  const [includeBreadcrumbSchema, setIncludeBreadcrumbSchema] = useState(true);
  
  // Indexing
  const [isIndexable, setIsIndexable] = useState(true);
  const [robotsDirective, setRobotsDirective] = useState('index, follow');
  
  // Local Business Schema
  const [localBusinessName, setLocalBusinessName] = useState('Buy A Warranty');
  const [localBusinessPhone, setLocalBusinessPhone] = useState('+443302295040');
  const [localBusinessEmail, setLocalBusinessEmail] = useState('support@buyawarranty.co.uk');

  useEffect(() => {
    if (pageId) {
      loadPage();
    }
  }, [pageId]);

  // Auto-generate slug from brand name
  useEffect(() => {
    if (!pageId && brandName) {
      const generatedSlug = brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-extended-warranty';
      setSlug(generatedSlug);
    }
  }, [brandName, pageId]);

  // Auto-generate meta title
  useEffect(() => {
    if (brandName && !metaTitle) {
      setMetaTitle(`${brandName} Extended Warranty | Used ${brandName} Cover & Quotes`);
    }
  }, [brandName]);

  // Auto-generate OG fields from SEO fields
  useEffect(() => {
    if (!ogTitle && metaTitle) {
      setOgTitle(metaTitle);
    }
    if (!ogDescription && metaDescription) {
      setOgDescription(metaDescription);
    }
  }, [metaTitle, metaDescription]);

  const loadPage = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (error) throw error;

      setSlug(data.slug);
      setBrandName(data.brand_name);
      setStatus(data.status as 'draft' | 'published' | 'scheduled');
      setH1Headline(data.h1_headline);
      setMetaTitle(data.meta_title);
      setMetaDescription(data.meta_description);
      setFocusKeyword(data.focus_keyword || '');
      setSecondaryKeywords((data.secondary_keywords as string[]) || []);
      setOgTitle(data.og_title || '');
      setOgDescription(data.og_description || '');
      setOgImageUrl(data.og_image_url || '');
      setFeaturedImageUrl(data.featured_image_url || '');
      setBrandLogoUrl(data.brand_logo_url || '');
      setFaqs((data.faqs as unknown as FAQ[]) || []);
      setInternalLinks((data.internal_links as unknown as InternalLink[]) || []);
      setShowInMainNav(data.show_in_main_nav);
      setShowInFooter(data.show_in_footer);
      setShowOnHomepage(data.show_on_homepage);
      setIncludeOrgSchema(data.include_organization_schema);
      setIncludeLocalSchema(data.include_local_business_schema);
      setIncludeProductSchema(data.include_product_schema);
      setIncludeFaqSchema(data.include_faq_schema);
      setIncludeReviewSchema(data.include_review_schema);
      setIncludeBreadcrumbSchema(data.include_breadcrumb_schema);
      setIsIndexable(data.is_indexable);
      setRobotsDirective(data.robots_directive || 'index, follow');
      setLocalBusinessName(data.local_business_name || 'Buy A Warranty');
      setLocalBusinessPhone(data.local_business_phone || '+443302295040');
      setLocalBusinessEmail(data.local_business_email || 'support@buyawarranty.co.uk');
      
      // Parse hero content
      const heroContent = (data.hero_content as any) || {};
      setHeroSubheadline(heroContent.subheadline || '');
      setHeroDescription(heroContent.description || '');
      setBenefits(heroContent.benefits || []);
    } catch (error: any) {
      console.error('Error loading page:', error);
      toast.error('Failed to load page');
    }
  };

  const handleSave = async (publishNow = false) => {
    if (!brandName || !h1Headline || !metaTitle || !metaDescription || !slug) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (metaTitle.length > 60) {
      toast.error('Meta title must be 60 characters or less');
      return;
    }

    if (metaDescription.length > 160) {
      toast.error('Meta description must be 160 characters or less');
      return;
    }

    setSaving(true);
    try {
      const pageData: any = {
        slug,
        brand_name: brandName,
        status: publishNow ? 'published' : status,
        h1_headline: h1Headline,
        meta_title: metaTitle,
        meta_description: metaDescription,
        focus_keyword: focusKeyword,
        secondary_keywords: secondaryKeywords,
        og_title: ogTitle || metaTitle,
        og_description: ogDescription || metaDescription,
        og_image_url: ogImageUrl,
        featured_image_url: featuredImageUrl,
        brand_logo_url: brandLogoUrl,
        hero_content: {
          subheadline: heroSubheadline,
          description: heroDescription,
          benefits
        },
        faqs,
        internal_links: internalLinks,
        show_in_main_nav: showInMainNav,
        show_in_footer: showInFooter,
        show_on_homepage: showOnHomepage,
        include_organization_schema: includeOrgSchema,
        include_local_business_schema: includeLocalSchema,
        include_product_schema: includeProductSchema,
        include_faq_schema: includeFaqSchema,
        include_review_schema: includeReviewSchema,
        include_breadcrumb_schema: includeBreadcrumbSchema,
        is_indexable: isIndexable,
        robots_directive: robotsDirective,
        local_business_name: localBusinessName,
        local_business_phone: localBusinessPhone,
        local_business_email: localBusinessEmail,
        published_at: publishNow ? new Date().toISOString() : null
      };

      if (pageId) {
        const { error } = await supabase
          .from('landing_pages')
          .update(pageData)
          .eq('id', pageId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('landing_pages')
          .insert(pageData);
        if (error) throw error;
      }

      toast.success(publishNow ? 'Page published!' : 'Page saved!');
      onSave?.();
    } catch (error: any) {
      console.error('Error saving page:', error);
      toast.error(error.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const addFaq = () => {
    setFaqs([...faqs, { question: '', answer: '' }]);
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setBenefits([...benefits, newBenefit.trim()]);
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !secondaryKeywords.includes(newKeyword.trim())) {
      setSecondaryKeywords([...secondaryKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (index: number) => {
    setSecondaryKeywords(secondaryKeywords.filter((_, i) => i !== index));
  };

  const addInternalLink = () => {
    setInternalLinks([...internalLinks, { text: '', url: '' }]);
  };

  const updateInternalLink = (index: number, field: 'text' | 'url', value: string) => {
    const updated = [...internalLinks];
    updated[index][field] = value;
    setInternalLinks(updated);
  };

  const removeInternalLink = (index: number) => {
    setInternalLinks(internalLinks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{pageId ? 'Edit Landing Page' : 'Create Landing Page'}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              <Globe className="w-4 h-4 mr-2" />
              {pageId && status === 'published' ? 'Update' : 'Publish'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="seo">SEO & OG</TabsTrigger>
              <TabsTrigger value="faqs">FAQs</TabsTrigger>
              <TabsTrigger value="linking">Linking</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6 mt-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Name *</Label>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g., BMW, Mercedes, Audi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">/</span>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="bmw-extended-warranty"
                    />
                    <span className="text-gray-500">/</span>
                  </div>
                </div>
              </div>

              {/* H1 Headline */}
              <div className="space-y-2">
                <Label>H1 Headline *</Label>
                <Input
                  value={h1Headline}
                  onChange={(e) => setH1Headline(e.target.value)}
                  placeholder="e.g., BMW Extended Warranty UK"
                />
                <p className="text-xs text-gray-500">Main heading visible on page (include brand keyword)</p>
              </div>

              {/* Hero Subheadline */}
              <div className="space-y-2">
                <Label>Hero Subheadline</Label>
                <Input
                  value={heroSubheadline}
                  onChange={(e) => setHeroSubheadline(e.target.value)}
                  placeholder="e.g., Affordable Cover with Fast Claims"
                />
              </div>

              {/* Hero Description */}
              <div className="space-y-2">
                <Label>Hero Description</Label>
                <Textarea
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                  placeholder="Protect Your BMW. Avoid Costly Repairs. Drive With Confidence."
                  rows={3}
                />
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <Label>Key Benefits</Label>
                <div className="flex gap-2">
                  <Input
                    value={newBenefit}
                    onChange={(e) => setNewBenefit(e.target.value)}
                    placeholder="Add a benefit..."
                    onKeyPress={(e) => e.key === 'Enter' && addBenefit()}
                  />
                  <Button type="button" onClick={addBenefit}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {benefits.map((benefit, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {benefit}
                      <button onClick={() => removeBenefit(index)} className="ml-1 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Featured Image URL</Label>
                  <Input
                    value={featuredImageUrl}
                    onChange={(e) => setFeaturedImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand Logo URL</Label>
                  <Input
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-6 mt-6">
              {/* Meta Title */}
              <div className="space-y-2">
                <Label>Meta Title * ({metaTitle.length}/60)</Label>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="BMW Extended Warranty | Used BMW Cover & Quotes"
                  className={metaTitle.length > 60 ? 'border-red-500' : ''}
                />
                {metaTitle.length > 60 && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Title too long - may be truncated in search results
                  </p>
                )}
              </div>

              {/* Meta Description */}
              <div className="space-y-2">
                <Label>Meta Description * ({metaDescription.length}/160)</Label>
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Protect your BMW from costly repairs..."
                  rows={3}
                  className={metaDescription.length > 160 ? 'border-red-500' : ''}
                />
                {metaDescription.length > 160 && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Description too long
                  </p>
                )}
              </div>

              {/* Focus Keyword */}
              <div className="space-y-2">
                <Label>Focus Keyword</Label>
                <Input
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g., BMW warranty"
                />
              </div>

              {/* Secondary Keywords */}
              <div className="space-y-2">
                <Label>Secondary Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Add keyword..."
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <Button type="button" onClick={addKeyword}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {secondaryKeywords.map((kw, index) => (
                    <Badge key={index} variant="outline">
                      {kw}
                      <button onClick={() => removeKeyword(index)} className="ml-1 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <hr />

              {/* Open Graph - Unique per page */}
              <h3 className="font-semibold text-lg">Open Graph (Social Sharing)</h3>
              <p className="text-sm text-gray-500">Customize how this page appears when shared on social media and AI tools</p>

              <div className="space-y-2">
                <Label>OG Title ({ogTitle.length}/100)</Label>
                <Input
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  placeholder="Defaults to meta title if empty"
                />
              </div>

              <div className="space-y-2">
                <Label>OG Description ({ogDescription.length}/200)</Label>
                <Textarea
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  placeholder="Defaults to meta description if empty"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>OG Image URL</Label>
                <Input
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-xs text-gray-500">Recommended: 1200x630px for optimal display</p>
              </div>

              <hr />

              {/* Indexing Controls */}
              <h3 className="font-semibold text-lg">Indexing Controls</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Search Engine Indexing</Label>
                  <p className="text-xs text-gray-500">If disabled, search engines won't index this page</p>
                </div>
                <Switch checked={isIndexable} onCheckedChange={setIsIndexable} />
              </div>

              <div className="space-y-2">
                <Label>Robots Directive</Label>
                <Select value={robotsDirective} onValueChange={setRobotsDirective}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index, follow">index, follow (Default)</SelectItem>
                    <SelectItem value="noindex, follow">noindex, follow</SelectItem>
                    <SelectItem value="index, nofollow">index, nofollow</SelectItem>
                    <SelectItem value="noindex, nofollow">noindex, nofollow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SERP Preview */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold mb-2">Search Engine Preview</h4>
                <div className="space-y-1">
                  <p className="text-blue-600 text-lg hover:underline cursor-pointer truncate">
                    {metaTitle || 'Page Title Here'}
                  </p>
                  <p className="text-green-700 text-sm">
                    buyawarranty.co.uk/{slug}/
                  </p>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {metaDescription || 'Meta description will appear here...'}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="faqs" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">FAQ Section</h3>
                  <p className="text-sm text-gray-500">Add FAQs for schema markup and on-page display</p>
                </div>
                <Button onClick={addFaq}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <Label>Question {index + 1}</Label>
                            <Input
                              value={faq.question}
                              onChange={(e) => updateFaq(index, 'question', e.target.value)}
                              placeholder="e.g., Is a BMW extended warranty worth it?"
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500"
                            onClick={() => removeFaq(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Answer</Label>
                          <Textarea
                            value={faq.answer}
                            onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                            placeholder="Provide a detailed answer..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {faqs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No FAQs added yet. Click "Add FAQ" to create schema-optimized questions.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="linking" className="space-y-6 mt-6">
              {/* Navigation Placement */}
              <div className="space-y-4">
                <h3 className="font-semibold">Navigation Placement</h3>
                <p className="text-sm text-gray-500">Choose where this page appears on the site (avoid orphan pages)</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Show in Main Navigation</Label>
                      <p className="text-xs text-gray-500">Add to the main menu dropdown</p>
                    </div>
                    <Switch checked={showInMainNav} onCheckedChange={setShowInMainNav} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Show in Footer</Label>
                      <p className="text-xs text-gray-500">Add to footer links section</p>
                    </div>
                    <Switch checked={showInFooter} onCheckedChange={setShowInFooter} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Show on Homepage</Label>
                      <p className="text-xs text-gray-500">Feature in homepage brand section</p>
                    </div>
                    <Switch checked={showOnHomepage} onCheckedChange={setShowOnHomepage} />
                  </div>
                </div>
              </div>

              <hr />

              {/* Internal Links */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Internal Links</h3>
                    <p className="text-sm text-gray-500">Add links to relevant pages (improves SEO)</p>
                  </div>
                  <Button onClick={addInternalLink}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </div>

                <div className="space-y-3">
                  {internalLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={link.text}
                        onChange={(e) => updateInternalLink(index, 'text', e.target.value)}
                        placeholder="Link text"
                        className="flex-1"
                      />
                      <Input
                        value={link.url}
                        onChange={(e) => updateInternalLink(index, 'url', e.target.value)}
                        placeholder="/page-url/"
                        className="flex-1"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500"
                        onClick={() => removeInternalLink(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Suggested Links */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Suggested Internal Links</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="cursor-pointer hover:bg-blue-100" 
                      onClick={() => setInternalLinks([...internalLinks, { text: 'Get a Quote', url: '/#quote-form' }])}>
                      + Get a Quote
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-blue-100"
                      onClick={() => setInternalLinks([...internalLinks, { text: "What's Covered", url: '/what-is-covered/' }])}>
                      + What's Covered
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-blue-100"
                      onClick={() => setInternalLinks([...internalLinks, { text: 'Make a Claim', url: '/make-a-claim/' }])}>
                      + Make a Claim
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-blue-100"
                      onClick={() => setInternalLinks([...internalLinks, { text: 'FAQ', url: '/faq/' }])}>
                      + FAQ
                    </Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schema" className="space-y-6 mt-6">
              <div>
                <h3 className="font-semibold mb-2">Schema Markup Options</h3>
                <p className="text-sm text-gray-500 mb-4">Select which structured data schemas to include</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Organization Schema</Label>
                      <p className="text-xs text-gray-500">Business identity, contact info, Trustpilot rating</p>
                    </div>
                    <Switch checked={includeOrgSchema} onCheckedChange={setIncludeOrgSchema} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Local Business Schema (UK Geo-targeting)</Label>
                      <p className="text-xs text-gray-500">UK address, phone, email for local SEO</p>
                    </div>
                    <Switch checked={includeLocalSchema} onCheckedChange={setIncludeLocalSchema} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Product Schema</Label>
                      <p className="text-xs text-gray-500">Warranty as product with pricing</p>
                    </div>
                    <Switch checked={includeProductSchema} onCheckedChange={setIncludeProductSchema} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>FAQ Schema</Label>
                      <p className="text-xs text-gray-500">Structured Q&A for rich snippets</p>
                    </div>
                    <Switch checked={includeFaqSchema} onCheckedChange={setIncludeFaqSchema} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Review Schema</Label>
                      <p className="text-xs text-gray-500">Customer reviews and ratings</p>
                    </div>
                    <Switch checked={includeReviewSchema} onCheckedChange={setIncludeReviewSchema} />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Breadcrumb Schema</Label>
                      <p className="text-xs text-gray-500">Navigation hierarchy</p>
                    </div>
                    <Switch checked={includeBreadcrumbSchema} onCheckedChange={setIncludeBreadcrumbSchema} />
                  </div>
                </div>
              </div>

              <hr />

              {/* Local Business Details */}
              <Accordion type="single" collapsible>
                <AccordionItem value="local-business">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Local Business Schema Details
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Business Name</Label>
                      <Input
                        value={localBusinessName}
                        onChange={(e) => setLocalBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input
                        value={localBusinessPhone}
                        onChange={(e) => setLocalBusinessPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={localBusinessEmail}
                        onChange={(e) => setLocalBusinessEmail(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      UK address defaults to "United Kingdom" for national coverage. Geo-coordinates set to London (51.5074, -0.1278).
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
