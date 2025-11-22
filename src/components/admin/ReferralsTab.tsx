import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Referral {
  id: string;
  referrer_email: string;
  referrer_name: string | null;
  friend_email: string;
  discount_code: string | null;
  status: string;
  converted_at: string | null;
  created_at: string;
}

export const ReferralsTab = () => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (error: any) {
      console.error('Error fetching referrals:', error);
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, convertedAt: string | null) => {
    if (convertedAt) {
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Converted
        </Badge>
      );
    }
    
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-blue-500 text-white">
            <Mail className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500 text-white">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500 text-white">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredReferrals = referrals.filter(referral =>
    referral.referrer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    referral.friend_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (referral.referrer_name && referral.referrer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (referral.discount_code && referral.discount_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: referrals.length,
    converted: referrals.filter(r => r.converted_at).length,
    pending: referrals.filter(r => !r.converted_at && r.status === 'sent').length,
    conversionRate: referrals.length > 0 
      ? ((referrals.filter(r => r.converted_at).length / referrals.length) * 100).toFixed(1)
      : '0'
  };

  if (loading) {
    return <div className="p-6">Loading referrals...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Referral Tracking</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search referrals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Friend Email</TableHead>
                  <TableHead>Discount Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Converted Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No referrals found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.referrer_name || 'Anonymous'}</div>
                          <div className="text-sm text-muted-foreground">{referral.referrer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{referral.friend_email}</TableCell>
                      <TableCell>
                        {referral.discount_code && (
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {referral.discount_code}
                          </code>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status, referral.converted_at)}</TableCell>
                      <TableCell>
                        {format(new Date(referral.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        {referral.converted_at ? (
                          format(new Date(referral.converted_at), 'MMM dd, yyyy')
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};