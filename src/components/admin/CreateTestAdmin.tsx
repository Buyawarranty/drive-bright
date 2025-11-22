import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CreateTestAdmin = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createTestAdmin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-test-admin');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Test Admin Created",
        description: `Admin created with email: ${data.credentials.email} and password: ${data.credentials.password}`,
      });

      console.log("Test admin credentials:", data.credentials);
      
    } catch (error: any) {
      console.error('Error creating test admin:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create test admin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Test Admin</CardTitle>
        <CardDescription>
          Create a test admin user for testing the login system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={createTestAdmin} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Test Admin (admin@test.com / admin123)'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CreateTestAdmin;