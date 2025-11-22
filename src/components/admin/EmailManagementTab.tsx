import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Edit, Eye, Send, Users, Calendar, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  open_tracked?: boolean;
  click_tracked?: boolean;
  conversion_tracked?: boolean;
  tracking_id?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  template: {
    name: string;
    template_type: string;
  } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  status: string;
}

const EmailManagementTab = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [customerEmailSearch, setCustomerEmailSearch] = useState('');
  const [customerEmailHistory, setCustomerEmailHistory] = useState<EmailLog[]>([]);
  const [isResending, setIsResending] = useState<string | null>(null);
  const { toast } = useToast();

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

  // Send email form state
  const [sendFormData, setSendFormData] = useState({
    templateId: '',
    recipientType: 'individual', // 'individual' or 'bulk'
    recipientEmail: '',
    customerSegment: 'all', // 'all', 'active', 'basic', 'standard', 'premium'
    variables: {} as Record<string, string>
  });

  useEffect(() => {
    fetchTemplates();
    fetchEmailLogs();
    fetchCustomers();
    fetchScheduledEmails();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data as EmailTemplate[]) || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch email templates",
        variant: "destructive",
      });
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          email_templates!email_logs_template_id_fkey(name, template_type)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const formattedLogs = data?.map(log => ({
        ...log,
        template: log.email_templates
      })) || [];
      
      setEmailLogs(formattedLogs);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch email logs",
        variant: "destructive",
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, plan_type, status')
        .order('signup_date', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchScheduledEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select(`
          *,
          email_templates!scheduled_emails_template_id_fkey(name, template_type)
        `)
        .order('scheduled_for', { ascending: true })
        .limit(50);

      if (error) throw error;
      setScheduledEmails(data || []);
    } catch (error) {
      console.error('Error fetching scheduled emails:', error);
    }
  };

  const handleSaveTemplate = async () => {
    setIsLoading(true);
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
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', selectedTemplate.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Email template updated successfully",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Email template created successfully",
        });
      }

      setIsEditing(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
    // Use setTimeout to ensure state updates before opening dialog
    setTimeout(() => setIsEditing(true), 0);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      if (sendFormData.recipientType === 'individual') {
        // Send to individual email
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            templateId: sendFormData.templateId,
            recipientEmail: sendFormData.recipientEmail,
            variables: sendFormData.variables
          }
        });

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Email sent successfully",
        });
      } else {
        // Bulk send
        let targetCustomers = customers;
        
        if (sendFormData.customerSegment !== 'all') {
          targetCustomers = customers.filter(customer => {
            if (sendFormData.customerSegment === 'active') {
              return customer.status === 'Active';
            } else {
              return customer.plan_type.toLowerCase() === sendFormData.customerSegment;
            }
          });
        }

        // Send emails in batches
        for (const customer of targetCustomers) {
        const variables = {
          customerFirstName: customer.name.split(' ')[0],
          ...sendFormData.variables
        };

          await supabase.functions.invoke('send-email', {
            body: {
              templateId: sendFormData.templateId,
              recipientEmail: customer.email,
              customerId: customer.id,
              variables
            }
          });
        }

        toast({
          title: "Success",
          description: `Bulk email sent to ${targetCustomers.length} customers`,
        });
      }

      setSendEmailOpen(false);
      fetchEmailLogs();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const searchCustomerEmails = async () => {
    if (!customerEmailSearch.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          email_templates!email_logs_template_id_fkey(name, template_type)
        `)
        .eq('recipient_email', customerEmailSearch.trim())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedLogs = data?.map(log => ({
        ...log,
        template: log.email_templates
      })) || [];
      
      setCustomerEmailHistory(formattedLogs);
      
      if (formattedLogs.length === 0) {
        toast({
          title: "No emails found",
          description: `No email history found for ${customerEmailSearch}`,
        });
      } else {
        toast({
          title: "Success",
          description: `Found ${formattedLogs.length} email(s) for this customer`,
        });
      }
    } catch (error) {
      console.error('Error searching customer emails:', error);
      toast({
        title: "Error",
        description: "Failed to search customer email history",
        variant: "destructive",
      });
    }
  };

  const handleResendEmail = async (log: EmailLog) => {
    setIsResending(log.id);
    try {
      // If it's a welcome email, use the welcome email resend function
      if (log.template?.template_type === 'welcome') {
        const { error } = await supabase.functions.invoke('resend-welcome-email', {
          body: { customerEmail: log.recipient_email }
        });
        
        if (error) throw error;
      } else {
        // For other email types, use the general send-email function
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            templateId: log.template_id,
            recipientEmail: log.recipient_email,
            variables: {}
          }
        });
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Email resent successfully to ${log.recipient_email}`,
      });
      
      fetchEmailLogs();
      if (customerEmailSearch) {
        searchCustomerEmails();
      }
    } catch (error) {
      console.error('Error resending email:', error);
      toast({
        title: "Error",
        description: "Failed to resend email",
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      bounced: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const renderPreview = () => {
    if (!selectedTemplate) return null;

    const sampleVariables = {
      customerFirstName: 'John',
      expiryDate: '31st December 2024',
      portalUrl: 'https://portal.buyawarranty.co.uk',
      renewalUrl: 'https://buyawarranty.co.uk/renew'
    };

    let content = selectedTemplate.content.content || '';
    let greeting = selectedTemplate.content.greeting || '';

    // Replace variables with sample data
    for (const [key, value] of Object.entries(sampleVariables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
      greeting = greeting.replace(new RegExp(placeholder, 'g'), value);
    }

    return (
      <div className="border rounded-lg p-6 bg-white max-h-96 overflow-y-auto">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-t-lg -m-6 mb-6">
          <h3 className="font-bold text-lg">Buyawarranty.co.uk</h3>
        </div>
        <div className="space-y-4">
          <p className="font-semibold text-lg">{greeting}</p>
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Email Management</h2>
        <div className="space-x-2">
          <Button 
            variant="outline"
            onClick={async () => {
              setIsLoading(true);
              try {
                const { error } = await supabase.functions.invoke('process-scheduled-emails');
                if (error) throw error;
                toast({
                  title: "Success",
                  description: "Scheduled emails processed successfully",
                });
                fetchEmailLogs();
                fetchScheduledEmails();
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to process scheduled emails",
                  variant: "destructive",
                });
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Process Scheduled
          </Button>
          <Dialog open={sendEmailOpen} onOpenChange={setSendEmailOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Send Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template">Email Template</Label>
                  <Select value={sendFormData.templateId} onValueChange={(value) => setSendFormData({...sendFormData, templateId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.filter(t => t.is_active).map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Recipient Type</Label>
                  <Select value={sendFormData.recipientType} onValueChange={(value) => setSendFormData({...sendFormData, recipientType: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual Email</SelectItem>
                      <SelectItem value="bulk">Bulk Send</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sendFormData.recipientType === 'individual' ? (
                  <div>
                    <Label htmlFor="email">Recipient Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={sendFormData.recipientEmail}
                      onChange={(e) => setSendFormData({...sendFormData, recipientEmail: e.target.value})}
                      placeholder="customer@example.com"
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Customer Segment</Label>
                    <Select value={sendFormData.customerSegment} onValueChange={(value) => setSendFormData({...sendFormData, customerSegment: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers ({customers.length})</SelectItem>
                        <SelectItem value="active">Active Only ({customers.filter(c => c.status === 'Active').length})</SelectItem>
                        <SelectItem value="basic">Basic Plan ({customers.filter(c => c.plan_type === 'Basic').length})</SelectItem>
                        <SelectItem value="standard">Standard Plan ({customers.filter(c => c.plan_type === 'Standard').length})</SelectItem>
                        <SelectItem value="premium">Premium Plan ({customers.filter(c => c.plan_type === 'Premium').length})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSendEmailOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSendEmail} 
                    disabled={isSending || !sendFormData.templateId}
                  >
                    {isSending ? 'Sending...' : 'Send Email'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={() => setIsEditing(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Emails</TabsTrigger>
          <TabsTrigger value="logs">Email Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{template.subject}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{template.template_type}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        From: {template.from_email}
                      </div>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewTemplate(template)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <div>
                        Created: {new Date(template.created_at).toLocaleDateString()} {new Date(template.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div>
                        Updated: {new Date(template.updated_at).toLocaleDateString()} {new Date(template.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledEmails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled emails found
                  </div>
                ) : (
                  scheduledEmails.map((scheduled) => (
                    <div key={scheduled.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {scheduled.email_templates?.name || 'Unknown Template'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          To: {scheduled.recipient_email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Scheduled for: {new Date(scheduled.scheduled_for).toLocaleString()}
                        </div>
                        {scheduled.metadata?.customerFirstName && (
                          <div className="text-xs text-muted-foreground">
                            Customer: {scheduled.metadata.customerFirstName}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <Badge 
                          className={
                            scheduled.status === 'scheduled' 
                              ? 'bg-blue-100 text-blue-800' 
                              : scheduled.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : scheduled.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {scheduled.status}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          {scheduled.email_templates?.template_type}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Email Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="space-y-1 flex-1">
                      <div className="font-medium">{log.subject}</div>
                      <div className="text-sm text-muted-foreground">
                        To: {log.recipient_email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.template?.name} • {new Date(log.sent_at || log.created_at).toLocaleString()}
                        {log.template?.template_type && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {log.template.template_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-2 flex flex-col items-end">
                      {getStatusBadge(log.status)}
                      {log.status === 'sent' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendEmail(log)}
                          disabled={isResending === log.id}
                        >
                          {isResending === log.id ? 'Resending...' : 'Resend'}
                        </Button>
                      )}
                      {log.error_message && (
                        <div className="text-xs text-red-600 max-w-48 truncate">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{emailLogs.filter(log => log.status === 'sent').length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const sent = emailLogs.filter(log => log.status === 'sent').length;
                    const opened = emailLogs.filter(log => log.open_tracked).length;
                    return sent > 0 ? Math.round((opened / sent) * 100) : 0;
                  })()}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {emailLogs.filter(log => log.open_tracked).length} opens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Click Rate (CTR)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const sent = emailLogs.filter(log => log.status === 'sent').length;
                    const clicked = emailLogs.filter(log => log.click_tracked).length;
                    return sent > 0 ? Math.round((clicked / sent) * 100) : 0;
                  })()}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {emailLogs.filter(log => log.click_tracked).length} clicks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const sent = emailLogs.filter(log => log.status === 'sent').length;
                    const converted = emailLogs.filter(log => log.conversion_tracked).length;
                    return sent > 0 ? Math.round((converted / sent) * 100) : 0;
                  })()}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {emailLogs.filter(log => log.conversion_tracked).length} conversions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Email History Lookup */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Customer Email History Lookup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter customer email address..."
                  value={customerEmailSearch}
                  onChange={(e) => setCustomerEmailSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchCustomerEmails()}
                  className="flex-1"
                />
                <Button onClick={searchCustomerEmails}>
                  Search
                </Button>
              </div>

              {customerEmailHistory.length > 0 && (
                <div className="space-y-3 mt-4">
                  <div className="font-medium">
                    Email History for {customerEmailSearch} ({customerEmailHistory.length} email{customerEmailHistory.length !== 1 ? 's' : ''})
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {customerEmailHistory.map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-3 border rounded-lg bg-muted/50">
                        <div className="space-y-1 flex-1">
                          <div className="font-medium">{log.subject}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {log.template?.name}
                            {log.template?.template_type && (
                              <Badge variant="outline" className="text-xs">
                                {log.template.template_type}
                              </Badge>
                            )}
                            <span>•</span>
                            <span>{new Date(log.sent_at || log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-2 flex flex-col items-end">
                          {getStatusBadge(log.status)}
                          {log.status === 'sent' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendEmail(log)}
                              disabled={isResending === log.id}
                            >
                              {isResending === log.id ? 'Resending...' : 'Resend'}
                            </Button>
                          )}
                          {log.error_message && (
                            <div className="text-xs text-red-600 max-w-48 truncate">
                              {log.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Email Tools Section */}
          <div className="space-y-6 mt-8">
            <h3 className="text-lg font-semibold">Email Tools & Diagnostics</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResendWelcomeEmailTool />
              <TestEmailFunctionDirect />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TestAutomatedEmail />
              <EmailFunctionDiagnostics />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Editor Dialog */}
      <Dialog open={isEditing} onOpenChange={(open) => {
        setIsEditing(open);
        if (!open) {
          setSelectedTemplate(null);
          setFormData({
            name: '',
            subject: '',
            template_type: '',
            from_email: 'info@buyawarranty.co.uk',
            greeting: '',
            content: '',
            is_active: true
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Edit Email Template' : 'Create New Email Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Welcome Email"
                />
              </div>

              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Welcome to Buyawarranty.co.uk"
                />
              </div>

              <div>
                <Label htmlFor="template_type">Template Type</Label>
                <Select value={formData.template_type} onValueChange={(value) => setFormData({...formData, template_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="abandoned_cart">Abandoned Cart</SelectItem>
                    <SelectItem value="expiry">Expiry</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="claims">Claims</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="from_email">From Email</Label>
                <Select value={formData.from_email} onValueChange={(value) => setFormData({...formData, from_email: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info@buyawarranty.co.uk">info@buyawarranty.co.uk</SelectItem>
                    <SelectItem value="claims@buyawarranty.co.uk">claims@buyawarranty.co.uk</SelectItem>
                    <SelectItem value="sales@buyawarranty.co.uk">sales@buyawarranty.co.uk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="greeting">Email Greeting</Label>
                <Input
                  id="greeting"
                  value={formData.greeting}
                  onChange={(e) => setFormData({...formData, greeting: e.target.value})}
                  placeholder="Hi {{customerFirstName}},"
                />
              </div>

              <div>
                <Label htmlFor="content">Email Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Email content with {{variables}}"
                  rows={12}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                <Label htmlFor="is_active">Active Template</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Live Preview</h3>
              {selectedTemplate ? renderPreview() : (
                <div className="border rounded-lg p-6 bg-muted">
                  <p className="text-muted-foreground text-center">
                    Fill in the template details to see a preview
                  </p>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Available Variables:</strong></p>
                <p>{'{{customerFirstName}}'} - Customer's first name</p>
                <p>{'{{expiryDate}}'} - Policy expiry date</p>
                <p>{'{{portalUrl}}'} - Customer portal URL</p>
                <p>{'{{renewalUrl}}'} - Renewal URL</p>
                <p>{'{{quoteUrl}}'} - Quote URL</p>
                <p>{'{{referralLink}}'} - Referral link</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          {renderPreview()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailManagementTab;