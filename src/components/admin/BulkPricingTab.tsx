import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';

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

export const BulkPricingTab = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UpdateResult | null>(null);

  const downloadTemplate = () => {
    const csvContent = `"Voluntary Excess Amount","Claim Limit","1 Year Price","2 Years Price","3 Years Price"
"£0","£750",£547,£1057,£1587
"£0","£1250",£587,£1097,£1637
"£0","£2000",£697,£1207,£1757
"£50","£750",£517,£967,£1467
"£50","£1250",£537,£1037,£1517
"£50","£2000",£647,£1127,£1637
"£100","£750",£457,£867,£1287
"£100","£1250",£497,£927,£1387
"£100","£2000",£597,£1037,£1507
"£150","£750",£427,£817,£1237
"£150","£1250",£457,£867,£1287
"£150","£2000",£567,£967,£1407`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pricing_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Template downloaded successfully');
  };

  const parseCSV = (text: string): PricingRow[] => {
    const lines = text.trim().split('\n');
    
    // Parse CSV with proper handling of quoted fields
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
      const rowNum = index + 2; // +2 because CSV starts at row 1 and we skip header
      
      if (!row["Voluntary Excess Amount"]?.trim()) {
        errors.push(`Row ${rowNum}: Voluntary Excess Amount is required`);
      }
      
      if (!row["Claim Limit"]?.trim()) {
        errors.push(`Row ${rowNum}: Claim Limit is required`);
      }
      
      // Validate required pricing fields
      const requiredPriceFields = [
        '1 Year Price', '2 Years Price', '3 Years Price'
      ];
      
      requiredPriceFields.forEach(field => {
        const value = (row as any)[field];
        // Allow 0 values, only flag as error if truly missing
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
      
      // Validate data
      const validationErrors = validatePricingData(pricingData);
      if (validationErrors.length > 0) {
        setResults({ success: 0, errors: validationErrors });
        setUploading(false);
        return;
      }

      setProgress(25);

      // Call edge function to update pricing
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
          <h2 className="text-2xl font-bold text-foreground">Bulk Pricing Update</h2>
          <p className="text-muted-foreground">Update warranty pricing using CSV file upload</p>
        </div>
      </div>

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
              Download the CSV template with the correct format for updating pricing.
            </p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Required Columns:</strong>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>• <strong>Voluntary Excess Amount:</strong> e.g., "£0", "£50", "£100", "£150" (required)</li>
                  <li>• <strong>Claim Limit:</strong> e.g., "£750", "£1250", "£2000" (required)</li>
                  <li>• <strong>1 Year Price:</strong> Annual warranty price (required)</li>
                  <li>• <strong>2 Years Price:</strong> Two-year warranty price (required)</li>
                  <li>• <strong>3 Years Price:</strong> Three-year warranty price (required)</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs text-blue-700">
                    <strong>Note:</strong> The new pricing structure matches the warranty quote form with excess amounts, claim limits, and duration-based pricing. Each row represents a unique combination of excess amount and claim limit.
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
    </div>
  );
};