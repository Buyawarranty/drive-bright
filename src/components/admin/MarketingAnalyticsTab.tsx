import React, { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Facebook } from 'lucide-react';

const GoogleAdsSettingsTab = lazy(() => import('@/components/admin/GoogleAdsSettingsTab').then(m => ({ default: m.GoogleAdsSettingsTab })));
const FacebookAdsTab = lazy(() => import('@/components/admin/FacebookAdsTab').then(m => ({ default: m.FacebookAdsTab })));

const TabFallback = () => (
  <div className="flex items-center justify-center h-32">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
  </div>
);

export const MarketingAnalyticsTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Marketing Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track conversions, ROAS, and ad performance across all marketing channels
        </p>
      </div>

      <Tabs defaultValue="google" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="google" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Google Ads
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex items-center gap-2">
            <Facebook className="h-4 w-4" />
            Facebook Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="mt-6">
          <Suspense fallback={<TabFallback />}>
            <GoogleAdsSettingsTab hideHeader />
          </Suspense>
        </TabsContent>

        <TabsContent value="facebook" className="mt-6">
          <Suspense fallback={<TabFallback />}>
            <FacebookAdsTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingAnalyticsTab;
