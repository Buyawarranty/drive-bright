import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const resetAdminPassword = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-admin-password', {
        body: {
          userId: '97474b70-dd93-4007-a8f8-11e96670e194',
          email: 'info@buyawarranty.co.uk'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src="/lovable-uploads/9b53da8c-70f3-4fc2-8497-e1958a650b4a.png" 
            alt="BuyAWarranty" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <CardTitle>Reset Admin Password</CardTitle>
          <CardDescription>
            Reset password for info@buyawarranty.co.uk
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={resetAdminPassword} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Resetting...' : 'Reset Password for info@buyawarranty.co.uk'}
          </Button>
          
          {result && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              {result.error ? (
                <div className="text-red-600">
                  <strong>Error:</strong> {result.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-green-600 font-semibold">Password Reset Successful!</div>
                  <div><strong>Email:</strong> info@buyawarranty.co.uk</div>
                  <div><strong>New Password:</strong> {result.temporaryPassword}</div>
                  <div className="text-sm text-gray-600 mt-2">
                    You can now login to the admin dashboard with these credentials.
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

export default ResetPassword;