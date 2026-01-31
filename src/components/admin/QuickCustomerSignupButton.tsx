import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Loader2, Copy, Send, CheckCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QuickCustomerSignupButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export const QuickCustomerSignupButton: React.FC<QuickCustomerSignupButtonProps> = ({
  variant = 'outline',
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Search/lookup
  const [searchEmail, setSearchEmail] = useState('');
  const [customerFound, setCustomerFound] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [hasExistingAccount, setHasExistingAccount] = useState<boolean | null>(null);
  
  // Generated credentials
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const generateRandomPassword = () => {
    const length = 10;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSearchLoading(true);
    setCustomerFound(null);
    setHasExistingAccount(null);
    setGeneratedCredentials(null);

    try {
      // Search for customer
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, name, email')
        .ilike('email', `%${searchEmail.trim()}%`)
        .limit(1);

      if (error) throw error;

      if (!customers || customers.length === 0) {
        toast.error('No customer found with that email');
        return;
      }

      const customer = customers[0];
      setCustomerFound(customer);

      // Check if auth account exists
      const { data: checkData } = await supabase.functions.invoke('check-customer-auth', {
        body: { email: customer.email }
      });

      setHasExistingAccount(checkData?.exists || false);

    } catch (error: any) {
      console.error('Search error:', error);
      toast.error('Failed to search for customer');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!customerFound) return;

    setLoading(true);
    try {
      const newPassword = generateRandomPassword();

      // Try to reset password first (in case account exists but wasn't detected)
      const { data: resetData, error: resetError } = await supabase.functions.invoke('reset-customer-password', {
        body: { email: customerFound.email, newPassword: newPassword }
      });

      if (resetError || (resetData && !resetData.success && resetData.error === 'User not found')) {
        // Create new account
        const { data: createData, error: createError } = await supabase.functions.invoke('create-customer-account', {
          body: {
            email: customerFound.email,
            password: newPassword,
            firstName: customerFound.name?.split(' ')[0] || '',
            lastName: customerFound.name?.split(' ').slice(1).join(' ') || '',
            customerId: customerFound.id
          }
        });

        if (createError) {
          throw createError;
        }

        if (createData?.success) {
          setGeneratedCredentials({
            email: customerFound.email,
            password: newPassword
          });
          setHasExistingAccount(true);
          toast.success('Customer account created successfully!');
        } else {
          throw new Error(createData?.error || 'Failed to create account');
        }
      } else if (resetData?.success) {
        // Password was reset successfully
        setGeneratedCredentials({
          email: customerFound.email,
          password: newPassword
        });
        setHasExistingAccount(true);
        toast.success('Customer password reset successfully!');
      }
    } catch (error: any) {
      console.error('Create account error:', error);
      toast.error(error.message || 'Failed to create customer account');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!generatedCredentials) return;

    const credentials = `Customer Dashboard Login Details

Dashboard URL: https://buyawarranty.co.uk/customer-dashboard
Email: ${generatedCredentials.email}
Password: ${generatedCredentials.password}

Please log in and change your password after first login.`;

    navigator.clipboard.writeText(credentials);
    toast.success('Credentials copied to clipboard');
  };

  const handleSendCredentialsEmail = async () => {
    if (!generatedCredentials) return;

    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke('resend-customer-credentials', {
        body: { email: generatedCredentials.email }
      });

      if (error) throw error;

      toast.success('Login credentials sent to customer');
    } catch (error: any) {
      console.error('Send email error:', error);
      toast.error('Failed to send credentials email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after closing
    setTimeout(() => {
      setSearchEmail('');
      setCustomerFound(null);
      setHasExistingAccount(null);
      setGeneratedCredentials(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant={variant} className={`gap-2 ${className}`}>
          <UserPlus className="h-4 w-4" />
          Customer Signup
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Quick Customer Account Signup
          </DialogTitle>
          <DialogDescription>
            Create or reset a customer's dashboard login credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Section */}
          <div className="space-y-2">
            <Label htmlFor="customer-email">Customer Email</Label>
            <div className="flex gap-2">
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button 
                onClick={handleSearch} 
                disabled={searchLoading}
                variant="secondary"
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Customer Found */}
          {customerFound && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{customerFound.name}</p>
                    <p className="text-sm text-muted-foreground">{customerFound.email}</p>
                  </div>
                  {hasExistingAccount !== null && (
                    <Badge variant={hasExistingAccount ? 'default' : 'secondary'}>
                      {hasExistingAccount ? 'Has Account' : 'No Account'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Generated Credentials */}
              {generatedCredentials ? (
                <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Account Ready!</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <code className="ml-2 px-2 py-0.5 bg-white rounded">
                        {generatedCredentials.email}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Password:</span>
                      <code className="ml-2 px-2 py-0.5 bg-white rounded font-mono">
                        {generatedCredentials.password}
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCredentials}
                      className="flex-1"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy All
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSendCredentialsEmail}
                      disabled={sendingEmail}
                      className="flex-1"
                    >
                      {sendingEmail ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Email Customer
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleCreateAccount}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {hasExistingAccount ? 'Reset Password' : 'Create Account'}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
