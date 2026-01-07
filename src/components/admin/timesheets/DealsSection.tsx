import React, { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, TrendingUp, Package, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DealRecord } from '@/hooks/useTimesheets';
import { cn } from '@/lib/utils';

interface DealsSectionProps {
  deals: DealRecord[];
  onAddDeal: (
    dealValue: number,
    dealDate: Date,
    planType?: string,
    customerName?: string,
    vehicleReg?: string,
    notes?: string
  ) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
}

export function DealsSection({ deals, onAddDeal, onDeleteDeal }: DealsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    dealValue: '',
    dealDate: format(new Date(), 'yyyy-MM-dd'),
    planType: '',
    customerName: '',
    vehicleReg: '',
    notes: '',
  });

  const totalValue = deals.reduce((sum, d) => sum + Number(d.deal_value), 0);
  const estimatedCommission = totalValue * 0.05; // 5% default rate

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dealValue) return;
    
    await onAddDeal(
      parseFloat(formData.dealValue),
      new Date(formData.dealDate),
      formData.planType || undefined,
      formData.customerName || undefined,
      formData.vehicleReg || undefined,
      formData.notes || undefined
    );

    setFormData({
      dealValue: '',
      dealDate: format(new Date(), 'yyyy-MM-dd'),
      planType: '',
      customerName: '',
      vehicleReg: '',
      notes: '',
    });
    setIsOpen(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Your Deals</h3>
              <p className="text-sm text-gray-500">Track your sales this month</p>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Deal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record a New Deal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deal Value (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.dealValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, dealValue: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label>Deal Date</Label>
                    <Input
                      type="date"
                      value={formData.dealDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dealDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Plan Type</Label>
                  <Select
                    value={formData.planType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, planType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="ev">EV</SelectItem>
                      <SelectItem value="phev">PHEV</SelectItem>
                      <SelectItem value="motorbike">Motorbike</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input
                      value={formData.customerName}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label>Vehicle Reg</Label>
                    <Input
                      value={formData.vehicleReg}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleReg: e.target.value.toUpperCase() }))}
                      placeholder="e.g. AB12 CDE"
                    />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
                <Button type="submit" className="w-full">Record Deal</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 p-5 border-b bg-gray-50">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deals.length}</div>
          <div className="text-xs text-gray-500">Deals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">£{totalValue.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total Value</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600">£{estimatedCommission.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Est. Commission</div>
        </div>
      </div>

      {/* Deals List */}
      <div className="max-h-[300px] overflow-y-auto">
        {deals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No deals recorded this month</p>
            <p className="text-xs mt-1">Click "Add Deal" to record your first sale</p>
          </div>
        ) : (
          <div className="divide-y">
            {deals.map((deal) => (
              <div key={deal.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    deal.plan_type === 'platinum' ? 'bg-purple-100' :
                    deal.plan_type === 'gold' ? 'bg-amber-100' : 'bg-blue-100'
                  )}>
                    <Car className={cn(
                      'h-4 w-4',
                      deal.plan_type === 'platinum' ? 'text-purple-600' :
                      deal.plan_type === 'gold' ? 'text-amber-600' : 'text-blue-600'
                    )} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      £{Number(deal.deal_value).toLocaleString()}
                      {deal.plan_type && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 rounded-full capitalize">
                          {deal.plan_type}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(deal.deal_date), 'd MMM')}
                      {deal.customer_name && ` • ${deal.customer_name}`}
                      {deal.vehicle_reg && ` • ${deal.vehicle_reg}`}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onDeleteDeal(deal.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
