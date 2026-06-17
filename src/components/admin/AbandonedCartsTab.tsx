import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';
import { FollowUpEmailDialog } from './FollowUpEmailDialog';
import { AbandonedCartExportPanel, buildAbandonedCartCsv, downloadAbandonedCartCsv } from './AbandonedCartExportPanel';
import { 
  ShoppingCart, 
  Mail, 
  Phone, 
  Car, 
  Calendar, 
  Search,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MapPin,
  Shield,
  Download
} from 'lucide-react';

interface AbandonedCart {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  vehicle_reg: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  mileage: string | null;
  plan_name: string | null;
  payment_type: string | null;
  vehicle_type: string | null;
  step_abandoned: number;
  contact_status: string;
  contact_notes: string | null;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
  contacted_by: string | null;
  is_converted?: boolean | null;
  converted_at?: string | null;
  cart_metadata?: {
    total_price?: number;
    voluntary_excess?: number;
    claim_limit?: number;
    address?: {
      flat_number?: string;
      building_name?: string;
      building_number?: string;
      street?: string;
      town?: string;
      county?: string;
      postcode?: string;
      country?: string;
    };
    protection_addons?: {
      breakdown?: boolean;
      motFee?: boolean;
      motRepair?: boolean;
      wearTear?: boolean;
      tyre?: boolean;
      european?: boolean;
      rental?: boolean;
      transfer?: boolean;
      lostKey?: boolean;
      consequential?: boolean;
    };
  };
}

interface CartEmail {
  id: string;
  email_type: 'customer_quote' | 'admin_followup';
  subject: string;
  sent_at: string;
  vehicle_reg: string | null;
  plan_name: string | null;
  price_amount: number | null;
}

const normalizeEmail = (email: string | null | undefined) => (email || '').trim().toLowerCase();
const normalizeReg = (reg: string | null | undefined) => (reg || '').replace(/\s+/g, '').toUpperCase();

