import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Monitor, Tablet, Smartphone, Eye, Share2, Link, 
  Accessibility, Zap, Globe, CheckCircle, AlertTriangle,
  RefreshCw, Settings, Download, ExternalLink
} from 'lucide-react';

export const PreviewTools = () => {
  const [activeDevice, setActiveDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewMode, setPreviewMode] = useState<'live' | 'draft'>('draft');

  const accessibilityChecks = [
    { item: 'Alt text for images', status: 'good', score: 95 },
    { item: 'Heading structure', status: 'good', score: 100 },
    { item: 'Color contrast', status: 'warning', score: 78 },
    { item: 'Keyboard navigation', status: 'good', score: 92 },
    { item: 'ARIA labels', status: 'warning', score: 85 },
    { item: 'Focus indicators', status: 'good', score: 88 }
  ];

  const performanceChecks = [
    { item: 'Page load speed', status: 'good', score: '2.1s', metric: 'Load Time' },
    { item: 'First contentful paint', status: 'good', score: '1.2s', metric: 'FCP' },
    { item: 'Largest contentful paint', status: 'warning', score: '3.8s', metric: 'LCP' },
    { item: 'Cumulative layout shift', status: 'good', score: '0.05', metric: 'CLS' },
    { item: 'Time to interactive', status: 'good', score: '2.8s', metric: 'TTI' },
    { item: 'Mobile friendliness', status: 'good', score: '98', metric: 'Score' }
  ];

  const socialPreviews = [
    {
      platform: 'Facebook',
      title: 'Complete Guide to Car Warranties in 2025',
      description: 'Everything you need to know about choosing the right warranty for your vehicle. Expert tips and recommendations.',
      image: '/public/lovable-uploads/warranty-guide.jpg',
      url: 'buyawarranty.co.uk/blog/car-warranties-guide-2025'
    },
    {
      platform: 'Twitter',
      title: 'Complete Guide to Car Warranties in 2025',
      description: 'Everything you need to know about choosing the right warranty for your vehicle. Expert tips and recommendations.',
      image: '/public/lovable-uploads/warranty-guide.jpg',
      url: 'buyawarranty.co.uk/blog/car-warranties-guide-2025'
    },
    {
      platform: 'LinkedIn',
      title: 'Complete Guide to Car Warranties in 2025',
      description: 'Everything you need to know about choosing the right warranty for your vehicle. Expert tips and recommendations.',
      image: '/public/lovable-uploads/warranty-guide.jpg',
      url: 'buyawarranty.co.uk/blog/car-warranties-guide-2025'
    }
  ];

  const getStatusIcon = (status: string) => {
    return status === 'good' ? 
      <CheckCircle className="w-4 h-4 text-green-600" /> : 
      <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusColor = (status: string) => {
    return status === 'good' ? 
      'bg-green-100 text-green-800' : 
      'bg-yellow-100 text-yellow-800';
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'desktop': return <Monitor className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      default: return <Monitor className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Live Preview
              </CardTitle>
              <CardDescription>Preview your content across different devices and platforms</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={previewMode === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('draft')}
              >
                Draft
              </Button>
              <Button
                variant={previewMode === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('live')}
              >
                Published
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Device Selection */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={activeDevice === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveDevice('desktop')}
            >
              <Monitor className="w-4 h-4 mr-2" />
              Desktop
            </Button>
            <Button
              variant={activeDevice === 'tablet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveDevice('tablet')}
            >
              <Tablet className="w-4 h-4 mr-2" />
              Tablet
            </Button>
            <Button
              variant={activeDevice === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveDevice('mobile')}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Mobile
            </Button>
          </div>

          {/* Preview Frame */}
          <div className="border rounded-lg overflow-hidden bg-gray-100">
            <div className="bg-gray-800 text-white p-2 flex items-center gap-2">
              {getDeviceIcon(activeDevice)}
              <span className="text-sm capitalize">{activeDevice} Preview</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs">
                  {activeDevice === 'desktop' ? '1920x1080' : 
                   activeDevice === 'tablet' ? '768x1024' : '375x667'}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {previewMode === 'draft' ? 'Draft' : 'Live'}
                </Badge>
              </div>
            </div>
            <div 
              className={`bg-white transition-all duration-300 ${
                activeDevice === 'desktop' ? 'h-96' :
                activeDevice === 'tablet' ? 'h-80 max-w-lg mx-auto' :
                'h-96 max-w-sm mx-auto'
              }`}
            >
              {/* Mock article preview */}
              <div className="p-6">
                <div className="mb-4">
                  <h1 className={`font-bold ${
                    activeDevice === 'mobile' ? 'text-xl' : 'text-2xl'
                  }`}>
                    Complete Guide to Car Warranties in 2025
                  </h1>
                  <p className="text-gray-600 text-sm mt-2">
                    Published on January 15, 2025 by John Smith
                  </p>
                </div>
                <div className="mb-4">
                  <div className="bg-gray-200 rounded h-32 flex items-center justify-center">
                    <span className="text-gray-500">Featured Image</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...
                  </p>
                  <div className="space-y-2">
                    <div className="bg-gray-200 rounded h-3 w-full"></div>
                    <div className="bg-gray-200 rounded h-3 w-4/5"></div>
                    <div className="bg-gray-200 rounded h-3 w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="accessibility" className="space-y-6">
        <TabsList>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="social">Social Preview</TabsTrigger>
          <TabsTrigger value="amp">AMP & Mobile</TabsTrigger>
        </TabsList>

        <TabsContent value="accessibility">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Accessibility className="w-5 h-5" />
                Accessibility Checker
              </CardTitle>
              <CardDescription>Ensure your content is accessible to all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800">Overall Score</h4>
                  <p className="text-3xl font-bold text-green-600">89%</p>
                  <p className="text-sm text-green-600">Good accessibility</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">WCAG Level</h4>
                  <p className="text-3xl font-bold text-blue-600">AA</p>
                  <p className="text-sm text-blue-600">Meets standards</p>
                </div>
              </div>

              <div className="space-y-3">
                {accessibilityChecks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <span className="text-sm">{check.item}</span>
                    </div>
                    <Badge className={getStatusColor(check.status)}>
                      {check.score}%
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Recommendations</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Improve color contrast for better readability</li>
                  <li>• Add more descriptive ARIA labels to buttons</li>
                  <li>• Consider adding skip navigation links</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Performance Analysis
              </CardTitle>
              <CardDescription>Optimize your page speed and user experience</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800">Performance Score</h4>
                  <p className="text-3xl font-bold text-green-600">92</p>
                  <p className="text-sm text-green-600">Excellent</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">SEO Score</h4>
                  <p className="text-3xl font-bold text-blue-600">85</p>
                  <p className="text-sm text-blue-600">Good</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800">Best Practices</h4>
                  <p className="text-3xl font-bold text-purple-600">96</p>
                  <p className="text-sm text-purple-600">Excellent</p>
                </div>
              </div>

              <div className="space-y-3">
                {performanceChecks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <span className="text-sm">{check.item}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{check.metric}</span>
                      <Badge className={getStatusColor(check.status)}>
                        {check.score}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Optimization Tips</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Images are properly optimized</li>
                    <li>• CSS and JavaScript are minified</li>
                    <li>• Caching headers are configured</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">Areas for Improvement</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Reduce largest contentful paint time</li>
                    <li>• Optimize third-party scripts</li>
                    <li>• Enable text compression</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Social Media Preview
              </CardTitle>
              <CardDescription>See how your article will appear when shared</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {socialPreviews.map((preview, index) => (
                  <div key={index}>
                    <h4 className="font-medium mb-3">{preview.platform}</h4>
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex gap-4">
                        <div className="bg-gray-200 rounded w-20 h-20 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-gray-500">Image</span>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-sm mb-1">{preview.title}</h5>
                          <p className="text-sm text-gray-600 mb-2">{preview.description}</p>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">{preview.url}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Social Media Tips</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Use high-quality featured images (1200x630px recommended)</li>
                  <li>• Keep titles under 60 characters for optimal display</li>
                  <li>• Write compelling descriptions that encourage clicks</li>
                  <li>• Test previews before publishing</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                AMP & Mobile Optimization
              </CardTitle>
              <CardDescription>Optimize for mobile-first and AMP performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">Mobile Optimization</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm">Mobile-friendly design</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm">Touch-friendly buttons</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm">Responsive images</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="text-sm">Page load speed</span>
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">AMP Status</h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h5 className="font-medium text-blue-800">AMP Available</h5>
                      <p className="text-sm text-blue-600 mt-1">
                        Accelerated Mobile Pages version is ready
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview AMP
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">AMP Validation</h5>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Valid AMP HTML</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Optimized CSS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>Structured data present</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Mobile Performance Score</h4>
                    <p className="text-sm text-gray-600">Google PageSpeed Insights</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">94</p>
                    <p className="text-sm text-green-600">Excellent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};