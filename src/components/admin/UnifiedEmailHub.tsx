import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Mail, Users, TrendingUp, Calendar, Brain, History, Shield, Zap, 
  Plus, Edit, Eye, Send, Download, Search, RefreshCw, CheckCircle, 
  XCircle, Clock, BarChart3, Tag, Filter, Settings, Play, Pause,
  Trash2, Copy, LayoutTemplate, Megaphone, UserCheck, Activity
} from 'lucide-react';
import { AIEmailSuggestions } from './email/AIEmailSuggestions';
import { TestEmailFunctionDirect } from "./TestEmailFunctionDirect";
import { TestAutomatedEmail } from "./TestAutomatedEmail";
import { EmailFunctionDiagnostics } from "./EmailFunctionDiagnostics";
import { ResendWelcomeEmailTool } from "./ResendWelcomeEmailTool";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  template_type: string;
  from_email: string;
  content: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  template_id: string | null;
  campaign_id: string | null;
  delivery_status: string | null;
  resend_count: number;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: string;
  campaign_type: string;
  created_at: string;
  scheduled_for: string | null;
  sent_at: string | null;
}

const UnifiedEmailHub = () => {
  const [activeView, setActiveView] = useState<'overview' | 'templates' | 'campaigns' | 'audience' | 'analytics' | 'automation' | 'logs' | 'tools'>('overview');
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  
  // Stats
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [avgOpenRate, setAvgOpenRate] = useState(0);
  const [avgClickRate, setAvgClickRate] = useState(0);
  
  // UI states
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state for template editing
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    template_type: '',
    from_email: 'info@buyawarranty.co.uk',
    greeting: '',
    content: '',
    is_active: true
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTemplates(),
        loadCampaigns(),
        loadEmailLogs(),
        loadAnalytics(),
        loadConsents(),
        loadScheduledEmails(),
        loadSegments()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load email data');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (!error && data) {
      setTemplates(data);
      setTotalTemplates(data.length);
    }
  };

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setCampaigns(data);
      setTotalCampaigns(data.length);
    }
  };

  const loadEmailLogs = async () => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (!error && data) {
      setEmailLogs(data);
    }
  };

  const loadAnalytics = async () => {
    const { data, error } = await supabase
      .from('campaign_analytics')
      .select('*, email_campaigns(name, subject)');
    
    if (!error && data) {
      setAnalytics(data);
      if (data.length > 0) {
        const avgOpen = data.reduce((sum, a) => sum + (a.open_rate || 0), 0) / data.length;
        const avgClick = data.reduce((sum, a) => sum + (a.click_rate || 0), 0) / data.length;
        setAvgOpenRate(Number(avgOpen.toFixed(2)));
        setAvgClickRate(Number(avgClick.toFixed(2)));
      }
    }
  };

  const loadConsents = async () => {
    const { data, error } = await supabase
      .from('email_consents')
      .select('*')
      .order('consent_date', { ascending: false });
    
    if (!error && data) {
      setConsents(data);
      setTotalSubscribers(data.filter(c => c.consent_given && !c.unsubscribed_at).length);
    }
  };

  const loadScheduledEmails = async () => {
    const { data, error } = await supabase
      .from('scheduled_emails')
      .select('*, email_templates(name)')
      .order('scheduled_for', { ascending: true });
    
    if (!error && data) {
      setScheduledEmails(data);
    }
  };

  const loadSegments = async () => {
    const { data, error } = await supabase
      .from('subscriber_segments')
      .select('*')
      .eq('is_active', true);
    
    if (!error && data) {
      setSegments(data);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    console.log('Opening template editor for:', template.name);
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      template_type: template.template_type,
      from_email: template.from_email,
      greeting: template.content?.greeting || '',
      content: template.content?.content || '',
      is_active: template.is_active
    });
    setTimeout(() => setIsEditing(true), 0);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleSaveTemplate = async () => {
    setLoading(true);
    try {
      const templateData = {
        name: formData.name,
        subject: formData.subject,
        template_type: formData.template_type,
        from_email: formData.from_email,
        content: {
          greeting: formData.greeting,
          content: formData.content
        },
        is_active: formData.is_active
      };

      if (selectedTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        toast.success('Email template updated successfully');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);

        if (error) throw error;
        toast.success('Email template created successfully');
      }

      setIsEditing(false);
      setSelectedTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save email template');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async (log: EmailLog) => {
    setIsResending(log.id);
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          templateId: log.template_id,
          recipientEmail: log.recipient_email,
          variables: {}
        }
      });
      
      toast.success(`Email resent to ${log.recipient_email}`);
      loadEmailLogs();
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Failed to resend email');
    } finally {
      setIsResending(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any }> = {
      sent: { className: 'bg-green-100 text-green-800', icon: CheckCircle },
      delivered: { className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      opened: { className: 'bg-purple-100 text-purple-800', icon: Eye },
      clicked: { className: 'bg-indigo-100 text-indigo-800', icon: Activity },
      failed: { className: 'bg-red-100 text-red-800', icon: XCircle },
      bounced: { className: 'bg-orange-100 text-orange-800', icon: XCircle },
      pending: { className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      scheduled: { className: 'bg-gray-100 text-gray-800', icon: Calendar },
      draft: { className: 'bg-gray-100 text-gray-600', icon: Edit }
    };

    const variant = variants[status.toLowerCase()] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  // Overview View
  const OverviewView = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📧 Email Hub</h1>
        <p className="text-muted-foreground mt-2">
          Your unified command center for all email communications — templates, campaigns, and analytics in one place.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscribers</p>
                <p className="text-3xl font-bold mt-1">{totalSubscribers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Email Templates</p>
                <p className="text-3xl font-bold mt-1">{totalTemplates}</p>
              </div>
              <LayoutTemplate className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Campaigns</p>
                <p className="text-3xl font-bold mt-1">{totalCampaigns}</p>
              </div>
              <Megaphone className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
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

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Click Rate</p>
                <p className="text-3xl font-bold mt-1">{avgClickRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-pink-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('templates')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-blue-600 transition-colors">
              <LayoutTemplate className="h-5 w-5" />
              Email Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create, edit, and organize reusable email templates for consistent branding.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              Manage Templates →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('campaigns')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-purple-600 transition-colors">
              <Megaphone className="h-5 w-5" />
              Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Launch marketing campaigns with templates, scheduling, and tracking.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              View Campaigns →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('audience')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-green-600 transition-colors">
              <Users className="h-5 w-5" />
              Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage subscribers, segments, consent tracking, and GDPR compliance.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              Manage Audience →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('analytics')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-orange-600 transition-colors">
              <BarChart3 className="h-5 w-5" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Deep insights into opens, clicks, bounces, and campaign performance.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              View Analytics →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('automation')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-pink-600 transition-colors">
              <Zap className="h-5 w-5" />
              Automation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Schedule emails, set up triggers, and automate customer journeys.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              Setup Automation →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('logs')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-cyan-600 transition-colors">
              <History className="h-5 w-5" />
              Email Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete delivery history with status tracking and resend options.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              View Logs →
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setActiveView('tools')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 group-hover:text-red-600 transition-colors">
              <Settings className="h-5 w-5" />
              Tools & Testing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Test email delivery, diagnostics, and development tools.
            </p>
            <Button variant="ghost" size="sm" className="mt-4 w-full">
              Access Tools →
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Brain className="h-5 w-5" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get AI-powered recommendations for subject lines and send times.
            </p>
            <Badge className="mt-4 bg-blue-100 text-blue-800">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Email Activity
          </CardTitle>
          <CardDescription>Latest email sends and campaign updates</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {emailLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{log.subject}</p>
                    <p className="text-xs text-muted-foreground">{log.recipient_email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()}
                    </span>
                    {getStatusBadge(log.delivery_status || log.status || 'pending')}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // Templates View - TODO: Implement full template management
  const TemplatesView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-muted-foreground">Create and manage reusable email templates</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">{template.template_type}</CardDescription>
                </div>
                {getStatusBadge(template.is_active ? 'Active' : 'Inactive')}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{template.subject}</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEditTemplate(template)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handlePreviewTemplate(template)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    const newTemplate = { ...template, id: crypto.randomUUID(), name: `${template.name} (Copy)` };
                    handleEditTemplate(newTemplate as EmailTemplate);
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Duplicate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // Campaigns View - TODO: Implement full campaign management
  const CampaignsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Campaigns</h2>
          <p className="text-muted-foreground">Create and track marketing campaigns</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground">
                      Created: {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                    {campaign.sent_at && (
                      <span className="text-xs text-muted-foreground">
                        Sent: {new Date(campaign.sent_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(campaign.status)}
                  <Button variant="outline" size="sm">
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                  {campaign.status === 'draft' && (
                    <Button size="sm">
                      <Send className="w-3 h-3 mr-1" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // Audience View - TODO: Implement audience management
  const AudienceView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audience Management</h2>
        <p className="text-muted-foreground">Manage subscribers, segments, and consents</p>
      </div>

      <Tabs defaultValue="subscribers" className="w-full">
        <TabsList>
          <TabsTrigger value="subscribers">Subscribers ({totalSubscribers})</TabsTrigger>
          <TabsTrigger value="segments">Segments ({segments.length})</TabsTrigger>
          <TabsTrigger value="consents">Consents</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscribers</CardTitle>
              <CardDescription>Manage your email subscriber list</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {consents.filter(c => c.consent_given && !c.unsubscribed_at).slice(0, 20).map((consent) => (
                  <div key={consent.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{consent.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Subscribed: {new Date(consent.consent_date).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge('Active')}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments">
          <Card>
            <CardHeader>
              <CardTitle>Subscriber Segments</CardTitle>
              <CardDescription>Organize subscribers into targeted groups</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Segment management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents">
          <Card>
            <CardHeader>
              <CardTitle>GDPR & Consent Management</CardTitle>
              <CardDescription>Track opt-ins, unsubscribes, and compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-lg border bg-green-50">
                  <p className="text-2xl font-bold text-green-700">
                    {consents.filter(c => c.consent_given && !c.unsubscribed_at).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Consents</p>
                </div>
                <div className="p-4 rounded-lg border bg-red-50">
                  <p className="text-2xl font-bold text-red-700">
                    {consents.filter(c => c.unsubscribed_at).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Unsubscribed</p>
                </div>
                <div className="p-4 rounded-lg border bg-blue-50">
                  <p className="text-2xl font-bold text-blue-700">
                    {consents.filter(c => c.double_opt_in).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Double Opt-In</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  // Analytics View - TODO: Implement full analytics
  const AnalyticsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Campaign Analytics</h2>
        <p className="text-muted-foreground">Track performance metrics and engagement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Open Rate</p>
            <p className="text-3xl font-bold text-green-600">{avgOpenRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Click Rate</p>
            <p className="text-3xl font-bold text-blue-600">{avgClickRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Sent</p>
            <p className="text-3xl font-bold text-purple-600">
              {analytics.reduce((sum, a) => sum + (a.total_sent || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Delivered</p>
            <p className="text-3xl font-bold text-orange-600">
              {analytics.reduce((sum, a) => sum + (a.total_delivered || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.map((stat) => (
              <div key={stat.id} className="p-4 rounded-lg border">
                <h4 className="font-semibold mb-2">{stat.email_campaigns?.name || 'Unknown Campaign'}</h4>
                <div className="grid grid-cols-6 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-semibold">{stat.total_sent || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="font-semibold">{stat.total_delivered || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Opened</p>
                    <p className="font-semibold">{stat.total_opened || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Clicked</p>
                    <p className="font-semibold">{stat.total_clicked || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open Rate</p>
                    <p className="font-semibold text-green-600">{stat.open_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Click Rate</p>
                    <p className="font-semibold text-blue-600">{stat.click_rate || 0}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Automation View - TODO: Implement automation
  const AutomationView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Automation</h2>
        <p className="text-muted-foreground">Schedule emails and set up automated workflows</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Emails ({scheduledEmails.length})</CardTitle>
          <CardDescription>Emails scheduled for future delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduledEmails.map((email) => (
              <div key={email.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <p className="font-medium">{email.email_templates?.name || 'Unknown Template'}</p>
                  <p className="text-sm text-muted-foreground">To: {email.recipient_email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {new Date(email.scheduled_for).toLocaleString()}
                  </span>
                  {getStatusBadge(email.status || 'scheduled')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Email Logs View
  const LogsView = () => {
    const filteredLogs = emailLogs.filter(log => {
      const matchesSearch = searchQuery === '' || 
        log.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.subject.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        (log.delivery_status || log.status || '').toLowerCase() === statusFilter.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Email Delivery Logs</h2>
            <p className="text-muted-foreground">Complete history of all sent emails</p>
          </div>
          <Button variant="outline" onClick={loadEmailLogs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search by email or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{log.subject}</p>
                      <p className="text-sm text-muted-foreground">{log.recipient_email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        {log.resend_count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Resent {log.resend_count}x
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {getStatusBadge(log.delivery_status || log.status || 'pending')}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendEmail(log)}
                        disabled={isResending === log.id}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${isResending === log.id ? 'animate-spin' : ''}`} />
                        Resend
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {emailLogs.length} emails
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Tools View
  const ToolsView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Tools & Testing</h2>
        <p className="text-muted-foreground">Development and diagnostic tools</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <EmailFunctionDiagnostics />
        <TestEmailFunctionDirect />
        <TestAutomatedEmail />
        <ResendWelcomeEmailTool />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Edit Template Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Edit Email Template' : 'Create New Email Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Welcome Email"
                />
              </div>
              <div>
                <Label htmlFor="template_type">Template Type</Label>
                <Select
                  value={formData.template_type}
                  onValueChange={(value) => setFormData({ ...formData, template_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="notification">Notification</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject line"
              />
            </div>
            <div>
              <Label htmlFor="from_email">From Email</Label>
              <Input
                id="from_email"
                type="email"
                value={formData.from_email}
                onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="greeting">Greeting</Label>
              <Input
                id="greeting"
                value={formData.greeting}
                onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                placeholder="e.g., Hello {{customerFirstName}},"
              />
            </div>
            <div>
              <Label htmlFor="content">Email Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Email body content..."
                rows={10}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Template</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={loading}>
                {loading ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Template Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">Subject:</p>
              <p className="font-medium">{selectedTemplate?.subject}</p>
            </div>
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">From:</p>
              <p className="font-medium">{selectedTemplate?.from_email}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">{selectedTemplate?.content?.greeting}</p>
              <div className="whitespace-pre-wrap">{selectedTemplate?.content?.content}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Bar */}
      <div className="bg-white border rounded-lg p-2">
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={activeView === 'overview' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('overview')}
          >
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeView === 'templates' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('templates')}
          >
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button
            variant={activeView === 'campaigns' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('campaigns')}
          >
            <Megaphone className="w-4 h-4 mr-2" />
            Campaigns
          </Button>
          <Button
            variant={activeView === 'audience' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('audience')}
          >
            <Users className="w-4 h-4 mr-2" />
            Audience
          </Button>
          <Button
            variant={activeView === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('analytics')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant={activeView === 'automation' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('automation')}
          >
            <Zap className="w-4 h-4 mr-2" />
            Automation
          </Button>
          <Button
            variant={activeView === 'logs' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('logs')}
          >
            <History className="w-4 h-4 mr-2" />
            Logs
          </Button>
          <Button
            variant={activeView === 'tools' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('tools')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Tools
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading email data...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'templates' && <TemplatesView />}
          {activeView === 'campaigns' && <CampaignsView />}
          {activeView === 'audience' && <AudienceView />}
          {activeView === 'analytics' && <AnalyticsView />}
          {activeView === 'automation' && <AutomationView />}
          {activeView === 'logs' && <LogsView />}
          {activeView === 'tools' && <ToolsView />}
        </>
      )}
    </div>
  );
};

export default UnifiedEmailHub;
