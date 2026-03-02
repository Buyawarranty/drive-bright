import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle2, XCircle, AlertTriangle, Upload, RefreshCw, Zap,
  Key, Shield, Database, TrendingUp, Clock, ArrowUpRight
} from 'lucide-react';

// Required secrets for the upload-google-conversions edge function
const REQUIRED_SECRETS = [
  { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Developer Token', description: 'From Google Ads API Center' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Customer ID', description: 'Your Google Ads account ID (no dashes)' },
  { key: 'GOOGLE_ADS_CONVERSION_ACTION_ID', label: 'Conversion Action ID', description: 'The "Closed Sale" conversion action ID' },
  { key: 'GOOGLE_ADS_CLIENT_ID', label: 'OAuth2 Client ID', description: 'From Google Cloud Console' },
  { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'OAuth2 Client Secret', description: 'From Google Cloud Console' },
  { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'OAuth2 Refresh Token', description: 'Generated via OAuth2 flow' },
];

export const GoogleAdsSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Fetch conversion upload stats
  const { data: conversionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['google-ads-conversion-stats'],
    queryFn: async () => {
      const [customersResult, bumperResult, pendingCustomers, pendingBumper] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .not('gclid', 'is', null)
          .not('google_ads_conversion_uploaded_at', 'is', null),
        supabase
          .from('bumper_transactions')
          .select('id', { count: 'exact', head: true })
          .not('gclid', 'is', null)
          .not('google_ads_conversion_uploaded_at', 'is', null),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .not('gclid', 'is', null)
          .is('google_ads_conversion_uploaded_at', null)
          .eq('status', 'active')
          .eq('is_deleted', false),
        supabase
          .from('bumper_transactions')
          .select('id', { count: 'exact', head: true })
          .not('gclid', 'is', null)
          .is('google_ads_conversion_uploaded_at', null)
          .eq('status', 'completed'),
      ]);

      return {
        uploaded: (customersResult.count || 0) + (bumperResult.count || 0),
        pending: (pendingCustomers.count || 0) + (pendingBumper.count || 0),
        totalWithGclid: (customersResult.count || 0) + (bumperResult.count || 0) + (pendingCustomers.count || 0) + (pendingBumper.count || 0),
      };
    },
  });

  // Fetch recent upload attempts
  const { data: recentUploads } = useQuery({
    queryKey: ['google-ads-recent-uploads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, email, final_amount, gclid, google_ads_conversion_status, google_ads_conversion_uploaded_at, created_at')
        .not('gclid', 'is', null)
        .not('google_ads_conversion_status', 'is', null)
        .order('google_ads_conversion_uploaded_at', { ascending: false, nullsFirst: false })
        .limit(10);
      return data || [];
    },
  });

  // Fetch total GCLID captures
  const { data: gclidStats } = useQuery({
    queryKey: ['gclid-capture-stats'],
    queryFn: async () => {
      const [customers, bumper, leads] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('bumper_transactions').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true }).not('gclid', 'is', null),
      ]);
      return {
        customers: customers.count || 0,
        bumper: bumper.count || 0,
        leads: leads.count || 0,
      };
    },
  });

  // Trigger manual upload
  const triggerUpload = async () => {
    setIsUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-google-conversions');
      if (error) throw error;
      
      toast({
        title: 'Upload complete',
        description: `Uploaded: ${data?.uploaded || 0}, Failed: ${data?.failed || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ['google-ads-conversion-stats'] });
      queryClient.invalidateQueries({ queryKey: ['google-ads-recent-uploads'] });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Check that all secrets are configured.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Google Ads — Conversion & ROAS Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage offline conversion uploads, GCLID tracking, and Target ROAS optimisation
        </p>
      </div>

      {/* Strategy Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Target ROAS Strategy
          </CardTitle>
          <CardDescription>
            Maximize Conversion Value by uploading actual sale values back to Google Ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">1. Capture GCLID</p>
              <p className="text-muted-foreground">Automatically captured on every CTA & form submission</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">2. Track Closed Sales</p>
              <p className="text-muted-foreground">Actual policy values uploaded as offline conversions</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">3. Optimise Bidding</p>
              <p className="text-muted-foreground">Google uses real revenue data to maximise ROAS</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">GCLIDs Captured</p>
                <p className="text-2xl font-bold">
                  {gclidStats ? (gclidStats.customers + gclidStats.bumper + gclidStats.leads).toLocaleString() : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {gclidStats?.customers || 0} customers · {gclidStats?.bumper || 0} bumper · {gclidStats?.leads || 0} leads
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Conversions Uploaded</p>
                <p className="text-2xl font-bold">{conversionStats?.uploaded?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending Upload</p>
                <p className="text-2xl font-bold">{conversionStats?.pending?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total w/ GCLID</p>
                <p className="text-2xl font-bold">{conversionStats?.totalWithGclid?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Required Secrets Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Credentials
            </CardTitle>
            <CardDescription>
              These secrets must be set in{' '}
              <a
                href="https://supabase.com/dashboard/project/mzlpuxzwyrcyrgrongeb/settings/functions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                Supabase Edge Function Secrets <ArrowUpRight className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REQUIRED_SECRETS.map((secret) => (
              <div
                key={secret.key}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium truncate">{secret.key}</p>
                  <p className="text-xs text-muted-foreground">{secret.label} — {secret.description}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Secrets are encrypted and not visible here. The upload function will fail with a clear error if any are missing.
          </p>
        </CardContent>
      </Card>

      {/* Manual Upload Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Offline Conversion Upload
          </CardTitle>
          <CardDescription>
            Uploads pending conversions (customers & Bumper with GCLID) to Google Ads.
            This runs automatically but can be triggered manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={triggerUpload}
            disabled={isUploading || (conversionStats?.pending === 0)}
            className="gap-2"
          >
            {isUploading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : `Upload ${conversionStats?.pending || 0} Pending Conversions`}
          </Button>

          {/* Recent uploads table */}
          {recentUploads && recentUploads.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Recent Upload History</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUploads.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.email || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {row.final_amount ? `£${row.final_amount.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell>
                          {row.google_ads_conversion_status === 'uploaded' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Uploaded
                            </Badge>
                          ) : row.google_ads_conversion_status?.startsWith('failed') ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                              <XCircle className="h-3 w-3" /> Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" /> {row.google_ads_conversion_status || 'Pending'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.google_ads_conversion_uploaded_at
                            ? new Date(row.google_ads_conversion_uploaded_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GCLID Capture Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            GCLID Capture Pipeline
          </CardTitle>
          <CardDescription>
            How click IDs flow from Google Ads → your site → offline conversions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Frontend GCLID Capture</p>
                <p className="text-xs text-muted-foreground">
                  GCLID is extracted from the URL on page load and stored in localStorage + dataLayer.
                  It's sent with every form submission, checkout, and Bumper redirect.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-50/50">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Server-Side Conversion (Stripe & Bumper webhooks)</p>
                <p className="text-xs text-muted-foreground">
                  Both the Stripe webhook and Bumper success handler fire server-side conversions
                  using the GCLID stored in session metadata.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50/50">
              <Upload className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Offline Conversion Upload (Google Ads API)</p>
                <p className="text-xs text-muted-foreground">
                  The <code className="bg-muted px-1 rounded">upload-google-conversions</code> edge function
                  batches all unuploaded conversions with GCLID and sends actual sale values to Google Ads
                  for Target ROAS bidding optimisation.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAdsSettingsTab;
