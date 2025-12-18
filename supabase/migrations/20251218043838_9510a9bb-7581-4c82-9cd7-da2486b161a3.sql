-- Create landing_pages table for SEO-optimized brand landing pages
CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Core page data
  slug VARCHAR(255) NOT NULL UNIQUE,
  brand_name VARCHAR(255) NOT NULL,
  page_type VARCHAR(50) DEFAULT 'brand_warranty',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  
  -- SEO fields
  h1_headline TEXT NOT NULL,
  meta_title VARCHAR(60) NOT NULL,
  meta_description VARCHAR(160) NOT NULL,
  focus_keyword VARCHAR(100),
  secondary_keywords TEXT[],
  canonical_url TEXT,
  
  -- Open Graph (unique per page)
  og_title VARCHAR(100),
  og_description VARCHAR(200),
  og_image_url TEXT,
  
  -- Content sections (JSON for flexibility)
  hero_content JSONB DEFAULT '{}'::jsonb,
  features_content JSONB DEFAULT '{}'::jsonb,
  coverage_content JSONB DEFAULT '{}'::jsonb,
  pricing_content JSONB DEFAULT '{}'::jsonb,
  testimonials_content JSONB DEFAULT '{}'::jsonb,
  
  -- FAQ section for schema
  faqs JSONB DEFAULT '[]'::jsonb,
  
  -- Images
  featured_image_url TEXT,
  brand_logo_url TEXT,
  supporting_images JSONB DEFAULT '[]'::jsonb,
  
  -- Internal linking (avoid orphan pages)
  internal_links JSONB DEFAULT '[]'::jsonb,
  show_in_main_nav BOOLEAN DEFAULT false,
  show_in_footer BOOLEAN DEFAULT false,
  show_on_homepage BOOLEAN DEFAULT false,
  nav_order INTEGER DEFAULT 99,
  
  -- Schema markup options
  include_organization_schema BOOLEAN DEFAULT true,
  include_local_business_schema BOOLEAN DEFAULT true,
  include_product_schema BOOLEAN DEFAULT true,
  include_faq_schema BOOLEAN DEFAULT true,
  include_review_schema BOOLEAN DEFAULT true,
  include_breadcrumb_schema BOOLEAN DEFAULT true,
  
  -- Local Business Schema data (UK address for geo-targeting)
  local_business_name VARCHAR(255) DEFAULT 'Buy A Warranty',
  local_business_address JSONB DEFAULT '{"streetAddress": "United Kingdom", "addressLocality": "London", "addressRegion": "England", "postalCode": "", "addressCountry": "GB"}'::jsonb,
  local_business_phone VARCHAR(50) DEFAULT '+443302295040',
  local_business_email VARCHAR(255) DEFAULT 'support@buyawarranty.co.uk',
  local_business_geo JSONB DEFAULT '{"latitude": 51.5074, "longitude": -0.1278}'::jsonb,
  
  -- Publishing
  published_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  
  -- Indexing controls
  is_indexable BOOLEAN DEFAULT true,
  robots_directive VARCHAR(100) DEFAULT 'index, follow',
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  last_edited_by UUID,
  
  -- Performance tracking
  view_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can view all landing pages" 
ON public.landing_pages 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can create landing pages" 
ON public.landing_pages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update landing pages" 
ON public.landing_pages 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can delete landing pages" 
ON public.landing_pages 
FOR DELETE 
USING (true);

-- Create index for slug lookups (critical for performance)
CREATE INDEX idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX idx_landing_pages_status ON public.landing_pages(status);
CREATE INDEX idx_landing_pages_brand ON public.landing_pages(brand_name);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_landing_pages_updated_at
BEFORE UPDATE ON public.landing_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert brand templates for bulk creation
INSERT INTO public.landing_pages (slug, brand_name, h1_headline, meta_title, meta_description, focus_keyword, status)
VALUES 
  ('toyota-extended-warranty', 'Toyota', 'Toyota Extended Warranty UK', 'Toyota Extended Warranty | Used Toyota Cover & Quotes', 'Protect your Toyota from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Toyota warranty', 'draft'),
  ('honda-extended-warranty', 'Honda', 'Honda Extended Warranty UK', 'Honda Extended Warranty | Used Honda Cover & Quotes', 'Protect your Honda from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Honda warranty', 'draft'),
  ('vauxhall-extended-warranty', 'Vauxhall', 'Vauxhall Extended Warranty UK', 'Vauxhall Extended Warranty | Used Vauxhall Cover & Quotes', 'Protect your Vauxhall from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Vauxhall warranty', 'draft'),
  ('peugeot-extended-warranty', 'Peugeot', 'Peugeot Extended Warranty UK', 'Peugeot Extended Warranty | Used Peugeot Cover & Quotes', 'Protect your Peugeot from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Peugeot warranty', 'draft'),
  ('kia-extended-warranty', 'Kia', 'Kia Extended Warranty UK', 'Kia Extended Warranty | Used Kia Cover & Quotes', 'Protect your Kia from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Kia warranty', 'draft'),
  ('mazda-extended-warranty', 'Mazda', 'Mazda Extended Warranty UK', 'Mazda Extended Warranty | Used Mazda Cover & Quotes', 'Protect your Mazda from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Mazda warranty', 'draft'),
  ('seat-extended-warranty', 'SEAT', 'SEAT Extended Warranty UK', 'SEAT Extended Warranty | Used SEAT Cover & Quotes', 'Protect your SEAT from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'SEAT warranty', 'draft'),
  ('renault-extended-warranty', 'Renault', 'Renault Extended Warranty UK', 'Renault Extended Warranty | Used Renault Cover & Quotes', 'Protect your Renault from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Renault warranty', 'draft'),
  ('citroen-extended-warranty', 'Citroën', 'Citroën Extended Warranty UK', 'Citroën Extended Warranty | Used Citroën Cover & Quotes', 'Protect your Citroën from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'Citroën warranty', 'draft'),
  ('mini-extended-warranty', 'MINI', 'MINI Extended Warranty UK', 'MINI Extended Warranty | Used MINI Cover & Quotes', 'Protect your MINI from costly repairs with extended warranty. Instant quotes, UK garages, flexible plans.', 'MINI warranty', 'draft');