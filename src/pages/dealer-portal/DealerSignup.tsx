import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';

const DealerSignup = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company_name: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.company_name || !form.password) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dealer-portal/dashboard`,
          data: { dealer_name: form.name, company_name: form.company_name },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create dealer profile
        const { error: dealerError } = await supabase.from('dealers').insert({
          user_id: data.user.id,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          company_name: form.company_name,
        });

        if (dealerError) {
          console.error('Dealer profile error:', dealerError);
        }

        toast({ title: 'Account created!', description: 'Welcome to the Dealer Portal.' });
        navigate('/dealer-portal/dashboard');
      }
    } catch (error: any) {
      toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <SEOHead title="Dealer Signup | BuyAWarranty" description="Create your dealer account in 60 seconds." />
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center">
          <Link to="/dealer-portal/" className="inline-block mb-4">
            <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-8 mx-auto" />
          </Link>
          <CardTitle className="text-2xl font-bold">Create Dealer Account</CardTitle>
          <CardDescription>Get started in 60 seconds</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email *</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="dealer@example.com" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07700 900000" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Company Name *</label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="ABC Motors Ltd" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password *</label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required />
            </div>
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/dealer-portal/login" className="text-orange-600 hover:underline font-medium">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DealerSignup;
