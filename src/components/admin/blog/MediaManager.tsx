import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, Image, Video, FileText, Search, Filter, 
  Edit, Trash2, Download, Copy, Tag, Star, Grid, 
  List, Folder, Calendar, Eye, Minimize2
} from 'lucide-react';

export const MediaManager = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');

  const mediaItems = [
    {
      id: 1,
      name: 'car-warranty-guide.jpg',
      type: 'image',
      size: '2.4 MB',
      dimensions: '1920x1080',
      uploadDate: '2025-01-15',
      altText: 'Complete guide to car warranties with infographic',
      tags: ['warranty', 'guide', 'infographic'],
      url: '/public/lovable-uploads/warranty-guide.jpg',
      featured: true
    },
    {
      id: 2,
      name: 'ev-charging-station.mp4',
      type: 'video',
      size: '15.8 MB',
      dimensions: '1920x1080',
      uploadDate: '2025-01-14',
      altText: 'Electric vehicle charging at a public station',
      tags: ['ev', 'charging', 'electric'],
      url: '/public/lovable-uploads/ev-charging.mp4',
      featured: false
    },
    {
      id: 3,
      name: 'warranty-comparison-chart.png',
      type: 'image',
      size: '890 KB',
      dimensions: '1200x800',
      uploadDate: '2025-01-13',
      altText: 'Comparison chart of different warranty types',
      tags: ['warranty', 'comparison', 'chart'],
      url: '/public/lovable-uploads/warranty-comparison.png',
      featured: false
    },
    {
      id: 4,
      name: 'customer-testimonial-video.mp4',
      type: 'video',
      size: '22.1 MB',
      dimensions: '1920x1080',
      uploadDate: '2025-01-12',
      altText: 'Happy customer sharing warranty experience',
      tags: ['testimonial', 'customer', 'review'],
      url: '/public/lovable-uploads/testimonial.mp4',
      featured: true
    },
    {
      id: 5,
      name: 'maintenance-tips-infographic.jpg',
      type: 'image',
      size: '1.2 MB',
      dimensions: '800x1200',
      uploadDate: '2025-01-11',
      altText: 'Essential car maintenance tips infographic',
      tags: ['maintenance', 'tips', 'infographic'],
      url: '/public/lovable-uploads/maintenance-tips.jpg',
      featured: false
    }
  ];

  const tags = ['all', 'warranty', 'guide', 'ev', 'maintenance', 'customer', 'infographic'];

  const filteredItems = mediaItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.altText.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = selectedTag === 'all' || item.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-blue-100 text-blue-800';
      case 'video': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Media Upload
          </CardTitle>
          <CardDescription>Upload and manage your blog media assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Drop files here or click to upload</h3>
            <p className="text-gray-600 mb-4">Supports: JPG, PNG, WebP, MP4, MOV (Max 50MB)</p>
            <div className="space-y-2">
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
            </div>
          </div>
          
          {/* Upload Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Minimize2 className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="font-medium text-sm">Auto Compression</h4>
                <p className="text-xs text-gray-600">Optimize file sizes automatically</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Edit className="w-5 h-5 text-green-600" />
              <div>
                <h4 className="font-medium text-sm">Image Editing</h4>
                <p className="text-xs text-gray-600">Crop and resize images</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Tag className="w-5 h-5 text-purple-600" />
              <div>
                <h4 className="font-medium text-sm">Auto Tagging</h4>
                <p className="text-xs text-gray-600">AI-powered content tags</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Library */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Folder className="w-5 h-5" />
                Media Library
              </CardTitle>
              <CardDescription>{filteredItems.length} of {mediaItems.length} files</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search media files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="flex gap-1 flex-wrap">
                {tags.map(tag => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(tag)}
                    className="capitalize"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Media Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <div key={item.id} className="group border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative aspect-video bg-gray-100 flex items-center justify-center">
                    {item.type === 'image' ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <Image className="w-8 h-8 text-blue-600" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                        <Video className="w-8 h-8 text-purple-600" />
                      </div>
                    )}
                    {item.featured && (
                      <Star className="absolute top-2 right-2 w-4 h-4 text-yellow-500 fill-current" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="secondary">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {getFileIcon(item.type)}
                      <h4 className="font-medium text-sm truncate flex-1">{item.name}</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{item.size}</span>
                        <Badge className={getTypeColor(item.type)}>{item.type}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    {getFileIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        {item.featured && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                        <Badge className={getTypeColor(item.type)}>{item.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{item.altText}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{item.size}</span>
                    <span>{item.dimensions}</span>
                    <span>{item.uploadDate}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Featured Image Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Featured Image
          </CardTitle>
          <CardDescription>Select the main image for this blog post</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mediaItems.filter(item => item.type === 'image').slice(0, 4).map((item) => (
              <Button
                key={item.id}
                variant="outline"
                className="h-24 p-2 flex flex-col gap-2"
              >
                <Image className="w-6 h-6" />
                <span className="text-xs truncate">{item.name}</span>
              </Button>
            ))}
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Featured Image Guidelines:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Recommended size: 1200x630px (1.91:1 ratio)</li>
              <li>• Include relevant alt text for accessibility</li>
              <li>• Use high-quality, professional images</li>
              <li>• Ensure images are optimized for web</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};