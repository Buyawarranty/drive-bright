import { useEffect, useState } from 'react';
import { trackPurchaseComplete } from '@/utils/analytics';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Manual conversion firing for missed Google Ads conversions
const AdminConversionFire = () => {
  const [fired, setFired] = useState<string[]>([]);
  const [gtagReady, setGtagReady] = useState(false);

  // Conversions that need to be fired - includes purchase date for reference
  // NOTE: Google Ads gtag doesn't support backdating - conversions are recorded at firing time
  // For true backdated conversions, use Google Ads Offline Conversion Import
  const missedConversions = [
    // February 2026 missed conversions
    {
      id: 'BAW-2602-400927',
      email: 'clive195847@gmail.com',
      amount: 455,
      phone: '',
      firstName: 'Clive',
      lastName: '',
      address: '',
      source: 'stripe',
      purchaseDate: '2026-02-12'
    },
    {
      id: 'BAW-2602-400928',
      email: 'raynehe@gmail.com',
      amount: 456,
      phone: '07834418090',
      firstName: 'Daxing',
      lastName: 'He',
      address: '33 Rimsdale Drive Manchester M40 0GN',
      source: 'bumper',
      purchaseDate: '2026-02-14'
    },
    {
      id: 'BAW-2602-400930',
      email: 'sonu.01haryanasonu@gmail.com',
      amount: 411,
      phone: '',
      firstName: 'Sonu',
      lastName: 'Sonu',
      address: 'Flat 74 County Durham DH8 5HP',
      source: 'stripe',
      purchaseDate: '2026-02-14'
    },
    // Previous missed conversions
    {
      id: 'BAW-2512-400857',
      email: 'dave.illingworth@btinternet.com',
      amount: 550,
      phone: '07805103310',
      firstName: 'David',
      lastName: 'Illingworth',
      address: '201 Shaftesbury Avenue',
      source: 'stripe',
      purchaseDate: '2024-12-20'
    },
    {
      id: 'BAW-2512-400855',
      email: 'jozie.quinn@hotmail.co.uk',
      amount: 417,
      phone: '07401371819',
      firstName: 'Jozie',
      lastName: 'Stephenson-Quinn',
      address: '16 Tyersal Terrace',
      source: 'bumper',
      purchaseDate: '2024-12-18'
    },
    {
      id: 'BAW-2512-400823',
      email: 'ian@ian-mcbride.com',
      amount: 1065,
      phone: '07860737263',
      firstName: 'Ian',
      lastName: 'McBride',
      address: 'B87 Albion Riverside Building',
      source: 'stripe',
      purchaseDate: '2024-12-17'
    },
    {
      id: 'BAW-2512-400853',
      email: 'sammain@hotmail.com',
      amount: 473,
      phone: '07395313048',
      firstName: 'Sam',
      lastName: 'Main',
      address: '8 Burnfoot Court',
      source: 'bumper',
      purchaseDate: '2024-12-18'
    }
  ];

  // Load gtag
  useEffect(() => {
    if (window.gtag) {
      setGtagReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17325228149';
    script.async = true;
    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      window.gtag('js', new Date());
      window.gtag('config', 'AW-17325228149');
      setGtagReady(true);
      console.log('✅ gtag loaded for manual conversion firing');
    };
    document.head.appendChild(script);
  }, []);

  const fireConversion = (conversion: typeof missedConversions[0]) => {
    if (!gtagReady) {
      toast.error('gtag not ready yet');
      return;
    }

    console.log(`🎯 Manually firing conversion for ${conversion.id}...`);

    // Grant consent first
    window.gtag('consent', 'update', {
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted',
      'analytics_storage': 'granted'
    });

    // Set enhanced conversion data first
    window.gtag('set', 'user_data', {
      email: conversion.email,
      phone_number: conversion.phone.replace(/^0/, '+44'),
      address: {
        first_name: conversion.firstName,
        last_name: conversion.lastName,
        street: conversion.address,
        country: 'GB'
      }
    });

    // Push dataLayer event for GTM (simulating thank-you page context)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'purchase',
      'order_value': 1,
      'transaction_id': conversion.id,
      'currency': 'GBP',
      'page_location': window.location.origin + '/thank-you',
      'ecommerce': {
        'transaction_id': conversion.id,
        'value': 1,
        'currency': 'GBP'
      }
    });
    console.log('✅ DataLayer purchase event pushed');

    // Fire direct Google Ads conversion (bypasses GTM)
    window.gtag('event', 'conversion', {
      'send_to': 'AW-17325228149/U-BnCJKD2KUbEPWAqMVA',
      'value': 1,
      'currency': 'GBP',
      'transaction_id': conversion.id,
      'user_data': {
        'email': conversion.email,
        'phone_number': conversion.phone.replace(/^0/, '+44'),
        'address': {
          'first_name': conversion.firstName,
          'last_name': conversion.lastName,
          'street': conversion.address,
          'country': 'GB'
        }
      }
    });
    console.log('✅ Direct gtag conversion event fired');

    // Also call trackPurchaseComplete as backup
    trackPurchaseComplete(
      conversion.amount,
      conversion.id,
      {
        email: conversion.email,
        phone: conversion.phone,
        firstName: conversion.firstName,
        lastName: conversion.lastName,
        address: conversion.address
      }
    );

    setFired(prev => [...prev, conversion.id]);
    toast.success(`Conversion fired for ${conversion.id} - £1 sent to Google Ads`);
  };

  const fireAll = () => {
    missedConversions.forEach(conversion => {
      if (!fired.includes(conversion.id)) {
        fireConversion(conversion);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Manual Conversion Fire</h1>
        <p className="text-muted-foreground mb-4">
          gtag status: {gtagReady ? '✅ Ready' : '⏳ Loading...'}
        </p>

        <Button onClick={fireAll} className="mb-6" disabled={!gtagReady}>
          Fire All Conversions
        </Button>

        <div className="space-y-4">
          {missedConversions.map(conversion => (
            <div 
              key={conversion.id} 
              className={`p-4 border rounded-lg ${fired.includes(conversion.id) ? 'bg-green-50 border-green-200' : 'bg-card'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{conversion.id}</p>
                  <p className="text-sm text-muted-foreground">{conversion.email}</p>
                  <p className="text-sm text-blue-600 font-medium">Purchase Date: {conversion.purchaseDate}</p>
                  <p className="text-sm">Actual: £{conversion.amount} | <strong>Sends £1 to Google Ads</strong> via {conversion.source}</p>
                </div>
                <Button 
                  onClick={() => fireConversion(conversion)}
                  disabled={!gtagReady || fired.includes(conversion.id)}
                  variant={fired.includes(conversion.id) ? 'outline' : 'default'}
                  size="sm"
                >
                  {fired.includes(conversion.id) ? '✅ Fired' : 'Fire'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {fired.length > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              ✅ {fired.length} conversion(s) fired. Check Google Ads in 24-48 hours.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConversionFire;
