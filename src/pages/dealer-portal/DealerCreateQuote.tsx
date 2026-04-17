import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DealerLayout } from '@/components/dealer/DealerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { useToast } from '@/hooks/use-toast';

const DealerCreateQuote = () => {
  const { dealer } = useDealerAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    vehicle_reg: '',
    vehicle_make: '',
    vehicle_model: '',
    mileage: '',
    warranty_duration: '',
    plan_type: '',
    price: '',
  });

  // Pre-fill reg from hero handoff (?reg= or localStorage)
  useEffect(() => {
    const regParam = searchParams.get('reg') || localStorage.getItem('dealerPendingReg');
    if (regParam) {
      setForm((prev) => ({ ...prev, vehicle_reg: regParam.toUpperCase() }));
      localStorage.removeItem('dealerPendingReg');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer?.id) return;
    if (!form.customer_name || !form.vehicle_reg || !form.warranty_duration || !form.plan_type) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('dealer_quotes').insert({
        dealer_id: dealer.id,
        customer_name: form.customer_name,
        vehicle_reg: form.vehicle_reg.toUpperCase(),
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        mileage: form.mileage || null,
        warranty_duration: form.warranty_duration,
        plan_type: form.plan_type,
        price: form.price ? parseFloat(form.price) : null,
        status: 'pending',
      });

      if (error) throw error;
      toast({ title: 'Quote created successfully!' });
      navigate('/dealer-portal/quotes');
    } catch (error: any) {
      toast({ title: 'Failed to create quote', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const inputClass = "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500";

  return (
    <DealerLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Create Quote</h1>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-white">Vehicle & Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300">Customer Name *</label>
                <Input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} placeholder="Customer full name" required className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Vehicle Registration *</label>
                <Input value={form.vehicle_reg} onChange={(e) => update('vehicle_reg', e.target.value)} placeholder="AB12 CDE" required className={`uppercase ${inputClass}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300">Make</label>
                  <Input value={form.vehicle_make} onChange={(e) => update('vehicle_make', e.target.value)} placeholder="e.g. Ford" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300">Model</label>
                  <Input value={form.vehicle_model} onChange={(e) => update('vehicle_model', e.target.value)} placeholder="e.g. Focus" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Mileage</label>
                <Input value={form.mileage} onChange={(e) => update('mileage', e.target.value)} placeholder="e.g. 45000" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Warranty Duration *</label>
                <Select value={form.warranty_duration} onValueChange={(v) => update('warranty_duration', v)}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                    <SelectItem value="24">24 Months</SelectItem>
                    <SelectItem value="36">36 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Plan Type *</label>
                <Select value={form.plan_type} onValueChange={(v) => update('plan_type', v)}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300">Price (£)</label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="e.g. 299.99" className={inputClass} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Quote'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/dealer-portal/quotes')} className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DealerLayout>
  );
};

export default DealerCreateQuote;
