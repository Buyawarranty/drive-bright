import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, Download, Eye, FileText, Phone, Mail, Forward } from 'lucide-react';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

const ContactSubmissionsTab = () => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      console.error('Error fetching contact submissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch contact submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const updateSubmissionStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setSubmissions(prev =>
        prev.map(submission =>
          submission.id === id ? { ...submission, status } : submission
        )
      );

      toast({
        title: "Success",
        description: "Submission status updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating submission:', error);
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.new}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const forwardContactEmail = async (submissionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('forward-contact-email', {
        body: { submissionId }
      });

      if (error) {
        console.error('Error forwarding contact email:', error);
        toast({
          title: "Error",
          description: "Failed to forward contact email",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Contact email forwarded successfully to support@buyawarranty.co.uk",
      });
    } catch (error) {
      console.error('Error forwarding contact email:', error);
      toast({
        title: "Error",
        description: "Failed to forward contact email",
        variant: "destructive",
      });
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = 
      submission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (submission.phone && submission.phone.includes(searchTerm)) ||
      (submission.message && submission.message.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="p-6">Loading contact submissions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Contact Submissions</h2>
          <p className="text-gray-600">Manage customer contact form submissions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {submissions.filter(s => s.status === 'new').length}
            </div>
            <div className="text-sm text-gray-600">New</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {submissions.filter(s => s.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {submissions.filter(s => s.status === 'resolved').length}
            </div>
            <div className="text-sm text-gray-600">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {submissions.length}
            </div>
            <div className="text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        {filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No contact submissions found</p>
            </CardContent>
          </Card>
        ) : (
          filteredSubmissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{submission.name}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {submission.email}
                        </span>
                        {submission.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {submission.phone}
                          </span>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(submission.status)}
                    <span className="text-sm text-gray-500">
                      {format(new Date(submission.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {submission.message && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Message:</h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{submission.message}</p>
                  </div>
                )}
                
                {submission.file_url && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Attachment:</h4>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <a
                        href={submission.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {submission.file_name}
                      </a>
                      <span className="text-sm text-gray-500">
                        ({formatFileSize(submission.file_size)})
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Select
                      value={submission.status}
                      onValueChange={(value) => updateSubmissionStatus(submission.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`mailto:${submission.email}`, '_blank')}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => forwardContactEmail(submission.id)}
                      title="Forward email to support@buyawarranty.co.uk"
                    >
                      <Forward className="w-4 h-4 mr-1" />
                      Forward
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactSubmissionsTab;