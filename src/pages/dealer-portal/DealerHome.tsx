import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SEOHead } from '@/components/SEOHead';
import { Zap, TrendingUp, LayoutDashboard, UserPlus, FileText, Shield } from 'lucide-react';

const DealerHome = () => {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Dealer Warranty Solutions | BuyAWarranty"
        description="Create quotes and manage warranties in seconds. Partner with BuyAWarranty for fast dealer warranty solutions."
        keywords="dealer warranty, warranty quotes, dealer portal"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20 lg:py-32">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold mb-6">
            Dealer Warranty Solutions<br />Made Simple
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Create quotes and manage warranties in seconds. Boost your revenue with our hassle-free dealer portal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dealer-portal/login">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6 w-full sm:w-auto">
                Dealer Login
              </Button>
            </Link>
            <Link to="/dealer-portal/signup">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-gray-900 text-lg px-8 py-6 w-full sm:w-auto">
                Create Account in 60 Seconds
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-gray-900">
            Why Dealers Choose Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: 'Fast Quotes', desc: 'Generate accurate warranty quotes in under 60 seconds. No complex paperwork.' },
              { icon: TrendingUp, title: 'Increase Revenue', desc: 'Add warranty sales to every vehicle transaction and boost your bottom line.' },
              { icon: LayoutDashboard, title: 'Simple Dashboard', desc: 'Track all your quotes, warranties and conversions from one clean interface.' },
            ].map((b) => (
              <Card key={b.title} className="border-2 hover:shadow-lg transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="inline-flex p-4 bg-orange-50 rounded-full mb-4">
                    <b.icon className="h-8 w-8 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900">{b.title}</h3>
                  <p className="text-gray-600">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-gray-900">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: UserPlus, title: 'Sign Up', desc: 'Create your dealer account in seconds. No approval wait times.' },
              { step: '2', icon: FileText, title: 'Create Quote', desc: 'Enter the vehicle details and get an instant warranty price for your customer.' },
              { step: '3', icon: Shield, title: 'Convert to Warranty', desc: 'Convert your quote into a live warranty with one click.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 text-white rounded-full text-2xl font-bold mb-4">
                  {s.step}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">{s.title}</h3>
                <p className="text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-orange-500 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-orange-100 text-lg mb-8">
            Join hundreds of dealers already using BuyAWarranty to grow their warranty sales.
          </p>
          <Link to="/dealer-portal/signup">
            <Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-6">
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default DealerHome;
