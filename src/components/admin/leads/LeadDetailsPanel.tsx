import React, { useState } from 'react';
import { Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Phone, Mail, MessageSquare, Car, Calendar, User, 
  ChevronDown, ChevronUp, Bold, Italic, List, 
  Clock, Save, X, Gauge
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadDetailsPanelProps {
  lead: Lead;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onLogActivity: (leadId: string, type: string, description: string) => void;
}

export const LeadDetailsPanel: React.FC<LeadDetailsPanelProps> = ({
  lead,
  onUpdateNotes,
  onLogActivity
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notesValue, setNotesValue] = useState(lead.notes || '');
  const [contactOpen, setContactOpen] = useState(false);

  const handleSaveNotes = () => {
    onUpdateNotes(lead.id, notesValue);
    setIsEditing(false);
    toast.success('Notes saved');
  };

  const handleCall = () => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`);
      if (!lead.is_from_abandoned_cart) {
        onLogActivity(lead.id, 'call', 'Made phone call');
      }
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmail = () => {
    window.open(`mailto:${lead.email}?subject=Your Warranty Quote`);
    if (!lead.is_from_abandoned_cart) {
      onLogActivity(lead.id, 'email', 'Sent email');
    }
  };

  const handleWhatsApp = () => {
    if (lead.phone) {
      const cleanPhone = lead.phone.replace(/\s/g, '').replace(/^\+/, '');
      const phone = cleanPhone.startsWith('44') ? cleanPhone : `44${cleanPhone.replace(/^0/, '')}`;
      window.open(`https://wa.me/${phone}?text=Hi, following up on your warranty quote...`);
      if (!lead.is_from_abandoned_cart) {
        onLogActivity(lead.id, 'whatsapp', 'Sent WhatsApp message');
      }
    } else {
      toast.error('No phone number available');
    }
  };

  const insertFormatting = (format: 'bold' | 'italic' | 'list') => {
    const textarea = document.getElementById('lead-notes-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = notesValue.substring(start, end);
    
    let newText = '';
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'text'}**`;
        break;
      case 'italic':
        newText = `_${selectedText || 'text'}_`;
        break;
      case 'list':
        newText = `\n• ${selectedText || 'Item'}`;
        break;
    }
    
    const updatedNotes = notesValue.substring(0, start) + newText + notesValue.substring(end);
    setNotesValue(updatedNotes);
  };

  const displayName = lead.first_name || lead.last_name 
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    : lead.full_name && !lead.full_name.includes('@') ? lead.full_name : null;

  return (
    <div className="p-4 space-y-4">
      {/* Vehicle Details Card - Above Notes for Context */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tracking-wider text-foreground">
                    {lead.vehicle_reg || '—'}
                  </span>
                  {lead.vehicle_type && lead.vehicle_type !== 'Standard' && (
                    <Badge variant="secondary" className="text-xs">{lead.vehicle_type}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {lead.vehicle_make} {lead.vehicle_model} {lead.vehicle_year && `(${lead.vehicle_year})`}
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="h-4 w-4" />
                <span>{lead.mileage || '—'} miles</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Notes Section - Primary Focus */}
      <Card className="border-2 border-primary/30 shadow-sm">
        <CardContent className="p-0">
          {/* Notes Header with Quick Actions */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Notes</h3>
              {lead.notes && !isEditing && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Last updated
                </Badge>
              )}
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={handleCall}
              >
                <Phone className="h-4 w-4 mr-1.5" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                onClick={handleEmail}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                onClick={handleWhatsApp}
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Formatting Toolbar - Only shown when editing */}
          {isEditing && (
            <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('bold')}
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('italic')}
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('list')}
                title="Bullet List"
              >
                <List className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {notesValue.length} characters
              </span>
            </div>
          )}

          {/* Notes Content Area */}
          <div className="p-4">
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  id="lead-notes-textarea"
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add your notes here...&#10;&#10;• What was discussed?&#10;• Customer concerns or objections&#10;• Next steps agreed&#10;• Important details to remember"
                  className="min-h-[200px] text-sm leading-relaxed resize-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Use **bold** and _italic_ for formatting
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNotesValue(lead.notes || '');
                        setIsEditing(false);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveNotes}>
                      <Save className="h-4 w-4 mr-1" />
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "min-h-[160px] p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                  lead.notes 
                    ? "border-muted bg-muted/20 hover:border-primary/30 hover:bg-muted/30"
                    : "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
                )}
                onClick={() => {
                  setNotesValue(lead.notes || '');
                  setIsEditing(true);
                }}
              >
                {lead.notes ? (
                  <div className="space-y-2">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                      {lead.notes}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-base font-medium text-foreground mb-1">Add Notes</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Click here to add notes about this lead, track conversations, and record important details.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timestamp Footer */}
          {lead.notes && !isEditing && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Last updated {format(new Date(), 'dd MMM yyyy, HH:mm')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collapsible Contact Details Sidebar */}
      <Collapsible open={contactOpen} onOpenChange={setContactOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Contact Details</span>
                {displayName && (
                  <Badge variant="outline" className="text-xs">{displayName}</Badge>
                )}
              </div>
              {contactOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4 border-t">
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                    <p className="text-sm font-medium mt-0.5">{lead.email}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
                    <p className="text-sm font-medium mt-0.5">{lead.phone || '—'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</label>
                    <p className="text-sm font-medium mt-0.5 capitalize">{lead.lead_source?.replace('_', ' ') || '—'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</label>
                    <p className="text-sm font-medium mt-0.5">{format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                </div>
              </div>
              {lead.plan_name && (
                <div className="mt-4 pt-4 border-t">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected Plan</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-primary text-primary-foreground">{lead.plan_name}</Badge>
                    {lead.payment_amount && (
                      <span className="text-sm font-semibold">£{lead.payment_amount.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
