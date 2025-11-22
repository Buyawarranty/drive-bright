import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Mail, Users, TrendingUp, Calendar, Brain, History, 
  Shield, Zap, Paperclip, Bell, TestTube, Send, Download,
  Search, RefreshCw, CheckCircle, XCircle, Clock, BarChart3,
  Tag, Filter, Settings, Play, Pause, Eye, Edit
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogTrigger, DialogFooter 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AIEmailSuggestions } from './email/AIEmailSuggestions';

const EmailMarketingTab = () => {
  const [activeView, setActiveView] = useState<'overview' | 'campaigns' | 'subscribers' | 'analytics' | 'history' | 'gdpr' | 'automation'>('overview');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  
  // Overview stats
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [avgOpenRate, setAvgOpenRate] = useState(0);
  const [avgClickRate, setAvgClickRate] = useState(0);

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load campaigns
      const { data: campaignsData } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      setCampaigns(campaignsData || []);
      setTotalCampaigns(campaignsData?.length || 0);

      // Load email logs
      const { data: logsData } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      setEmailLogs(logsData || []);

      // Load analytics
      const { data: analyticsData } = await supabase
        .from('campaign_analytics')
        .select('*, email_campaigns(name, subject)');
      setAnalytics(analyticsData || []);

      if (analyticsData && analyticsData.length > 0) {
        const avgOpen = analyticsData.reduce((sum, a) => sum + (a.open_rate || 0), 0) / analyticsData.length;
        const avgClick = analyticsData.reduce((sum, a) => sum + (a.click_rate || 0), 0) / analyticsData.length;
        setAvgOpenRate(Number(avgOpen.toFixed(2)));
        setAvgClickRate(Number(avgClick.toFixed(2)));
      }

      // Load segments
      const { data: segmentsData } = await supabase
        .from('subscriber_segments')
        .select('*')
        .eq('is_active', true);
      setSegments(segmentsData || []);

      // Load consents
      const { data: consentsData } = await supabase
        .from('email_consents')
        .select('*')
        .order('consent_date', { ascending: false });
      setConsents(consentsData || []);
      setTotalSubscribers(consentsData?.filter(c => c.consent_given && !c.unsubscribed_at).length || 0);

      // Load scheduled emails
      const { data: scheduledData } = await supabase
        .from('scheduled_emails')
        .select('*')
        .order('scheduled_for', { ascending: true });
      setScheduledEmails(scheduledData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load email marketing data');
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async (logId: string) => {
    try {
      const log = emailLogs.find(l => l.id === logId);
      if (!log) return;

      await supabase.functions.invoke('send-email', {
        body: {
          recipientEmail: log.recipient_email,
          subject: log.subject,
          content: log.content
        }
      });

      await supabase
        .from('email_logs')
        .update({ 
          resend_count: (log.resend_count || 0) + 1,
          last_resent_at: new Date().toISOString()
        })
        .eq('id', logId);

      toast.success('Email resent successfully');
      loadData();
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Failed to resend email');
    }
  };

  const OverviewView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📧 Email Marketing</h1>
        <p className="text-muted-foreground mt-2">
          Your complete toolkit for customer communication — smart, reliable, and easy to use.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Subscribers</p>
                <p className="text-3xl font-bold mt-1">{totalSubscribers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-3xl font-bold mt-1">{totalCampaigns}</p>
              </div>
              <Mail className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Open Rate</p>
                <p className="text-3xl font-bold mt-1">{avgOpenRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Click Rate</p>
                <p className="text-3xl font-bold mt-1">{avgClickRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('campaigns')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Campaign Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create, schedule, and manage email campaigns with full control over delivery and tracking.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('subscribers')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Subscriber Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add, remove, segment, and tag subscribers to target the right audience every time.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('analytics')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
              Campaign Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track open rates, clicks, bounces, and unsubscribes to optimize performance.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('history')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" />
              Email History & Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View full history of sent emails, delivery status, engagement, and resend actions.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('gdpr')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              GDPR & Consent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage opt-ins, unsubscribes, and data privacy with built-in compliance features.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setActiveView('automation')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automated Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Set up triggers for abandoned carts, post-purchase follow-ups, and seasonal offers.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Features */}
      <Card>
        <CardHeader>
          <CardTitle>✨ Additional Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h3 className="font-semibold">Send Confirmation</h3>
                <p className="text-sm text-muted-foreground">
                  Every email logged with delivery status, timestamp, and recipient details.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-blue-500 mt-1" />
              <div>
                <h3 className="font-semibold">Manual Resend</h3>
                <p className="text-sm text-muted-foreground">
                  Resend any email with one click for follow-ups, corrections, or reminders.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-purple-500 mt-1" />
              <div>
                <h3 className="font-semibold">Scheduled Sends</h3>
                <p className="text-sm text-muted-foreground">
                  Plan campaigns in advance with flexible scheduling options.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-pink-500 mt-1" />
              <div>
                <h3 className="font-semibold">Smart Suggestions</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered tips for subject lines, send times, and content improvements.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Paperclip className="h-5 w-5 text-gray-500 mt-1" />
              <div>
                <h3 className="font-semibold">Rich Content</h3>
                <p className="text-sm text-muted-foreground">
                  Include PDFs, images, and formatted content in your emails.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TestTube className="h-5 w-5 text-cyan-500 mt-1" />
              <div>
                <h3 className="font-semibold">A/B Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Test subject lines, content, and send times to find what works best.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const CampaignsView = () => {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showAISuggestions, setShowAISuggestions] = useState(false);
    const [newCampaign, setNewCampaign] = useState({
      name: '',
      subject: '',
      content: '',
      campaign_type: 'marketing',
      scheduled_for: ''
    });

    const applySuggestion = (subject: string, content: string) => {
      setNewCampaign({ ...newCampaign, subject, content });
      toast.success('Suggestion applied to campaign');
    };

    const createCampaign = async () => {
      try {
        const { error } = await supabase
          .from('email_campaigns')
          .insert([{
            ...newCampaign,
            scheduled_for: newCampaign.scheduled_for || null,
            status: newCampaign.scheduled_for ? 'scheduled' : 'draft'
          }]);

        if (error) throw error;

        toast.success('Campaign created successfully');
        setShowCreateDialog(false);
        setNewCampaign({ name: '', subject: '', content: '', campaign_type: 'marketing', scheduled_for: '' });
        loadData();
      } catch (error) {
        console.error('Error creating campaign:', error);
        toast.error('Failed to create campaign');
      }
    };

    const sendCampaign = async (campaignId: string) => {
      try {
        // Get all consented subscribers
        const { data: subscribers } = await supabase
          .from('email_consents')
          .select('email')
          .eq('consent_given', true)
          .is('unsubscribed_at', null);

        if (!subscribers || subscribers.length === 0) {
          toast.error('No subscribers to send to');
          return;
        }

        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        // Update campaign status
        await supabase
          .from('email_campaigns')
          .update({ status: 'sending' })
          .eq('id', campaignId);

        // Send via edge function
        await supabase.functions.invoke('send-marketing-email', {
          body: {
            campaignId,
            emails: subscribers.map(s => s.email),
            subject: campaign.subject,
            content: campaign.content
          }
        });

        toast.success(`Campaign sent to ${subscribers.length} subscribers`);
        loadData();
      } catch (error) {
        console.error('Error sending campaign:', error);
        toast.error('Failed to send campaign');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Email Campaigns</h2>
            <p className="text-muted-foreground">Create and manage your marketing campaigns</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Mail className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  Set up a new email campaign for your subscribers
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                <div>
                  <Label>Campaign Name</Label>
                  <Input
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="e.g., Summer Sale 2025"
                  />
                </div>
                <div>
                  <Label>Email Subject</Label>
                  <Input
                    value={newCampaign.subject}
                    onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                    placeholder="e.g., Get 20% off extended warranties"
                  />
                </div>
                <div>
                  <Label>Email Content</Label>
                  <Textarea
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                    placeholder="Write your email content here..."
                    rows={8}
                  />
                </div>
                <div>
                  <Label>Campaign Type</Label>
                  <Select value={newCampaign.campaign_type} onValueChange={(val) => setNewCampaign({ ...newCampaign, campaign_type: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="transactional">Transactional</SelectItem>
                      <SelectItem value="automated">Automated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Schedule For (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={newCampaign.scheduled_for}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_for: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    AI Suggestions
                    <Switch 
                      checked={showAISuggestions} 
                      onCheckedChange={setShowAISuggestions}
                    />
                  </Label>
                </div>
              </div>

              {/* AI Suggestions Panel */}
              {showAISuggestions && (
                <div className="lg:col-span-1">
                  <AIEmailSuggestions
                    currentSubject={newCampaign.subject}
                    currentContent={newCampaign.content}
                    onApplySuggestion={applySuggestion}
                  />
                </div>
              )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={createCampaign}>Create Campaign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{campaign.name}</h3>
                      <Badge variant={
                        campaign.status === 'sent' ? 'default' :
                        campaign.status === 'sending' ? 'secondary' :
                        campaign.status === 'scheduled' ? 'outline' :
                        'secondary'
                      }>
                        {campaign.status}
                      </Badge>
                      {campaign.is_ab_test && (
                        <Badge variant="outline">
                          <TestTube className="h-3 w-3 mr-1" />
                          A/B Test
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Subject:</strong> {campaign.subject}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Created: {new Date(campaign.created_at).toLocaleDateString()}</span>
                      {campaign.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Scheduled: {new Date(campaign.scheduled_for).toLocaleString()}
                        </span>
                      )}
                      {campaign.sent_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Sent: {new Date(campaign.sent_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === 'draft' && (
                      <Button size="sm" onClick={() => sendCampaign(campaign.id)}>
                        <Send className="h-4 w-4 mr-1" />
                        Send Now
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {campaigns.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No campaigns yet. Create your first campaign to get started!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const SubscribersView = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterByConsent, setFilterByConsent] = useState<'all' | 'consented' | 'unsubscribed'>('all');

    const filteredConsents = consents.filter(consent => {
      const matchesSearch = consent.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = 
        filterByConsent === 'all' ||
        (filterByConsent === 'consented' && consent.consent_given && !consent.unsubscribed_at) ||
        (filterByConsent === 'unsubscribed' && consent.unsubscribed_at);
      return matchesSearch && matchesFilter;
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Subscriber Management</h2>
          <p className="text-muted-foreground">Manage your email subscriber list and preferences</p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search subscribers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterByConsent} onValueChange={(val: any) => setFilterByConsent(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subscribers</SelectItem>
              <SelectItem value="consented">Consented Only</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredConsents.map((consent) => (
                <div key={consent.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{consent.email}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span>Joined: {new Date(consent.consent_date).toLocaleDateString()}</span>
                      {consent.source && (
                        <Badge variant="outline" className="text-xs">{consent.source}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {consent.unsubscribed_at ? (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Unsubscribed
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {filteredConsents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No subscribers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriber Segments</CardTitle>
            <CardDescription>Create targeted segments for better campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {segments.map((segment) => (
                <div key={segment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{segment.name}</h4>
                    <p className="text-sm text-muted-foreground">{segment.description}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              ))}
              {segments.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No segments created yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const AnalyticsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Campaign Analytics</h2>
        <p className="text-muted-foreground">Track performance and optimize your campaigns</p>
      </div>

      {analytics.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No analytics data available yet. Send your first campaign to see insights!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {analytics.map((analytic) => (
            <Card key={analytic.id}>
              <CardHeader>
                <CardTitle>{analytic.email_campaigns?.name || 'Campaign'}</CardTitle>
                <CardDescription>{analytic.email_campaigns?.subject}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-2xl font-bold">{analytic.total_sent}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-2xl font-bold">{analytic.total_delivered}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Opened</p>
                    <p className="text-2xl font-bold">{analytic.total_opened}</p>
                    <p className="text-xs text-green-600">{analytic.open_rate}% rate</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clicked</p>
                    <p className="text-2xl font-bold">{analytic.total_clicked}</p>
                    <p className="text-xs text-blue-600">{analytic.click_rate}% rate</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bounced</p>
                    <p className="text-2xl font-bold">{analytic.total_bounced}</p>
                    <p className="text-xs text-red-600">{analytic.bounce_rate}% rate</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold">{analytic.total_failed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unsubscribed</p>
                    <p className="text-2xl font-bold">{analytic.total_unsubscribed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{new Date(analytic.last_calculated_at).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const HistoryView = () => {
    const [searchEmail, setSearchEmail] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const filteredLogs = emailLogs.filter(log => {
      const matchesSearch = log.recipient_email.toLowerCase().includes(searchEmail.toLowerCase());
      const matchesStatus = filterStatus === 'all' || log.delivery_status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Email History & Logs</h2>
          <p className="text-muted-foreground">Complete history of all sent emails</p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="opened">Opened</SelectItem>
              <SelectItem value="clicked">Clicked</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{log.recipient_email}</p>
                      <Badge variant={
                        log.delivery_status === 'sent' ? 'secondary' :
                        log.delivery_status === 'delivered' ? 'default' :
                        log.delivery_status === 'opened' ? 'default' :
                        log.delivery_status === 'clicked' ? 'default' :
                        log.delivery_status === 'bounced' ? 'destructive' :
                        'destructive'
                      }>
                        {log.delivery_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{log.subject}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span>Sent: {new Date(log.sent_at).toLocaleString()}</span>
                      {log.opened_at && (
                        <span>Opened: {new Date(log.opened_at).toLocaleString()}</span>
                      )}
                      {log.clicked_at && (
                        <span>Clicked: {new Date(log.clicked_at).toLocaleString()}</span>
                      )}
                      {log.resend_count > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Resent {log.resend_count}x
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => resendEmail(log.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resend
                  </Button>
                </div>
              ))}

              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No email logs found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const GDPRView = () => {
    const unsubscribedCount = consents.filter(c => c.unsubscribed_at).length;
    const consentedCount = consents.filter(c => c.consent_given && !c.unsubscribed_at).length;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">GDPR & Consent Management</h2>
          <p className="text-muted-foreground">Manage opt-ins, unsubscribes, and data privacy compliance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Consents</p>
                  <p className="text-3xl font-bold mt-1">{consentedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unsubscribed</p>
                  <p className="text-3xl font-bold mt-1">{unsubscribedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                  <p className="text-3xl font-bold mt-1">
                    {consents.length > 0 ? Math.round((consentedCount / consents.length) * 100) : 0}%
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Consent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {consents.slice(0, 50).map((consent) => (
                <div key={consent.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{consent.email}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span>Consent: {new Date(consent.consent_date).toLocaleDateString()}</span>
                      {consent.unsubscribed_at && (
                        <span className="text-red-600">
                          Unsubscribed: {new Date(consent.unsubscribed_at).toLocaleDateString()}
                        </span>
                      )}
                      {consent.unsubscribe_reason && (
                        <span className="italic">"{consent.unsubscribe_reason}"</span>
                      )}
                    </div>
                  </div>
                  {consent.consent_given && !consent.unsubscribed_at ? (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Consented
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Unsubscribed
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>GDPR Compliance:</strong> All subscriber data is managed according to GDPR requirements. 
            Unsubscribe requests are processed immediately, and consent tracking is maintained for all contacts.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const AutomationView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Automated Campaigns</h2>
        <p className="text-muted-foreground">Set up triggers and automated email workflows</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Scheduled Emails
            </CardTitle>
            <CardDescription>
              {scheduledEmails.length} emails scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scheduledEmails.slice(0, 5).map((email) => (
                <div key={email.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{email.recipient_email}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(email.scheduled_for).toLocaleString()}
                    </p>
                  </div>
                  <Badge>{email.status}</Badge>
                </div>
              ))}
              {scheduledEmails.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scheduled emails
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Automated Triggers
            </CardTitle>
            <CardDescription>Available automation workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-semibold text-sm">Abandoned Cart</h4>
                  <p className="text-xs text-muted-foreground">Send after 1 hour</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-semibold text-sm">Post-Purchase</h4>
                  <p className="text-xs text-muted-foreground">Send after 24 hours</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-semibold text-sm">Welcome Series</h4>
                  <p className="text-xs text-muted-foreground">3-email series</p>
                </div>
                <Switch />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          Automated campaigns are triggered based on customer behavior and run in the background.
          Configure timing and content for each automation type.
        </AlertDescription>
      </Alert>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={activeView === 'overview' ? 'default' : 'ghost'}
            onClick={() => setActiveView('overview')}
            className="whitespace-nowrap"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeView === 'campaigns' ? 'default' : 'ghost'}
            onClick={() => setActiveView('campaigns')}
            className="whitespace-nowrap"
          >
            <Mail className="h-4 w-4 mr-2" />
            Campaigns
          </Button>
          <Button
            variant={activeView === 'subscribers' ? 'default' : 'ghost'}
            onClick={() => setActiveView('subscribers')}
            className="whitespace-nowrap"
          >
            <Users className="h-4 w-4 mr-2" />
            Subscribers
          </Button>
          <Button
            variant={activeView === 'analytics' ? 'default' : 'ghost'}
            onClick={() => setActiveView('analytics')}
            className="whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'ghost'}
            onClick={() => setActiveView('history')}
            className="whitespace-nowrap"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            variant={activeView === 'gdpr' ? 'default' : 'ghost'}
            onClick={() => setActiveView('gdpr')}
            className="whitespace-nowrap"
          >
            <Shield className="h-4 w-4 mr-2" />
            GDPR
          </Button>
          <Button
            variant={activeView === 'automation' ? 'default' : 'ghost'}
            onClick={() => setActiveView('automation')}
            className="whitespace-nowrap"
          >
            <Zap className="h-4 w-4 mr-2" />
            Automation
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeView === 'overview' && <OverviewView />}
        {activeView === 'campaigns' && <CampaignsView />}
        {activeView === 'subscribers' && <SubscribersView />}
        {activeView === 'analytics' && <AnalyticsView />}
        {activeView === 'history' && <HistoryView />}
        {activeView === 'gdpr' && <GDPRView />}
        {activeView === 'automation' && <AutomationView />}
      </div>
    </div>
  );
};

export default EmailMarketingTab;
