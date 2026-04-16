import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { DealerStatsCards } from '@/components/dealer/DealerStatsCards';
import { DealerRecentQuotes } from '@/components/dealer/DealerRecentQuotes';
import { Button } from '@/components/ui/button';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { FilePlus, FileText, Shield } from 'lucide-react';

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

  const { data: warranties = [] } = useQuery({
    queryKey: ['dealer-warranties', dealer?.id],
    queryFn: async () => {
      if (!dealer?.id) return [];
      const { data } = await supabase
        .from('dealer_warranties')
        .select('*')
        .eq('dealer_id', dealer.id)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!dealer?.id,
  });

  const totalQuotes = quotes.length;
  const activeWarranties = warranties.length;
  const converted = quotes.filter((q: any) => q.status === 'converted').length;
  const conversionRate = totalQuotes > 0 ? (converted / totalQuotes) * 100 : 0;

  return (
    <DealerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
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
          <Button onClick={() => navigate('/dealer-portal/quotes/create')} className="bg-orange-500 hover:bg-orange-600 text-white">
            <FilePlus className="h-4 w-4 mr-2" /> Create Quote
          </Button>
          <Button variant="outline" onClick={() => navigate('/dealer-portal/quotes')}>
            <FileText className="h-4 w-4 mr-2" /> View Quotes
          </Button>
          <Button variant="outline" onClick={() => navigate('/dealer-portal/warranties')}>
            <Shield className="h-4 w-4 mr-2" /> View Warranties
          </Button>
        </div>

        <DealerRecentQuotes quotes={quotes as any[]} />
      </div>
    </DealerLayout>
  );
};

export default DealerDashboard;
