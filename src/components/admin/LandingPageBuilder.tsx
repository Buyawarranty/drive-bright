import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LandingPageEditor } from './landing-pages/LandingPageEditor';
import { LandingPagePreview } from './landing-pages/LandingPagePreview';
import { BulkPageCreator } from './landing-pages/BulkPageCreator';
import { 
  Globe, Search, Eye, Plus, Edit, Trash2, ExternalLink, 
  CheckCircle, Clock, FileText, BarChart3, Copy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LandingPage {
  id: string;
  slug: string;
  brand_name: string;
  h1_headline: string;
  meta_title: string;
  status: string;
  view_count: number;
  conversion_count: number;
  published_at: string | null;
  updated_at: string;
  is_indexable: boolean;
}

export const LandingPageBuilder = () => {
  const [activeTab, setActiveTab] = useState('pages');
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    totalViews: 0
  });

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('landing_pages')
        .select('id, slug, brand_name, h1_headline, meta_title, status, view_count, conversion_count, published_at, updated_at, is_indexable')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setPages(data || []);
      
      // Calculate stats
      const total = data?.length || 0;
      const published = data?.filter(p => p.status === 'published').length || 0;
      const draft = data?.filter(p => p.status === 'draft').length || 0;
      const totalViews = data?.reduce((sum, p) => sum + (p.view_count || 0), 0) || 0;
      
      setStats({ total, published, draft, totalViews });
    } catch (error: any) {
      console.error('Error loading pages:', error);
      toast.error('Failed to load landing pages');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this landing page?')) return;
    
    try {
      const { error } = await supabase
        .from('landing_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Landing page deleted');
      loadPages();
    } catch (error: any) {
      toast.error('Failed to delete page');
    }
  };

  const handleDuplicate = async (page: LandingPage) => {
    try {
      const { data: original, error: fetchError } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', page.id)
        .single();

      if (fetchError) throw fetchError;

      const { id, created_at, updated_at, published_at, view_count, conversion_count, ...pageData } = original;
      
      const { error } = await supabase
        .from('landing_pages')
        .insert({
          ...pageData,
          slug: `${pageData.slug}-copy`,
          brand_name: `${pageData.brand_name} (Copy)`,
          status: 'draft'
        });

      if (error) throw error;
      
      toast.success('Page duplicated');
      loadPages();
    } catch (error: any) {
      toast.error('Failed to duplicate page');
    }
  };

  const getStatusBadge = (status: string, isIndexable: boolean) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      published: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      draft: { color: 'bg-yellow-100 text-yellow-800', icon: FileText },
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      archived: { color: 'bg-gray-100 text-gray-800', icon: FileText }
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-2">
        <Badge className={config.color}>
          <Icon className="w-3 h-3 mr-1" />
          {status}
        </Badge>
        {!isIndexable && (
          <Badge variant="outline" className="text-red-600 border-red-300">
            noindex
          </Badge>
        )}
      </div>
    );
  };

  const filteredPages = pages.filter(page => 
    page.brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.h1_headline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedPage) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => {
            setSelectedPage(null);
            loadPages();
          }}
        >
          ← Back to Landing Pages
        </Button>
        <LandingPageEditor 
          pageId={selectedPage === 'new' ? undefined : selectedPage}
          onSave={() => {
            setSelectedPage(null);
            loadPages();
          }}
        />
      </div>
    );
  }

  if (previewPage) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={() => setPreviewPage(null)}
        >
          ← Back to Landing Pages
        </Button>
        <LandingPagePreview pageId={previewPage} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Landing Page Builder</h1>
          <p className="text-gray-600 mt-2">Create SEO-optimized landing pages for car brands</p>
        </div>
        <Button 
          onClick={() => setSelectedPage('new')}
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Landing Page
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pages</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Globe className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Published</p>
                <p className="text-2xl font-bold">{stats.published}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Drafts</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
              <FileText className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pages" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            All Pages
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Bulk Creator
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            SEO Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="space-y-6">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search pages by brand, slug, or headline..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Pages List */}
          <Card>
            <CardHeader>
              <CardTitle>Landing Pages</CardTitle>
              <CardDescription>Manage your SEO-optimized brand landing pages</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500 text-center py-8">Loading pages...</p>
              ) : filteredPages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No landing pages found. Create your first one!</p>
              ) : (
                <div className="space-y-4">
                  {filteredPages.map((page) => (
                    <div key={page.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{page.brand_name}</h3>
                          {getStatusBadge(page.status, page.is_indexable)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            /{page.slug}/
                          </span>
                          <span>Views: {page.view_count || 0}</span>
                          <span>Modified {new Date(page.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setPreviewPage(page.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedPage(page.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDuplicate(page)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {page.status === 'published' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/${page.slug}/`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(page.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <BulkPageCreator onComplete={loadPages} />
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>SEO Audit</CardTitle>
              <CardDescription>Check indexability and SEO health of all landing pages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pages.map((page) => (
                  <div key={page.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{page.brand_name}</h4>
                      {getStatusBadge(page.status, page.is_indexable)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Meta Title:</span>
                        <p className={page.meta_title.length > 60 ? 'text-red-600' : 'text-green-600'}>
                          {page.meta_title.length}/60 chars
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Indexable:</span>
                        <p className={page.is_indexable ? 'text-green-600' : 'text-red-600'}>
                          {page.is_indexable ? 'Yes' : 'No (noindex)'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <p className={page.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>
                          {page.status}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">URL:</span>
                        <p className="font-mono text-xs truncate">/{page.slug}/</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
