import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { CartProvider } from "@/contexts/CartContext";
import { redirectWwwToNonWww } from "@/utils/wwwRedirect";
import { preloadCriticalRoutes } from "@/utils/preloadRoutes";

// Eager load critical components
import Index from "./pages/Index";
import WebsiteFooter from "@/components/WebsiteFooter";
import ScrollToTop from "@/components/ScrollToTop";
import NotFound from "./pages/NotFound";
import { CookieBanner } from "@/components/CookieBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { PageViewLogger } from "@/components/PageViewLogger";
import { SeasonalOfferBanner } from "@/components/SeasonalOfferBanner";
import StickyNavigation from "@/components/StickyNavigation";

// Component to conditionally render banner only on homepage
const ConditionalSeasonalBanner = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasStep = searchParams.has('step');
  const isHomepage = (location.pathname === '/' || location.pathname === '/home' || location.pathname === '/home/') && !hasStep;
  
  if (!isHomepage) return null;
  return <SeasonalOfferBanner />;
};

// Component to conditionally hide footer during checkout steps and admin pages
const ConditionalStickyNavigation = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/dealer-portal')) return null;
  return <StickyNavigation />;
};

const ConditionalFooter = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const step = searchParams.get('step');
  
  // Hide footer on admin routes
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDealerDashboard = location.pathname.startsWith('/dealer-portal/dashboard') || location.pathname.startsWith('/dealer-portal/quotes') || location.pathname.startsWith('/dealer-portal/warranties') || location.pathname.startsWith('/dealer-portal/quote/');
  
  // Hide footer on brand landing pages (Google Ads pages)
  const isBrandLanding = location.pathname.startsWith('/warranty-types/') && location.pathname !== '/warranty-types/';
  
  // Hide footer on quote pages
  const isQuotePage = location.pathname.startsWith('/quote/');
  
  // Check if step starts with 2, 3, 4, 5, or 6 (handles cases like "3.", "3", "4" etc.)
  // Also check for any step that begins with these numbers
  const isCheckoutStep = step && /^[2-6]/.test(step);
  
  if (isCheckoutStep || isAdminRoute || isBrandLanding || isQuotePage || isDealerDashboard) return null;
  return <WebsiteFooter />;
};

