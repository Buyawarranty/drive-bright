import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface QuoteLookupProps {
  onQuoteFound?: (quoteData: any) => void;
}

const QuoteLookup: React.FC<QuoteLookupProps> = ({ onQuoteFound }) => {
  const [quoteId, setQuoteId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Check URL for quote parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const quoteParam = urlParams.get('quote');
    if (quoteParam) {
      setQuoteId(quoteParam);
      // Auto-focus email field if quote ID is found in URL
      setTimeout(() => {
        const emailInput = document.getElementById('quote-email');
        if (emailInput) emailInput.focus();
      }, 100);
    }
  }, []);

  const handleQuoteLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quoteId.trim() || !email.trim()) {
      toast.error('Please enter both Quote ID and email address');
      return;
    }

    setLoading(true);
    
    try {
      // For now, we'll simulate quote lookup since we don't have a backend storage
      // In a real implementation, this would query a database
      
      // Parse quote ID to extract basic info (this is a simple demo)
      const quoteMatch = quoteId.match(/^QUO-(\d+)-(.+)$/);
      
      if (!quoteMatch) {
        throw new Error('Invalid quote format');
      }

      // Simulate a successful quote lookup
      const mockQuoteData = {
        quoteId,
        email,
        found: true,
        planName: 'Basic', // This would come from the database
        vehicleReg: 'AB12 CDE', // This would come from the database
        totalPrice: 299,
        monthlyPrice: 25
      };

      // Show success message
      toast.success('Quote found! Redirecting to purchase...');
      
      // Simulate redirect delay
      setTimeout(() => {
        if (onQuoteFound) {
          onQuoteFound(mockQuoteData);
        } else {
          // Redirect to main flow with quote data
          const params = new URLSearchParams({
            quote: quoteId,
            email: email,
            step: '4'
          });
          window.location.href = `/customer-details?${params.toString()}`;
        }
      }, 1000);

    } catch (error) {
      console.error('Quote lookup error:', error);
      toast.error('Quote not found. Please check your Quote ID and email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
            <Search className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Find Your Quote</CardTitle>
          <CardDescription>
            Enter your Quote ID and email address to continue with your purchase
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleQuoteLookup} className="space-y-4">
            <div>
              <Label htmlFor="quote-id">Quote ID</Label>
              <Input
                id="quote-id"
                type="text"
                value={quoteId}
                onChange={(e) => setQuoteId(e.target.value)}
                placeholder="e.g., QUO-1234567890-ABC123"
                className="mt-1"
                required
              />
              <p className="text-sm text-gray-600 mt-1">
                You can find this in the email we sent you
              </p>
            </div>

            <div>
              <Label htmlFor="quote-email">Email Address</Label>
              <Input
                id="quote-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="mt-1"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Find My Quote
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900 mb-1">Can't find your quote?</p>
                <p>Check your email for the Quote ID, or contact our support team at info@buyawarranty.co.uk</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuoteLookup;