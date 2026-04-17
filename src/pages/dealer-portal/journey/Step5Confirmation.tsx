import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DealerJourneyLayout } from '@/components/dealer/journey/DealerJourneyLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDealerJourney } from '@/contexts/DealerJourneyContext';
import { CheckCircle2, FileText } from 'lucide-react';

const Step5Confirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { reset } = useDealerJourney();
  const method = searchParams.get('method') || 'pay_now';
  const id = searchParams.get('id');

  useEffect(() => {
    // Clear journey state — order has been written
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DealerJourneyLayout step={5} title="Order confirmed" subtitle="The warranty is now in your dashboard." showBack={false}>
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="inline-flex p-4 rounded-full bg-green-500/10 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {method === 'invoice' ? 'Added to your invoice' : 'Payment successful'}
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            {method === 'invoice'
              ? "We've recorded this warranty against your account. It will appear on your next monthly invoice."
              : 'Your customer is now covered. A confirmation email has been sent.'}
          </p>

          {id && (
            <p className="text-xs text-gray-500 mb-6">
              Reference: <span className="font-mono text-gray-400">{id.slice(0, 8).toUpperCase()}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate('/dealer-portal/warranties')}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <FileText className="h-4 w-4 mr-2" /> View warranties
            </Button>
            <Button
              onClick={() => navigate('/dealer-portal/quote/vehicle')}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Start another quote
            </Button>
          </div>
        </CardContent>
      </Card>
    </DealerJourneyLayout>
  );
};

export default Step5Confirmation;
