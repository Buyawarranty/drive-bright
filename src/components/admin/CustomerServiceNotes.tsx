import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Phone, MessageSquare, FileText, Clock, User, Trash2, Edit, Save, X, PoundSterling, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ServiceNote {
  id: string;
  note_text: string;
  note_type: 'call' | 'claim' | 'general' | 'follow_up';
  call_outcome?: string;
  claim_amount?: number;
  claim_status?: string;
  follow_up_date?: string;
  created_by: string;
  created_at: string;
  admin_user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

interface CustomerServiceNotesProps {
  customerId: string;
  customerType?: 'active' | 'incomplete';
  onNotesChange?: (count: number) => void;
}

const NOTE_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone, color: 'bg-blue-100 text-blue-700' },
  { value: 'claim', label: 'Claim', icon: PoundSterling, color: 'bg-green-100 text-green-700' },
  { value: 'follow_up', label: 'Follow-up', icon: Calendar, color: 'bg-amber-100 text-amber-700' },
  { value: 'general', label: 'General Note', icon: MessageSquare, color: 'bg-gray-100 text-gray-700' },
];

const CALL_OUTCOMES = [
  { value: 'answered', label: 'Answered - Interested' },
  { value: 'answered_not_interested', label: 'Answered - Not Interested' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Left Voicemail' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'converted', label: 'Converted to Sale' },
];

const CLAIM_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

const QUICK_TEMPLATES = [
  { label: 'No Answer', text: 'Called customer - no answer. Will try again.' },
  { label: 'Left VM', text: 'Left voicemail requesting callback.' },
  { label: 'Interested', text: 'Spoke with customer - interested in proceeding. Will follow up.' },
  { label: 'Not Interested', text: 'Spoke with customer - not interested at this time.' },
  { label: 'Quote Sent', text: 'Sent revised quote via email as requested.' },
  { label: 'Claim Enquiry', text: 'Customer called to enquire about making a claim.' },
];

export const CustomerServiceNotes = ({ customerId, customerType = 'active', onNotesChange }: CustomerServiceNotesProps) => {
  const [notes, setNotes] = useState<ServiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form state
  const [noteType, setNoteType] = useState<string>('call');
  const [noteText, setNoteText] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  
  // Edit state
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    fetchNotes();
    getCurrentUser();
  }, [customerId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchNotes = async () => {
    try {
      const { data: notesData, error } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get admin users for notes
      const createdByIds = [...new Set(notesData?.map(note => note.created_by) || [])];
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('user_id, email, first_name, last_name')
        .in('user_id', createdByIds);

      // Parse notes with metadata
      const processedNotes = (notesData || []).map(note => {
        const adminUser = adminUsers?.find(admin => admin.user_id === note.created_by);
        
        // Try to parse metadata from note_text if it contains JSON
        let parsedNote: ServiceNote = {
          id: note.id,
          note_text: note.note_text,
          note_type: 'general',
          created_by: note.created_by,
          created_at: note.created_at,
          admin_user: adminUser ? {
            email: adminUser.email,
            first_name: adminUser.first_name,
            last_name: adminUser.last_name
          } : null
        };

        // Check if note has embedded metadata (format: [TYPE:data] note text)
        const metaMatch = note.note_text.match(/^\[(\w+):([^\]]*)\]\s*(.*)/s);
        if (metaMatch) {
          const [, type, metadata, text] = metaMatch;
          parsedNote.note_type = type.toLowerCase() as ServiceNote['note_type'];
          parsedNote.note_text = text;
          
          try {
            const metaObj = JSON.parse(metadata || '{}');
            parsedNote.call_outcome = metaObj.outcome;
            parsedNote.claim_amount = metaObj.amount;
            parsedNote.claim_status = metaObj.status;
            parsedNote.follow_up_date = metaObj.followUp;
          } catch (e) {
            // If metadata parsing fails, just use the raw text
          }
        }
        
        return parsedNote;
      });

      setNotes(processedNotes);
      onNotesChange?.(processedNotes.length);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || !currentUser) return;

    try {
      // Build metadata object
      const metadata: any = {};
      if (noteType === 'call' && callOutcome) metadata.outcome = callOutcome;
      if (noteType === 'claim') {
        if (claimAmount) metadata.amount = parseFloat(claimAmount);
        if (claimStatus) metadata.status = claimStatus;
      }
      if (noteType === 'follow_up' && followUpDate) metadata.followUp = followUpDate;

      // Format note with embedded metadata
      const formattedNote = `[${noteType.toUpperCase()}:${JSON.stringify(metadata)}] ${noteText.trim()}`;

      const { error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          note_text: formattedNote,
          created_by: currentUser.id,
        });

      if (error) throw error;

      // Reset form
      setNoteText('');
      setCallOutcome('');
      setClaimAmount('');
      setClaimStatus('');
      setFollowUpDate('');
      setIsAddingNote(false);
      
      fetchNotes();
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      fetchNotes();
      toast.success('Note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editText.trim()) return;
    
    try {
      const { error } = await supabase
        .from('customer_notes')
        .update({ note_text: editText.trim() })
        .eq('id', noteId);

      if (error) throw error;
      
      setEditingNote(null);
      setEditText('');
      fetchNotes();
      toast.success('Note updated');
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const applyTemplate = (template: string) => {
    setNoteText(template);
  };

  const getAuthorName = (note: ServiceNote) => {
    if (note.admin_user?.first_name && note.admin_user?.last_name) {
      return `${note.admin_user.first_name} ${note.admin_user.last_name}`;
    }
    return note.admin_user?.email || 'Unknown';
  };

  const getNoteTypeConfig = (type: string) => {
    return NOTE_TYPES.find(t => t.value === type) || NOTE_TYPES[3];
  };

  // Calculate claim stats
  const claimNotes = notes.filter(n => n.note_type === 'claim');
  const totalClaimsPaid = claimNotes
    .filter(n => n.claim_status === 'paid')
    .reduce((sum, n) => sum + (n.claim_amount || 0), 0);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-24 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Notes
            <Badge variant="secondary">{notes.length}</Badge>
          </h3>
          {claimNotes.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Claims: {claimNotes.length} | Total Paid: £{totalClaimsPaid.toLocaleString()}
            </p>
          )}
        </div>
        
        <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Customer Note</DialogTitle>
            </DialogHeader>
            
            <Tabs value={noteType} onValueChange={setNoteType} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {NOTE_TYPES.map(type => (
                  <TabsTrigger key={type.value} value={type.value} className="gap-2">
                    <type.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{type.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Phone Call Tab */}
              <TabsContent value="call" className="space-y-4 mt-4">
                <div>
                  <Label>Call Outcome *</Label>
                  <Select value={callOutcome} onValueChange={setCallOutcome}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CALL_OUTCOMES.map(outcome => (
                        <SelectItem key={outcome.value} value={outcome.value}>
                          {outcome.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Claim Tab */}
              <TabsContent value="claim" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Claim Amount (£)</Label>
                    <Input
                      type="number"
                      value={claimAmount}
                      onChange={(e) => setClaimAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Claim Status</Label>
                    <Select value={claimStatus} onValueChange={setClaimStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CLAIM_STATUSES.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Follow-up Tab */}
              <TabsContent value="follow_up" className="space-y-4 mt-4">
                <div>
                  <Label>Follow-up Date</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </TabsContent>

              {/* General Tab - no extra fields */}
              <TabsContent value="general" className="mt-4">
                <p className="text-sm text-muted-foreground">Add a general note about this customer.</p>
              </TabsContent>
            </Tabs>

            {/* Quick Templates */}
            <div>
              <Label className="text-sm text-muted-foreground">Quick Templates</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_TEMPLATES.map((template, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => applyTemplate(template.text)}
                  >
                    {template.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Note Text */}
            <div>
              <Label>Note *</Label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter your note..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingNote(false)}>
                Cancel
              </Button>
              <Button onClick={addNote} disabled={!noteText.trim()}>
                Add Note
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Claims Summary Card */}
      {claimNotes.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <PoundSterling className="h-4 w-4" />
              Claims Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Claims</p>
                <p className="font-semibold text-lg">{claimNotes.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Paid</p>
                <p className="font-semibold text-lg text-green-700">£{totalClaimsPaid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending</p>
                <p className="font-semibold text-lg">
                  {claimNotes.filter(n => n.claim_status !== 'paid' && n.claim_status !== 'rejected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {notes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-lg">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No notes yet. Add the first note!</p>
          </div>
        ) : (
          notes.map(note => {
            const typeConfig = getNoteTypeConfig(note.note_type);
            const TypeIcon = typeConfig.icon;
            
            return (
              <Card key={note.id} className="relative">
                <CardContent className="pt-4">
                  {/* Note Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={typeConfig.color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                      
                      {note.note_type === 'call' && note.call_outcome && (
                        <Badge variant="outline">
                          {CALL_OUTCOMES.find(o => o.value === note.call_outcome)?.label || note.call_outcome}
                        </Badge>
                      )}
                      
                      {note.note_type === 'claim' && (
                        <>
                          {note.claim_amount && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              £{note.claim_amount.toLocaleString()}
                            </Badge>
                          )}
                          {note.claim_status && (
                            <Badge variant={note.claim_status === 'paid' ? 'default' : 'outline'}>
                              {CLAIM_STATUSES.find(s => s.value === note.claim_status)?.label || note.claim_status}
                            </Badge>
                          )}
                        </>
                      )}
                      
                      {note.note_type === 'follow_up' && note.follow_up_date && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700">
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(note.follow_up_date), 'dd MMM yyyy')}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingNote(note.id);
                          setEditText(note.note_text);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Note Content */}
                  {editingNote === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingNote(null);
                            setEditText('');
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => updateNote(note.id)}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                  )}

                  {/* Note Footer */}
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{getAuthorName(note)}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
