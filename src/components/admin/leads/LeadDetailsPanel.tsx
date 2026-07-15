import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EmailBlockButton } from '../email/EmailBlockButton';
import { Lead } from '@/hooks/useLeads';
import { addSystemNote } from '@/utils/leadSystemNotes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Phone, Mail, MessageSquare, Car, User, 
  ChevronDown, ChevronUp, 
  CreditCard, Printer, Award
} from 'lucide-react';
import { CommissionClaimDialog } from './CommissionClaimDialog';
import { CommissionClaimReviewPanel } from './CommissionClaimReviewPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';
import { RemindMePopover } from './RemindMePopover';
import { MarkAsPaidDialog } from './MarkAsPaidDialog';
import { UnifiedNotesPanel } from './notes/UnifiedNotesPanel';
import { PrintableWarrantyLetter } from '../PrintableWarrantyLetter';
import { LeadDuplicatesPanel } from './LeadDuplicatesPanel';

interface LeadDetailsPanelProps {
  lead: Lead;
  onUpdateNotes?: (leadId: string, notes: string, replaceAll?: boolean) => void | Promise<void>; // Deprecated - now handled by UnifiedNotesPanel
  onLogActivity: (leadId: string, type: string, description: string) => void;
  onRefresh?: () => void;
  onNavigateToQuote?: (lead: Lead) => void;
  hasQuotesSent?: boolean;
  /** Recontact / Renewals / Lost lists pass true — no Open-Pool outcome UI. */
  hidePoolOutcome?: boolean;
}

export const LeadDetailsPanel: React.FC<LeadDetailsPanelProps> = ({
  lead,
  onLogActivity,
  onRefresh,
  onNavigateToQuote,
  hasQuotesSent = false,
  hidePoolOutcome = false,
}) => {
  const [contactOpen, setContactOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [isPrintLetterOpen, setIsPrintLetterOpen] = useState(false);
  
  const previousLeadIdRef = useRef<string | null>(null);

  // Reset state when switching leads
  useEffect(() => {
    if (previousLeadIdRef.current !== lead.id) {
      previousLeadIdRef.current = lead.id;
    }
  }, [lead.id]);

  const handleCall = () => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`);
      if (!lead.is_from_abandoned_cart) {
        onLogActivity(lead.id, 'call', 'Made phone call');
      }
      // Add automated system note for click-to-dial (fire-and-forget)
      addSystemNote(lead.id, `📞 Click-to-dial: ${lead.phone}`);
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmail = () => {
    const subject = 'Your Warranty Quote';
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
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
            {/* Expand/Collapse Chevron - Click to toggle notes section only */}
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-10 w-10 flex-shrink-0 transition-all duration-100",
                "bg-muted text-muted-foreground border-2 border-border hover:bg-muted/80 hover:text-foreground"
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
              
              {/* Mark as Paid - navigate to Confirm External Payment workflow */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onNavigateToQuote) {
                    onNavigateToQuote(lead);
                  } else {
                    setIsMarkPaidDialogOpen(true);
                  }
                }}
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Mark as Paid
              </Button>
              
              {/* Print Confirmation Letter */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsPrintLetterOpen(true); 
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print Letter
              </Button>
              
              {/* Block Marketing Emails */}
              <div onClick={(e) => e.stopPropagation()}>
                <EmailBlockButton
                  email={lead.email}
                  customerName={displayName || undefined}
                  vehicleReg={lead.vehicle_reg || undefined}
                  source="lead"
                  size="sm"
                />
              </div>

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
                      <Badge variant="outline">Claim: £{getDisplayClaimLimitValue(lead.cart_metadata.claim_limit).toLocaleString()}</Badge>
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

          {/* Duplicate siblings by phone/email */}
          <LeadDuplicatesPanel
            leadId={lead.id}
            phone={lead.phone}
            email={lead.email}
          />



          {/* Commission Claims Section - available to all users for PAID leads */}
          {lead.is_paid && (
            <div className="px-4 pt-3">
              <CommissionClaimDialog
                customerId={lead.id}
                leadId={lead.id}
                agentId={lead.assigned_to || ''}
                customerName={displayName || lead.email}
                dealValue={lead.payment_amount || undefined}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50">
                    <Award className="h-4 w-4" />
                    Claim Commission for This Sale
                  </Button>
                }
              />
              <CommissionClaimReviewPanel
                customerId={lead.id}
                isAdmin={false}
              />
            </div>
          )}

          {/* Notes Content - Always mounted to preserve state, hidden when collapsed */}
          <div className={cn("p-4", !notesOpen && "hidden")}>
            <UnifiedNotesPanel leadId={lead.id} hidePoolOutcome={hidePoolOutcome} />
          </div>
        </CardContent>
      </Card>

      {/* Mark as Paid Dialog */}
      <MarkAsPaidDialog
        lead={lead}
        open={isMarkPaidDialogOpen}
        onOpenChange={setIsMarkPaidDialogOpen}
        onSuccess={onRefresh}
        onNavigateToQuote={onNavigateToQuote ? () => onNavigateToQuote(lead) : undefined}
      />

      {/* Print Warranty Letter Dialog */}
      <PrintableWarrantyLetter
        open={isPrintLetterOpen}
        onOpenChange={setIsPrintLetterOpen}
        policy={{
          customerName: lead.first_name && lead.last_name 
            ? `${lead.first_name} ${lead.last_name}` 
            : lead.full_name || lead.email,
          customerEmail: lead.email,
          vehicleReg: lead.vehicle_reg || '',
          vehicleMake: lead.vehicle_make || undefined,
          vehicleModel: lead.vehicle_model || undefined,
          vehicleYear: lead.vehicle_year || undefined,
          mileage: lead.mileage || undefined,
          warrantyNumber: '',
          policyNumber: '',
          planType: lead.plan_name || lead.plan_interest || 'N/A',
          policyStartDate: new Date().toISOString(),
          policyEndDate: new Date().toISOString(),
          claimLimit: lead.cart_metadata?.claim_limit,
          voluntaryExcess: lead.cart_metadata?.voluntary_excess,
        }}
      />
    </div>
  );
};
