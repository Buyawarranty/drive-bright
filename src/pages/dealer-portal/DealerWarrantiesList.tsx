import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      case 'expired': return 'bg-gray-200 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DealerLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Warranties</h1>

        <Card className="border-2">
          <CardContent className="pt-6">
            {warranties.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                No warranties yet. Convert a quote to create a warranty.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warranties.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.customer_name}</TableCell>
                      <TableCell>{w.vehicle_reg}</TableCell>
                      <TableCell>{new Date(w.start_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell>{new Date(w.end_date).toLocaleDateString('en-GB')}</TableCell>
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
