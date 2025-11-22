import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  FolderOpen, Tag, User, Clock, CalendarDays, MessageSquare, 
  Share2, Globe, FileText, Settings, Users, Eye, Edit3,
  CheckCircle, AlertCircle, Calendar, Send
} from 'lucide-react';

export const ContentOrganizer = () => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [tags, setTags] = useState(['car warranty', 'guide', 'insurance']);
  const [newTag, setNewTag] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [status, setStatus] = useState('draft');

  const categories = [
    { id: 'warranty-guides', name: 'Warranty Guides', count: 12 },
    { id: 'car-maintenance', name: 'Car Maintenance', count: 8 },
    { id: 'insurance-tips', name: 'Insurance Tips', count: 6 },
    { id: 'ev-guides', name: 'EV Guides', count: 4 },
    { id: 'customer-stories', name: 'Customer Stories', count: 15 }
  ];

  const authors = [
    { id: '1', name: 'John Smith', role: 'Senior Writer', articles: 24 },
    { id: '2', name: 'Sarah Johnson', role: 'Content Manager', articles: 18 },
    { id: '3', name: 'Mike Chen', role: 'Technical Writer', articles: 12 }
  ];

  const workflow = [
    { step: 'Draft', status: 'current', description: 'Content creation in progress' },
    { step: 'Review', status: 'pending', description: 'Editorial review and fact-checking' },
    { step: 'SEO Check', status: 'pending', description: 'SEO optimization and keyword analysis' },
    { step: 'Approval', status: 'pending', description: 'Final approval from content manager' },
    { step: 'Published', status: 'pending', description: 'Live on website' }
  ];

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current': return <Edit3 className="w-4 h-4 text-blue-600" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-gray-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (postStatus: string) => {
    switch (postStatus) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Content Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Content Workflow
          </CardTitle>
          <CardDescription>Track your article through the publication process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {workflow.map((item, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    item.status === 'current' ? 'border-blue-600 bg-blue-50' :
                    item.status === 'completed' ? 'border-green-600 bg-green-50' :
                    'border-gray-300 bg-gray-50'
                  }`}>
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="text-center mt-2">
                    <h4 className="text-sm font-medium">{item.step}</h4>
                    <p className="text-xs text-gray-600 max-w-20">{item.description}</p>
                  </div>
                </div>
                {index < workflow.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    item.status === 'completed' ? 'bg-green-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Categories
            </CardTitle>
            <CardDescription>Organize your content by topic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">All Categories</h4>
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">{category.name}</span>
                  <Badge variant="secondary">{category.count}</Badge>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full">
              <FolderOpen className="w-4 h-4 mr-2" />
              Manage Categories
            </Button>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags
            </CardTitle>
            <CardDescription>Add relevant tags for better discoverability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <Button onClick={addTag} size="sm">Add</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="cursor-pointer">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Popular Tags</h4>
              <div className="flex flex-wrap gap-1">
                {['car warranty', 'maintenance', 'insurance', 'EV', 'guide', 'tips'].map((tag) => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    onClick={() => !tags.includes(tag) && setTags([...tags, tag])}
                    disabled={tags.includes(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Publishing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Publishing Settings
          </CardTitle>
          <CardDescription>Control when and how your content is published</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Publish Date</label>
              <Input
                type="datetime-local"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Author</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select author" />
                </SelectTrigger>
                <SelectContent>
                  {authors.map((author) => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.name} ({author.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Co-Authors
              </h4>
              <div className="space-y-2">
                {authors.slice(0, 2).map((author) => (
                  <div key={author.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm">{author.name}</span>
                    </div>
                    <Badge variant="outline">{author.role}</Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Add Co-Author
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Visibility Settings
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Public</span>
                  <Badge className={getStatusColor('published')}>Visible to all</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Search Engines</span>
                  <Badge className="bg-green-100 text-green-800">Indexed</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">RSS Feed</span>
                  <Badge className="bg-blue-100 text-blue-800">Included</Badge>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Advanced Settings
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editorial Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Editorial Comments
          </CardTitle>
          <CardDescription>Collaborate with your team through feedback and notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                <span className="font-medium text-sm">Sarah Johnson</span>
                <span className="text-xs text-gray-600">2 hours ago</span>
              </div>
              <p className="text-sm">Great article! Please add more statistics about EV warranty coverage in the third paragraph.</p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                <span className="font-medium text-sm">Mike Chen</span>
                <span className="text-xs text-gray-600">1 day ago</span>
              </div>
              <p className="text-sm">SEO review complete. Focus keyword density is optimal. Consider adding internal links to related warranty guides.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Add your comment or feedback..."
              rows={3}
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  Attach File
                </Button>
              </div>
              <Button size="sm">
                <Send className="w-4 h-4 mr-2" />
                Add Comment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publishing Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              <Button variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Share Draft
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">
                Save Draft
              </Button>
              <Button>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Publish
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};