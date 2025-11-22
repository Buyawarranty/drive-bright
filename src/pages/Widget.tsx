import { VehicleWidget } from '@/components/VehicleWidget';
import { SEOHead } from '@/components/SEOHead';

export default function Widget() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <SEOHead 
        title="Car Warranty Widget | Embed Vehicle Warranty Quotes"
        description="Embed our car warranty widget on your website. Instant quotes for vehicles with competitive pricing and comprehensive coverage options."
        keywords="warranty widget, embed warranty quotes, vehicle warranty, car insurance widget"
      />
      <VehicleWidget 
        redirectUrl={window.location.origin}
        className="bg-white"
      />
    </div>
  );
}