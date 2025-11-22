import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Search, Target, Eye, Link, CheckCircle, AlertCircle, 
  TrendingUp, Globe, Hash, FileText, Lightbulb, Star
} from 'lucide-react';

export const SEOToolkit = () => {
  const [focusKeyword, setFocusKeyword] = useState('car warranty');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [slug, setSlug] = useState('');

  const seoScore = 78;
  const readabilityScore = 85;

  const seoChecks = [
    { item: 'Focus keyword in title', status: 'good', score: 100 },
    { item: 'Focus keyword in meta description', status: 'good', score: 100 },
    { item: 'Focus keyword in content', status: 'good', score: 100 },
    { item: 'Meta description length', status: 'warning', score: 70 },
    { item: 'Title length', status: 'good', score: 100 },
    { item: 'Internal links', status: 'poor', score: 30 },
    { item: 'External links', status: 'good', score: 100 },
    { item: 'Image alt text', status: 'warning', score: 60 },
  ];

  const readabilityChecks = [
    { item: 'Flesch Reading Ease', status: 'good', score: 'Good (65.2)' },
    { item: 'Average sentence length', status: 'good', score: '15.2 words' },
    { item: 'Passive voice', status: 'warning', score: '8.5%' },
    { item: 'Transition words', status: 'good', score: '35%' },
    { item: 'Subheading distribution', status: 'good', score: 'Good' },
    { item: 'Paragraph length', status: 'warning', score: 'Some too long' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'poor': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* SEO Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <CardTitle>SEO Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-primary">{seoScore}%</div>
              <Progress value={seoScore} className="w-full" />
              <Badge className={seoScore >= 80 ? 'bg-green-100 text-green-800' : seoScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                {seoScore >= 80 ? 'Excellent' : seoScore >= 60 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle>Readability Score</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-blue-600">{readabilityScore}%</div>
              <Progress value={readabilityScore} className="w-full" />
              <Badge className={readabilityScore >= 80 ? 'bg-green-100 text-green-800' : readabilityScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                {readabilityScore >= 80 ? 'Very Readable' : readabilityScore >= 60 ? 'Readable' : 'Difficult to Read'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Focus Keyword */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Focus Keyword Analysis
          </CardTitle>
          <CardDescription>Set your primary keyword for SEO optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Focus Keyword</label>
            <Input
              value={focusKeyword}
              onChange={(e) => setFocusKeyword(e.target.value)}
              placeholder="Enter your focus keyword..."
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">8</div>
              <div className="text-sm text-gray-600">Keyword Density</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">1,200</div>
              <div className="text-sm text-gray-600">Search Volume</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">45</div>
              <div className="text-sm text-gray-600">Difficulty</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">£2.40</div>
              <div className="text-sm text-gray-600">CPC</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Meta Information
          </CardTitle>
          <CardDescription>Optimize your search engine snippet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Meta Title</label>
              <span className="text-sm text-gray-500">{metaTitle.length}/60</span>
            </div>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Enter your page title..."
              maxLength={60}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Meta Description</label>
              <span className="text-sm text-gray-500">{metaDescription.length}/160</span>
            </div>
            <Textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Write a compelling meta description..."
              maxLength={160}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">buyawarranty.co.uk/blog/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug"
                className="flex-1"
              />
            </div>
          </div>

          {/* Search Preview */}
          <div className="p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Search Engine Preview
            </h4>
            <div className="bg-white p-4 rounded border">
              <h3 className="text-blue-600 text-lg hover:underline cursor-pointer">
                {metaTitle || 'Your Page Title Here'}
              </h3>
              <p className="text-green-600 text-sm">
                buyawarranty.co.uk/blog/{slug || 'your-url-slug'}
              </p>
              <p className="text-gray-700 text-sm mt-1">
                {metaDescription || 'Your meta description will appear here. Make it compelling to improve click-through rates.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              SEO Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seoChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <span className="text-sm">{check.item}</span>
                  </div>
                  <Badge className={getStatusColor(check.status)}>
                    {typeof check.score === 'number' ? `${check.score}%` : check.score}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Readability Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readabilityChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <span className="text-sm">{check.item}</span>
                  </div>
                  <Badge className={getStatusColor(check.status)}>
                    {check.score}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schema Markup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Schema Markup
          </CardTitle>
          <CardDescription>Structure your content for better search visibility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <FileText className="w-6 h-6" />
              <span className="text-xs">Article</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Lightbulb className="w-6 h-6" />
              <span className="text-xs">FAQ</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Star className="w-6 h-6" />
              <span className="text-xs">Review</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <TrendingUp className="w-6 h-6" />
              <span className="text-xs">How-to</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Internal Linking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Internal Linking Suggestions
          </CardTitle>
          <CardDescription>Improve your site's link structure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm">Related Articles to Link:</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• "Understanding EV Warranties: Complete Guide 2025"</li>
                <li>• "Car Warranty vs Extended Warranty: What's the Difference?"</li>
                <li>• "Top 10 Most Reliable Car Brands for Extended Warranties"</li>
              </ul>
            </div>
            <Button variant="outline" size="sm">
              Auto-suggest Internal Links
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};