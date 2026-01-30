import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Upload, Download, AlertCircle, CheckCircle, FileSpreadsheet, Table as TableIcon, Calculator } from 'lucide-react';
import { 
  BASE_PRICING_MATRIX, 
  LABOUR_RATE_MONTHLY_ADJUSTMENT,
  MARKETING_SAVINGS,
  DURATION_MONTHS,
  BOOST_CLAIM_LIMIT_MONTHLY,
  TRANSFER_COVER_PRICE,
  calculateLabourRateAdjustment,
  calculateBoostAdjustment,
  getBasePrice,
  calculateTotalWarrantyPrice,
  type PaymentPeriod
} from '@/lib/pricingMatrix';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PricingRow {
  "Voluntary Excess Amount": string;
  "Claim Limit": string;
  "1 Year Price": string;
  "2 Years Price": string;
  "3 Years Price": string;
}

interface UpdateResult {
  success: number;
  errors: string[];
}

// Define all pricing options
const EXCESS_OPTIONS = [0, 50, 100, 150] as const;
const CLAIM_LIMIT_OPTIONS = [750, 1250, 2000] as const;
const LABOUR_RATE_OPTIONS = [50, 70, 100, 200] as const;
const DURATION_OPTIONS = ['12months', '24months', '36months'] as const;