// Lazy load pages
const FAQ = lazy(() => import("./pages/FAQ"));
const LiveQuotePage = lazy(() => import("./pages/LiveQuotePage"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const PaymentReceived = lazy(() => import("./pages/PaymentReceived"));
const PaymentFallback = lazy(() => import("./pages/PaymentFallback"));
const StripePayment = lazy(() => import("./pages/StripePayment"));
const Cart = lazy(() => import("./pages/Cart"));
const Widget = lazy(() => import("./pages/Widget"));
const Terms = lazy(() => import("./pages/Terms"));
const Protected = lazy(() => import("./pages/Protected"));
const Claims = lazy(() => import("./pages/Claims"));
const CancelWarranty = lazy(() => import("./pages/CancelWarranty"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Complaints = lazy(() => import("./pages/Complaints"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const AdminConversionFire = lazy(() => import("./pages/AdminConversionFire"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const WarrantyPlan = lazy(() => import("./pages/WarrantyPlan"));
const BuyCarWarranty = lazy(() => import("./pages/BuyCarWarranty"));
const VanWarrantyNew = lazy(() => import("./pages/VanWarrantyNew"));
const EVWarranty = lazy(() => import("./pages/EVWarranty"));
const MotorbikeWarranty = lazy(() => import("./pages/MotorbikeWarranty"));
const MotorcycleWarranty = lazy(() => import("./pages/MotorcycleWarranty"));
const CarExtendedWarranty = lazy(() => import("./pages/CarExtendedWarranty"));
const WarrantyTypes = lazy(() => import("./pages/WarrantyTypes"));
const DiscountsOffers = lazy(() => import("./pages/DiscountsOffers"));
const BMWWarrantyLanding = lazy(() => import("./pages/warranty-types/BMWWarrantyLanding"));
const MercedesWarrantyLanding = lazy(() => import("./pages/warranty-types/MercedesWarrantyLanding"));
const VanWarrantyLanding = lazy(() => import("./pages/warranty-types/VanWarrantyLanding"));
const MotorbikeWarrantyLanding = lazy(() => import("./pages/warranty-types/MotorbikeWarrantyLanding"));
const HondaWarrantyLanding = lazy(() => import("./pages/warranty-types/HondaWarrantyLanding"));
const ToyotaWarrantyLanding = lazy(() => import("./pages/warranty-types/ToyotaWarrantyLanding"));
const FordWarrantyLanding = lazy(() => import("./pages/warranty-types/FordWarrantyLanding"));
const KiaWarrantyLanding = lazy(() => import("./pages/warranty-types/KiaWarrantyLanding"));
const HyundaiWarrantyLanding = lazy(() => import("./pages/warranty-types/HyundaiWarrantyLanding"));
const MGWarrantyLanding = lazy(() => import("./pages/warranty-types/MGWarrantyLanding"));
const SkodaWarrantyLanding = lazy(() => import("./pages/warranty-types/SkodaWarrantyLanding"));
const AudiWarrantyLanding = lazy(() => import("./pages/warranty-types/AudiWarrantyLanding"));
const NissanWarrantyLanding = lazy(() => import("./pages/warranty-types/NissanWarrantyLanding"));
const PeugeotWarrantyLanding = lazy(() => import("./pages/warranty-types/PeugeotWarrantyLanding"));
const VauxhallWarrantyLanding = lazy(() => import("./pages/warranty-types/VauxhallWarrantyLanding"));
const VolvoWarrantyLanding = lazy(() => import("./pages/warranty-types/VolvoWarrantyLanding"));
const CitroenWarrantyLanding = lazy(() => import("./pages/warranty-types/CitroenWarrantyLanding"));
const EVWarrantyLanding = lazy(() => import("./pages/warranty-types/EVWarrantyLanding"));
const ClaimUpdateForm = lazy(() => import("./pages/ClaimUpdateForm"));
const HybridWarrantyLanding = lazy(() => import("./pages/warranty-types/HybridWarrantyLanding"));
const PHEVWarrantyLanding = lazy(() => import("./pages/warranty-types/PHEVWarrantyLanding"));
const VolkswagenWarrantyLanding = lazy(() => import("./pages/warranty-types/VolkswagenWarrantyLanding"));
const SmartWarrantyLanding = lazy(() => import("./pages/warranty-types/SmartWarrantyLanding"));
const PorscheWarrantyLanding = lazy(() => import("./pages/warranty-types/PorscheWarrantyLanding"));
const AlfaRomeoWarrantyLanding = lazy(() => import("./pages/warranty-types/AlfaRomeoWarrantyLanding"));
const LexusWarrantyLanding = lazy(() => import("./pages/warranty-types/LexusWarrantyLanding"));
const DaciaWarrantyLanding = lazy(() => import("./pages/warranty-types/DaciaWarrantyLanding"));
const JeepWarrantyLanding = lazy(() => import("./pages/warranty-types/JeepWarrantyLanding"));
const SubaruWarrantyLanding = lazy(() => import("./pages/warranty-types/SubaruWarrantyLanding"));
const SsangYongWarrantyLanding = lazy(() => import("./pages/warranty-types/SsangYongWarrantyLanding"));
const MiniWarrantyLanding = lazy(() => import("./pages/warranty-types/MiniWarrantyLanding"));
const DodgeWarrantyLanding = lazy(() => import("./pages/warranty-types/DodgeWarrantyLanding"));
const ChevroletWarrantyLanding = lazy(() => import("./pages/warranty-types/ChevroletWarrantyLanding"));
const BYDWarrantyLanding = lazy(() => import("./pages/warranty-types/BYDWarrantyLanding"));
const ChryslerWarrantyLanding = lazy(() => import("./pages/warranty-types/ChryslerWarrantyLanding"));
const SuzukiWarrantyLanding = lazy(() => import("./pages/warranty-types/SuzukiWarrantyLanding"));
const InfinitiWarrantyLanding = lazy(() => import("./pages/warranty-types/InfinitiWarrantyLanding"));
const MitsubishiWarrantyLanding = lazy(() => import("./pages/warranty-types/MitsubishiWarrantyLanding"));
const CadillacWarrantyLanding = lazy(() => import("./pages/warranty-types/CadillacWarrantyLanding"));
const TeslaWarrantyLanding = lazy(() => import("./pages/warranty-types/TeslaWarrantyLanding"));
const HyundaiWarranty = lazy(() => import("./pages/HyundaiWarranty"));
const AudiWarranty = lazy(() => import("./pages/AudiWarranty"));
const MercedesWarranty = lazy(() => import("./pages/MercedesWarranty"));
const VolkswagenWarranty = lazy(() => import("./pages/VolkswagenWarranty"));
const FordWarranty = lazy(() => import("./pages/FordWarranty"));
const NissanWarranty = lazy(() => import("./pages/NissanWarranty"));
const LandRoverWarranty = lazy(() => import("./pages/LandRoverWarranty"));
const JaguarWarranty = lazy(() => import("./pages/JaguarWarranty"));
const SkodaWarranty = lazy(() => import("./pages/SkodaWarranty"));
const BMWWarranty = lazy(() => import("./pages/BMWWarranty"));
const UsedCarWarrantyUK = lazy(() => import("./pages/UsedCarWarrantyUK"));
const DynamicLandingPage = lazy(() => import("./pages/DynamicLandingPage"));
const WarrantyTransfer = lazy(() => import("./pages/WarrantyTransfer"));

// Admin and auth pages
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const PasswordReset = lazy(() => import("./components/PasswordReset"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const QuickPasswordReset = lazy(() => import("./pages/QuickPasswordReset"));
const QuickResetTest = lazy(() => import("./pages/QuickResetTest"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const StepTest = lazy(() => import("./pages/StepTest"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const UpdateAdminCredentials = lazy(() => import("./pages/UpdateAdminCredentials"));
const RequestAccess = lazy(() => import("./pages/RequestAccess"));
const SalesLogin = lazy(() => import("./pages/SalesLogin"));

// Dealer Portal pages
const DealerHome = lazy(() => import("./pages/dealer-portal/DealerHome"));
const DealerSignup = lazy(() => import("./pages/dealer-portal/DealerSignup"));
const DealerLogin = lazy(() => import("./pages/dealer-portal/DealerLogin"));
const DealerDashboard = lazy(() => import("./pages/dealer-portal/DealerDashboard"));
const DealerCreateQuote = lazy(() => import("./pages/dealer-portal/DealerCreateQuote"));
const DealerQuotesList = lazy(() => import("./pages/dealer-portal/DealerQuotesList"));
const DealerWarrantiesList = lazy(() => import("./pages/dealer-portal/DealerWarrantiesList"));
const DealerJourneyStep1 = lazy(() => import("./pages/dealer-portal/journey/Step1Vehicle"));
const DealerJourneyStep2 = lazy(() => import("./pages/dealer-portal/journey/Step2Customer"));
const DealerJourneyStep3 = lazy(() => import("./pages/dealer-portal/journey/Step3Pricing"));
const DealerJourneyStep4 = lazy(() => import("./pages/dealer-portal/journey/Step4Checkout"));
const DealerJourneyStep5 = lazy(() => import("./pages/dealer-portal/journey/Step5Confirmation"));
import { DealerJourneyProvider } from "@/contexts/DealerJourneyContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes - increased for better caching
      gcTime: 30 * 60 * 1000, // 30 minutes - keep cached data longer
      retry: 1, // Reduced retries for faster failure handling
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
});

const App = () => {
  // Redirect www to non-www on mount and preload critical routes
  useEffect(() => {
    redirectWwwToNonWww();
    
    // Preload critical routes after initial load
    if (document.readyState === 'complete') {
      preloadCriticalRoutes();
    } else {
      window.addEventListener('load', preloadCriticalRoutes);
      return () => window.removeEventListener('load', preloadCriticalRoutes);
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SubscriptionProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <PageViewTracker />
            <PageViewLogger />
            <CookieBanner />
            <div className="min-h-screen flex flex-col w-full">
              <ConditionalStickyNavigation />
              <ConditionalSeasonalBanner />
              <main className="flex-1 pb-16 w-full overflow-x-hidden">
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/home" element={<Index />} />
                    <Route path="/home/" element={<Index />} />
                    <Route path="/faq/" element={<FAQ />} />
                    <Route path="/thank-you/" element={<ThankYou />} />
                    <Route path="/payment-received/" element={<PaymentReceived />} />
                    <Route path="/payment-fallback/" element={<PaymentFallback />} />
                    <Route path="/checkout/payment/" element={<StripePayment />} />
                    <Route path="/cart/" element={<Cart />} />
                    <Route path="/widget/" element={<Widget />} />
                    
                    <Route path="/auth/" element={<Auth />} />
                    <Route path="/sales-login/" element={<SalesLogin />} />
                    <Route path="/admin/" element={<AdminDashboard />} />
                    <Route path="/admin-dashboard/" element={<AdminDashboard />} />
                    <Route path="/customer-dashboard/" element={<CustomerDashboard />} />
                    <Route path="/forgot-password/" element={<ForgotPassword />} />
                    <Route path="/reset-password/" element={<PasswordReset />} />
                    <Route path="/password-reset/" element={<ResetPassword />} />
                    <Route path="/quick-reset/" element={<QuickResetTest />} />
                    <Route path="/setup-admin/" element={<SetupAdmin />} />
                    <Route path="/update-admin/" element={<UpdateAdminCredentials />} />
                    <Route path="/request-access/" element={<RequestAccess />} />
                    <Route path="/admin-conversion-fire/" element={<AdminConversionFire />} />
                    <Route path="/terms/" element={<Terms />} />
                    <Route path="/cookies/" element={<CookiePolicy />} />
                    <Route path="/privacy/" element={<PrivacyPolicy />} />
                    <Route path="/what-is-covered/" element={<Protected />} />
                    <Route path="/claims/" element={<Claims />} />
                    <Route path="/make-a-claim/" element={<Claims />} />
                    <Route path="/cancel-warranty" element={<CancelWarranty />} />
                    <Route path="/warranty-transfer/" element={<WarrantyTransfer />} />
                    <Route path="/contact-us/" element={<ContactUs />} />
                    <Route path="/complaints/" element={<Complaints />} />
                    <Route path="/thewarrantyhub/" element={<Blog />} />
                    <Route path="/thewarrantyhub/:slug/" element={<BlogArticle />} />
                    <Route path="/quote/:token" element={<LiveQuotePage />} />
                    <Route path="/quote/:token/success" element={<LiveQuotePage />} />
                    <Route path="/warranty-plan/" element={<WarrantyPlan />} />
                    <Route path="/buy-a-used-car-warranty-reliable-warranties/" element={<BuyCarWarranty />} />
                    <Route path="/discount-promo-offers/" element={<DiscountsOffers />} />
                    <Route path="/discounts-offers/" element={<Navigate to="/discount-promo-offers/" replace />} />
                    <Route path="/van-warranty/" element={<VanWarrantyNew />} />
                    <Route path="/ev-warranty/" element={<EVWarranty />} />
                    <Route path="/motorbike-repair-warranty-uk-warranties/" element={<MotorbikeWarranty />} />
                    <Route path="/motorcycle-warranty/" element={<MotorcycleWarranty />} />
                    <Route path="/car-extended-warranty/" element={<CarExtendedWarranty />} />
                    <Route path="/car-extended-warranty/hyundai/" element={<HyundaiWarranty />} />
        <Route path="/car-extended-warranty/audi/" element={<AudiWarranty />} />
        <Route path="/car-extended-warranty/mercedes-benz/" element={<MercedesWarranty />} />
        <Route path="/car-extended-warranty/volkswagen/" element={<VolkswagenWarranty />} />
                    <Route path="/car-extended-warranty/ford/" element={<FordWarranty />} />
        <Route path="/car-extended-warranty/nissan/" element={<NissanWarranty />} />
        <Route path="/car-extended-warranty/land-rover/" element={<LandRoverWarranty />} />
        <Route path="/car-extended-warranty/jaguar/" element={<JaguarWarranty />} />
                    <Route path="/car-extended-warranty/skoda/" element={<SkodaWarranty />} />
                    <Route path="/car-extended-warranty/bmw/" element={<BMWWarranty />} />
                    <Route path="/used-car-warranty-uk/" element={<UsedCarWarrantyUK />} />
                    <Route path="/warranty-types/" element={<WarrantyTypes />} />
                    <Route path="/warranty-types/bmw-warranty" element={<BMWWarrantyLanding />} />
                    <Route path="/warranty-types/bmw-warranty/" element={<BMWWarrantyLanding />} />
                    <Route path="/warranty-types/mercedes-warranty" element={<MercedesWarrantyLanding />} />
                    <Route path="/warranty-types/mercedes-warranty/" element={<MercedesWarrantyLanding />} />
                    <Route path="/warranty-types/vans-warranty" element={<VanWarrantyLanding />} />
                    <Route path="/warranty-types/vans-warranty/" element={<VanWarrantyLanding />} />
                    <Route path="/warranty-types/motorbike-motorcycle-warranty" element={<MotorbikeWarrantyLanding />} />
                    <Route path="/warranty-types/motorbike-motorcycle-warranty/" element={<MotorbikeWarrantyLanding />} />
                    <Route path="/warranty-types/honda-warranty" element={<HondaWarrantyLanding />} />
                    <Route path="/warranty-types/honda-warranty/" element={<HondaWarrantyLanding />} />
                    <Route path="/warranty-types/toyota-warranty" element={<ToyotaWarrantyLanding />} />
                    <Route path="/warranty-types/toyota-warranty/" element={<ToyotaWarrantyLanding />} />
                    <Route path="/warranty-types/ford-warranty" element={<FordWarrantyLanding />} />
                    <Route path="/warranty-types/ford-warranty/" element={<FordWarrantyLanding />} />
                    <Route path="/warranty-types/kia-warranty" element={<KiaWarrantyLanding />} />
                    <Route path="/warranty-types/kia-warranty/" element={<KiaWarrantyLanding />} />
                    <Route path="/warranty-types/hyundai-warranty" element={<HyundaiWarrantyLanding />} />
                    <Route path="/warranty-types/hyundai-warranty/" element={<HyundaiWarrantyLanding />} />
                    <Route path="/warranty-types/mg-warranty" element={<MGWarrantyLanding />} />
                    <Route path="/warranty-types/mg-warranty/" element={<MGWarrantyLanding />} />
                    <Route path="/warranty-types/skoda-warranty" element={<SkodaWarrantyLanding />} />
                    <Route path="/warranty-types/skoda-warranty/" element={<SkodaWarrantyLanding />} />
                    <Route path="/warranty-types/audi-warranty" element={<AudiWarrantyLanding />} />
                    <Route path="/warranty-types/audi-warranty/" element={<AudiWarrantyLanding />} />
                    <Route path="/warranty-types/nissan-warranty" element={<NissanWarrantyLanding />} />
                    <Route path="/warranty-types/nissan-warranty/" element={<NissanWarrantyLanding />} />
                    <Route path="/warranty-types/peugeot-warranty" element={<PeugeotWarrantyLanding />} />
                    <Route path="/warranty-types/peugeot-warranty/" element={<PeugeotWarrantyLanding />} />
                    <Route path="/warranty-types/vauxhall-warranty" element={<VauxhallWarrantyLanding />} />
                    <Route path="/warranty-types/vauxhall-warranty/" element={<VauxhallWarrantyLanding />} />
                    <Route path="/warranty-types/volvo-warranty" element={<VolvoWarrantyLanding />} />
                    <Route path="/warranty-types/volvo-warranty/" element={<VolvoWarrantyLanding />} />
                    <Route path="/warranty-types/ev-warranty" element={<EVWarrantyLanding />} />
                    <Route path="/warranty-types/ev-warranty/" element={<EVWarrantyLanding />} />
                    <Route path="/warranty-types/hybrid-warranty" element={<HybridWarrantyLanding />} />
                    <Route path="/warranty-types/hybrid-warranty/" element={<HybridWarrantyLanding />} />
                    <Route path="/warranty-types/phev-warranty" element={<PHEVWarrantyLanding />} />
                    <Route path="/warranty-types/phev-warranty/" element={<PHEVWarrantyLanding />} />
                    <Route path="/warranty-types/citroen-warranty" element={<CitroenWarrantyLanding />} />
                    <Route path="/warranty-types/citroen-warranty/" element={<CitroenWarrantyLanding />} />
                    <Route path="/warranty-types/volkswagen-warranty" element={<VolkswagenWarrantyLanding />} />
                    <Route path="/warranty-types/volkswagen-warranty/" element={<VolkswagenWarrantyLanding />} />
                    <Route path="/warranty-types/smart-warranty" element={<SmartWarrantyLanding />} />
                    <Route path="/warranty-types/smart-warranty/" element={<SmartWarrantyLanding />} />
                    <Route path="/warranty-types/porsche-warranty" element={<PorscheWarrantyLanding />} />
                    <Route path="/warranty-types/porsche-warranty/" element={<PorscheWarrantyLanding />} />
                    <Route path="/warranty-types/alfa-romeo-warranty" element={<AlfaRomeoWarrantyLanding />} />
                    <Route path="/warranty-types/alfa-romeo-warranty/" element={<AlfaRomeoWarrantyLanding />} />
                    <Route path="/warranty-types/lexus-warranty" element={<LexusWarrantyLanding />} />
                    <Route path="/warranty-types/lexus-warranty/" element={<LexusWarrantyLanding />} />
                    <Route path="/warranty-types/dacia-warranty" element={<DaciaWarrantyLanding />} />
                    <Route path="/warranty-types/dacia-warranty/" element={<DaciaWarrantyLanding />} />
                    <Route path="/warranty-types/jeep-warranty" element={<JeepWarrantyLanding />} />
                    <Route path="/warranty-types/jeep-warranty/" element={<JeepWarrantyLanding />} />
                    <Route path="/warranty-types/subaru-warranty" element={<SubaruWarrantyLanding />} />
                    <Route path="/warranty-types/subaru-warranty/" element={<SubaruWarrantyLanding />} />
                    <Route path="/warranty-types/ssangyong-warranty" element={<SsangYongWarrantyLanding />} />
                    <Route path="/warranty-types/ssangyong-warranty/" element={<SsangYongWarrantyLanding />} />
                    <Route path="/warranty-types/mini-warranty" element={<MiniWarrantyLanding />} />
                    <Route path="/warranty-types/mini-warranty/" element={<MiniWarrantyLanding />} />
                    <Route path="/warranty-types/dodge-warranty" element={<DodgeWarrantyLanding />} />
                    <Route path="/warranty-types/dodge-warranty/" element={<DodgeWarrantyLanding />} />
                    <Route path="/warranty-types/chevrolet-warranty" element={<ChevroletWarrantyLanding />} />
                    <Route path="/warranty-types/chevrolet-warranty/" element={<ChevroletWarrantyLanding />} />
                    <Route path="/warranty-types/byd-warranty" element={<BYDWarrantyLanding />} />
                    <Route path="/warranty-types/byd-warranty/" element={<BYDWarrantyLanding />} />
                    <Route path="/warranty-types/chrysler-warranty" element={<ChryslerWarrantyLanding />} />
                    <Route path="/warranty-types/chrysler-warranty/" element={<ChryslerWarrantyLanding />} />
                    <Route path="/warranty-types/suzuki-warranty" element={<SuzukiWarrantyLanding />} />
                    <Route path="/warranty-types/suzuki-warranty/" element={<SuzukiWarrantyLanding />} />
                    <Route path="/warranty-types/infiniti-warranty" element={<InfinitiWarrantyLanding />} />
                    <Route path="/warranty-types/infiniti-warranty/" element={<InfinitiWarrantyLanding />} />
                    <Route path="/warranty-types/mitsubishi-warranty" element={<MitsubishiWarrantyLanding />} />
                    <Route path="/warranty-types/mitsubishi-warranty/" element={<MitsubishiWarrantyLanding />} />
                    <Route path="/warranty-types/cadillac-warranty" element={<CadillacWarrantyLanding />} />
                    <Route path="/warranty-types/cadillac-warranty/" element={<CadillacWarrantyLanding />} />
                    <Route path="/warranty-types/tesla-warranty" element={<TeslaWarrantyLanding />} />
                    <Route path="/warranty-types/tesla-warranty/" element={<TeslaWarrantyLanding />} />
                    
                    <Route path="/warranty-types/:brand" element={<DynamicLandingPage />} />
                    <Route path="/warranty-types/:brand/" element={<DynamicLandingPage />} />
                    <Route path="/claim-update/:token" element={<ClaimUpdateForm />} />
                    <Route path="/steptest" element={<StepTest />} />
                    
                    {/* Dealer Portal */}
                    <Route path="/dealer-portal" element={<DealerHome />} />
                    <Route path="/dealer-portal/" element={<DealerHome />} />
                    <Route path="/dealer-portal/signup" element={<DealerSignup />} />
                    <Route path="/dealer-portal/login" element={<DealerLogin />} />
                    <Route path="/dealer-portal/dashboard" element={<DealerDashboard />} />
                    <Route path="/dealer-portal/quotes/create" element={<DealerCreateQuote />} />
                    <Route path="/dealer-portal/quotes" element={<DealerQuotesList />} />
                    <Route path="/dealer-portal/warranties" element={<DealerWarrantiesList />} />
                    {/* Dealer multi-step quote journey */}
                    <Route path="/dealer-portal/quote/vehicle" element={<DealerJourneyProvider><DealerJourneyStep1 /></DealerJourneyProvider>} />
                    <Route path="/dealer-portal/quote/customer" element={<DealerJourneyProvider><DealerJourneyStep2 /></DealerJourneyProvider>} />
                    <Route path="/dealer-portal/quote/pricing" element={<DealerJourneyProvider><DealerJourneyStep3 /></DealerJourneyProvider>} />
                    <Route path="/dealer-portal/quote/checkout" element={<DealerJourneyProvider><DealerJourneyStep4 /></DealerJourneyProvider>} />
                    <Route path="/dealer-portal/quote/confirmation" element={<DealerJourneyProvider><DealerJourneyStep5 /></DealerJourneyProvider>} />

                    <Route path="/:slug" element={<DynamicLandingPage />} />
                    
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <ConditionalFooter />
            </div>
          </BrowserRouter>
        </CartProvider>
      </SubscriptionProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
