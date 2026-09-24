/**
 * Route metadata for build-time prerendering.
 *
 * Each entry produces a static `<route>/index.html` file at build time so that
 * social scrapers (WhatsApp, iMessage, Facebook, Twitter, LinkedIn, etc.) and
 * search engines see route-specific <title>, <meta description>, canonical,
 * and Open Graph tags — instead of the homepage defaults.
 *
 * Real users still get the SPA: the body is unchanged and React Router
 * hydrates normally on first paint.
 */

export interface RouteMeta {
  /** URL path, must start with `/`. Trailing slash is normalized. */
  path: string;
  title: string;
  description: string;
  /** Optional override for OG image. Falls back to the site default. */
  ogImage?: string;
  /** Optional Open Graph type override, e.g. "article" for editorial pages. */
  ogType?: string;
  /** Static <h1> for the crawler-visible fallback body. Defaults to the title minus its brand suffix. */
  h1?: string;
  /** Static intro paragraph for the crawler-visible fallback body. Defaults to the description. */
  intro?: string;
}


const SITE = "https://buyawarranty.co.uk";
const DEFAULT_OG_IMAGE = `${SITE}/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png`;

export const DEFAULT_OG_IMAGE_URL = DEFAULT_OG_IMAGE;
export const SITE_URL = SITE;

