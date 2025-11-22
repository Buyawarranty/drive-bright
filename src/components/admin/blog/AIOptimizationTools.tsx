import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, Wand2, Target, MessageSquare, TrendingUp, 
  Lightbulb, FileText, Users, Zap, RefreshCw, 
  CheckCircle, Star, Copy, Download, Share2
} from 'lucide-react';

export const AIOptimizationTools = () => {
  const [analysisType, setAnalysisType] = useState('headline');
  const [toneType, setToneType] = useState('professional');
  const [contentIntent, setContentIntent] = useState('informational');
  const [inputText, setInputText] = useState('');

  const headlineAnalysis = {
    score: 78,
    emotion: 'Curiosity',
    length: 'Optimal',
    readability: 'Good',
    suggestions: [
      '10 Essential Car Warranty Tips Every Driver Must Know in 2025',
      'The Ultimate Car Warranty Guide: Everything You Need to Know',
      'Car Warranty Secrets: How to Choose the Perfect Coverage',
      'Complete Car Warranty Guide: Expert Tips for Smart Buyers'
    ]
  };

  const contentSuggestions = [
    {
      type: 'FAQ',
      title: 'What does a car warranty cover?',
      content: 'A comprehensive car warranty typically covers major mechanical and electrical components, including engine, transmission, air conditioning, and more.',
      confidence: 95
    },
    {
      type: 'FAQ',
      title: 'How long do car warranties last?',
      content: 'Car warranties vary in duration, typically ranging from 1-3 years or specific mileage limits like 12,000-36,000 miles.',
      confidence: 92
    },
    {
      type: 'Expansion',
      title: 'Benefits of Extended Warranties',
      content: 'Extended warranties provide peace of mind beyond manufacturer coverage, protecting against unexpected repair costs and maintaining vehicle value.',
      confidence: 88
    },
    {
      type: 'Voice Search',
      title: 'How much does a car warranty cost?',
      content: 'Car warranty costs depend on vehicle age, model, coverage level, and provider, typically ranging from £200-£1,500 annually.',
      confidence: 90
    }
  ];

  const toneAnalysis = {
    current: 'Professional, informative',
    suggestions: {
      friendly: 'Make it more conversational and approachable',
      authoritative: 'Add more expert credentials and data',
      persuasive: 'Include stronger call-to-actions and benefits',
      empathetic: 'Address customer pain points more directly'
    }
  };

  const ctaGenerated = [
    {
      type: 'Primary',
      text: 'Get Your Free Warranty Quote Today',
      placement: 'End of article',
      conversion: 'High'
    },
    {
      type: 'Secondary',
      text: 'Compare Warranty Plans',
      placement: 'Middle of content',
      conversion: 'Medium'
    },
    {
      type: 'Soft',
      text: 'Learn More About Our Coverage',
      placement: 'After key points',
      conversion: 'Medium'
    },
    {
      type: 'Urgency',
      text: 'Limited Time: 20% Off All Warranties',
      placement: 'Top of page',
      conversion: 'High'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-100 text-green-800';
    if (confidence >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* AI Assistant Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Content Assistant
          </CardTitle>
          <CardDescription>
            Leverage AI to optimize your content for better engagement and conversions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <Wand2 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-medium">Content Enhancement</h4>
              <p className="text-sm text-gray-600">AI-powered improvements</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-medium">SEO Optimization</h4>
              <p className="text-sm text-gray-600">Smart keyword suggestions</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-medium">Performance Boost</h4>
              <p className="text-sm text-gray-600">Engagement optimization</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <h4 className="font-medium">Audience Insights</h4>
              <p className="text-sm text-gray-600">Reader behavior analysis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="headline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="headline">Headlines</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="tone">Tone Check</TabsTrigger>
          <TabsTrigger value="cta">CTAs</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="headline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Headline Analyzer
              </CardTitle>
              <CardDescription>Optimize your headlines for maximum click-through rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Current Headline</label>
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter your headline to analyze..."
                />
                <Button className="mt-2" size="sm">
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze Headline
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-lg ${getScoreBackground(headlineAnalysis.score)}`}>
                  <h4 className="font-medium">Overall Score</h4>
                  <p className={`text-2xl font-bold ${getScoreColor(headlineAnalysis.score)}`}>
                    {headlineAnalysis.score}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium">Emotion</h4>
                  <p className="text-lg font-semibold text-blue-600">{headlineAnalysis.emotion}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium">Length</h4>
                  <p className="text-lg font-semibold text-green-600">{headlineAnalysis.length}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium">Readability</h4>
                  <p className="text-lg font-semibold text-purple-600">{headlineAnalysis.readability}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">AI-Generated Alternatives</h4>
                <div className="space-y-3">
                  {headlineAnalysis.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <span className="flex-1">{suggestion}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Star className="w-3 h-3 mr-1" />
                          {85 + index}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Headline Tips</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Use numbers and specific details for clarity</li>
                  <li>• Include emotional triggers like "essential" or "ultimate"</li>
                  <li>• Keep headlines between 50-60 characters for SEO</li>
                  <li>• Test different variations to see what resonates</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Content Enhancement
              </CardTitle>
              <CardDescription>AI-powered content suggestions and expansions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Content Type</label>
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="introduction">Introduction</SelectItem>
                      <SelectItem value="conclusion">Conclusion</SelectItem>
                      <SelectItem value="section">Section Expansion</SelectItem>
                      <SelectItem value="faq">FAQ Generation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Content Intent</label>
                  <Select value={contentIntent} onValueChange={setContentIntent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informational">Informational</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="navigational">Navigational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content Context</label>
                <Textarea
                  placeholder="Paste your current content or describe what you need help with..."
                  rows={4}
                />
                <Button className="mt-2">
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Suggestions
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-3">AI Content Suggestions</h4>
                <div className="space-y-4">
                  {contentSuggestions.map((suggestion, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{suggestion.type}</Badge>
                          <h5 className="font-medium">{suggestion.title}</h5>
                        </div>
                        <Badge className={getConfidenceColor(suggestion.confidence)}>
                          {suggestion.confidence}% confident
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{suggestion.content}</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          <Copy className="w-4 h-4 mr-2" />
                          Use This
                        </Button>
                        <Button size="sm" variant="ghost">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Voice Search Optimization</h4>
                <p className="text-sm text-green-700 mb-3">
                  These questions are optimized for voice search and featured snippets:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">"What is the best car warranty?"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">"How much should I pay for a car warranty?"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">"Do I need an extended car warranty?"</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tone">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Tone & Style Checker
              </CardTitle>
              <CardDescription>Ensure your content matches your brand voice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Target Tone</label>
                <Select value={toneType} onValueChange={setToneType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="authoritative">Authoritative</SelectItem>
                    <SelectItem value="conversational">Conversational</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content to Analyze</label>
                <Textarea
                  placeholder="Paste your content here for tone analysis..."
                  rows={6}
                />
                <Button className="mt-2">
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze Tone
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Current Tone Analysis</h4>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-800">Detected Tone</p>
                    <p className="text-blue-700">{toneAnalysis.current}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Tone Adjustments</h4>
                  <div className="space-y-2">
                    {Object.entries(toneAnalysis.suggestions).map(([tone, suggestion]) => (
                      <div key={tone} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium capitalize">{tone}</span>
                          <Button size="sm" variant="outline">Apply</Button>
                        </div>
                        <p className="text-sm text-gray-600">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">Writing Style Suggestions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-sm mb-2">Strengthen Your Voice:</h5>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• Use more active voice (currently 85%)</li>
                      <li>• Add personal pronouns for connection</li>
                      <li>• Include specific examples and data</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm mb-2">Readability Tips:</h5>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• Shorten some complex sentences</li>
                      <li>• Use more transition words</li>
                      <li>• Add subheadings for structure</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cta">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                CTA Generator
              </CardTitle>
              <CardDescription>Create compelling calls-to-action that convert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">CTA Purpose</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select CTA goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quote">Get Quote</SelectItem>
                      <SelectItem value="signup">Newsletter Signup</SelectItem>
                      <SelectItem value="download">Download Guide</SelectItem>
                      <SelectItem value="contact">Contact Us</SelectItem>
                      <SelectItem value="learn">Learn More</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Urgency Level</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Informational</SelectItem>
                      <SelectItem value="medium">Medium - Encouraging</SelectItem>
                      <SelectItem value="high">High - Urgent Action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate CTAs
              </Button>

              <div>
                <h4 className="font-medium mb-3">Generated Call-to-Actions</h4>
                <div className="space-y-3">
                  {ctaGenerated.map((cta, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{cta.type}</Badge>
                          <span className="font-medium">{cta.text}</span>
                        </div>
                        <Badge className={cta.conversion === 'High' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {cta.conversion} Conversion
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Best placement: {cta.placement}</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">CTA Best Practices</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Use action-oriented verbs</li>
                    <li>• Create sense of urgency when appropriate</li>
                    <li>• Make buttons visually prominent</li>
                  </ul>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Test different wording variations</li>
                    <li>• Place CTAs at natural stopping points</li>
                    <li>• Use contrasting colors for visibility</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                AI Content Insights
              </CardTitle>
              <CardDescription>Data-driven recommendations for content optimization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800">Content Score</h4>
                  <p className="text-2xl font-bold text-green-600">87</p>
                  <p className="text-sm text-green-600">Above average performance</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800">Engagement Potential</h4>
                  <p className="text-2xl font-bold text-blue-600">92%</p>
                  <p className="text-sm text-blue-600">High engagement expected</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800">Conversion Likelihood</h4>
                  <p className="text-2xl font-bold text-purple-600">78%</p>
                  <p className="text-sm text-purple-600">Good conversion potential</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Content Strengths</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Strong keyword optimization</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Good readability score</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Comprehensive topic coverage</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Engaging introduction</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Improvement Opportunities</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">Add more internal links</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">Include more statistics</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">Strengthen conclusion CTA</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">Add FAQ section</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Competitor Analysis</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>Your content length:</span>
                    <Badge variant="outline">1,847 words</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Average competitor length:</span>
                    <Badge variant="outline">2,156 words</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Your keyword density:</span>
                    <Badge className="bg-green-100 text-green-800">2.3%</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Competitor average:</span>
                    <Badge variant="outline">2.8%</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Consider expanding content by 300-400 words to match top-ranking competitors.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
                <Button variant="outline">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Insights
                </Button>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};