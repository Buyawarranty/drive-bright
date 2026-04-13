import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PoundSterling, FileText, Plus, AlertCircle, CheckCircle2, Clock, X, Eye, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { AddClaimDialog } from './AddClaimDialog';

interface Claim {
  id: string;
  claim_reason: string | null;
  payment_amount: number | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  vehicle_registration: string | null;
}

interface CustomerClaimsSummaryProps {
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  vehicleReg?: string;
  onClaimAdded?: () => void;
  compact?: boolean;
  showOnly?: 'claimsMade' | 'claimsPaid'; // For separate column display
}

export const CustomerClaimsSummary: React.FC<CustomerClaimsSummaryProps> = ({
  customerId,
  customerEmail,
  customerName,
  vehicleReg,
  onClaimAdded,
  compact = false,
  showOnly
}) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchClaims = async () => {
    if (!customerEmail && !vehicleReg) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('claims_submissions')
        .select('id, claim_reason, payment_amount, status, created_at, paid_at, vehicle_registration')
        .order('created_at', { ascending: false });

      // Match by email OR vehicle registration
      if (customerEmail && vehicleReg) {
        query = query.or(`email.ilike.${customerEmail},vehicle_registration.ilike.${vehicleReg}`);
      } else if (customerEmail) {
        query = query.ilike('email', customerEmail);
      } else if (vehicleReg) {
        query = query.ilike('vehicle_registration', vehicleReg);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      console.error('Error fetching customer claims:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [customerEmail, vehicleReg]);

  const totalClaims = claims.length;
  const totalPaid = claims.reduce((sum, c) => sum + (c.payment_amount || 0), 0);
  const paidClaims = claims.filter(c => c.status === 'paid').length;
  const pendingClaims = claims.filter(c => ['new', 'in_progress', 'awaiting_info', 'approved'].includes(c.status)).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><AlertCircle className="w-3 h-3 mr-1" />New</Badge>;
    }
  };

  const handleClaimAdded = () => {
    fetchClaims();
    onClaimAdded?.();
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-24" />
    );
  }

  // Single metric view for separate columns
  if (showOnly === 'claimsMade') {
    const searchTerm = vehicleReg || customerEmail || '';
    return (
      <div className="flex flex-col gap-1">
        <Badge
          variant="outline"
          className="font-mono cursor-pointer hover:bg-accent transition-colors"
          onClick={() => {
            window.location.href = `/admin-dashboard/?tab=claims&search=${encodeURIComponent(searchTerm)}`;
          }}
          title="Click to view claim details"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          {totalClaims} claim{totalClaims !== 1 ? 's' : ''}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Claim
        </Button>
        <AddClaimDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          customerEmail={customerEmail}
          customerName={customerName}
          vehicleReg={vehicleReg}
          onClaimAdded={handleClaimAdded}
        />
      </div>
    );
  }

  if (showOnly === 'claimsPaid') {
    return (
      <Badge className="bg-green-100 text-green-700 font-mono">
        £{totalPaid.toLocaleString()}
      </Badge>
    );
  }

  // Compact view for table columns (legacy - shows both)
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {totalClaims} claim{totalClaims !== 1 ? 's' : ''}
          </Badge>
          <Badge className="bg-green-100 text-green-700 font-mono">
            £{totalPaid.toLocaleString()}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Claim
        </Button>
        <AddClaimDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          customerEmail={customerEmail}
          customerName={customerName}
          vehicleReg={vehicleReg}
          onClaimAdded={handleClaimAdded}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-orange" />
            Claims History
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="h-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Claim
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-brand-deep-blue">{totalClaims}</p>
            <p className="text-xs text-muted-foreground">Total Claims</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">£{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Paid Out</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingClaims}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Claims List */}
        {claims.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Recent Claims</h4>
              {claims.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-6 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {expanded ? 'Show Less' : `View All (${claims.length})`}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {(expanded ? claims : claims.slice(0, 3)).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {claim.claim_reason || 'No reason specified'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(claim.created_at), 'dd MMM yyyy')}
                      {claim.paid_at && ` • Paid ${format(new Date(claim.paid_at), 'dd MMM yyyy')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(claim.status)}
                    {claim.payment_amount && claim.payment_amount > 0 && (
                      <Badge className="bg-green-100 text-green-700 font-mono">
                        £{claim.payment_amount.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {claims.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No claims recorded for this customer</p>
          </div>
        )}

        <AddClaimDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          customerEmail={customerEmail}
          customerName={customerName}
          vehicleReg={vehicleReg}
          onClaimAdded={handleClaimAdded}
        />
      </CardContent>
    </Card>
  );
};
