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
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/dealer-portal/" className="hover:opacity-80 transition-opacity">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto brightness-0 invert" />
              </Link>
              <span className="ml-3 text-xs font-semibold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">DEALER</span>
            </div>

            <nav className="hidden lg:flex items-center space-x-1">
              <Link to="/dealer-portal/dashboard" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Dashboard</Link>
              <Link to="/dealer-portal/quotes/create" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Create Quote</Link>
              <Link to="/dealer-portal/quotes" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Quotes</Link>
              <Link to="/dealer-portal/warranties" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors">Warranties</Link>
            </nav>

            <div className="hidden lg:flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                {dealer?.company_name || dealer?.name || user.email}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={signOut}
                className="text-red-400 border-red-800 hover:bg-red-950 hover:text-red-300"
              >
                Sign Out
              </Button>
            </div>

            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2 text-gray-300 hover:bg-gray-800">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] bg-gray-900 border-gray-800">
                  <div className="flex flex-col h-full">
                    <div className="pb-6">
                      <Link to="/dealer-portal/">
                        <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-8 w-auto brightness-0 invert" />
                      </Link>
                    </div>
                    <nav className="flex flex-col space-y-4 flex-1">
                      <Link to="/dealer-portal/dashboard" className="text-gray-300 hover:text-white font-medium text-sm py-2 border-b border-gray-800" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                      <Link to="/dealer-portal/quotes/create" className="text-gray-300 hover:text-white font-medium text-sm py-2 border-b border-gray-800" onClick={() => setMobileMenuOpen(false)}>Create Quote</Link>
                      <Link to="/dealer-portal/quotes" className="text-gray-300 hover:text-white font-medium text-sm py-2 border-b border-gray-800" onClick={() => setMobileMenuOpen(false)}>Quotes</Link>
                      <Link to="/dealer-portal/warranties" className="text-gray-300 hover:text-white font-medium text-sm py-2 border-b border-gray-800" onClick={() => setMobileMenuOpen(false)}>Warranties</Link>
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
