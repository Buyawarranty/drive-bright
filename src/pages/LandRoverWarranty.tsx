import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { OrganizationSchema } from '@/components/schema/OrganizationSchema';
import { WebPageSchema } from '@/components/schema/WebPageSchema';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { ProductSchema } from '@/components/schema/ProductSchema';
import { BreadcrumbSchema } from '@/components/schema/BreadcrumbSchema';
import TrustpilotHeader from '@/components/TrustpilotHeader';
import WebsiteFooter from '@/components/WebsiteFooter';
import { OptimizedImage } from '@/components/OptimizedImage';
import rangeRoverImg from '@/assets/land-rover-range-rover.png';
import defenderImg from '@/assets/land-rover-defender.png';
import discoverySportImg from '@/assets/land-rover-discovery-sport.png';

const LandRoverWarranty: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const faqItems = [
    {
      question: "How much is the Land Rover extended warranty?",
      answer: "Prices vary based on age, mileage and cover levels. Newer vehicles cost less, while older high-mileage models cost slightly more. Enter your registration to see your personalised quote instantly."
    },
    {
      question: "Are Land Rover extended warranties worth it?",
      answer: "Yes, they are valuable for drivers who want protection from high repair costs. Land Rovers have complex mechanical and electrical systems so even a single repair can exceed the cost of a full year of cover."
    },
    {
      question: "Can I buy a Land Rover extended warranty later?",
      answer: "Yes, you can buy cover at any time unless the vehicle already has an active pre-existing fault. Buying earlier usually gives a lower premium and wider cover options."
    },
    {
      question: "What is the extended warranty on a Land Rover?",
      answer: "It is a protection plan that covers the cost of repairing mechanical and electrical failures once the original manufacturer's warranty has expired. It includes parts, labour and diagnostics."
    }
  ];

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Land Rover Extended Warranty | Affordable Cover for Used Models"
        description="Protect your Land Rover with reliable extended warranty cover. Includes major mechanical and electrical faults with flexible plans and instant quotes."
        keywords="Land Rover warranty, Range Rover warranty, Discovery warranty, Land Rover extended warranty, Defender warranty"
        canonical="https://buyawarranty.co.uk/car-extended-warranty/land-rover/"
        ogTitle="Land Rover Extended Warranty | Affordable Cover for Used Models"
        ogDescription="Protect your Land Rover with reliable extended warranty cover. Includes major mechanical and electrical faults with flexible plans and instant quotes."
      />
      
      <OrganizationSchema type="InsuranceAgency" />
      <WebPageSchema
        name="Land Rover Extended Warranty - Buy A Warranty"
        description="Comprehensive extended warranty coverage for Land Rover vehicles in the UK. Protect your Range Rover, Defender, or Discovery from unexpected repair costs."
        url="https://buyawarranty.co.uk/car-extended-warranty/land-rover/"
        specialty="Land Rover Extended Warranty, Range Rover Warranty, Discovery Warranty"
      />
      <FAQSchema faqs={faqItems} />
      <ProductSchema
        name="Land Rover Extended Warranty Plans"
        description="Comprehensive Land Rover warranty coverage protecting your vehicle from unexpected mechanical and electrical failures."
        price="19.00"
        priceCurrency="GBP"
        brand="Buy A Warranty"
        category="Extended Warranty"
        image="https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png"
      />
      <BreadcrumbSchema 
        items={[
          { name: "Home", url: "https://buyawarranty.co.uk/" },
          { name: "Car Extended Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/" },
          { name: "Land Rover Warranty", url: "https://buyawarranty.co.uk/car-extended-warranty/land-rover/" }
        ]} 
      />

      {/* Sticky Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center">
              <Link to="/">
                <img src="/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png" alt="Buy a Warranty" className="h-6 sm:h-8 w-auto" />
              </Link>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
              <Link to="/#coverage" className="text-gray-700 hover:text-primary transition-colors">What's Covered</Link>
              <Link to="/make-a-claim/" className="text-gray-700 hover:text-primary transition-colors">Make a Claim</Link>
              <Link to="/faq/" className="text-gray-700 hover:text-primary transition-colors">FAQs</Link>
              <Link to="/contact-us/" className="text-gray-700 hover:text-primary transition-colors">Contact Us</Link>
              <a href="https://wa.me/443302295040" target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                WhatsApp Us
              </a>
              <Button onClick={() => window.location.href = '/?step=1'} className="bg-primary hover:bg-primary/90">
                Get my quote
              </Button>
            </nav>

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col space-y-4 mt-8">
                  <Link to="/#coverage" className="text-gray-700 hover:text-primary text-lg">What's Covered</Link>
                  <Link to="/make-a-claim/" className="text-gray-700 hover:text-primary text-lg">Make a Claim</Link>
                  <Link to="/faq/" className="text-gray-700 hover:text-primary text-lg">FAQs</Link>
                  <Link to="/contact-us/" className="text-gray-700 hover:text-primary text-lg">Contact Us</Link>
                  <a href="https://wa.me/443302295040" target="_blank" rel="noopener noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg text-center">
                    WhatsApp Us
                  </a>
                  <Button onClick={() => window.location.href = '/?step=1'} className="w-full">
                    Get my quote
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-white">
                Land Rover Extended Warranty
              </h1>
              <p className="text-xl text-white">
                Land Rover models offer strong capability and luxury, yet repairs for engines, gearboxes, and electrical systems remain among the highest in the UK market. A Land Rover extended warranty gives you financial protection, expert support and consistent reliability once your factory warranty ends.
              </p>
              <p className="text-lg text-white">
                We provide cover for new and used Land Rover warranty plans, including the most popular models. These include the Land Rover Defender, Range Rover, Range Rover Evoque, Range Rover Sport, Discovery and Discovery Sport.
              </p>
              <p className="text-lg text-white">
                You can choose your preferred garage and activate cover online in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  onClick={() => window.location.href = '/?step=1'}
                  className="bg-white text-primary hover:bg-gray-100 font-semibold text-lg px-8 py-6"
                >
                  Get My Land Rover Quote →
                </Button>
              </div>
            </div>
            <div className="relative">
              <OptimizedImage 
                src={rangeRoverImg}
                alt="Land Rover Range Rover extended warranty coverage"
                className="w-full max-w-md mx-auto"
                priority={true}
                width={600}
                height={400}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trustpilot Section */}
      <section className="bg-white py-8">
        <div className="container mx-auto px-4">
          <TrustpilotHeader className="justify-center" />
        </div>
      </section>

      {/* Why Consider Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Consider a Land Rover Car Extended Warranty
          </h2>
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-lg text-gray-700">
              Land Rover repair bills can rise quickly due to the complexity of advanced 4x4 systems, luxury electronics and premium components. A Land Rover car extended warranty gives you protection against:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Engine failures</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Gearbox and automatic transmission faults</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Suspension and air suspension issues</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Electrical system failures</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Cooling and overheating faults</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Drivetrain and differential issues</span>
              </div>
            </div>
            <p className="text-lg text-gray-700 mt-6">
              Modern Land Rover systems like Terrain Response, adaptive damping and advanced infotainment place additional load on sensitive components. A warranty shields you from unpredictable repair costs and maintains the value of your vehicle.
            </p>
          </div>
          <div className="text-center mt-8">
            <OptimizedImage 
              src={defenderImg}
              alt="Land Rover Defender warranty protection"
              className="w-full max-w-md mx-auto"
              priority={false}
              width={600}
              height={400}
            />
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            What Our Land Rover Extended Warranty Plans Include
          </h2>
          <p className="text-lg text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            Our Land Rover extended warranty plans offer comprehensive mechanical and electrical protection with clear terms and a fast claims process.
          </p>
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-6">Key benefits</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Cover for major mechanical and electrical components</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Diagnostics and labour included</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Instant online claims authorisation</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Nationwide garage network</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Flexible claim limits based on your vehicle value</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Monthly or annual payment options</span>
              </div>
            </div>
            <p className="text-lg text-gray-700 mt-8">
              We offer one of the most flexible mileage allowances in the UK. You can insure vehicles up to 150,000 miles, which is significantly higher than many traditional warranty providers. For full information on what your plan includes, please visit our <Link to="/#coverage" className="text-primary hover:underline">coverage page</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Repair Costs Table */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Average Land Rover Repair Costs
          </h2>
          <p className="text-lg text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            Premium models can create premium repair bills. Here is a helpful data reference to give drivers an idea of real-world costs.
          </p>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-lg overflow-hidden shadow-md">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="p-4 text-left font-bold">Component</th>
                  <th className="p-4 text-left font-bold">Average Repair Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4">Engine</td>
                  <td className="p-4 font-semibold">£2,200 to £5,800</td>
                </tr>
                <tr className="border-b bg-gray-50">
                  <td className="p-4">Automatic Gearbox</td>
                  <td className="p-4 font-semibold">£1,800 to £4,000</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Air Suspension</td>
                  <td className="p-4 font-semibold">£700 to £2,200</td>
                </tr>
                <tr className="border-b bg-gray-50">
                  <td className="p-4">Electrical System</td>
                  <td className="p-4 font-semibold">£250 to £1,100</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4">Turbocharger</td>
                  <td className="p-4 font-semibold">£900 to £2,100</td>
                </tr>
                <tr>
                  <td className="p-4">Cooling System</td>
                  <td className="p-4 font-semibold">£350 to £900</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-lg text-center text-gray-700 mt-8 max-w-3xl mx-auto">
            These are the types of bills a Land Rover warranty can absorb, protecting your budget.
          </p>
        </div>
      </section>

      {/* Models We Cover */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Land Rover Models We Cover
          </h2>
          <p className="text-lg text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            We offer extended warranty plans for all major Land Rover models sold through UK dealerships, including Jaguar Land Rover. This includes:
          </p>
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Land Rover Defender</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Range Rover</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Range Rover Sport</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Range Rover Evoque</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Range Rover Velar</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Range Rover Vogue</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Discovery</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Discovery Sport</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Freelander (used models)</span>
              </div>
            </div>
            <p className="text-lg text-gray-700 mt-8">
              All plans include wide support and access to approved repairers.
            </p>
          </div>
          <div className="text-center mt-8">
            <OptimizedImage 
              src={discoverySportImg}
              alt="Land Rover Discovery Sport extended warranty"
              className="w-full max-w-md mx-auto"
              priority={false}
              width={600}
              height={400}
            />
          </div>
        </div>
      </section>

      {/* Cost Information */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            How Much Does a Land Rover Warranty Cost
          </h2>
          <p className="text-lg text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            The Land Rover extended warranty cost depends on your vehicle age, mileage, cover level and chosen claim limit. Prices are usually lower than dealership warranties while offering broader cover across more components.
          </p>
          <p className="text-lg text-center text-gray-700 mb-8 max-w-3xl mx-auto">
            Get an instant price by entering your registration and mileage. Your quote updates in real time based on your chosen options.
          </p>
          <div className="text-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/?step=1'}
              className="bg-primary hover:bg-primary/90 font-semibold text-lg px-8 py-6"
            >
              Get My Instant Quote →
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
            Why Choose Our Extended Warranty for Land Rover Vehicles
          </h2>
          <p className="text-lg text-center text-gray-700 mb-12 max-w-3xl mx-auto">
            You receive professional, transparent and customer-centred protection.
          </p>
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-6">Our advantages</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">High mileage covers up to 150,000 miles</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Flexible monthly or annual payments</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">UK-wide repair network</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Fast digital claims</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">No long call centre delays</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Simple online activation</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <span className="text-gray-700">Cover that matches real-world Land Rover ownership needs</span>
              </div>
            </div>
            <p className="text-lg text-gray-700 mt-8">
              You remain in control of your costs with claim limits that suit your vehicle's market value.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqItems.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-lg">{faq.question}</span>
                  {expandedFAQ === index ? (
                    <ChevronUp className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-700">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ready To Secure Your Land Rover Today?
            </h2>
            <p className="text-xl text-white">
              Activate your extended cover in minutes and prevent costly surprises later. Get a personalised price based on your model, age and mileage, and drive with confidence knowing your Land Rover is protected.
            </p>
            <Button 
              size="lg"
              onClick={() => window.location.href = '/?step=1'}
              className="bg-white text-primary hover:bg-gray-100 font-semibold text-lg px-8 py-6"
            >
              Get My Land Rover Warranty Quote →
            </Button>
            <p className="text-sm text-white">Takes less than 60 seconds. No phone calls, no pressure - just instant pricing.</p>
          </div>
        </div>
      </section>

      <WebsiteFooter />
    </div>
  );
};

export default LandRoverWarranty;