export const PRERENDER_ROUTES: RouteMeta[] = [
  // ---------------- Footer / legal ----------------
  {
    path: "/cancellation-policy/",
    title: "Cancellation Policy | Buy A Warranty",
    description:
      "Read our cancellation policy. 14-day money back guarantee, refund eligibility and how to cancel your warranty plan.",
  },
  {
    path: "/cancel-warranty/",
    title: "Cancel Your Warranty | Buy A Warranty",
    description:
      "Need to cancel your warranty? Check refund eligibility and submit a cancellation request online in minutes.",
  },
  {
    path: "/privacy/",
    title: "Privacy Policy | Buy A Warranty",
    description:
      "How Buy A Warranty collects, uses and protects your personal data. GDPR-compliant privacy policy for UK customers.",
  },
  {
    path: "/terms/",
    title: "Terms & Conditions | Buy A Warranty",
    description:
      "Terms and conditions for using buyawarranty.co.uk and purchasing a vehicle warranty plan.",
  },
  {
    path: "/cookies/",
    title: "Cookie Policy | Buy A Warranty",
    description:
      "How we use cookies on buyawarranty.co.uk and how you can manage your cookie preferences.",
  },
  {
    path: "/complaints/",
    title: "Complaints Procedure | Buy A Warranty",
    description:
      "How to raise a complaint with Buy A Warranty. Our resolution process, response times and escalation steps.",
  },
  {
    path: "/contact-us/",
    title: "Contact Us | Buy A Warranty",
    description:
      "Get in touch with Buy A Warranty. Call 0330 229 5040, email support@buyawarranty.co.uk, or message us on WhatsApp.",
  },
  {
    path: "/faq/",
    title: "Frequently Asked Questions | Buy A Warranty",
    description:
      "Answers to common questions about car, van, EV and motorbike warranties — claims, cover, pricing and more.",
  },
  {
    path: "/make-a-claim/",
    title: "Make a Claim | Buy A Warranty",
    description:
      "Submit a warranty claim online. Fast claims process, dedicated claims line on 0330 229 5045.",
  },
  {
    path: "/warranty-transfer",
    title: "Warranty Transfer | Buy A Warranty",
    description:
      "Selling your vehicle? Transfer your warranty to the new owner quickly and add value to the sale.",
  },
  {
    path: "/discount-promo-offers/",
    title: "Car Warranty Discount Codes 2026 | Buy A Warranty",
    description:
      "Latest discounts and promotional offers on car, van, EV and motorbike warranty plans.",
  },
  {
    path: "/thewarrantyhub/",
    title: "The Warranty Hub | Drive Smarter | Buy A Warranty",
    description:
      "Guides, tips and articles to help you drive smarter and protect your vehicle.",
  },

  // ---------------- The Warranty Hub articles ----------------
  {
    path: "/thewarrantyhub/platinum-warranty-cover-modifications-uk-vehicle-protection-guide/",
    title: "Platinum Warranty Cover & Modifications | UK Guide 2026",
    description:
      "What Platinum car warranty cover includes for petrol, diesel, hybrid, EV and motorbike vehicles in the UK, plus exclusions and how engine remaps affect claims.",
    ogType: "article",
    ogImage:
      "https://buyawarranty.co.uk/blog/platinum-warranty-cover-modifications-uk.jpg",
  },
  {
    path: "/thewarrantyhub/top-rated-car-warranty-uk-buyer-guide/",
    title: "Top Rated Car Warranty UK 2026 | Buyer Guide & Cover Tiers",
    description:
      "How the top rated UK car warranties compare on cover tiers, labour rate limits, claim limits and garage choice, and how to pick the right plan in 2026.",
    ogType: "article",
    ogImage:
      "https://buyawarranty.co.uk/blog/top-rated-car-warranty-uk-claim-approved.jpg",
  },
  {
    path: "/thewarrantyhub/stop-overpaying-for-repairs-maintenance-warranty-vs-extended-warranty/",
    title: "Maintenance Warranty vs Extended Warranty UK | Key Differences",
    description:
      "Understand the difference between a maintenance warranty and an extended warranty in the UK, what each covers, 2026 costs and how to stop overpaying for repairs.",
    ogType: "article",
    ogImage: "https://buyawarranty.co.uk/blog/maintenance-vs-extended-warranty-uk.jpg",
  },
  {
    path: "/thewarrantyhub/2026-toyota-corolla-cross-first-look-features-price-reliability/",
    title: "2026 Toyota Corolla Cross First Look UK | Price & Reliability",
    description:
      "First look at the 2026 Toyota Corolla Cross with updated design and hybrid efficiency in the UK, plus price expectations, reliability insight and warranty advice.",
    ogType: "article",
    ogImage: "https://buyawarranty.co.uk/blog/2026-toyota-corolla-cross-uk.jpg",
  },
  {
    path: "/thewarrantyhub/toyota-corolla-hybrid-ownership-cost-uk-fuel-savings-vs-warranty-protection/",
    title: "Toyota Corolla Hybrid Ownership Cost UK | Fuel Savings vs Warranty",
    description:
      "Real UK running costs for the Toyota Corolla Hybrid — fuel savings, servicing, common repair bills and when warranty cover pays for itself.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/cheap-car-warranty-in-the-uk-what-is-covered-what-is-not-how-to-choose-smartly/",
    title: "Cheap Car Warranty UK | What's Covered & How to Choose",
    description:
      "What a cheap UK car warranty covers, what it excludes, and how to judge genuine value instead of just the lowest monthly price.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/are-car-warranties-worth-it-best-car-warranty-uk-2026/",
    title: "Are Car Warranties Worth It? Best Car Warranty UK 2026",
    description:
      "Whether a car warranty is worth it in the UK, typical repair bills it offsets, and how to compare the best cover in 2026.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/uk-car-theft-hotspots-2026-riskiest-areas-and-protection/",
    title: "UK Car Theft Hotspots 2026 | Riskiest Areas & Protection",
    description:
      "The UK's riskiest areas for vehicle theft in 2026 and practical steps, devices and cover that protect your car.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/what-is-cat-n-car-uk-write-off-categories-guide-2026/",
    title: "What Is a Cat N Car? UK Write-Off Categories Guide 2026",
    description:
      "Cat N, Cat S, Cat B and Cat A explained for UK buyers in 2026, what they mean for value, insurance and warranty cover.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/top-10-stolen-cars-uk-2026-trends-and-security/",
    title: "Top 10 Stolen Cars UK 2026 | Theft Trends and Security",
    description:
      "The models UK thieves target most in 2026, how keyless relay theft works, and the security measures that actually stop it.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/electric-car-running-costs-uk-2026-tax-insurance-servicing/",
    title: "Electric Car Running Costs UK 2026 | Tax, Insurance, Servicing",
    description:
      "What an EV really costs to run in the UK in 2026, covering VED, home and public charging, insurance, servicing and repairs.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/car-warranty-vs-breakdown-cover-vs-insurance-uk-2026/",
    title: "Car Warranty vs Breakdown Cover vs Insurance UK 2026",
    description:
      "How warranty, breakdown cover and insurance differ in the UK, what each one pays for, and which combination UK drivers actually need.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/uk-car-repair-costs-2026-without-warranty/",
    title: "UK Car Repair Costs 2026 | What Repairs Cost Without Cover",
    description:
      "2026 UK repair cost data — gearbox, clutch, turbo, EGR, hybrid battery and more — and what a warranty would have covered.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/used-car-warranty-uk-2026-whats-covered-when-to-buy/",
    title: "Used Car Warranty UK 2026 | What's Covered & When to Buy",
    description:
      "What a used car warranty covers in the UK, the best time to buy cover, claim limits, labour rates and how to make a claim.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/dealership-vs-independent-cover-protect-used-car-uk-2026/",
    title: "Dealership vs Independent Warranty UK 2026 | Which Is Better",
    description:
      "Dealer warranty or independent cover for your used car? Price, claim limits, garage choice and flexibility compared for UK buyers.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/good-mileage-used-car-uk-2026-buyers-guide/",
    title: "Good Mileage for a Used Car UK | 2026 Buyer's Guide",
    description:
      "What counts as good mileage for a used car in the UK, how age and mileage interact, and when higher mileage is still a safe buy.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/auto-warranty-vs-extended-warranty-insurance-uk-2026/",
    title: "Auto Warranty vs Extended Warranty Insurance UK 2026",
    description:
      "The real difference between an auto warranty and extended warranty insurance in the UK, and which protects you better.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/do-electric-cars-need-mot-uk-rules-explained-2026/",
    title: "Do Electric Cars Need an MOT? UK Rules Explained 2026",
    description:
      "Yes, electric cars need an MOT in the UK from age 3, then annually. What is tested, why the battery is not checked, top EV failure reasons and 2026 costs.",
    ogType: "article",
    ogImage: `${SITE}/__l5e/assets-v1/ca53618a-c7fb-458c-b503-b3eb9d2993a0/do-electric-cars-need-mot-uk-2026-hero.jpg`,
  },

  {
    path: "/thewarrantyhub/top-reasons-car-warranty-claims-rejected-uk-2026/",
    title: "Top 7 Reasons UK Warranty Claims Get Rejected (2026)",
    description:
      "The most common reasons UK car warranty claims are rejected and the simple steps that keep your claim valid.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/12-top-reliable-used-cars-under-15000-uk-2026/",
    title: "12 Reliable Used Cars Under £15,000 UK (2026)",
    description:
      "Twelve dependable used cars under £15,000 in the UK for 2026, with known weak points and running-cost notes.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/is-maintenance-warranty-necessary-used-cars-uk-2026/",
    title: "Is a Maintenance Warranty Necessary for a Used Car? UK 2026",
    description:
      "Whether a maintenance warranty is worth it on a UK used car, what it covers versus servicing, and who benefits most.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/private-car-warranty-uk-2026-safe-without-a-dealer/",
    title: "Private Car Warranty UK 2026 | Safe to Buy Without a Dealer?",
    description:
      "Buying warranty cover for a privately bought car in the UK — eligibility, inspections, waiting periods and what to check first.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/maintenance-warranty-vs-extended-warranty-uk-2026/",
    title: "Maintenance Warranty vs Extended Warranty UK 2026",
    description:
      "Maintenance plan or extended warranty? What each covers in the UK, typical costs and which one suits your car.",
    ogType: "article",
  },
  {
    path: "/thewarrantyhub/tesla-warranty-uk-2026-battery-cover-repair-costs-extended-options/",
    title: "Tesla Warranty UK 2026 | Battery Cover & Repair Costs",
    description:
      "Tesla's UK warranty runs 4 years or 60,000 miles with 8 years of battery and drive unit cover. See 2026 repair costs, battery limits and extended options.",
    ogType: "article",
    ogImage: `${SITE}/blog/tesla-warranty-uk-2026.jpg`,
  },
  {
    path: "/thewarrantyhub/tesla-car-price-extended-warranty-uk-2026-ownership-guide/",
    title: "Tesla Car Price & Extended Warranty UK 2026 | Ownership Guide",
    description:
      "Tesla UK prices, EV road tax, Helvetia extended cover and independent warranty options for older Tesla models in 2026.",
    ogType: "article",
    ogImage: "https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/blog-images/tesla-car-price-extended-warranty-uk-2026.jpg",
  },
  {
    path: "/thewarrantyhub/petrol-diesel-vehicle-warranty-cover-complete-uk-drivers-guide/",
    title: "Petrol & Diesel Car Warranty Cover UK | Complete Guide",
    description:
      "What's covered on a UK petrol or diesel extended warranty: engine, turbo, gearbox, wheel bearings, electrics and diagnostics, plus typical repair costs without cover.",
    ogType: "article",
    ogImage: `${SITE}/blog/petrol-diesel-vehicle-warranty-cover-uk.jpg`,
  },
  {
    path: "/thewarrantyhub/land-rover-extended-warranty-cost-uk-2026-prices-repair-costs/",
    title: "Land Rover Warranty Cost UK 2026 | Repair Prices",
    description:
      "Compare Land Rover extended warranty costs in the UK for 2026, including prices from £19 a month, repair bills and what to check before buying.",
    ogType: "article",
    ogImage: "https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/blog-images/land-rover-warranty-cost-uk-2026.jpg",
  },


  // ---------------- Main product pages ----------------
  {
    path: "/buy-a-used-car-warranty-reliable-warranties/",
    title: "Buy a Car Warranty Online | Trusted UK Cover",
    description:
      "Comprehensive used car warranty cover from 60p a day. Protect your car against unexpected repair bills.",
  },
  {
    path: "/van-warranty/",
    title: "Van Warranty | UK Van Cover | Buy A Warranty",
    description:
      "Affordable van warranty cover for tradespeople and businesses. Instant quotes, flexible plans.",
  },
  {
    path: "/ev-warranty/",
    title: "EV Warranty | Electric Vehicle Cover | Buy A Warranty",
    description:
      "Specialist warranty cover for electric vehicles. Battery, motor and drivetrain protection.",
  },
  {
    path: "/motorcycle-warranty/",
    title: "Motorbike Warranty | UK Motorcycle Cover | Buy A Warranty",
    description:
      "Reliable warranty cover for motorbikes. Protect against unexpected mechanical and electrical failures.",
  },
  {
    path: "/car-extended-warranty/",
    title: "Extended Car Warranty UK | Buy A Warranty",
    description:
      "Extend your car warranty with flexible UK plans. Instant quotes, no hidden fees.",
  },
  {
    path: "/warranty-types/",
    title: "Warranty Types | Choose Your Plan | Buy A Warranty",
    description:
      "Compare warranty types and find the right plan for your car, van, EV or motorbike.",
  },
  {
    path: "/warranty-types/vans-warranty/",
    title: "Vans Warranty | Buy A Warranty",
    description:
      "Specialist vans warranty plans designed for trade and business use.",
  },
  {
    path: "/used-car-warranty-uk/",
    title: "Used Car Warranty UK | Buy A Warranty",
    description:
      "Trusted UK used car warranty provider. 5-star reviews, instant online quotes from 60p a day.",
  },

  // ---------------- Brand-specific PPC landing pages ----------------
  {
    path: "/car-extended-warranty/mercedes-benz/",
    title: "Mercedes-Benz Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Mercedes-Benz from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/207b7a00-2fce-48b8-9893-e9deb63e4a0d/mercedes-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/volkswagen/",
    title: "Volkswagen Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Volkswagen from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/a8654212-2d11-434d-84c0-7ac213730b6d/vw-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/bmw/",
    title: "BMW Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your BMW from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/c5a3804c-e712-43cb-aaf7-d8e1dff42533/bmw-panda-hero.png`,
  },
  {
    path: "/car-extended-warranty/audi/",
    title: "Audi Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Audi from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/546b3135-5645-4d9f-b5ee-076fa2745d48/audi-hero-panda-cars.png`,
  },
  {
    path: "/car-extended-warranty/nissan/",
    title: "Nissan Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Nissan from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/43bea0eb-75cf-4a29-9b93-7a3efd4e1de7/nissan-hero-panda-cars.png`,
  },
  {
    path: "/car-extended-warranty/vauxhall/",
    title: "Vauxhall Extended Warranty Cover from £19/month | Buy A Warranty",
    description:
      "Protect your Vauxhall from unexpected repair bills with flexible UK warranty cover from £19/month. Instant online quote in under 60 seconds.",
    ogImage: `${SITE}/__l5e/assets-v1/9d7591c8-b60e-4b72-95af-0623d578e089/vauxhall-hero-panda-cars.png`,
  },

  // ---------------- Added Aug 2026: static canonical + meta for every sitemap route ----------------
  {
    path: "/cancel-warranty/",
    title: "Cancel Your Warranty | BuyAWarranty",
    description:
      "Cancel your used car warranty easily. Understand your cooling off rights, refund process and alternative options.",
  },
  {
    path: "/car-extended-warranty/ford/",
    title: "Ford Extended Warranty Cover from \u00a319/month | Quote",
    description:
      "Protect your Ford from unexpected repair bills with flexible UK warranty cover from \u00a319/month. Instant online quote in under 60 seconds.",
  },
  {
    path: "/car-extended-warranty/hyundai/",
    title: "Hyundai Extended Warranty | Used Hyundai Cover & Instant Quotes",
    description:
      "Extend your Hyundai warranty and protect against expensive repairs. Get instant quotes for used Hyundai cover, including high-mileage cars up to 150,000 miles.",
  },
  {
    path: "/car-extended-warranty/jaguar/",
    title: "Jaguar Car Extended Warranty | Cover for New & Used Models",
    description:
      "Protect your Jaguar with comprehensive extended warranty cover for new and used models. Get instant online quotes, flexible plans and protection from costly repairs.",
  },
  {
    path: "/car-extended-warranty/land-rover/",
    title: "Land Rover Warranty UK | Discovery & Range Rover Cover",
    description:
      "Protect your Land Rover or Range Rover from unexpected repair bills with flexible UK warranty cover from \u00a319/month. Instant online quote in under 60 seconds.",
  },
  {
    path: "/car-extended-warranty/skoda/",
    title: "\u0160koda Car Extended Warranty | Cover for New & Used Models",
    description:
      "Protect your \u0160koda with comprehensive extended warranty cover for new and used models. Get instant quotes, flexible plans and protection from costly repairs.",
  },
  {
    path: "/careers/",
    title: "Warranty Sales Jobs UK | Remote PAYE Careers",
    description:
      "Remote UK Vehicle Warranty Sales Executive role. Full-time PAYE, warm leads, uncapped commission, OTE \u00a335,000\u2013\u00a360,000+. Apply to join the Buyawarranty sales team.",
  },
  {
    path: "/warranty-plan/",
    title: "12 Month Car Warranty UK | Affordable Cover | BuyA Warranty",
    description:
      "Get 12 month car warranty protection in the UK with BuyA Warranty. Affordable cover, flexible terms and reliable mechanical breakdown insurance.",
  },
  {
    path: "/warranty-types/audi-warranty/",
    title: "Audi Extended Warranty UK | Instant Quote | BuyA Warranty",
    description:
      "Audi Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/bmw-warranty/",
    title: "BMW Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "BMW Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/citroen-warranty/",
    title: "Citro\u00ebn Extended Warranty UK | From \u00a319/mo | Buy A Warranty",
    description:
      "Citro\u00ebn Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/ev-warranty/",
    title: "EV Warranty UK | Electric Vehicle Cover | BuyA Warranty",
    description:
      "EV Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/ford-warranty/",
    title: "Ford Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Ford Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/honda-warranty/",
    title: "Honda Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Honda Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/hybrid-warranty/",
    title: "Hybrid Warranty UK | BuyA Warranty Protection",
    description:
      "Hybrid Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/hyundai-warranty/",
    title: "Hyundai Extended Warranty UK | Tucson, i30, Kona, IONIQ 5 from \u00a319/mo",
    description:
      "Hyundai Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/kia-warranty/",
    title: "Kia Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Kia Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/mercedes-warranty/",
    title: "Mercedes Extended Warranty UK | Instant Quote | BuyA Warranty",
    description:
      "Mercedes Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/mg-warranty/",
    title: "MG Extended Warranty UK | BuyA Warranty Cover",
    description:
      "MG Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/motorbike-motorcycle-warranty/",
    title: "Motorbike Warranty UK | Full Protection | BuyA Warranty",
    description:
      "Motorbike Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/nissan-warranty/",
    title: "Nissan Extended Warranty UK | Get Your Instant Quote | Buy A Warranty",
    description:
      "Nissan Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/peugeot-warranty/",
    title: "Peugeot Extended Warranty UK | Reliable Cover | BuyA Warranty",
    description:
      "Peugeot Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/phev-warranty/",
    title: "PHEV Warranty UK | Plug-In Hybrid Cover | BuyA Warranty",
    description:
      "PHEV Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/skoda-warranty/",
    title: "Skoda Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Skoda Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/suv-warranty/",
    title: "SUV Extended Warranty UK | 4x4 Cover from \u00a321/mo | BuyAWarranty",
    description:
      "SUV Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/toyota-warranty/",
    title: "Toyota Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Toyota Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/vauxhall-warranty/",
    title: "Vauxhall Extended Warranty UK | Corsa, Astra, Grandland Cover from \u00a319/mo",
    description:
      "Vauxhall Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/volkswagen-warranty/",
    title: "Volkswagen Extended Warranty UK | Trusted Cover | BuyA Warranty",
    description:
      "Volkswagen Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/warranty-types/volvo-warranty/",
    title: "Volvo Extended Warranty UK | Get Instant Quote | BuyA Warranty",
    description:
      "Volvo Extended Warranty UK \u2014 UK extended warranty cover from \u00a319/month with unlimited claims, nationwide approved garages and instant online quotes in under 60 seconds.",
  },
  {
    path: "/what-is-covered/",
    title: "What's Covered | Complete UK Vehicle Warranty Coverage Guide",
    description:
      "See exactly what your warranty covers and what we pay. Unlimited claims, parts and labour included. Petrol, diesel, hybrid, EV and motorcycles.",
  },
  {
    path: "/warranty-types/ssangyong-warranty/",
    title: "SsangYong Extended Warranty UK | Reliable Car Protection Plans",
    description:
      "SsangYong extended warranty cover in the UK from \u00a319/month \u2014 Rexton, Korando and Tivoli protection with unlimited claims and instant online quotes.",
  },
  {
    path: "/warranty-types/tesla-warranty/",
    title: "Tesla Warranty UK | Model 3, Y, S & X Cover | Buy A Warranty",
    description:
      "Tesla warranty cover in the UK for Model 3, Model Y, Model S and Model X — drive unit, on-board charger, power electronics and MCU protection with instant online quotes.",
  },
  {
    path: "/warranty-types/dacia-warranty/",
    title: "Dacia Extended Warranty UK | Sandero, Duster & Jogger Cover",
    description:
      "Dacia extended warranty cover in the UK for Sandero, Duster, Jogger and Spring — turbo, gearbox and electrics protection with instant online quotes.",
  },
  {
    path: "/warranty-types/jeep-warranty/",
    title: "Jeep Extended Warranty UK | Renegade, Compass & Cherokee",
    description:
      "Jeep extended warranty cover in the UK for Renegade, Compass, Cherokee and Wrangler — gearbox, 4x4 driveline and electronics protection, quoted online in 60 seconds.",
  },
  {
    path: "/warranty-types/smart-warranty/",
    title: "smart Car Warranty UK | fortwo & forfour Cover | Buy A Warranty",
    description:
      "smart car warranty cover in the UK for fortwo, forfour and EQ models — clutch actuator, gear selector and electrics protection with instant online quotes.",
  },
  {
    path: "/warranty-types/subaru-warranty/",
    title: "Subaru Extended Warranty UK | Forester, Outback & Impreza",
    description:
      "Subaru extended warranty cover in the UK for Forester, Outback, Impreza and XV — boxer engine, CVT and all-wheel-drive protection quoted online in 60 seconds.",
  },
  {
    path: "/warranty-types/porsche-warranty/",
    title: "Porsche Extended Warranty UK | Instant Quote | Buy A Warranty",
    description:
      "Porsche extended warranty cover in the UK for Macan, Cayenne, Boxster, Cayman and Panamera — specialist labour rates and instant online quotes.",
  },
  {
    path: "/warranty-types/lexus-warranty/",
    title: "Lexus Extended Warranty UK | Hybrid Cover | Buy A Warranty",
    description:
      "Lexus extended warranty cover in the UK for IS, NX, RX, UX and CT — hybrid transaxle, inverter and electronics protection with instant online quotes.",
  },
  {
    path: "/warranty-types/mini-warranty/",
    title: "MINI Extended Warranty UK | Hatch, Countryman & Clubman",
    description:
      "MINI extended warranty cover in the UK for Hatch, Countryman, Clubman and Convertible — timing chain, gearbox and electrics protection quoted online.",
  },
  {
    path: "/warranty-types/alfa-romeo-warranty/",
    title: "Alfa Romeo Extended Warranty UK | Giulia, Stelvio & Giulietta",
    description:
      "Alfa Romeo extended warranty cover in the UK for Giulia, Stelvio, Giulietta and MiTo — gearbox, turbo and electronics protection quoted online in 60 seconds.",
  },
  {
    path: "/warranty-types/suzuki-warranty/",
    title: "Suzuki Extended Warranty UK | Swift, Vitara & Jimny Cover",
    description:
      "Suzuki extended warranty cover in the UK for Swift, Vitara, S-Cross, Ignis and Jimny — mechanical and electrical protection with instant online quotes.",
  },
  {
    path: "/warranty-types/mitsubishi-warranty/",
    title: "Mitsubishi Extended Warranty UK | Outlander PHEV & ASX",
    description:
      "Mitsubishi extended warranty cover in the UK for Outlander PHEV, ASX, Shogun and L200 — hybrid drive, gearbox and 4x4 protection quoted online.",
  },
  {
    path: "/warranty-types/byd-warranty/",
    title: "BYD Warranty UK | Atto 3, Dolphin & Seal Cover | Buy A Warranty",
    description:
      "BYD warranty cover in the UK for Atto 3, Dolphin, Seal and Seal U — drive motor, on-board charger and power electronics protection with instant online quotes.",
  },
  {
    path: "/warranty-types/chevrolet-warranty/",
    title: "Chevrolet Extended Warranty UK | Captiva, Cruze & Spark",
    description:
      "Chevrolet extended warranty cover in the UK for Captiva, Cruze, Aveo, Spark and Orlando — engine, gearbox and electrics protection quoted online.",
  },
  {
    path: "/warranty-types/chrysler-warranty/",
    title: "Chrysler Extended Warranty UK | Grand Voyager & 300C Cover",
    description:
      "Chrysler extended warranty cover in the UK for Grand Voyager, 300C, Ypsilon and Delta — automatic gearbox, engine and electrics protection quoted online.",
  },
  {
    path: "/warranty-types/dodge-warranty/",
    title: "Dodge Extended Warranty UK | Journey, Nitro & Caliber Cover",
    description:
      "Dodge extended warranty cover in the UK for Journey, Nitro, Caliber and Avenger — gearbox, driveline and electrics protection with instant online quotes.",
  },
  {
    path: "/warranty-types/infiniti-warranty/",
    title: "Infiniti Extended Warranty UK | Q30, QX30 & Q50 Cover",
    description:
      "Infiniti extended warranty cover in the UK for Q30, QX30, Q50 and FX — gearbox, turbo and electronics protection quoted online in 60 seconds.",
  },
  {
    path: "/warranty-types/cadillac-warranty/",
    title: "Cadillac Extended Warranty UK | CTS, BLS & Escalade Cover",
    description:
      "Cadillac extended warranty cover in the UK for CTS, BLS, SRX and Escalade — automatic gearbox, engine and electrics protection quoted online.",
  },
];
