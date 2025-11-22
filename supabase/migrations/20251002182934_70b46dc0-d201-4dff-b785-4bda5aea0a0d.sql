-- Create blog_authors table
CREATE TABLE public.blog_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create blog_categories table
CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create blog_tags table
CREATE TABLE public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content JSONB NOT NULL,
  featured_image_url TEXT,
  author_id UUID REFERENCES blog_authors(id),
  category_id UUID REFERENCES blog_categories(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  canonical_url TEXT,
  meta_tags JSONB DEFAULT '{}',
  structured_data JSONB DEFAULT '{}',
  word_count INTEGER DEFAULT 0,
  read_time_minutes INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  enable_comments BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create blog_post_tags junction table
CREATE TABLE public.blog_post_tags (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Create blog_comments table
CREATE TABLE public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX idx_blog_posts_featured ON blog_posts(is_featured) WHERE is_featured = true;
CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_updated_at();

CREATE TRIGGER update_blog_authors_updated_at
  BEFORE UPDATE ON blog_authors
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_updated_at();

-- Enable RLS
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_authors
CREATE POLICY "Everyone can view active authors"
  ON blog_authors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage authors"
  ON blog_authors FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for blog_categories
CREATE POLICY "Everyone can view active categories"
  ON blog_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON blog_categories FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for blog_tags
CREATE POLICY "Everyone can view tags"
  ON blog_tags FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tags"
  ON blog_tags FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for blog_posts
CREATE POLICY "Everyone can view published posts"
  ON blog_posts FOR SELECT
  USING (status = 'published' AND published_at <= now());

CREATE POLICY "Admins can manage all posts"
  ON blog_posts FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for blog_post_tags
CREATE POLICY "Everyone can view post tags"
  ON blog_post_tags FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage post tags"
  ON blog_post_tags FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for blog_comments
CREATE POLICY "Everyone can view approved comments"
  ON blog_comments FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Anyone can submit comments"
  ON blog_comments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage comments"
  ON blog_comments FOR ALL
  USING (is_admin(auth.uid()));

-- Insert default authors
INSERT INTO blog_authors (name, bio, email, is_active) VALUES
  ('Steve Wilkinson', 'Expert automotive journalist with over 15 years of experience in vehicle warranties and consumer protection.', 'steve@buyawarranty.co.uk', true),
  ('Gary Flinch', 'Automotive specialist focusing on car maintenance, repair costs, and warranty solutions for UK drivers.', 'gary@buyawarranty.co.uk', true);

-- Insert default categories
INSERT INTO blog_categories (name, slug, description) VALUES
  ('Car Maintenance', 'car-maintenance', 'Tips and advice for maintaining your vehicle'),
  ('Seasonal Advice', 'seasonal-advice', 'Seasonal driving and maintenance guides'),
  ('Buying Guide', 'buying-guide', 'Guides for buying and protecting vehicles'),
  ('Education', 'education', 'Educational content about warranties and insurance'),
  ('Customer Stories', 'customer-stories', 'Real stories from our customers'),
  ('Cost Comparisons', 'cost-comparisons', 'Comparing repair costs and warranty options');