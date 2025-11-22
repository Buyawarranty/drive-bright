import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const UpdateAdminCredentials = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const updateCredentials = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('update-admin-credentials');

      if (error) throw error;

      setResult(data);
      
      if (data.success) {
        toast.success('Admin credentials updated successfully!');
      } else {
        toast.error('Failed to update credentials');
      }
    } catch (error: any) {
      console.error('Error updating admin credentials:', error);
      toast.error(error.message || 'Failed to update credentials');
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </Link>
        
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-orange-500" />
            <CardTitle>Update Admin Credentials</CardTitle>
            <CardDescription>
              Update admin email to info@buyawarranty.co.uk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">This will:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Change admin email to: info@buyawarranty.co.uk</li>
                <li>Set password to: PasswordLogin123-</li>
                <li>Ensure admin role is assigned</li>
              </ul>
            </div>

            <Button 
              onClick={updateCredentials}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Updating...' : 'Update Admin Credentials'}
            </Button>
            
            {result && (
              <div className={`p-4 rounded-lg ${
                result.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {result.success ? (
                  <div className="space-y-2">
                    <div className="text-green-600 font-semibold">✓ Success!</div>
                    <div className="text-sm space-y-1">
                      <div><strong>Email:</strong> {result.email}</div>
                      <div><strong>Password:</strong> PasswordLogin123-</div>
                      <div><strong>User ID:</strong> {result.userId}</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <Link to="/auth">
                        <Button className="w-full">
                          Go to Login Page
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-red-600 font-semibold">✗ Error</div>
                    <div className="text-sm mt-1">{result.error || 'Unknown error occurred'}</div>
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              This is a one-time setup operation. After successful update, you can login with the new credentials.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdateAdminCredentials;
