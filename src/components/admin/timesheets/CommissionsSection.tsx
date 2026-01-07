import React from 'react';
import { format } from 'date-fns';
import { Coins, CheckCircle2, Clock, Banknote } from 'lucide-react';
import { CommissionRecord } from '@/hooks/useTimesheets';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CommissionsSectionProps {
  commissions: CommissionRecord[];
}

export function CommissionsSection({ commissions }: CommissionsSectionProps) {
  const totalPending = commissions
    .filter(c => c.status === 'pending' || c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.commission_amount) + Number(c.bonus_amount), 0);
  
  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.commission_amount) + Number(c.bonus_amount), 0);

  const statusConfig = {
    pending: { icon: Clock, label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-100' },
    approved: { icon: CheckCircle2, label: 'Approved', color: 'text-blue-600', bg: 'bg-blue-100' },
    paid: { icon: Banknote, label: 'Paid', color: 'text-green-600', bg: 'bg-green-100' },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Coins className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Commission History</h3>
            <p className="text-sm text-gray-500">Your earnings over time</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 p-5 border-b bg-gradient-to-r from-amber-50 to-green-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">£{totalPending.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Pending / Approved</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">£{totalPaid.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Paid Out</div>
        </div>
      </div>

      {/* Commission List */}
      <div className="max-h-[300px] overflow-y-auto">
        {commissions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No commission records yet</p>
            <p className="text-xs mt-1">Commissions are calculated monthly</p>
          </div>
        ) : (
          <div className="divide-y">
            {commissions.map((commission) => {
              const config = statusConfig[commission.status as keyof typeof statusConfig];
              const Icon = config.icon;
              const totalAmount = Number(commission.commission_amount) + Number(commission.bonus_amount);
              
              return (
                <div key={commission.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">
                      {format(new Date(commission.period_start), 'MMM yyyy')}
                    </div>
                    <Badge variant="secondary" className={cn('gap-1', config.bg, config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Deals</div>
                      <div className="font-medium">{commission.deals_count}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Sales</div>
                      <div className="font-medium">£{Number(commission.total_sales_value).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Rate</div>
                      <div className="font-medium">{(Number(commission.commission_rate) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Total</div>
                      <div className={cn('font-bold', config.color)}>
                        £{totalAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {commission.bonus_amount > 0 && (
                    <div className="mt-2 text-xs text-purple-600 bg-purple-50 rounded px-2 py-1 inline-block">
                      +£{Number(commission.bonus_amount).toFixed(2)} bonus
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
