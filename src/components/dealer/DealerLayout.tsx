import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DealerSidebar } from './DealerSidebar';
import { useDealerAuth } from '@/hooks/useDealerAuth';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface DealerLayoutProps {
  children: React.ReactNode;
}

export const DealerLayout: React.FC<DealerLayoutProps> = ({ children }) => {
  const { user, dealer, loading, signOut } = useDealerAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/dealer-portal/login');
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header — matches AdminDashboardInner */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dealer-portal/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>

            <div className="hidden lg:flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {dealer?.company_name || dealer?.name || user.email}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={signOut}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>

            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px]">
                  <div className="flex flex-col h-full">
                    <div className="pb-6">
                      <Link to="/dealer-portal/">
                        <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-8 w-auto" />
                      </Link>
                    </div>
                    <nav className="flex flex-col space-y-4 flex-1">
                      <Link to="/dealer-portal/dashboard" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                      <Link to="/dealer-portal/quotes/create" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b" onClick={() => setMobileMenuOpen(false)}>Create Quote</Link>
                      <Link to="/dealer-portal/quotes" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b" onClick={() => setMobileMenuOpen(false)}>Quotes</Link>
                      <Link to="/dealer-portal/warranties" className="text-gray-700 hover:text-gray-900 font-medium text-sm py-2 border-b" onClick={() => setMobileMenuOpen(false)}>Warranties</Link>
                    </nav>
                    <div className="pt-6 mt-auto">
                      <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors">
                        Sign Out
                      </button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        <DealerSidebar onSignOut={signOut} />
        <div className="flex-1 lg:ml-64 overflow-hidden">
          <main className="p-4 lg:p-6 overflow-y-auto h-[calc(100vh-64px)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
