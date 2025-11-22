import { ClaimsTab } from '@/components/admin/ClaimsTab';
import ContactSubmissionsTab from '@/components/admin/ContactSubmissionsTab';
import { AbandonedCartsTab } from '@/components/admin/AbandonedCartsTab';
import { GetQuoteTab } from '@/components/admin/GetQuoteTab';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SEOHead } from '@/components/SEOHead';
import { CustomersTab } from '@/components/admin/CustomersTab';
import { PlansTab } from '@/components/admin/PlansTab';
import SpecialVehiclePlansTab from '@/components/admin/SpecialVehiclePlansTab';
import { DiscountCodesTab } from '@/components/admin/DiscountCodesTab';
import { ReferralsTab } from '@/components/admin/ReferralsTab';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import UnifiedEmailHub from '@/components/admin/UnifiedEmailHub';
import AccountSettings from '@/components/admin/AccountSettings';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import CreateTestCustomer from '@/components/CreateTestCustomer';
import CreateTestAdmin from '@/components/admin/CreateTestAdmin';
import ResetAdminPassword from '@/components/admin/ResetAdminPassword';
import SetAdminPassword from '@/components/admin/SetAdminPassword';
import TestWarranties2000 from '@/components/TestWarranties2000';
import TestWarranties2000AddOns from '@/components/TestWarranties2000AddOns';
import TestBumper from '@/components/TestBumper';
import { ApiConnectivityTest } from '@/components/admin/ApiConnectivityTest';
import { UserPermissionsTab } from '@/components/admin/UserPermissionsTab';
import { DocumentMappingTab } from '@/components/admin/DocumentMappingTab';
import { BulkPricingTab } from '@/components/admin/BulkPricingTab';
import { BlogWritingTab } from '@/components/admin/BlogWritingTab';
import OrderReconciliation from '@/components/admin/OrderReconciliation';
import { ManualPaymentProcessor } from '@/components/admin/ManualPaymentProcessor';
import { ResendWelcomeEmail } from '@/components/admin/ResendWelcomeEmail';
import { TestAutomatedEmail } from '@/components/admin/TestAutomatedEmail';
import { SimpleEmailTest } from '@/components/admin/SimpleEmailTest';
import { TestEmailFunctionDirect } from '@/components/admin/TestEmailFunctionDirect';
import { EmailFunctionDiagnostics } from '@/components/admin/EmailFunctionDiagnostics';
import { TestPolicyDocumentsEmail } from '@/components/admin/TestPolicyDocumentsEmail';
import { ClickFraudTab } from '@/components/admin/ClickFraudTab';
import { ResetCustomerPassword } from '@/components/admin/ResetCustomerPassword';
import { TestTrustpilotEmail } from '@/components/admin/TestTrustpilotEmail';
import { TestAbandonedCartEmail } from '@/components/admin/TestAbandonedCartEmail';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('customers');
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    checkAdminAccess();
  }, [session, authLoading]);

  const checkAdminAccess = async () => {
    console.log('🔍 checkAdminAccess called - authLoading:', authLoading, 'session:', !!session);
    
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    // If no session after auth loading is complete, redirect to auth
    if (!session?.user) {
      console.log('❌ No session found, redirecting to auth');
      navigate('/auth', { replace: true });
      return;
    }

    try {
      console.log('✅ Session found for user:', session.user.email, 'ID:', session.user.id);
      console.log('🔍 Checking user role for:', session.user.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      console.log('📊 Role query result:', { data, error });

      // Allow all admin role types: admin, member, viewer, guest, blog_writer
      if (error || !data || !['admin', 'member', 'viewer', 'guest', 'blog_writer'].includes(data.role)) {
        console.error('❌ Access denied - not an admin user', error, data);
        console.log('🏠 User has no admin role, redirecting to homepage');
        navigate('/', { replace: true });
        return;
      }

      console.log('✅ Access granted for role:', data.role);
      setUserRole(data.role);
      setHasAdminAccess(true);
      setIsCheckingRole(false);
      
      // Set default tab for blog writers
      if (data.role === 'blog_writer') {
        setActiveTab('blog-writing');
      }
    } catch (error) {
      console.error('💥 Error checking admin access:', error);
      navigate('/', { replace: true });
    }
  };

  // Show loading while checking auth or role
  if (authLoading || isCheckingRole || !hasAdminAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Authenticating...' : isCheckingRole ? 'Checking permissions...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'customers':
        return <CustomersTab />;
      case 'plans':
        return <PlansTab />;
      case 'bulk-pricing':
        return <BulkPricingTab />;
      case 'special-plans':
        return <SpecialVehiclePlansTab />;
      case 'discount-codes':
        return <DiscountCodesTab />;
      case 'referrals':
        return <ReferralsTab />;
      case 'claims':
        return <ClaimsTab />;
      case 'contact':
        return <ContactSubmissionsTab />;
      case 'abandoned-carts':
        return <AbandonedCartsTab />;
      case 'emails':
        return <UnifiedEmailHub />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'security':
        return <ClickFraudTab />;
      case 'user-permissions':
        return <UserPermissionsTab />;
      case 'document-mapping':
        return <DocumentMappingTab />;
      case 'blog-writing':
        return <BlogWritingTab />;
      case 'get-quote':
        return <GetQuoteTab />;
      case 'testing':
        console.log('Rendering Testing Tab');
        try {
          return (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Testing Tools</h1>
                <p className="text-gray-600 mt-2">Tools for testing and development</p>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <ManualPaymentProcessor />
                
                <OrderReconciliation />
                
                <ApiConnectivityTest />
                
                <EmailFunctionDiagnostics />
                
                <TestPolicyDocumentsEmail />
                
                <TestAbandonedCartEmail />
                
                <TestTrustpilotEmail />
                
                <SimpleEmailTest />
                
                <TestEmailFunctionDirect />
                
                <TestAutomatedEmail />
                
                <ResendWelcomeEmail />
                
                <CreateTestCustomer />
                
                <CreateTestAdmin />
                
                <ResetAdminPassword />
                
                <ResetCustomerPassword />
                
                <SetAdminPassword />
                
                <Card>
                  <CardHeader>
                    <CardTitle>Test Credentials</CardTitle>
                    <CardDescription>
                      Use these credentials to test the customer login
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Email:</span> test@customer.com
                      </div>
                      <div>
                        <span className="font-medium">Password:</span> password123
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <TestWarranties2000 />
                
                <TestWarranties2000AddOns />
                
                <TestBumper />
              </div>
            </div>
          );
        } catch (error) {
          console.error('Error rendering testing tab:', error);
          return (
            <div className="max-w-4xl mx-auto p-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Error Loading Testing Tab</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    There was an error loading the testing tools. Check the console for details.
                  </p>
                  <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                    {error instanceof Error ? error.message : 'Unknown error'}
                  </pre>
                </CardContent>
              </Card>
            </div>
          );
        }
      case 'account':
        return <AccountSettings />;
      default:
        return <CustomersTab />;
    }
  };

  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SEOHead 
        title="Admin Dashboard | BuyAWarranty Management"
        description="Administrative dashboard for managing warranties, customers, and business operations. Secure access for authorized personnel only."
        keywords="admin, dashboard, warranty management, customer management"
      />
      
      {/* Header with same navigation as homepage */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* First line - Standard navigation */}
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            {/* Navigation - Hidden on mobile, visible on lg+ */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/what-is-covered/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">What's Covered</Link>
              <Link to="/make-a-claim/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">Make a Claim</Link>
              <Link to="/faq/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">FAQs</Link>
              <Link to="/contact-us/" className="text-gray-700 hover:text-gray-900 font-medium text-sm">Contact Us</Link>
            </nav>

            {/* Desktop CTA Buttons - Show on desktop */}
            <div className="hidden lg:flex items-center space-x-3">
              <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 px-3 text-sm"
                >
                  WhatsApp Us
                </Button>
              </a>
              <Button 
                size="sm"
                onClick={navigateToQuoteForm}
                className="bg-orange-500 text-white hover:bg-orange-600 px-3 text-sm"
              >
                Get my quote
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden p-2"
                >
                  <Menu className="h-8 w-8" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  {/* Header with logo */}
                  <div className="flex items-center justify-between pb-6">
                    <Link to="/" className="hover:opacity-80 transition-opacity">
                      <img 
                        src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" 
                        alt="Buy a Warranty" 
                        className="h-8 w-auto"
                      />
                    </Link>
                  </div>

                  {/* Navigation Links */}
                  <nav className="flex flex-col space-y-6 flex-1">
                    <Link 
                      to="/what-is-covered/"
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      What's Covered
                    </Link>
                    <Link 
                      to="/make-a-claim/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Make a Claim
                    </Link>
                    <Link 
                      to="/faq/" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                       FAQs
                    </Link>
                    <Link 
                      to="/contact-us" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Contact Us
                    </Link>
                    <Link 
                      to="/customer-dashboard" 
                      className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b border-gray-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Customer Dashboard
                    </Link>
                    <span className="text-orange-500 font-semibold text-sm py-2 border-b border-gray-200">
                      Admin Dashboard
                    </span>
                  </nav>

                  {/* CTA Buttons */}
                  <div className="space-y-4 pt-6 mt-auto">
                    <a href="https://wa.me/message/SPQPJ6O3UBF5B1" target="_blank" rel="noopener noreferrer">
                      <Button 
                        variant="outline" 
                        className="w-full bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600 text-lg py-3"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        WhatsApp Us
                      </Button>
                    </a>
                    <Button 
                      className="w-full bg-orange-500 text-white hover:bg-orange-600 text-lg py-3"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigateToQuoteForm();
                      }}
                    >
                      Get my quote
                    </Button>
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        navigate('/auth');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors text-lg"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          {/* Second line - Admin-specific navigation */}
          <div className="hidden lg:flex items-center justify-center space-x-6 py-2 border-t border-gray-200">
            <span className="text-orange-500 font-semibold text-sm">Admin Dashboard</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth');
              }}
              className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      <div className="flex-1 flex flex-col lg:flex-row">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} userRole={userRole} />
        
        <div className="flex-1 lg:ml-64 overflow-hidden">
          <main className="p-4 lg:p-6 overflow-y-auto h-[calc(100vh-80px)]">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