export const AbandonedCartsTab: React.FC = () => {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [rawCartCount, setRawCartCount] = useState(0);
  const [removedConvertedCount, setRemovedConvertedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [contactNotes, setContactNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [newCartsCount, setNewCartsCount] = useState(0);
  const [cartEmails, setCartEmails] = useState<Record<string, CartEmail[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchAbandonedCarts();
    fetchAllCartEmails();
    
    // Set up real-time subscription for new abandoned carts
    const channel = supabase
      .channel('abandoned_carts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'abandoned_carts'
        },
        (payload) => {
          console.log('New abandoned cart:', payload);
          setNewCartsCount(prev => prev + 1);
          toast.info('New abandoned cart detected!', {
            description: `Customer: ${(payload.new as AbandonedCart).email}`,
            duration: 5000,
            action: {
              label: 'Refresh',
              onClick: () => {
                fetchAbandonedCarts();
                fetchAllCartEmails();
              },
            },
          });
          // Don't auto-refetch on every insert — it re-renders the whole page
          // (including the export panel) and makes dropdowns/buttons unresponsive
          // under live traffic. The user can click Refresh when ready.
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAbandonedCarts = async () => {
    try {
      // Paginate to bypass Supabase 1000-row default limit
      const pageSize = 1000;
      let offset = 0;
      const all: AbandonedCart[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('abandoned_carts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as AbandonedCart[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 50000) break; // hard safety cap
      }

      setRawCartCount(all.length);

      // Only exclude carts that match a real active warranty customer
      // (status = 'Active'). This matches what's visible in the Customers
      // dashboard and prevents the count being inflated by quote payments,
      // unconverted records, or cancelled/refunded customers.
      const purchasedEmails = new Set<string>();
      const purchasedRegs = new Set<string>();
      let cOffset = 0;
      while (true) {
        const { data: cust, error: cErr } = await supabase
          .from('customers')
          .select('email,registration_plate')
          .eq('is_deleted', false)
          .ilike('status', 'active')
          .range(cOffset, cOffset + pageSize - 1);
        if (cErr) break;
        const crows = (cust || []) as { email: string | null; registration_plate: string | null }[];
        crows.forEach(c => {
          const email = normalizeEmail(c.email);
          const reg = normalizeReg(c.registration_plate);
          if (email) purchasedEmails.add(email);
          if (reg) purchasedRegs.add(reg);
        });
        if (crows.length < pageSize) break;
        cOffset += pageSize;
        if (cOffset > 100000) break;
      }

      const remarketable = all.filter(c => {
        const e = normalizeEmail(c.email);
        const reg = normalizeReg(c.vehicle_reg);
        const cartStatus = (c.contact_status || '').toLowerCase();
        return (
          e &&
          !c.is_converted &&
          !c.converted_at &&
          cartStatus !== 'converted' &&
          !purchasedEmails.has(e) &&
          (!reg || !purchasedRegs.has(reg))
        );
      });

      setRemovedConvertedCount(all.length - remarketable.length);
      setCarts(remarketable);
      setNewCartsCount(0);
    } catch (error) {
      console.error('Error fetching abandoned carts:', error);
      toast.error('Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCartEmails = async () => {
    try {
      // Limit to the last 90 days to avoid pulling 15k+ rows and freezing the page.
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('abandoned_cart_emails')
        .select('*')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      // Group emails by cart ID and customer email
      const emailsMap: Record<string, CartEmail[]> = {};
      (data || []).forEach((email: any) => {
        const key = email.abandoned_cart_id || email.customer_email;
        if (!emailsMap[key]) {
          emailsMap[key] = [];
        }
        emailsMap[key].push(email as CartEmail);
      });
      setCartEmails(emailsMap);
    } catch (error) {
      console.error('Error fetching cart emails:', error);
    }
  };

  const getCartEmailHistory = (cart: AbandonedCart): CartEmail[] => {
    return cartEmails[cart.id] || cartEmails[cart.email] || [];
  };

  const updateContactStatus = async (cartId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_status: status,
          last_contacted_at: new Date().toISOString()
        })
        .eq('id', cartId);

      if (error) throw error;

      toast.success('Status updated successfully');
      fetchAbandonedCarts();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const saveContactNotes = async () => {
    if (!selectedCart) return;

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .update({ 
          contact_notes: contactNotes,
          last_contacted_at: new Date().toISOString()
        })
        .eq('id', selectedCart.id);

      if (error) throw error;

      toast.success('Notes saved successfully');
      fetchAbandonedCarts();
      setSelectedCart(null);
      setContactNotes('');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const filteredCarts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) return carts;
    return carts.filter(cart =>
      cart.email?.toLowerCase().includes(searchLower) ||
      cart.full_name?.toLowerCase().includes(searchLower) ||
      cart.vehicle_reg?.toLowerCase().includes(searchLower) ||
      cart.vehicle_make?.toLowerCase().includes(searchLower) ||
      cart.vehicle_model?.toLowerCase().includes(searchLower)
    );
  }, [carts, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCarts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCarts = useMemo(
    () => filteredCarts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCarts, safePage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_contacted':
        return 'bg-red-100 text-red-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'converted':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_contacted':
        return <AlertCircle className="w-4 h-4" />;
      case 'contacted':
        return <Clock className="w-4 h-4" />;
      case 'converted':
        return <CheckCircle className="w-4 h-4" />;
      case 'lost':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading abandoned carts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Abandoned Carts</h1>
          <p className="text-gray-600 mt-2">
            Customers who started but did not finish checkout. Anyone who has since purchased is automatically removed.
            Used for remarketing exports to Google and Facebook. Live outreach is handled in the Leads section.
          </p>
        </div>
        {newCartsCount > 0 && (
          <Badge className="bg-red-500 text-white text-lg px-4 py-2">
            {newCartsCount} New
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total captured carts</p>
                <p className="text-2xl font-bold">{rawCartCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">full database count, not capped at 1000</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Remarketable carts</p>
                <p className="text-2xl font-bold text-blue-600">{carts.length.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">ready for Google / Facebook export</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Removed purchasers</p>
                <p className="text-2xl font-bold text-purple-600">{removedConvertedCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">matched to a paid customer (excludes cancelled & refunded)</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remarketing Export Panel */}
      <AbandonedCartExportPanel candidateCarts={carts as any} />


      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search by email, name, registration, or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={fetchAbandonedCarts} variant="outline">
          Refresh
        </Button>
        <Button
          onClick={() => downloadAbandonedCartCsv(buildAbandonedCartCsv(carts as any, 'google'), `abandoned-carts-google-all-${new Date().toISOString().slice(0, 10)}.csv`)}
          disabled={carts.length === 0}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Full Google CSV
        </Button>
        <Button
          onClick={() => downloadAbandonedCartCsv(buildAbandonedCartCsv(carts as any, 'facebook'), `abandoned-carts-facebook-all-${new Date().toISOString().slice(0, 10)}.csv`)}
          disabled={carts.length === 0}
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Full Facebook CSV
        </Button>
      </div>

      {/* Carts List */}
      <div className="text-sm text-gray-600">
        Showing {filteredCarts.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
        –{Math.min(safePage * PAGE_SIZE, filteredCarts.length)} of {filteredCarts.length.toLocaleString()}
        {searchTerm && ` (filtered from ${carts.length.toLocaleString()})`}
      </div>
      <div className="grid gap-4">
        {pagedCarts.map((cart) => (
          <Card key={cart.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Customer Info */}
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {cart.full_name || 'Anonymous Customer'}
                    </h3>
                    <Badge className={getStatusColor(cart.contact_status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(cart.contact_status)}
                        {cart.contact_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{cart.email}</span>
                    </div>
                    {cart.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{cart.phone}</span>
                      </div>
                    )}
                    {cart.vehicle_reg && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Car className="w-4 h-4" />
                        <span>
                          {cart.vehicle_reg} - {cart.vehicle_make} {cart.vehicle_model} ({cart.vehicle_year})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(cart.created_at).toLocaleDateString()} at{' '}
                        {new Date(cart.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Plan Info with Pricing */}
                  {cart.plan_name && (
                    <div className="bg-gray-50 p-3 rounded space-y-2">
                      <p className="text-sm font-medium">Selected Plan</p>
                      <p className="text-sm text-gray-600">
                        {cart.plan_name} - {cart.payment_type} 
                        {cart.mileage && ` | ${parseInt(cart.mileage).toLocaleString()} miles`}
                      </p>
                      {cart.cart_metadata?.total_price && (
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold text-green-600">
                            Total Price: £{cart.cart_metadata.total_price.toFixed(2)}
                          </p>
                          {cart.cart_metadata.voluntary_excess && (
                            <p className="text-xs text-gray-600">
                              Voluntary Excess: £{cart.cart_metadata.voluntary_excess}
                            </p>
                          )}
                          {cart.cart_metadata.claim_limit && (
                            <p className="text-xs text-gray-600">
                              Claim Limit: £{getDisplayClaimLimitValue(cart.cart_metadata.claim_limit).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Abandoned at step {cart.step_abandoned}
                      </p>
                    </div>
                  )}

                  {/* Address Information */}
                  {cart.cart_metadata?.address && (
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Customer Address
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {[
                          cart.cart_metadata.address.flat_number,
                          cart.cart_metadata.address.building_name,
                          cart.cart_metadata.address.building_number,
                          cart.cart_metadata.address.street,
                          cart.cart_metadata.address.town,
                          cart.cart_metadata.address.county,
                          cart.cart_metadata.address.postcode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Protection Add-ons */}
                  {cart.cart_metadata?.protection_addons && 
                   Object.values(cart.cart_metadata.protection_addons).some(v => v) && (
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Selected Add-ons
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {cart.cart_metadata.protection_addons.breakdown && (
                          <Badge variant="secondary" className="text-xs">Breakdown Recovery</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.motFee && (
                          <Badge variant="secondary" className="text-xs">MOT Fee</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.motRepair && (
                          <Badge variant="secondary" className="text-xs">MOT Repair</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.wearTear && (
                          <Badge variant="secondary" className="text-xs">Wear & Tear</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.tyre && (
                          <Badge variant="secondary" className="text-xs">Tyre Cover</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.european && (
                          <Badge variant="secondary" className="text-xs">European Cover</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.rental && (
                          <Badge variant="secondary" className="text-xs">Vehicle Rental</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.transfer && (
                          <Badge variant="secondary" className="text-xs">Transfer Cover</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.lostKey && (
                          <Badge variant="secondary" className="text-xs">Lost Key</Badge>
                        )}
                        {cart.cart_metadata.protection_addons.consequential && (
                          <Badge variant="secondary" className="text-xs">Consequential Loss</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Email History */}
                  {getCartEmailHistory(cart).length > 0 && (
                    <div className="bg-orange-50 p-3 rounded">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email History ({getCartEmailHistory(cart).length})
                      </p>
                      <div className="space-y-2 mt-2">
                        {getCartEmailHistory(cart).map((email) => (
                          <div key={email.id} className="text-xs bg-white p-2 rounded border">
                            <div className="flex items-center gap-2 justify-between">
                              <Badge 
                                variant="outline" 
                                className={email.email_type === 'customer_quote' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : 'bg-green-50 text-green-700 border-green-200'
                                }
                              >
                                {email.email_type === 'customer_quote' ? 'Customer Request' : 'Admin Follow-up'}
                              </Badge>
                              <span className="text-gray-500">
                                {new Date(email.sent_at).toLocaleDateString('en-GB')} {new Date(email.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-gray-700 mt-1 truncate" title={email.subject}>{email.subject}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Notes */}
                  {cart.contact_notes && (
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Contact Notes
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{cart.contact_notes}</p>
                      {cart.last_contacted_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last contacted: {new Date(cart.last_contacted_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedCart(cart);
                      setContactNotes(cart.contact_notes || '');
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>

                  {/* Follow-up Email Button */}
                  <FollowUpEmailDialog
                    cartId={cart.id}
                    customerEmail={cart.email}
                    customerName={cart.full_name}
                    vehicleReg={cart.vehicle_reg}
                    vehicleMake={cart.vehicle_make}
                    vehicleModel={cart.vehicle_model}
                    planName={cart.plan_name}
                    totalPrice={cart.cart_metadata?.total_price}
                    onEmailSent={fetchAllCartEmails}
                  />
                  
                  {cart.contact_status === 'not_contacted' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateContactStatus(cart.id, 'contacted')}
                    >
                      Mark Contacted
                    </Button>
                  )}
                  
                  {cart.contact_status === 'contacted' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600"
                        onClick={() => updateContactStatus(cart.id, 'converted')}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Converted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-gray-600"
                        onClick={() => updateContactStatus(cart.id, 'lost')}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Lost
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCarts.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No abandoned carts found
              </h3>
              <p className="text-gray-600">
                {searchTerm ? 'Try a different search term' : 'Abandoned carts will appear here'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {safePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Contact Notes Modal */}
      {selectedCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Add Contact Notes</CardTitle>
              <p className="text-sm text-gray-600">
                {selectedCart.full_name || selectedCart.email}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Enter your notes about the contact attempt..."
                rows={6}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCart(null);
                    setContactNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveContactNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