export const BulkPricingTab = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UpdateResult | null>(null);
  const [activeTab, setActiveTab] = useState('download');

  // Generate complete pricing breakdown
  const generateCompletePricingCSV = () => {
    const rows: string[] = [];
    
    // Header row
    rows.push([
      'Duration',
      'Duration (Months)',
      'Excess Amount',
      'Claim Limit',
      'Labour Rate',
      'Base Price',
      'Labour Rate Adjustment',
      'Total Price (No Addons)',
      'Monthly Payment (12 installments)',
      'With Boost (+£1000 Cover)',
      'Monthly With Boost',
      'Marketing Was Price',
      'Marketing Savings'
    ].map(h => `"${h}"`).join(','));

    // Generate all combinations
    for (const duration of DURATION_OPTIONS) {
      for (const excess of EXCESS_OPTIONS) {
        for (const claimLimit of CLAIM_LIMIT_OPTIONS) {
          for (const labourRate of LABOUR_RATE_OPTIONS) {
            const basePrice = getBasePrice(duration, excess, claimLimit);
            const labourAdjustment = calculateLabourRateAdjustment(labourRate, duration);
            const totalPrice = basePrice + labourAdjustment;
            const monthlyPrice = Math.floor(totalPrice / 12);
            
            const boostTotal = totalPrice + (BOOST_CLAIM_LIMIT_MONTHLY * 12);
            const boostMonthly = Math.floor(boostTotal / 12);
            
            const marketingSavings = MARKETING_SAVINGS[duration] || 0;
            const wasPrice = totalPrice + marketingSavings;
            
            const durationLabel = duration === '12months' ? '1 Year' : 
                                  duration === '24months' ? '2 Years' : '3 Years';
            
            rows.push([
              durationLabel,
              DURATION_MONTHS[duration],
              `£${excess}`,
              `£${claimLimit}`,
              `£${labourRate}/hr`,
              `£${basePrice}`,
              labourAdjustment >= 0 ? `+£${labourAdjustment}` : `-£${Math.abs(labourAdjustment)}`,
              `£${totalPrice}`,
              `£${monthlyPrice}`,
              `£${boostTotal}`,
              `£${boostMonthly}`,
              `£${wasPrice}`,
              `£${marketingSavings}`
            ].map(v => `"${v}"`).join(','));
          }
        }
      }
    }

    return rows.join('\n');
  };

  // Generate simplified pricing matrix (base prices only)
  const generateBasePricingCSV = () => {
    const rows: string[] = [];
    
    // Header
    rows.push([
      'Excess Amount',
      'Claim Limit',
      '1 Year Base Price',
      '2 Years Base Price',
      '3 Years Base Price'
    ].map(h => `"${h}"`).join(','));

    for (const excess of EXCESS_OPTIONS) {
      for (const claimLimit of CLAIM_LIMIT_OPTIONS) {
        const price12 = BASE_PRICING_MATRIX['12months'][excess][claimLimit];
        const price24 = BASE_PRICING_MATRIX['24months'][excess][claimLimit];
        const price36 = BASE_PRICING_MATRIX['36months'][excess][claimLimit];

        rows.push([
          `£${excess}`,
          `£${claimLimit}`,
          `£${price12}`,
          `£${price24}`,
          `£${price36}`
        ].map(v => `"${v}"`).join(','));
      }
    }

    return rows.join('\n');
  };

  // Generate labour rate adjustments table
  const generateLabourRatesCSV = () => {
    const rows: string[] = [];
    
    rows.push([
      'Labour Rate',
      'Monthly Adjustment',
      '1 Year Total Adjustment',
      '2 Years Total Adjustment',
      '3 Years Total Adjustment'
    ].map(h => `"${h}"`).join(','));

    for (const rate of LABOUR_RATE_OPTIONS) {
      const monthly = LABOUR_RATE_MONTHLY_ADJUSTMENT[rate];
      rows.push([
        `£${rate}/hr`,
        monthly >= 0 ? `+£${monthly}/month` : `-£${Math.abs(monthly)}/month`,
        monthly >= 0 ? `+£${monthly * 12}` : `-£${Math.abs(monthly * 12)}`,
        monthly >= 0 ? `+£${monthly * 24}` : `-£${Math.abs(monthly * 24)}`,
        monthly >= 0 ? `+£${monthly * 36}` : `-£${Math.abs(monthly * 36)}`
      ].map(v => `"${v}"`).join(','));
    }

    return rows.join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded successfully`);
  };

  const downloadCompletePricing = () => {
    const csv = generateCompletePricingCSV();
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `complete_pricing_breakdown_${date}.csv`);
  };

  const downloadBasePricing = () => {
    const csv = generateBasePricingCSV();
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `base_pricing_matrix_${date}.csv`);
  };

  const downloadLabourRates = () => {
    const csv = generateLabourRatesCSV();
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `labour_rate_adjustments_${date}.csv`);
  };

  const downloadTemplate = () => {
    const csvContent = `"Voluntary Excess Amount","Claim Limit","1 Year Price","2 Years Price","3 Years Price"
"£0","£750",£467,£897,£1347
"£0","£1250",£497,£937,£1397
"£0","£2000",£587,£1027,£1497
"£50","£750",£437,£827,£1247
"£50","£1250",£457,£877,£1297
"£50","£2000",£547,£957,£1397
"£100","£750",£387,£737,£1097
"£100","£1250",£417,£787,£1177
"£100","£2000",£507,£877,£1277
"£150","£750",£367,£697,£1047
"£150","£1250",£387,£737,£1097
"£150","£2000",£477,£827,£1197`;

    downloadCSV(csvContent, 'pricing_upload_template.csv');
  };

  const parseCSV = (text: string): PricingRow[] => {
    const lines = text.trim().split('\n');
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && (i === 0 || line[i-1] === ',')) {
          inQuotes = true;
        } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line).map(v => v.replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row as PricingRow;
    });
  };

  const validatePricingData = (data: PricingRow[]): string[] => {
    const errors: string[] = [];
    
    data.forEach((row, index) => {
      const rowNum = index + 2;
      
      if (!row["Voluntary Excess Amount"]?.trim()) {
        errors.push(`Row ${rowNum}: Voluntary Excess Amount is required`);
      }
      
      if (!row["Claim Limit"]?.trim()) {
        errors.push(`Row ${rowNum}: Claim Limit is required`);
      }
      
      const requiredPriceFields = [
        '1 Year Price', '2 Years Price', '3 Years Price'
      ];
      
      requiredPriceFields.forEach(field => {
        const value = (row as any)[field];
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
          errors.push(`Row ${rowNum}: ${field} is required (use 0 for no charge)`);
        }
      });
    });
    
    return errors;
  };

  const handleFileUpload = async () => {
    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    setProgress(0);
    setResults(null);

    try {
      const text = await file.text();
      const pricingData = parseCSV(text);
      
      const validationErrors = validatePricingData(pricingData);
      if (validationErrors.length > 0) {
        setResults({ success: 0, errors: validationErrors });
        setUploading(false);
        return;
      }

      setProgress(25);

      const { data, error } = await supabase.functions.invoke('bulk-update-pricing', {
        body: { pricingData }
      });

      setProgress(100);

      if (error) {
        throw error;
      }

      setResults(data);
      toast.success(`Pricing updated successfully! ${data.success} plans updated.`);
      
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('Failed to update pricing');
      setResults({ success: 0, errors: ['Failed to process file: ' + (error as Error).message] });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pricing Management</h2>
          <p className="text-muted-foreground">View, download, and update warranty pricing</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="download" className="gap-2">
            <Download className="h-4 w-4" />
            Download Pricing
          </TabsTrigger>
          <TabsTrigger value="view" className="gap-2">
            <TableIcon className="h-4 w-4" />
            View Matrix
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Update Pricing
          </TabsTrigger>
        </TabsList>

        {/* Download Tab */}
        <TabsContent value="download" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  Complete Breakdown
                </CardTitle>
                <CardDescription>
                  All pricing combinations with labour rates, boost options, and monthly calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">All Durations</Badge>
                  <Badge variant="secondary">All Excess</Badge>
                  <Badge variant="secondary">All Limits</Badge>
                  <Badge variant="secondary">All Labour Rates</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {DURATION_OPTIONS.length * EXCESS_OPTIONS.length * CLAIM_LIMIT_OPTIONS.length * LABOUR_RATE_OPTIONS.length} price combinations
                </p>
                <Button onClick={downloadCompletePricing} className="w-full" variant="default">
                  <Download className="h-4 w-4 mr-2" />
                  Download Complete CSV
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  Base Price Matrix
                </CardTitle>
                <CardDescription>
                  Core pricing at £70/hr labour rate (default) - the foundation prices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">£70/hr Labour</Badge>
                  <Badge variant="outline">No Boost</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {EXCESS_OPTIONS.length * CLAIM_LIMIT_OPTIONS.length} base price points
                </p>
                <Button onClick={downloadBasePricing} className="w-full" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Base Prices
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TableIcon className="h-5 w-5 text-purple-600" />
                  Labour Rate Adjustments
                </CardTitle>
                <CardDescription>
                  Monthly and total adjustments for each labour rate option
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">£50/hr</Badge>
                  <Badge className="bg-blue-100 text-blue-800">£70/hr (Default)</Badge>
                  <Badge variant="outline">£100/hr</Badge>
                  <Badge variant="outline">£200/hr</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Per-month adjustments and totals by duration
                </p>
                <Button onClick={downloadLabourRates} className="w-full" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Labour Rates
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Rules Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Current Pricing Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Labour Rate Adjustments</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>£50/hr</span>
                      <span className="text-green-600">-£5/month (below base)</span>
                    </div>
                    <div className="flex justify-between font-medium bg-blue-50 px-2 py-1 rounded">
                      <span>£70/hr</span>
                      <span>Base price (DEFAULT)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>£100/hr</span>
                      <span className="text-amber-600">+£8/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span>£200/hr</span>
                      <span className="text-red-600">+£24/month</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Fixed Add-Ons</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Boost (+£1000 Cover)</span>
                      <span>+£5/month × 12 = £60 total</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transfer Cover</span>
                      <span>+£19 one-off</span>
                    </div>
                  </div>
                  <h4 className="font-medium text-sm mt-4">Multi-Year Promo</h4>
                  <div className="text-sm text-muted-foreground">
                    2yr/3yr plans: £2000 claim limit at £1250 price
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* View Matrix Tab */}
        <TabsContent value="view" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Base Pricing Matrix (£70/hr Labour Rate)</CardTitle>
              <CardDescription>
                These are the foundation prices before labour rate adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Excess</TableHead>
                      <TableHead className="w-28">Claim Limit</TableHead>
                      <TableHead className="text-right">1 Year</TableHead>
                      <TableHead className="text-right">2 Years</TableHead>
                      <TableHead className="text-right">3 Years</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXCESS_OPTIONS.map(excess => (
                      CLAIM_LIMIT_OPTIONS.map((limit, idx) => (
                        <TableRow key={`${excess}-${limit}`} className={idx === 0 ? 'border-t-2' : ''}>
                          {idx === 0 && (
                            <TableCell rowSpan={CLAIM_LIMIT_OPTIONS.length} className="font-medium bg-muted/30">
                              £{excess}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">£{limit.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">
                            £{BASE_PRICING_MATRIX['12months'][excess][limit]}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            £{BASE_PRICING_MATRIX['24months'][excess][limit]}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            £{BASE_PRICING_MATRIX['36months'][excess][limit]}
                          </TableCell>
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labour Rate Adjustments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Labour Rate</TableHead>
                    <TableHead className="text-right">Per Month</TableHead>
                    <TableHead className="text-right">1 Year Total</TableHead>
                    <TableHead className="text-right">2 Years Total</TableHead>
                    <TableHead className="text-right">3 Years Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LABOUR_RATE_OPTIONS.map(rate => {
                    const monthly = LABOUR_RATE_MONTHLY_ADJUSTMENT[rate];
                    const isDefault = rate === 70;
                    return (
                      <TableRow key={rate} className={isDefault ? 'bg-blue-50' : ''}>
                        <TableCell className="font-medium">
                          £{rate}/hr {isDefault && <Badge className="ml-2 text-xs">DEFAULT</Badge>}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${monthly > 0 ? 'text-amber-600' : monthly < 0 ? 'text-green-600' : ''}`}>
                          {monthly > 0 ? '+' : ''}{monthly === 0 ? '—' : `£${monthly}`}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${monthly > 0 ? 'text-amber-600' : monthly < 0 ? 'text-green-600' : ''}`}>
                          {monthly > 0 ? '+' : ''}{monthly === 0 ? '—' : `£${monthly * 12}`}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${monthly > 0 ? 'text-amber-600' : monthly < 0 ? 'text-green-600' : ''}`}>
                          {monthly > 0 ? '+' : ''}{monthly === 0 ? '—' : `£${monthly * 24}`}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${monthly > 0 ? 'text-amber-600' : monthly < 0 ? 'text-green-600' : ''}`}>
                          {monthly > 0 ? '+' : ''}{monthly === 0 ? '—' : `£${monthly * 36}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download the CSV template with the correct format for updating base prices.
                </p>
                <Button onClick={downloadTemplate} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Upload Template
                </Button>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>CSV Format Required Columns:</strong>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>• <strong>Voluntary Excess Amount:</strong> £0, £50, £100, £150</li>
                      <li>• <strong>Claim Limit:</strong> £750, £1250, £2000</li>
                      <li>• <strong>1 Year Price:</strong> Base price at £70/hr</li>
                      <li>• <strong>2 Years Price:</strong> Base price at £70/hr</li>
                      <li>• <strong>3 Years Price:</strong> Base price at £70/hr</li>
                    </ul>
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs text-amber-700">
                        <strong>Note:</strong> Upload updates BASE prices only. Labour rate adjustments, boost, and add-ons are calculated automatically.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Pricing File
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="csv-file">Select CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />
                </div>
                
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}
                
                <Button 
                  onClick={handleFileUpload} 
                  disabled={!file || uploading}
                  className="w-full"
                >
                  {uploading ? 'Processing...' : 'Update Pricing'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {results.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  Update Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Successfully Updated:</span>
                    <span className="text-green-600 font-bold">{results.success}</span>
                  </div>
                  
                  {results.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Errors:</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                        {results.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-700">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};