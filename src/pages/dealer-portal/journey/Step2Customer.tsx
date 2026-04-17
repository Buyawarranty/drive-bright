import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DealerJourneyLayout } from '@/components/dealer/journey/DealerJourneyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDealerJourney } from '@/contexts/DealerJourneyContext';

const Step2Customer: React.FC = () => {
  const navigate = useNavigate();
  const { vehicle, customer, setCustomer } = useDealerJourney();
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address_line1: customer?.address_line1 || '',
    address_line2: customer?.address_line2 || '',
    town: customer?.town || '',
    postcode: customer?.postcode || '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicle) navigate('/dealer-portal/quote/vehicle', { replace: true });
  }, [vehicle, navigate]);

  const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.address_line1.trim() || !form.town.trim() || !form.postcode.trim()) {
      setError('Please complete all required fields');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setCustomer(form);
    navigate('/dealer-portal/quote/pricing');
  };

  const inputClass = 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-orange-500';

  return (
    <DealerJourneyLayout step={2} title="Customer details" subtitle="The end customer who will hold this warranty.">
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <form onSubmit={handleNext} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Full name *</label>
                <Input value={form.name} onChange={(e) => update('name', e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Email *</label>
                <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Phone *</label>
              <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Address line 1 *</label>
              <Input value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Address line 2</label>
              <Input value={form.address_line2} onChange={(e) => update('address_line2', e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Town *</label>
                <Input value={form.town} onChange={(e) => update('town', e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Postcode *</label>
                <Input value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} required className={`uppercase ${inputClass}`} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto">
                Continue → Plan & pricing
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DealerJourneyLayout>
  );
};

export default Step2Customer;
