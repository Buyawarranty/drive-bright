-- Insert BMW Extended Used Car Warranty landing page with corrected field lengths
INSERT INTO public.landing_pages (
  slug,
  brand_name,
  page_type,
  status,
  h1_headline,
  meta_title,
  meta_description,
  focus_keyword,
  secondary_keywords,
  canonical_url,
  og_title,
  og_description,
  hero_content,
  features_content,
  coverage_content,
  pricing_content,
  testimonials_content,
  faqs,
  featured_image_url,
  brand_logo_url,
  supporting_images,
  internal_links,
  show_in_main_nav,
  show_in_footer,
  show_on_homepage,
  include_organization_schema,
  include_local_business_schema,
  include_product_schema,
  include_faq_schema,
  include_review_schema,
  include_breadcrumb_schema,
  local_business_name,
  local_business_phone,
  local_business_email,
  local_business_address,
  local_business_geo,
  robots_directive,
  is_indexable
) VALUES (
  'car-extended-warranty/bmw',
  'BMW',
  'brand_warranty',
  'published',
  'BMW Extended Warranty UK | Protect Your Ultimate Driving Machine',
  'BMW Extended Warranty | Used BMW Cover UK',
  'Protect your BMW from costly repairs. Extended warranty with UK garages, fast claims & flexible payments. Get an instant quote today.',
  'BMW extended warranty',
  ARRAY['BMW warranty UK', 'used BMW warranty', 'BMW car warranty', 'BMW protection plan', 'BMW breakdown cover'],
  'https://buyawarranty.co.uk/car-extended-warranty/bmw',
  'BMW Extended Warranty UK | Affordable Cover',
  'Get instant BMW warranty quotes. Comprehensive cover, UK garages, flexible monthly payments from £19.99.',
  '{
    "subheadline": "Comprehensive Cover for All BMW Models",
    "description": "Whether you drive a 1 Series, 3 Series, 5 Series, X3, X5, or M Sport, our extended warranty plans protect you from unexpected repair bills. Get covered in under 60 seconds.",
    "benefits": [
      "Full mechanical & electrical cover for all BMW models",
      "Parts & labour included - no hidden costs",
      "UK-wide approved garage network",
      "Fast claims - 94% approved within 24 hours",
      "14-day money-back guarantee",
      "Cover BMW-specific technology & iDrive systems"
    ],
    "ctaText": "Get My BMW Quote →"
  }'::jsonb,
  '{
    "title": "Why Choose Our BMW Warranty?",
    "items": [
      {"icon": "shield", "title": "BMW Specialist Cover", "description": "Covers complex systems like iDrive, xDrive AWD, and TwinPower Turbo engines."},
      {"icon": "clock", "title": "Instant Online Quotes", "description": "Get your quote in under 60 seconds. Fast, transparent pricing."},
      {"icon": "zap", "title": "Fast Claims Process", "description": "94% of claims approved within 24 hours. Use any UK garage."},
      {"icon": "star", "title": "Trustpilot Rated", "description": "Rated Excellent by thousands of BMW owners."}
    ]
  }'::jsonb,
  '{
    "title": "What Does Your BMW Warranty Cover?",
    "sections": [
      {
        "title": "Engine & Drivetrain",
        "items": ["TwinPower Turbo engines", "Valvetronic systems", "VANOS variable valve timing", "xDrive all-wheel drive", "Automatic & manual gearboxes", "Differential units"]
      },
      {
        "title": "Technology & Electronics",
        "items": ["iDrive infotainment system", "Digital instrument cluster", "Parking sensors & cameras", "Adaptive headlights", "Climate control systems", "Electric window motors"]
      },
      {
        "title": "BMW-Specific Systems",
        "items": ["Active steering systems", "Adaptive suspension", "M Sport components", "Start-stop technology", "EfficientDynamics systems", "Hybrid/PHEV components"]
      }
    ]
  }'::jsonb,
  '{
    "title": "Flexible BMW Warranty Plans",
    "subtitle": "Choose the cover level that suits your BMW and budget"
  }'::jsonb,
  '{
    "title": "What BMW Owners Say About Us",
    "items": [
      {"name": "James T., 330d Owner", "text": "My turbo failed and Buy a Warranty covered the entire £2,800 repair. Claim approved in less than a day!", "rating": 5},
      {"name": "Sarah M., X3 Owner", "text": "Peace of mind knowing my X3 is protected. Instant quote and reasonable monthly payment.", "rating": 5},
      {"name": "David K., 520i Owner", "text": "Had an issue with my iDrive system. Hassle-free claim and they paid the garage directly.", "rating": 5}
    ]
  }'::jsonb,
  '[
    {"question": "What BMW models do you cover?", "answer": "We cover all BMW models including 1 Series, 2 Series, 3 Series, 4 Series, 5 Series, 6 Series, 7 Series, 8 Series, X1, X2, X3, X4, X5, X6, X7, Z4, and all M Sport variants. Your BMW must be under 15 years old and have fewer than 150,000 miles."},
    {"question": "Are BMW-specific components covered?", "answer": "Yes! Our plans cover BMW technology including iDrive, VANOS, Valvetronic, xDrive, adaptive suspension, and TwinPower Turbo engines."},
    {"question": "Can I use a BMW dealership for repairs?", "answer": "Yes, you can use any VAT-registered garage in the UK, including official BMW dealerships. We pay the garage directly."},
    {"question": "How quickly are claims processed?", "answer": "94% of claims are approved within 24 hours. Our average BMW claim payout is over £1,200."},
    {"question": "What is not covered?", "answer": "Wear and tear items like brake pads, tyres, clutches, and routine servicing are not covered. Pre-existing faults and cosmetic damage are also excluded."},
    {"question": "Can I cancel my warranty?", "answer": "Yes, 14-day cooling-off period with full refund. After that, cancel anytime with pro-rata refund."}
  ]'::jsonb,
  '/assets/Bmw-extended-used-car-warranty.png',
  '/assets/logos/bmw.webp',
  '[
    {"url": "/assets/bmw-3-series-warranty.png", "alt": "BMW 3 Series Extended Warranty Cover", "caption": "Popular: BMW 3 Series warranty"},
    {"url": "/assets/bmw-x5-warranty.png", "alt": "BMW X5 SUV Extended Warranty", "caption": "SUV protection: BMW X5 cover"}
  ]'::jsonb,
  '[
    {"text": "Car Extended Warranty", "url": "/car-extended-warranty/"},
    {"text": "Audi Extended Warranty", "url": "/car-extended-warranty/audi/"},
    {"text": "Mercedes Extended Warranty", "url": "/car-extended-warranty/mercedes/"},
    {"text": "Make a Claim", "url": "/make-a-claim/"},
    {"text": "FAQs", "url": "/faq/"},
    {"text": "Contact Us", "url": "/contact-us/"}
  ]'::jsonb,
  false,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  'Buy A Warranty',
  '0330 229 5040',
  'support@buyawarranty.co.uk',
  '{"streetAddress": "Warranty House, 62 Berkhamsted Ave", "addressLocality": "Wembley", "addressRegion": "London", "postalCode": "HA9 6DT", "addressCountry": "GB"}'::jsonb,
  '{"latitude": 51.5574, "longitude": -0.2967}'::jsonb,
  'index, follow',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  brand_name = EXCLUDED.brand_name,
  status = EXCLUDED.status,
  h1_headline = EXCLUDED.h1_headline,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  focus_keyword = EXCLUDED.focus_keyword,
  secondary_keywords = EXCLUDED.secondary_keywords,
  canonical_url = EXCLUDED.canonical_url,
  og_title = EXCLUDED.og_title,
  og_description = EXCLUDED.og_description,
  hero_content = EXCLUDED.hero_content,
  features_content = EXCLUDED.features_content,
  coverage_content = EXCLUDED.coverage_content,
  testimonials_content = EXCLUDED.testimonials_content,
  faqs = EXCLUDED.faqs,
  featured_image_url = EXCLUDED.featured_image_url,
  brand_logo_url = EXCLUDED.brand_logo_url,
  supporting_images = EXCLUDED.supporting_images,
  internal_links = EXCLUDED.internal_links,
  include_organization_schema = EXCLUDED.include_organization_schema,
  include_local_business_schema = EXCLUDED.include_local_business_schema,
  include_product_schema = EXCLUDED.include_product_schema,
  include_faq_schema = EXCLUDED.include_faq_schema,
  include_review_schema = EXCLUDED.include_review_schema,
  include_breadcrumb_schema = EXCLUDED.include_breadcrumb_schema,
  local_business_name = EXCLUDED.local_business_name,
  local_business_phone = EXCLUDED.local_business_phone,
  local_business_email = EXCLUDED.local_business_email,
  local_business_address = EXCLUDED.local_business_address,
  local_business_geo = EXCLUDED.local_business_geo,
  updated_at = now();