import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, Star, CheckCircle2, XCircle, Clock, Filter, RefreshCw, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface CustomerReviewData {
  id: string;
  name: string;
  email: string;
  registration_plate: string | null;
  plan_type: string;
  signup_date: string;
  has_claim: boolean;
  claim_count: number;
  trustpilot_review_requested: boolean;
  trustpilot_review_requested_at: string | null;
  trustpilot_review_completed: boolean;
  trustpilot_review_completed_at: string | null;
  google_review_requested: boolean;
  google_review_requested_at: string | null;
  google_review_completed: boolean;
  google_review_completed_at: string | null;
}

export const ReviewsTab = () => {
  const [customers, setCustomers] = useState<CustomerReviewData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const [trustpilotFilter, setTrustpilotFilter] = useState<string>('all');
  const [googleFilter, setGoogleFilter] = useState<string>('all');

  const fetchCustomersWithClaims = async () => {
    setLoading(true);
    try {
      // Fetch customers with review fields
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          registration_plate,
          plan_type,
          signup_date,
          trustpilot_review_requested,
          trustpilot_review_requested_at,
          trustpilot_review_completed,
          trustpilot_review_completed_at,
          google_review_requested,
          google_review_requested_at,
          google_review_completed,
          google_review_completed_at
        `)
        .eq('is_deleted', false)
        .order('signup_date', { ascending: false });

      if (customersError) throw customersError;

      // Fetch claims to determine which customers have made claims
      const { data: claimsData, error: claimsError } = await supabase
        .from('claims_submissions')
        .select('email, id');

      if (claimsError) throw claimsError;

      // Count claims per email
      const claimCountByEmail: Record<string, number> = {};
      claimsData?.forEach(claim => {
        const email = claim.email.toLowerCase();
        claimCountByEmail[email] = (claimCountByEmail[email] || 0) + 1;
      });

      // Combine data
      const combinedData: CustomerReviewData[] = (customersData || []).map(customer => ({
        ...customer,
        has_claim: claimCountByEmail[customer.email.toLowerCase()] > 0,
        claim_count: claimCountByEmail[customer.email.toLowerCase()] || 0,
        trustpilot_review_requested: customer.trustpilot_review_requested || false,
        trustpilot_review_completed: customer.trustpilot_review_completed || false,
        google_review_requested: customer.google_review_requested || false,
        google_review_completed: customer.google_review_completed || false,
      }));

      setCustomers(combinedData);
      setFilteredCustomers(combinedData);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomersWithClaims();
  }, []);

  useEffect(() => {
    let filtered = [...customers];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.registration_plate && c.registration_plate.toLowerCase().includes(term))
      );
    }

    // Claim filter
    if (claimFilter === 'has_claim') {
      filtered = filtered.filter(c => c.has_claim);
    } else if (claimFilter === 'no_claim') {
      filtered = filtered.filter(c => !c.has_claim);
    }

    // Trustpilot filter
    if (trustpilotFilter === 'completed') {
      filtered = filtered.filter(c => c.trustpilot_review_completed);
    } else if (trustpilotFilter === 'requested') {
      filtered = filtered.filter(c => c.trustpilot_review_requested && !c.trustpilot_review_completed);
    } else if (trustpilotFilter === 'not_requested') {
      filtered = filtered.filter(c => !c.trustpilot_review_requested);
    }

    // Google filter
    if (googleFilter === 'completed') {
      filtered = filtered.filter(c => c.google_review_completed);
    } else if (googleFilter === 'requested') {
      filtered = filtered.filter(c => c.google_review_requested && !c.google_review_completed);
    } else if (googleFilter === 'not_requested') {
      filtered = filtered.filter(c => !c.google_review_requested);
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, claimFilter, trustpilotFilter, googleFilter, customers]);

  const updateReviewStatus = async (
    customerId: string,
    field: 'trustpilot_review_requested' | 'trustpilot_review_completed' | 'google_review_requested' | 'google_review_completed',
    value: boolean
  ) => {
    try {
      const updateData: Record<string, any> = { [field]: value };
      
      // Add timestamp if marking as true
      if (value) {
        const timestampField = field + '_at';
        updateData[timestampField] = new Date().toISOString();
      }

      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId);

      if (error) throw error;

      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId 
          ? { ...c, [field]: value, [field + '_at']: value ? new Date().toISOString() : null }
          : c
      ));

      toast.success('Review status updated');
    } catch (error) {
      console.error('Error updating review status:', error);
      toast.error('Failed to update review status');
    }
  };

  const getReviewStatusBadge = (requested: boolean, completed: boolean) => {
    if (completed) {
      return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (requested) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Requested</Badge>;
    }
    return <Badge variant="outline" className="border-muted-foreground text-muted-foreground"><XCircle className="h-3 w-3 mr-1" />Not Requested</Badge>;
  };

  // Calculate stats
  const stats = {
    total: customers.length,
    withClaims: customers.filter(c => c.has_claim).length,
    trustpilotCompleted: customers.filter(c => c.trustpilot_review_completed).length,
    trustpilotRequested: customers.filter(c => c.trustpilot_review_requested && !c.trustpilot_review_completed).length,
    googleCompleted: customers.filter(c => c.google_review_completed).length,
    googleRequested: customers.filter(c => c.google_review_requested && !c.google_review_completed).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Monitoring</h1>
          <p className="text-muted-foreground">Track Trustpilot and Google reviews from customers</p>
        </div>
        <Button onClick={fetchCustomersWithClaims} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">{stats.withClaims}</div>
            <p className="text-xs text-muted-foreground">With Claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.trustpilotCompleted}</div>
            <p className="text-xs text-muted-foreground">Trustpilot Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.trustpilotRequested}</div>
            <p className="text-xs text-muted-foreground">Trustpilot Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.googleCompleted}</div>
            <p className="text-xs text-muted-foreground">Google Reviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.googleRequested}</div>
            <p className="text-xs text-muted-foreground">Google Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email or reg..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={claimFilter} onValueChange={setClaimFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Claims" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="has_claim">Has Made Claim</SelectItem>
                <SelectItem value="no_claim">No Claims</SelectItem>
              </SelectContent>
            </Select>
            <Select value={trustpilotFilter} onValueChange={setTrustpilotFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trustpilot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trustpilot</SelectItem>
                <SelectItem value="completed">Review Completed</SelectItem>
                <SelectItem value="requested">Requested Only</SelectItem>
                <SelectItem value="not_requested">Not Requested</SelectItem>
              </SelectContent>
            </Select>
            <Select value={googleFilter} onValueChange={setGoogleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Google" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Google</SelectItem>
                <SelectItem value="completed">Review Completed</SelectItem>
                <SelectItem value="requested">Requested Only</SelectItem>
                <SelectItem value="not_requested">Not Requested</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Reviews ({filteredCustomers.length})</CardTitle>
          <CardDescription>
            Click the checkboxes to mark review requests sent or reviews completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Signup Date</TableHead>
                    <TableHead>Claims</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 text-green-600" />
                        Trustpilot
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 text-blue-600" />
                        Google
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">{customer.email}</div>
                          {customer.registration_plate && (
                            <div className="text-xs text-muted-foreground">{customer.registration_plate}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.plan_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(customer.signup_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {customer.has_claim ? (
                          <Badge className="bg-orange-500 hover:bg-orange-600">
                            {customer.claim_count} Claim{customer.claim_count > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">No Claims</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          {getReviewStatusBadge(customer.trustpilot_review_requested, customer.trustpilot_review_completed)}
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={customer.trustpilot_review_requested}
                                onCheckedChange={(checked) => 
                                  updateReviewStatus(customer.id, 'trustpilot_review_requested', !!checked)
                                }
                              />
                              Requested
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={customer.trustpilot_review_completed}
                                onCheckedChange={(checked) => 
                                  updateReviewStatus(customer.id, 'trustpilot_review_completed', !!checked)
                                }
                              />
                              Done
                            </label>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-2">
                          {getReviewStatusBadge(customer.google_review_requested, customer.google_review_completed)}
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={customer.google_review_requested}
                                onCheckedChange={(checked) => 
                                  updateReviewStatus(customer.id, 'google_review_requested', !!checked)
                                }
                              />
                              Requested
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <Checkbox
                                checked={customer.google_review_completed}
                                onCheckedChange={(checked) => 
                                  updateReviewStatus(customer.id, 'google_review_completed', !!checked)
                                }
                              />
                              Done
                            </label>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No customers found matching your filters
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
