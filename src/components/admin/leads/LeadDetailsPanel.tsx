import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Lead } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Phone, Mail, MessageSquare, Car, User, 
  ChevronDown, ChevronUp, Bold, Italic, List, 
  Clock, Save, X, Plus, CreditCard, FileText, StickyNote,
  AlertCircle, RefreshCw, Loader2, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ManualOrderEntry } from '../ManualOrderEntry';
import { RemindMePopover } from './RemindMePopover';
import { MarkAsPaidDialog } from './MarkAsPaidDialog';
import { useAtomicNoteSave } from '@/hooks/useAtomicNoteSave';

interface LeadDetailsPanelProps {
  lead: Lead;
  onUpdateNotes: (leadId: string, notes: string, replaceAll?: boolean) => void | Promise<void>;
  onLogActivity: (leadId: string, type: string, description: string) => void;
  onRefresh?: () => void;
  onNavigateToQuote?: (lead: Lead) => void;
}

export const LeadDetailsPanel: React.FC<LeadDetailsPanelProps> = ({
  lead,
  onUpdateNotes,
  onLogActivity,
  onRefresh,
  onNavigateToQuote
}) => {
  const [newNoteValue, setNewNoteValue] = useState(''); // For Add Notes section
  const [quickNoteValue, setQuickNoteValue] = useState(''); // For Quick Notes with autosave
  const [contactOpen, setContactOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  
  const previousLeadIdRef = useRef<string | null>(null);

  // Atomic note save for manual notes (Add Notes section)
  const manualNoteSave = useAtomicNoteSave({
    debounceMs: 1000,
    onSave: async (content: string) => {
      console.log(`[LeadDetailsPanel] Manual save executing for lead ${lead.id}`);
      await onUpdateNotes(lead.id, content, false);
    },
    onSuccess: () => {
      console.log(`[LeadDetailsPanel] Manual save success`);
      setManualSaveSuccess(true);
      setTimeout(() => setManualSaveSuccess(false), 2000);
      // Don't show toast here - parent hook shows it
    },
    onError: (error) => {
      console.error(`[LeadDetailsPanel] Manual save error:`, error);
      // Toast is shown by parent hook
    }
  });

  // Atomic note save for quick notes (autosave section)
  const quickNoteSave = useAtomicNoteSave({
    debounceMs: 1000, // 1 second debounce
    onSave: async (content: string) => {
      console.log(`[LeadDetailsPanel] Quick save executing for lead ${lead.id}`);
      await onUpdateNotes(lead.id, content, false);
    },
    onSuccess: () => {
      console.log(`[LeadDetailsPanel] Quick save success - clearing input`);
      setQuickNoteValue(''); // Clear after successful save
      toast.success('Quick note saved ✓', { duration: 1500 });
    },
    onError: (error) => {
      console.error(`[LeadDetailsPanel] Quick save error:`, error);
      toast.error('Failed to save quick note. Please try again.');
    }
  });

  // Reset inputs and save states when switching leads
  useEffect(() => {
    if (previousLeadIdRef.current !== lead.id) {
      console.log(`[LeadDetailsPanel] Lead changed from ${previousLeadIdRef.current} to ${lead.id} - resetting state`);
      setNewNoteValue('');
      setQuickNoteValue('');
      setManualSaveSuccess(false);
      manualNoteSave.reset();
      quickNoteSave.reset();
      previousLeadIdRef.current = lead.id;
    }
  }, [lead.id, manualNoteSave.reset, quickNoteSave.reset]);

  // Trigger debounced autosave when quick note value changes
  useEffect(() => {
    if (quickNoteValue.trim()) {
      quickNoteSave.debouncedSave(quickNoteValue);
    }
    // Cleanup on unmount or lead change
    return () => {
      quickNoteSave.clearDebounce();
    };
  }, [quickNoteValue, quickNoteSave.debouncedSave, quickNoteSave.clearDebounce]);

  // Prepare customer data for ManualOrderEntry pre-fill
  const customerDataForOrder = {
    id: lead.id,
    name: lead.first_name && lead.last_name 
      ? `${lead.first_name} ${lead.last_name}` 
      : lead.full_name || '',
    email: lead.email,
    phone: lead.phone || '',
    registration_plate: lead.vehicle_reg || '',
    vehicle_make: lead.vehicle_make || '',
    vehicle_model: lead.vehicle_model || '',
    vehicle_year: lead.vehicle_year || '',
    mileage: lead.mileage || '',
  };

  const handleSaveNotes = async () => {
    if (!newNoteValue.trim()) {
      toast.error('Please enter a note before saving');
      return;
    }
    
    console.log(`[LeadDetailsPanel] Manual save button clicked`);
    const success = await manualNoteSave.immediateSave(newNoteValue);
    if (success) {
      // Keep the note in the field after saving for user verification
      // Success toast is handled by the hook
    }
  };

  const handleRetryManualSave = async () => {
    if (newNoteValue.trim()) {
      await manualNoteSave.retry(newNoteValue);
    }
  };

  const handleRetryQuickSave = async () => {
    if (quickNoteValue.trim()) {
      await quickNoteSave.retry(quickNoteValue);
    }
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
    const selectedText = newNoteValue.substring(start, end);
    
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
    
    const updatedNotes = newNoteValue.substring(0, start) + newText + newNoteValue.substring(end);
    setNewNoteValue(updatedNotes);
  };

  const displayName = lead.first_name || lead.last_name 
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    : lead.full_name && !lead.full_name.includes('@') ? lead.full_name : null;

  const vehicleInfo = `${lead.vehicle_make || ''} ${lead.vehicle_model || ''} ${lead.vehicle_year ? `(${lead.vehicle_year})` : ''}`.trim();

  return (
    <div className="p-4">
      {/* Single Card with Everything */}
      <Card className="border-2 border-primary/30 shadow-sm">
        <CardContent className="p-0">
          {/* Header Row - All left-aligned */}
          <div 
            className="flex items-center gap-3 p-4 border-b bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setNotesOpen(!notesOpen)}
          >
            {/* Expand/Collapse Chevron - Click to toggle */}
            <Button
              variant={notesOpen ? "default" : "outline"}
              size="icon"
              className={cn(
                "h-10 w-10 flex-shrink-0 transition-all duration-100",
                notesOpen 
                  ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                  : "border-2 border-primary hover:border-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 hover:shadow-lg"
              )}
              onClick={(e) => { 
                e.stopPropagation(); 
                setNotesOpen(!notesOpen); 
              }}
            >
              {notesOpen ? (
                <ChevronUp className="h-6 w-6" strokeWidth={3} />
              ) : (
                <ChevronDown className="h-6 w-6" strokeWidth={3} />
              )}
            </Button>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={(e) => { e.stopPropagation(); handleCall(); }}
              >
                <Phone className="h-4 w-4 mr-1.5" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                onClick={(e) => { e.stopPropagation(); handleEmail(); }}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }}
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                WhatsApp
              </Button>
              
              {/* Create Order Button */}
              <Button
                size="sm"
                className="h-8 bg-primary hover:bg-primary/90"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsOrderDialogOpen(true); 
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Order
              </Button>
              
              {/* Mark as Paid Button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsMarkPaidDialogOpen(true); 
                }}
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Mark as Paid
              </Button>
              
              {/* Remind Me Button */}
              <div onClick={(e) => e.stopPropagation()}>
                <RemindMePopover leadId={lead.id} />
              </div>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Vehicle Info - Inline */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Car className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wider text-foreground">
                  {lead.vehicle_reg || '—'}
                </span>
                {vehicleInfo && (
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {vehicleInfo}
                  </span>
                )}
                {lead.vehicle_type && lead.vehicle_type !== 'Standard' && (
                  <Badge variant="secondary" className="text-xs hidden md:inline-flex">{lead.vehicle_type}</Badge>
                )}
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Notes Title */}
            <h3 className="font-semibold text-lg">Notes</h3>

            {/* Contact Details Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={(e) => { 
                e.stopPropagation(); 
                setContactOpen(!contactOpen); 
              }}
            >
              <User className="h-4 w-4 mr-1.5" />
              {displayName || 'Contact'}
              {contactOpen ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>
          </div>

          {/* Contact Details - Collapsible inline, left-aligned */}
          {contactOpen && (
            <div className="p-4 border-b bg-muted/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                  <p className="text-sm font-medium mt-0.5">{lead.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
                  <p className="text-sm font-medium mt-0.5">{lead.phone || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mileage</label>
                  <p className="text-sm font-medium mt-0.5">{lead.mileage || '—'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</label>
                  <p className="text-sm font-medium mt-0.5">{format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
              {/* Plan Selection Summary - Show what customer selected */}
              {(lead.plan_name || lead.step_abandoned) && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Customer Selection (Step {lead.step_abandoned || '?'})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lead.plan_name && (
                      <Badge className="bg-primary text-primary-foreground">{lead.plan_name}</Badge>
                    )}
                    {lead.payment_type && (
                      <Badge variant="secondary">{lead.payment_type === '12months' ? '12 Month' : lead.payment_type === '24months' ? '24 Month' : lead.payment_type}</Badge>
                    )}
                    {lead.cart_metadata?.claim_limit && (
                      <Badge variant="outline">Claim: £{lead.cart_metadata.claim_limit.toLocaleString()}</Badge>
                    )}
                    {lead.cart_metadata?.voluntary_excess !== undefined && (
                      <Badge variant="outline">Excess: £{lead.cart_metadata.voluntary_excess}</Badge>
                    )}
                    {lead.cart_metadata?.labour_rate && (
                      <Badge variant="outline">Labour: £{lead.cart_metadata.labour_rate}/hr</Badge>
                    )}
                    {lead.cart_metadata?.total_price && (
                      <span className="text-sm font-semibold text-green-600">Total: £{lead.cart_metadata.total_price.toFixed(2)}</span>
                    )}
                    {lead.payment_amount && !lead.cart_metadata?.total_price && (
                      <span className="text-sm font-semibold">£{lead.payment_amount.toFixed(2)}</span>
                    )}
                  </div>
                  {/* Protection Add-ons */}
                  {lead.cart_metadata?.protection_addons && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.cart_metadata.protection_addons.breakdown && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ Breakdown</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.rental && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ Rental</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.european && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ European</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.tyre && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ Tyre</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.wearAndTear && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ Wear & Tear</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.motFee && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ MOT Fee</Badge>
                      )}
                      {lead.cart_metadata.protection_addons.transfer && (
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">✓ Transfer</Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes Content - Collapsible */}
          {notesOpen && (
            <>
              {/* Formatting Toolbar */}
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
                  {newNoteValue.length} characters
                </span>
              </div>

              {/* Notes Content Area */}
              <div className="p-4 space-y-4">
                {/* Add Notes Section */}
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">Add Notes</h4>
                      <p className="text-xs text-muted-foreground">Click to add notes about this lead</p>
                    </div>
                    {manualSaveSuccess && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                  </div>
                  
                  {/* Error Banner for Manual Notes */}
                  {manualNoteSave.error && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Failed to save note: {manualNoteSave.error}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRetryManualSave}
                          className="ml-2"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Textarea
                    id="lead-notes-textarea"
                    value={newNoteValue}
                    onChange={(e) => setNewNoteValue(e.target.value)}
                    placeholder="Type your detailed note here..."
                    className="min-h-[80px] text-sm leading-relaxed resize-none focus:ring-2 focus:ring-primary/20 bg-background"
                    disabled={manualNoteSave.isWriting}
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <Button 
                      size="sm" 
                      onClick={handleSaveNotes} 
                      disabled={!newNoteValue.trim() || manualNoteSave.isWriting}
                      className="min-w-[100px]"
                    >
                      {manualNoteSave.isWriting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Note
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewNoteValue('')}
                      disabled={!newNoteValue || manualNoteSave.isWriting}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Quick Notes Section - Autosave */}
                <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-md bg-amber-200 flex items-center justify-center">
                      <StickyNote className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-amber-900">Quick Notes</h4>
                      <p className="text-xs text-amber-700">Add a quick note... (autosaves after 1s)</p>
                    </div>
                    {quickNoteSave.isWriting && (
                      <span className="text-xs text-amber-600 flex items-center gap-1 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                  </div>
                  
                  {/* Error Banner for Quick Notes */}
                  {quickNoteSave.error && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Failed to save: {quickNoteSave.error}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRetryQuickSave}
                          className="ml-2"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Textarea
                    value={quickNoteValue}
                    onChange={(e) => setQuickNoteValue(e.target.value)}
                    placeholder="Quick note - starts saving after you stop typing..."
                    className="min-h-[60px] text-sm leading-relaxed resize-none focus:ring-2 focus:ring-amber-300 bg-white border-amber-200"
                    disabled={quickNoteSave.isWriting}
                  />
                </div>

                {/* Notes History (read-only) */}
                {lead.notes && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Notes History
                    </h4>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-lg max-h-[300px] overflow-y-auto">
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual Order Entry Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <ManualOrderEntry 
            customerToEdit={customerDataForOrder}
            onClose={() => setIsOrderDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <MarkAsPaidDialog
        lead={lead}
        open={isMarkPaidDialogOpen}
        onOpenChange={setIsMarkPaidDialogOpen}
        onSuccess={onRefresh}
        onNavigateToQuote={onNavigateToQuote ? () => onNavigateToQuote(lead) : undefined}
      />
    </div>
  );
};
