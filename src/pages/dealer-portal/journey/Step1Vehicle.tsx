import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DealerJourneyLayout } from '@/components/dealer/journey/DealerJourneyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDealerJourney } from '@/contexts/DealerJourneyContext';

const Step1Vehicle: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { vehicle, setVehicle } = useDealerJourney();

  const [reg, setReg] = useState(vehicle?.reg || '');
  const [make, setMake] = useState(vehicle?.make || '');
  const [model, setModel] = useState(vehicle?.model || '');
  const [year, setYear] = useState(vehicle?.year || '');
  const [mileage, setMileage] = useState(vehicle?.mileage || '');
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from ?reg= or localStorage
  useEffect(() => {
    const fromUrl = searchParams.get('reg');
    const fromStorage = localStorage.getItem('dealerPendingReg');
    const initial = fromUrl || fromStorage;
    if (initial && !reg) {
      setReg(initial.toUpperCase());
      localStorage.removeItem('dealerPendingReg');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reg.trim()) {
      setError('Vehicle registration is required');
      return;
    }
    if (!mileage.trim() || isNaN(Number(mileage))) {
      setError('Enter a valid mileage');
      return;
    }
    setError(null);
    setVehicle({
      reg: reg.trim().toUpperCase(),
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: year.trim() || undefined,
      mileage: mileage.trim(),
    });
    navigate('/dealer-portal/quote/customer');
  };

  const inputClass = 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-orange-500';

  return (
    <DealerJourneyLayout step={1} title="Vehicle details" subtitle="Confirm the vehicle this warranty covers." backTo="/dealer-portal/dashboard">
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Vehicle registration *</label>
              <Input
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase())}
                placeholder="AB12 CDE"
                required
                className={`uppercase ${inputClass}`}
                maxLength={10}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Make</label>
                <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Ford" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Model</label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Focus" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Year</label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2020" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Mileage *</label>
                <Input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="e.g. 45000" className={inputClass} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="pt-2">
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto">
                Continue → Customer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DealerJourneyLayout>
  );
};

export default Step1Vehicle;
