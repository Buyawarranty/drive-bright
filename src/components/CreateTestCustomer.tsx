
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CreateTestCustomer = () => {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();

  const createTestCustomer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-test-customer');
      
      if (error) throw error;
      
      toast({
        title: "Test customer created!",
        description: `Email: ${data.credentials.email} | Password: ${data.credentials.password}`,
        duration: 10000,
      });

      console.log('Test Customer Credentials:');
      console.log('Email:', data.credentials.email);
      console.log('Password:', data.credentials.password);
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to create test customer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteTestUser = async () => {
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-test-user', {
        body: { email: 'prajwalchauhan26@gmail.com' }
      });
      
      if (error) throw error;
      
      toast({
        title: "Test user deleted!",
        description: "prajwalchauhan26@gmail.com has been removed from the system",
      });
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to delete test user",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Test Customer</CardTitle>
        <CardDescription>
          Creates a test customer with known credentials for testing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={createTestCustomer} 
          disabled={loading}
          className="w-full mb-2"
        >
          {loading ? 'Creating...' : 'Create Test Customer'}
        </Button>
        <Button 
          onClick={deleteTestUser} 
          disabled={deleteLoading}
          variant="destructive"
          className="w-full"
        >
          {deleteLoading ? 'Deleting...' : 'Delete Test User'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CreateTestCustomer;
