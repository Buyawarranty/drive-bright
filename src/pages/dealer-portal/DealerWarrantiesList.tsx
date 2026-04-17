import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDealerAuth } from '@/hooks/useDealerAuth';

const DealerWarrantiesList = () => {
  const { dealer } = useDealerAuth();

  // Source of truth = customers table filtered by dealer_id (matches admin view)
  const { data: warranties = [] } = useQuery({
    queryKey: ['dealer-warranties-list', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, vehicle_make, vehicle_model, plan_type, payment_type, final_amount, payment_status, status, warranty_start_date, policy_end_date, signup_date')
        .eq('dealer_id', dealer.id)
        .order('signup_date', { ascending: false });
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  const renderStatus = (w: any) => {
    if (w.payment_status === 'invoice_pending') {
      return <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">Awaiting invoice</Badge>;
    }
    if (w.status === 'active') {
      return <Badge className="bg-green-500 text-white">Active</Badge>;
    }
    if (w.status === 'expired') {
      return <Badge className="bg-gray-600 text-gray-200">Expired</Badge>;
    }
    if (w.status === 'cancelled') {
      return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">Cancelled</Badge>;
    }
    return <Badge className="bg-gray-700 text-gray-300">{w.status || 'Pending'}</Badge>;
  };

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

  return (
    <DealerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Warranties</h1>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            {warranties.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No warranties yet. Start a full quote to issue your first warranty.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">Customer</TableHead>
                      <TableHead className="text-gray-400">Vehicle</TableHead>
                      <TableHead className="text-gray-400">Plan</TableHead>
                      <TableHead className="text-gray-400">Start</TableHead>
                      <TableHead className="text-gray-400">End</TableHead>
                      <TableHead className="text-gray-400 text-right">Amount</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warranties.map((w: any) => (
                      <TableRow key={w.id} className="border-gray-800 hover:bg-gray-800/50">
                        <TableCell className="font-medium text-white">
                          <div>{w.name}</div>
                          <div className="text-xs text-gray-500">{w.email}</div>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          <div className="font-mono">{w.registration_plate}</div>
                          {(w.vehicle_make || w.vehicle_model) && (
                            <div className="text-xs text-gray-500">{w.vehicle_make} {w.vehicle_model}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300 capitalize">
                          {w.plan_type} · {w.payment_type}mo
                        </TableCell>
                        <TableCell className="text-gray-300">{fmtDate(w.warranty_start_date || w.signup_date)}</TableCell>
                        <TableCell className="text-gray-300">{fmtDate(w.policy_end_date)}</TableCell>
                        <TableCell className="text-right text-white font-semibold">£{Number(w.final_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>{renderStatus(w)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DealerLayout>
  );
};

export default DealerWarrantiesList;
