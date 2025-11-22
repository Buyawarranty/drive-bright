import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const QuickPasswordReset = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const setPasswordDirectly = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-admin-password', {
        body: {
          userId: '97474b70-dd93-4007-a8f8-11e96670e194',
          email: 'info@buyawarranty.co.uk',
          password: 'PasswordLogin123-'
        }
      });

      if (error) {
        setResult({ error: error.message });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on component mount
  useEffect(() => {
    setPasswordDirectly();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src="/lovable-uploads/9b53da8c-70f3-4fc2-8497-e1958a650b4a.png" 
            alt="BuyAWarranty" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <CardTitle>Admin Password Reset</CardTitle>
          <CardDescription>
            Setting password for info@buyawarranty.co.uk
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-2"></div>
              <p>Setting password...</p>
            </div>
          )}
          
          {result && !loading && (
            <div className="space-y-4">
              {result.error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-600">
                    <strong>Error:</strong> {result.error}
                  </div>
                  <Button 
                    onClick={setPasswordDirectly} 
                    className="mt-2 w-full"
                    variant="destructive"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-green-600 font-semibold mb-2">Password Set Successfully!</div>
                  <div className="space-y-1 text-sm">
                    <div><strong>Email:</strong> info@buyawarranty.co.uk</div>
                    <div><strong>Password:</strong> PasswordLogin123-</div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-sm text-gray-600 mb-2">You can now login to the admin dashboard:</p>
                    <Button 
                      onClick={() => window.location.href = '/auth'} 
                      className="w-full"
                    >
                      Go to Admin Login
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickPasswordReset;