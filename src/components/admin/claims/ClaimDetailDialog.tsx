import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, MessageSquare, Paperclip, Calendar, User, Mail, Phone, Car, CreditCard, Download, Clock, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClaimCommunicationsPanel } from './ClaimCommunicationsPanel';
import { ClaimEmailDialog } from './ClaimEmailDialog';
import { ClaimStatusDropdown } from './ClaimStatusDropdown';
import { ClaimPriorityBadge } from './ClaimPriorityBadge';

interface ClaimDetailDialogProps {
  claim: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ClaimDetailDialog: React.FC<ClaimDetailDialogProps> = ({ claim, open, onOpenChange, onUpdate }) => {
  const { toast } = useToast();
  const [internalNotes, setInternalNotes] = useState(claim?.internal_notes || '');
  const [paymentAmount, setPaymentAmount] = useState(claim?.payment_amount || 0);
  const [rejectionReason, setRejectionReason] = useState(claim?.rejection_reason || '');
  const [loading, setLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const getDaysSinceClaim = (createdAt: string) => {
    const claimDate = new Date(createdAt);
    const today = new Date();
    const diffTime = today.getTime() - claimDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleApproveClaim = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          status: 'approved',
          payment_amount: paymentAmount,
          approved_at: new Date().toISOString(),
          internal_notes: internalNotes,
        })
        .eq('id', claim.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Claim approved successfully",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving claim:', error);
      toast({
        title: "Error",
        description: "Failed to approve claim",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          rejected_at: new Date().toISOString(),
          internal_notes: internalNotes,
        })
        .eq('id', claim.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Claim rejected",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast({
        title: "Error",
        description: "Failed to reject claim",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMoreInfo = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          status: 'awaiting_info',
          internal_notes: internalNotes,
        })
        .eq('id', claim.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status updated to awaiting information",
      });
      onUpdate();
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        title: "Error",
        description: "Failed to update claim status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          internal_notes: internalNotes,
        })
        .eq('id', claim.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Internal notes saved",
      });
      onUpdate();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    const { data } = supabase.storage
      .from('policy-documents')
      .getPublicUrl(fileUrl);
    
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!claim) return null;

  const daysSinceClaim = getDaysSinceClaim(claim.created_at);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Claim Details</span>
                <ClaimStatusDropdown
                  claimId={claim.id}
                  currentTagId={claim.tag_id}
                  currentStatus={claim.status}
                  onUpdate={onUpdate}
                />
                <ClaimPriorityBadge priority={claim.priority || 'normal'} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold ${
                  daysSinceClaim <= 3 ? 'text-green-600 bg-green-50' :
                  daysSinceClaim <= 7 ? 'text-yellow-600 bg-yellow-50' :
                  daysSinceClaim <= 14 ? 'text-orange-600 bg-orange-50' :
                  'text-red-600 bg-red-50'
                }`}>
                  <Clock className="h-4 w-4" />
                  {daysSinceClaim} days old
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailDialog(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Email Claims
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Submitted on {new Date(claim.created_at).toLocaleString('en-GB')}
              {claim.last_contacted_at && (
                <span className="ml-2 text-xs">
                  • Last contacted: {new Date(claim.last_contacted_at).toLocaleString('en-GB')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Claim Details</TabsTrigger>
              <TabsTrigger value="communications">Communications</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <Label className="text-sm text-gray-600">Name</Label>
                    <p className="font-medium">{claim.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Email</Label>
                    <p className="font-medium">
                      <a href={`mailto:${claim.email}`} className="text-blue-600 hover:underline">
                        {claim.email}
                      </a>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Phone</Label>
                    <p className="font-medium">
                      {claim.phone ? (
                        <a href={`tel:${claim.phone}`} className="text-blue-600 hover:underline">
                          {claim.phone}
                        </a>
                      ) : 'Not provided'}
                    </p>
                  </div>
                  {claim.vehicle_registration && (
                    <div>
                      <Label className="text-sm text-gray-600">Vehicle Registration</Label>
                      <p className="font-medium font-mono bg-white px-2 py-1 rounded inline-block">
                        {claim.vehicle_registration}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Assessment Banner */}
              {(claim.days_on_risk !== null || claim.mileage_driven !== null) && (
                <>
                  <Separator />
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3 text-amber-800">⚠️ Risk Assessment</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {claim.days_on_risk !== null && claim.days_on_risk !== undefined && (
                        <div className="text-center bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-2xl font-bold text-amber-700">{claim.days_on_risk.toLocaleString()}</p>
                          <p className="text-xs text-amber-600 font-medium">Days on Risk</p>
                        </div>
                      )}
                      {claim.mileage_driven !== null && claim.mileage_driven !== undefined && (
                        <div className="text-center bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-2xl font-bold text-amber-700">{claim.mileage_driven.toLocaleString()}</p>
                          <p className="text-xs text-amber-600 font-medium">Miles Since Purchase</p>
                        </div>
                      )}
                      {claim.purchase_mileage && (
                        <div className="text-center bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-2xl font-bold text-gray-700">{claim.purchase_mileage.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 font-medium">Mileage at Purchase</p>
                        </div>
                      )}
                      {claim.warranty_start_date && (
                        <div className="text-center bg-white rounded-lg p-3 border border-amber-200">
                          <p className="text-lg font-bold text-gray-700">{new Date(claim.warranty_start_date).toLocaleDateString('en-GB')}</p>
                          <p className="text-xs text-gray-500 font-medium">Warranty Started</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Claim Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Claim Details
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  {claim.warranty_type && (
                    <div>
                      <Label className="text-sm text-gray-600">Warranty Type</Label>
                      <p className="font-medium">{claim.warranty_type}</p>
                    </div>
                  )}
                  {claim.claim_reason && (
                    <div>
                      <Label className="text-sm text-gray-600">Claim Reason</Label>
                      <p className="font-medium">{claim.claim_reason}</p>
                    </div>
                  )}
                  {claim.date_of_incident && (
                    <div>
                      <Label className="text-sm text-gray-600">Date of Incident</Label>
                      <p className="font-medium">{new Date(claim.date_of_incident).toLocaleDateString('en-GB')}</p>
                    </div>
                  )}
                  {claim.mileage_at_claim && (
                    <div>
                      <Label className="text-sm text-gray-600">Mileage at Claim</Label>
                      <p className="font-medium">{claim.mileage_at_claim.toLocaleString()} miles</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              {claim.message && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Customer Message
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="whitespace-pre-wrap text-gray-700">{claim.message}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Attachment */}
              {claim.file_url && claim.file_name && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Paperclip className="h-5 w-5" />
                      Attachment
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-gray-400" />
                        <span>{claim.file_name}</span>
                        {claim.file_size && (
                          <span className="text-sm text-gray-500">
                            ({(claim.file_size / 1024).toFixed(2)} KB)
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(claim.file_url, claim.file_name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Payment Information */}
              {(claim.status === 'approved' || claim.status === 'paid') && claim.payment_amount > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Information
                    </h3>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Payment Amount</span>
                        <span className="text-2xl font-bold text-green-600">
                          £{claim.payment_amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {claim.paid_at && (
                        <p className="text-sm text-gray-600 mt-2">
                          Paid on: {new Date(claim.paid_at).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Rejection Reason */}
              {claim.status === 'rejected' && claim.rejection_reason && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-red-600">Rejection Reason</h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-gray-700">{claim.rejection_reason}</p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="communications" className="mt-4">
              <ClaimCommunicationsPanel claimId={claim.id} onRefresh={onUpdate} />
            </TabsContent>

            <TabsContent value="actions" className="space-y-6 mt-4">
              {/* Internal Notes */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Internal Notes</h3>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Add internal notes for this claim (not visible to customer)..."
                  rows={4}
                  className="w-full"
                />
                <Button 
                  onClick={handleSaveNotes} 
                  className="mt-2"
                  variant="outline"
                  disabled={loading}
                >
                  Save Notes
                </Button>
              </div>

              {/* Action Buttons */}
              {claim.status !== 'approved' && claim.status !== 'rejected' && claim.status !== 'paid' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Claim Actions</h3>
                    
                    {/* Approve Section */}
                    <div className="space-y-2">
                      <Label>Approve Claim</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                            placeholder="Payment amount (£)"
                          />
                        </div>
                        <Button 
                          onClick={handleApproveClaim}
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve & Set Amount
                        </Button>
                      </div>
                    </div>

                    {/* Reject Section */}
                    <div className="space-y-2">
                      <Label>Reject Claim</Label>
                      <div className="flex gap-2">
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          rows={2}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleRejectClaim}
                          disabled={loading}
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>

                    {/* Request More Info */}
                    <div>
                      <Button 
                        onClick={handleRequestMoreInfo}
                        disabled={loading}
                        variant="outline"
                        className="w-full"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Request More Information
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      {showEmailDialog && (
        <ClaimEmailDialog
          claim={claim}
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          onEmailSent={onUpdate}
        />
      )}
    </>
  );
};
