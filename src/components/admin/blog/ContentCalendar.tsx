import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, CalendarDays, Plus, Filter, Grid, List, 
  Clock, User, Eye, Edit, Trash2, ChevronLeft, 
  ChevronRight, FileText, CheckCircle, AlertCircle
} from 'lucide-react';

export const ContentCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterStatus, setFilterStatus] = useState('all');

  const scheduledPosts = [
    {
      id: 1,
      title: 'EV Warranty Guide 2025',
      author: 'John Smith',
      status: 'scheduled',
      publishDate: '2025-01-18',
      category: 'EV Guides',
      priority: 'high'
    },
    {
      id: 2,
      title: 'Car Maintenance Tips for Winter',
      author: 'Sarah Johnson',
      status: 'draft',
      publishDate: '2025-01-20',
      category: 'Maintenance',
      priority: 'medium'
    },
    {
      id: 3,
      title: 'Extended Warranty vs Insurance',
      author: 'Mike Chen',
      status: 'review',
      publishDate: '2025-01-22',
      category: 'Warranty Guides',
      priority: 'high'
    },
    {
      id: 4,
      title: 'Customer Success Story: BMW Warranty',
      author: 'Sarah Johnson',
      status: 'scheduled',
      publishDate: '2025-01-25',
      category: 'Customer Stories',
      priority: 'low'
    },
    {
      id: 5,
      title: 'Top 10 Car Warranty Myths Debunked',
      author: 'John Smith',
      status: 'idea',
      publishDate: '2025-01-28',
      category: 'Warranty Guides',
      priority: 'medium'
    }
  ];

  const contentIdeas = [
    { title: 'Hybrid Vehicle Warranty Differences', priority: 'high', effort: 'medium' },
    { title: 'Luxury Car Warranty Comparison', priority: 'medium', effort: 'high' },
    { title: 'Common Warranty Claim Mistakes', priority: 'high', effort: 'low' },
    { title: 'Seasonal Car Care and Warranty Tips', priority: 'medium', effort: 'medium' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'idea': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published': return <CheckCircle className="w-4 h-4" />;
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'review': return <AlertCircle className="w-4 h-4" />;
      case 'draft': return <Edit className="w-4 h-4" />;
      case 'idea': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getPostsForDate = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledPosts.filter(post => post.publishDate === dateStr);
  };

  const filteredPosts = filterStatus === 'all' ? 
    scheduledPosts : 
    scheduledPosts.filter(post => post.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Content Calendar
              </CardTitle>
              <CardDescription>Plan, schedule, and track your blog content</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Content Brief
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="idea">Ideas</SelectItem>
                    <SelectItem value="draft">Drafts</SelectItem>
                    <SelectItem value="review">In Review</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {viewMode === 'calendar' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="grid grid-cols-7 gap-1">
              {/* Days of week header */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center font-medium text-gray-600 text-sm">
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before month starts */}
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                <div key={`empty-${index}`} className="p-2 h-24 border rounded"></div>
              ))}
              
              {/* Days of the month */}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                const day = index + 1;
                const postsForDay = getPostsForDate(day);
                const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
                
                return (
                  <div
                    key={day}
                    className={`p-2 h-24 border rounded relative hover:bg-gray-50 transition-colors ${
                      isToday ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                      {day}
                    </div>
                    <div className="mt-1 space-y-1">
                      {postsForDay.slice(0, 2).map(post => (
                        <div
                          key={post.id}
                          className={`text-xs p-1 rounded truncate cursor-pointer ${getStatusColor(post.status)}`}
                          title={post.title}
                        >
                          {post.title}
                        </div>
                      ))}
                      {postsForDay.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{postsForDay.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {filteredPosts.map(post => (
                <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(post.status)}
                      <Badge className={getStatusColor(post.status)}>{post.status}</Badge>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{post.title}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          <span>{new Date(post.publishDate).toLocaleDateString()}</span>
                        </div>
                        <Badge variant="outline">{post.category}</Badge>
                        <Badge className={getPriorityColor(post.priority)}>{post.priority}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Ideas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Content Ideas Pipeline
          </CardTitle>
          <CardDescription>Ideas and inspiration for future content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contentIdeas.map((idea, index) => (
              <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{idea.title}</h4>
                  <Badge className={getPriorityColor(idea.priority)}>{idea.priority}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Effort: {idea.effort}</Badge>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Brief
                    </Button>
                    <Button size="sm">Schedule</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Publishing Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-green-600">posts scheduled</p>
              </div>
              <CalendarDays className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-blue-600">posts planned</p>
              </div>
              <Grid className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Review</p>
                <p className="text-2xl font-bold">4</p>
                <p className="text-sm text-yellow-600">need attention</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};