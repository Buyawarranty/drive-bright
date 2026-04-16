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

  const { data: warranties = [] } = useQuery({
    queryKey: ['dealer-warranties-list', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('dealer_warranties')
        .select('*')
        .eq('dealer_id', dealer.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'expired': return 'bg-gray-600 text-gray-300';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  return (
    <DealerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Warranties</h1>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            {warranties.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No warranties yet. Convert a quote to create a warranty.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Customer</TableHead>
                    <TableHead className="text-gray-400">Vehicle</TableHead>
                    <TableHead className="text-gray-400">Start Date</TableHead>
                    <TableHead className="text-gray-400">End Date</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warranties.map((w: any) => (
                    <TableRow key={w.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="font-medium text-white">{w.customer_name}</TableCell>
                      <TableCell className="text-gray-300">{w.vehicle_reg}</TableCell>
                      <TableCell className="text-gray-300">{new Date(w.start_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="text-gray-300">{new Date(w.end_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(w.status)}>
                          {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DealerLayout>
  );
};

export default DealerWarrantiesList;
