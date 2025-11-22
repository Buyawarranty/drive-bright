import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Send, Eye, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BulkEmailDialogProps {
  selectedCustomerIds: string[];
  onComplete?: () => void;
}

export const BulkEmailDialog: React.FC<BulkEmailDialogProps> = ({ 
  selectedCustomerIds,
  onComplete 
}) => {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [customEmails, setCustomEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateContent();
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setTemplates(data);
    }
  };

  const loadTemplateContent = async () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setEmailSubject(template.subject || '');
      
      // Extract content from JSONB or use html directly
      let content = '';
      if (template.content?.blocks) {
        content = template.content.blocks
          .map((block: any) => block.data?.text || '')
          .join('\n\n');
      } else if (template.content?.html) {
        content = template.content.html;
      }
      
      setEmailContent(content);
    }
  };

  const getPreviewText = (text: string) => {
    return text.replace(/\{name\}/gi, 'John Smith');
  };

  const handleSend = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template');
      return;
    }

    if (!emailSubject.trim() || !emailContent.trim()) {
      toast.error('Subject and content cannot be empty');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          customerIds: selectedCustomerIds,
          templateId: selectedTemplateId,
          customSubject: emailSubject,
          customContent: emailContent,
          customEmails: customEmails.trim() ? customEmails.split(',').map(e => e.trim()).filter(e => e) : []
        }
      });

      if (error) throw error;

      toast.success(`Email sent to ${data.results.success} customers successfully!`);
      if (data.results.failed > 0) {
        toast.warning(`Failed to send to ${data.results.failed} customers`);
      }
      
      setOpen(false);
      setSelectedTemplateId('');
      setEmailSubject('');
      setEmailContent('');
      setCustomEmails('');
      onComplete?.();
    } catch (error: any) {
      console.error('Bulk email error:', error);
      toast.error(error.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={selectedCustomerIds.length === 0}>
          <Mail className="h-4 w-4 mr-2" />
          Send Bulk Email ({selectedCustomerIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Send Bulk Email</DialogTitle>
          <DialogDescription>
            Sending to {selectedCustomerIds.length} selected customer(s)
            {customEmails.trim() && ` + ${customEmails.split(',').filter(e => e.trim()).length} custom email(s)`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label>Email Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional Email Addresses (Optional)</Label>
            <Textarea
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              rows={2}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter additional email addresses separated by commas
            </p>
          </div>

          {selectedTemplateId && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email subject"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{name}'} to personalize with customer name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Email Content</Label>
                  <Textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Email content..."
                    rows={14}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{name}'} to personalize with customer name
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-4 mt-4">
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-muted px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Preview</div>
                      <Badge variant="outline">Example: {'{name}'} → John Smith</Badge>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Subject:</div>
                      <div className="text-base font-semibold">
                        {getPreviewText(emailSubject) || '(No subject)'}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Message:</div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {getPreviewText(emailContent) || '(No content)'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    This preview shows how your email will appear with placeholder values replaced. Each customer will receive a personalized version with their actual name.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="border-t pt-4 mt-4">
          <Button 
            onClick={handleSend} 
            disabled={sending || !selectedTemplateId || !emailSubject.trim() || !emailContent.trim()}
            className="w-full"
            size="lg"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending to {selectedCustomerIds.length} customers...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {selectedCustomerIds.length} Customer(s)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
