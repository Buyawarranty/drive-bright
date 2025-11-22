import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, TrendingUp, Eye, Users, Clock, MousePointer, 
  Share2, Search, Globe, Target, ArrowUp, ArrowDown, 
  Calendar, Download, RefreshCw, Filter
} from 'lucide-react';

export const PerformanceInsights = () => {
  const performanceData = {
    totalViews: 45230,
    uniqueVisitors: 32180,
    avgTimeOnPage: '3:42',
    bounceRate: 32.5,
    socialShares: 1247,
    organicTraffic: 78.2,
    clickThroughRate: 4.8,
    conversionRate: 2.3
  };

  const topArticles = [
    {
      title: 'Complete Guide to EV Warranties in 2025',
      views: 8945,
      engagement: 87,
      shares: 342,
      trend: 'up',
      trendValue: 12
    },
    {
      title: 'Car Warranty vs Extended Warranty: Key Differences',
      views: 6723,
      engagement: 92,
      shares: 198,
      trend: 'up',
      trendValue: 8
    },
    {
      title: 'Top 10 Most Reliable Car Brands for Warranties',
      views: 5834,
      engagement: 76,
      shares: 156,
      trend: 'down',
      trendValue: -3
    },
    {
      title: 'How to Choose the Right Warranty Coverage',
      views: 4921,
      engagement: 89,
      shares: 203,
      trend: 'up',
      trendValue: 15
    }
  ];

  const trafficSources = [
    { source: 'Organic Search', percentage: 64.2, visitors: 20652, color: 'bg-green-500' },
    { source: 'Direct', percentage: 18.7, visitors: 6017, color: 'bg-blue-500' },
    { source: 'Social Media', percentage: 9.3, visitors: 2993, color: 'bg-purple-500' },
    { source: 'Referral', percentage: 5.8, visitors: 1864, color: 'bg-orange-500' },
    { source: 'Email', percentage: 2.0, visitors: 643, color: 'bg-yellow-500' }
  ];

  const keywordRankings = [
    { keyword: 'car warranty', position: 3, searches: 8900, difficulty: 67 },
    { keyword: 'extended warranty', position: 7, searches: 5400, difficulty: 54 },
    { keyword: 'EV warranty', position: 2, searches: 3200, difficulty: 42 },
    { keyword: 'warranty guide', position: 5, searches: 2100, difficulty: 38 },
    { keyword: 'car insurance vs warranty', position: 12, searches: 1800, difficulty: 51 }
  ];

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? 
      <ArrowUp className="w-4 h-4 text-green-600" /> : 
      <ArrowDown className="w-4 h-4 text-red-600" />;
  };

  const getRankingColor = (position: number) => {
    if (position <= 3) return 'bg-green-100 text-green-800';
    if (position <= 10) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="text-2xl font-bold">{performanceData.totalViews.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">+12.4%</span>
                </div>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Visitors</p>
                <p className="text-2xl font-bold">{performanceData.uniqueVisitors.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">+8.7%</span>
                </div>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Time</p>
                <p className="text-2xl font-bold">{performanceData.avgTimeOnPage}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">+15.2%</span>
                </div>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bounce Rate</p>
                <p className="text-2xl font-bold">{performanceData.bounceRate}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowDown className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600">-3.1%</span>
                </div>
              </div>
              <MousePointer className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="articles" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="articles">Top Articles</TabsTrigger>
            <TabsTrigger value="traffic">Traffic Sources</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Top Performing Articles
              </CardTitle>
              <CardDescription>Your most successful blog posts this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topArticles.map((article, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">{article.title}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{article.views.toLocaleString()} views</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          <span>{article.engagement}% engagement</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Share2 className="w-4 h-4" />
                          <span>{article.shares} shares</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(article.trend)}
                        <span className={`text-sm ${article.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                          {article.trend === 'up' ? '+' : ''}{article.trendValue}%
                        </span>
                      </div>
                      <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Traffic Sources
              </CardTitle>
              <CardDescription>Where your blog visitors are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trafficSources.map((source, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{source.source}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{source.visitors.toLocaleString()} visitors</span>
                        <Badge variant="secondary">{source.percentage}%</Badge>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${source.color} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${source.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800">Organic Growth</h4>
                  <p className="text-2xl font-bold text-green-600">{performanceData.organicTraffic}%</p>
                  <p className="text-sm text-green-600">+5.2% from last month</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">Click-Through Rate</h4>
                  <p className="text-2xl font-bold text-blue-600">{performanceData.clickThroughRate}%</p>
                  <p className="text-sm text-blue-600">+0.8% from last month</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800">Social Shares</h4>
                  <p className="text-2xl font-bold text-purple-600">{performanceData.socialShares}</p>
                  <p className="text-sm text-purple-600">+18.4% from last month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Keyword Rankings
              </CardTitle>
              <CardDescription>Track your search engine rankings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keywordRankings.map((keyword, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{keyword.keyword}</h4>
                        <Badge className={getRankingColor(keyword.position)}>
                          Position {keyword.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{keyword.searches.toLocaleString()} searches/month</span>
                        <span>Difficulty: {keyword.difficulty}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">Track</Button>
                      <Button variant="outline" size="sm">Optimize</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">SEO Opportunities</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 5 keywords dropped in rankings - needs attention</li>
                  <li>• 12 new keyword opportunities identified</li>
                  <li>• Featured snippet opportunity for "car warranty comparison"</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Social Media Performance
              </CardTitle>
              <CardDescription>How your content performs across social platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Facebook</h4>
                    <Badge className="bg-blue-100 text-blue-800">487 shares</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Reach:</span>
                      <span>12.4K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Engagement:</span>
                      <span>3.2%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Twitter</h4>
                    <Badge className="bg-sky-100 text-sky-800">312 shares</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Impressions:</span>
                      <span>8.7K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Engagement:</span>
                      <span>4.1%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">LinkedIn</h4>
                    <Badge className="bg-blue-100 text-blue-800">298 shares</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Reach:</span>
                      <span>6.2K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Engagement:</span>
                      <span>5.8%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Pinterest</h4>
                    <Badge className="bg-red-100 text-red-800">150 shares</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Saves:</span>
                      <span>1.8K</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CTR:</span>
                      <span>2.4%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Most Shared Articles</h4>
                {topArticles.slice(0, 3).map((article, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-sm">{article.title}</span>
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">{article.shares} shares</span>
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