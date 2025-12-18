import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Loader2, CheckCircle, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkPageCreatorProps {
  onComplete: () => void;
}

interface BrandTemplate {
  name: string;
  slug: string;
  selected: boolean;
  exists?: boolean;
}

export const BulkPageCreator = ({ onComplete }: BulkPageCreatorProps) => {
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [brands, setBrands] = useState<BrandTemplate[]>([
    { name: 'Toyota', slug: 'toyota-extended-warranty', selected: false },
    { name: 'Honda', slug: 'honda-extended-warranty', selected: false },
    { name: 'Vauxhall', slug: 'vauxhall-extended-warranty', selected: false },
    { name: 'Peugeot', slug: 'peugeot-extended-warranty', selected: false },
    { name: 'Kia', slug: 'kia-extended-warranty', selected: false },
    { name: 'Mazda', slug: 'mazda-extended-warranty', selected: false },
    { name: 'SEAT', slug: 'seat-extended-warranty', selected: false },
    { name: 'Renault', slug: 'renault-extended-warranty', selected: false },
    { name: 'Citroën', slug: 'citroen-extended-warranty', selected: false },
    { name: 'MINI', slug: 'mini-extended-warranty', selected: false },
    { name: 'Fiat', slug: 'fiat-extended-warranty', selected: false },
    { name: 'Volvo', slug: 'volvo-extended-warranty', selected: false },
    { name: 'Lexus', slug: 'lexus-extended-warranty', selected: false },
    { name: 'Porsche', slug: 'porsche-extended-warranty', selected: false },
    { name: 'Tesla', slug: 'tesla-extended-warranty', selected: false },
    { name: 'Subaru', slug: 'subaru-extended-warranty', selected: false },
    { name: 'Mitsubishi', slug: 'mitsubishi-extended-warranty', selected: false },
    { name: 'Suzuki', slug: 'suzuki-extended-warranty', selected: false },
    { name: 'Alfa Romeo', slug: 'alfa-romeo-extended-warranty', selected: false },
    { name: 'Bentley', slug: 'bentley-extended-warranty', selected: false },
  ]);

  useState(() => {
    // Check which brands already exist
    const checkExisting = async () => {
      const { data } = await supabase
        .from('landing_pages')
        .select('slug');
      
      if (data) {
        const existingSlugs = data.map(p => p.slug);
        setBrands(prev => prev.map(b => ({
          ...b,
          exists: existingSlugs.includes(b.slug)
        })));
      }
    };
    checkExisting();
  });

  const toggleBrand = (index: number) => {
    setBrands(prev => prev.map((b, i) => 
      i === index ? { ...b, selected: !b.selected } : b
    ));
  };

  const selectAll = () => {
    setBrands(prev => prev.map(b => ({ ...b, selected: !b.exists })));
  };

  const deselectAll = () => {
    setBrands(prev => prev.map(b => ({ ...b, selected: false })));
  };

  const selectedCount = brands.filter(b => b.selected).length;

  const createPages = async () => {
    const selectedBrands = brands.filter(b => b.selected);
    if (selectedBrands.length === 0) {
      toast.error('Please select at least one brand');
      return;
    }

    setCreating(true);
    setProgress(0);

    let created = 0;
    let failed = 0;

    for (let i = 0; i < selectedBrands.length; i++) {
      const brand = selectedBrands[i];
      
      try {
        const { error } = await supabase
          .from('landing_pages')
          .insert({
            slug: brand.slug,
            brand_name: brand.name,
            h1_headline: `${brand.name} Extended Warranty UK`,
            meta_title: `${brand.name} Extended Warranty | Used ${brand.name} Cover & Quotes`,
            meta_description: `Protect your ${brand.name} from costly repairs with extended warranty. Instant quotes, UK garages, flexible payment plans.`,
            focus_keyword: `${brand.name} warranty`,
            og_title: `${brand.name} Extended Warranty | Affordable UK Cover`,
            og_description: `Get instant ${brand.name} warranty quotes. Protect your vehicle from costly repairs with flexible cover options.`,
            hero_content: {
              subheadline: 'Affordable Cover with Fast Claims',
              description: `Protect Your ${brand.name}. Avoid Costly Repairs. Drive With Confidence.`,
              benefits: [
                'Fully mechanical and electrical cover',
                `Used and older ${brand.name}s welcome`,
                'Instant online quotes',
                'Flexible monthly plans'
              ]
            },
            faqs: [
              {
                question: `Is a ${brand.name} extended warranty worth it in the UK?`,
                answer: `Yes, ${brand.name} repairs can be expensive due to specialized parts and electronics. An extended warranty protects key components like the engine, gearbox, and ECUs, preventing unexpected repair bills.`
              },
              {
                question: `How much does a ${brand.name} extended warranty cost?`,
                answer: `Extended ${brand.name} warranty prices typically start from £35 to £95 per month, depending on your model, mileage, and chosen claim limit.`
              },
              {
                question: `Can I buy a ${brand.name} extended warranty after the manufacturer warranty expires?`,
                answer: `Yes, you can buy cover even if your ${brand.name} is outside its original warranty, or if you purchased it used.`
              }
            ],
            status: 'draft',
            include_organization_schema: true,
            include_local_business_schema: true,
            include_product_schema: true,
            include_faq_schema: true,
            include_review_schema: true,
            include_breadcrumb_schema: true,
            is_indexable: true,
            robots_directive: 'index, follow'
          });

        if (error) throw error;
        created++;
      } catch (error: any) {
        console.error(`Failed to create ${brand.name}:`, error);
        failed++;
      }

      setProgress(((i + 1) / selectedBrands.length) * 100);
    }

    setCreating(false);
    
    if (created > 0) {
      toast.success(`Created ${created} landing pages`);
    }
    if (failed > 0) {
      toast.error(`Failed to create ${failed} pages`);
    }

    onComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="w-5 h-5" />
          Bulk Landing Page Creator
        </CardTitle>
        <CardDescription>
          Quickly create SEO-optimized landing pages for multiple car brands at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All Available
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
          <Badge variant="secondary">
            {selectedCount} selected
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {brands.map((brand, index) => (
            <div
              key={brand.slug}
              className={`
                flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                ${brand.exists ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}
                ${brand.selected ? 'border-primary bg-primary/5' : ''}
              `}
              onClick={() => !brand.exists && toggleBrand(index)}
            >
              <Checkbox 
                checked={brand.selected} 
                disabled={brand.exists}
                onCheckedChange={() => !brand.exists && toggleBrand(index)}
              />
              <div className="flex-1">
                <p className="font-medium">{brand.name}</p>
                {brand.exists && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Already exists
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {creating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Creating pages...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Button 
          onClick={createPages} 
          disabled={creating || selectedCount === 0}
          className="w-full"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Pages...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create {selectedCount} Landing Page{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          Pages will be created as drafts. You can edit and publish them individually.
        </p>
      </CardContent>
    </Card>
  );
};
