import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { DealerStatsCards } from '@/components/dealer/DealerStatsCards';
import { DealerRecentQuotes } from '@/components/dealer/DealerRecentQuotes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { FilePlus, FileText, Shield, Sparkles } from 'lucide-react';

const DealerDashboard = () => {
  const { dealer } = useDealerAuth();
  const navigate = useNavigate();

  const { data: quotes = [] } = useQuery({
    queryKey: ['dealer-quotes', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('dealer_quotes')
        .select('*')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  // Dealer orders = customer rows linked to this dealer (single source of truth)
  const { data: dealerOrders = [] } = useQuery({
    queryKey: ['dealer-orders', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, plan_type, payment_type, final_amount, payment_status, status, signup_date, policy_end_date')
        .eq('dealer_id', dealer.id)
        .order('signup_date', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  const totalQuotes = quotes.length;
  const activeWarranties = dealerOrders.filter((o: any) => o.status === 'active').length;
  const totalOrders = dealerOrders.length;
  const conversionRate = totalQuotes > 0 ? (totalOrders / totalQuotes) * 100 : 0;

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back{dealer?.name ? `, ${dealer.name}` : ''}
          </h1>
          <p className="text-gray-500 text-sm">{dealer?.company_name}</p>
        </div>

        <DealerStatsCards
          totalQuotes={totalQuotes}
          activeWarranties={activeWarranties}
          conversionRate={conversionRate}
        />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/dealer-portal/quote/vehicle')} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Sparkles className="h-4 w-4 mr-2" /> Start full quote
          </Button>
          <Button variant="outline" onClick={() => navigate('/dealer-portal/quotes/create')} className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FilePlus className="h-4 w-4 mr-2" /> Quick quote
          </Button>
          <Button variant="outline" onClick={() => navigate('/dealer-portal/quotes')} className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <FileText className="h-4 w-4 mr-2" /> View quotes
          </Button>
          <Button variant="outline" onClick={() => navigate('/dealer-portal/warranties')} className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            <Shield className="h-4 w-4 mr-2" /> View warranties
          </Button>
        </div>

        {/* Recent dealer orders */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent dealer orders</h2>
            {dealerOrders.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No dealer orders yet. Start a full quote to issue your first warranty.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="text-left py-2 font-medium">Customer</th>
                      <th className="text-left py-2 font-medium">Vehicle</th>
                      <th className="text-left py-2 font-medium">Plan</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-left py-2 font-medium pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dealerOrders.slice(0, 8).map((o: any) => (
                      <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 text-white">{o.name}</td>
                        <td className="py-3 text-gray-300 font-mono text-xs">{o.registration_plate}</td>
                        <td className="py-3 text-gray-300 capitalize">{o.plan_type} · {o.payment_type}mo</td>
                        <td className="py-3 text-right text-white font-semibold">£{Number(o.final_amount || 0).toFixed(2)}</td>
                        <td className="py-3 pl-4">
                          {o.payment_status === 'invoice_pending' ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">Awaiting invoice</Badge>
                          ) : o.status === 'active' ? (
                            <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-700 text-gray-300">{o.status || 'Pending'}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <DealerRecentQuotes quotes={quotes as any[]} />
      </div>
    </DealerLayout>
  );
};

export default DealerDashboard;
