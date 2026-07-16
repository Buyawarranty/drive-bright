import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, ImageOff, Loader2, RefreshCw } from 'lucide-react';

interface Result {
  id: string;
  slug: string;
  title: string;
  url: string;
  status?: string;
  pass?: boolean;
  complete_car?: boolean;
  blank_plates?: boolean;
  single_image?: boolean;
  realistic?: boolean;
  issues?: string[];
  notes?: string;
}

export const HeroImageValidator = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const runScan = async () => {
    setRunning(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-hero-images', {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      toast.success(`Scanned ${data.results?.length ?? 0} hero images`);
    } catch (e: any) {
      console.error(e);
      toast.error(`Scan failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const failed = results?.filter((r) => r.pass === false) ?? [];
  const passed = results?.filter((r) => r.pass === true) ?? [];

  const flagRow = (label: string, ok?: boolean) => (
    <Badge variant={ok ? 'secondary' : 'destructive'} className="text-[10px]">
      {ok ? '✓' : '✗'} {label}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Hero Image Validator</CardTitle>
              <CardDescription>
                Scans every blog post's hero image with vision AI and flags: incomplete cars,
                readable number plates, split/diptych compositions, and unrealistic renders.
              </CardDescription>
            </div>
            <Button onClick={runScan} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {running ? 'Scanning…' : 'Scan all hero images'}
            </Button>
          </div>
        </CardHeader>
        {results && (
          <CardContent>
            <div className="flex gap-3 text-sm">
              <Badge variant="secondary">{results.length} total</Badge>
              <Badge className="bg-green-100 text-green-800">{passed.length} passed</Badge>
              <Badge variant="destructive">{failed.length} failed</Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {results && failed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Failed ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {failed.map((r) => (
              <div key={r.id} className="flex gap-4 border rounded-lg p-3">
                {r.url ? (
                  <img src={r.url} alt="" className="w-32 h-24 object-cover rounded border" />
                ) : (
                  <div className="w-32 h-24 flex items-center justify-center border rounded bg-muted">
                    <ImageOff className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground truncate">/{r.slug}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {flagRow('complete car', r.complete_car)}
                    {flagRow('blank plates', r.blank_plates)}
                    {flagRow('single image', r.single_image)}
                    {flagRow('realistic', r.realistic)}
                  </div>
                  {r.issues && r.issues.length > 0 && (
                    <ul className="text-sm text-destructive mt-2 list-disc list-inside">
                      {r.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                    </ul>
                  )}
                  {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {results && passed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Passed ({passed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {passed.map((r) => (
                <div key={r.id} className="border rounded p-2">
                  <img src={r.url} alt="" className="w-full h-20 object-cover rounded mb-1" />
                  <div className="text-xs truncate" title={r.title}>{r.title}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
