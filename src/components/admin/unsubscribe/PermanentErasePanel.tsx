import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Loader2, Archive, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsManagement } from '@/hooks/useIsManagement';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props {
  email: string;
  phone: string;
  reason: string;
}

type ErasedRow = {
  id: string;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  reason: string | null;
  status: string;
  lead_ids: string[] | null;
  erased_by_name: string | null;
  created_at: string;
};

export const PermanentErasePanel: React.FC<Props> = ({ email, phone, reason }) => {
  const { isManagement, loading } = useIsManagement();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [erasing, setErasing] = useState(false);
  const [result, setResult] = useState<{ deletedLeads: number; anonymisedCustomers: number } | null>(null);

  const { data: archive = [] } = useQuery({
    queryKey: ['erased-customers'],
    enabled: isManagement,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('erased_customers')
        .select('id, email, phone, customer_name, reason, status, lead_ids, erased_by_name, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ErasedRow[];
    },
  });

  const target = email.trim() || phone.trim();

  const handleErase = async () => {
    setErasing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('staff-erase-customer', {
        body: { email: email.trim().toLowerCase(), phone: phone.trim(), reason: reason.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        deletedLeads: (data as any)?.deletedLeads ?? 0,
        anonymisedCustomers: (data as any)?.anonymisedCustomers ?? 0,
      });
      toast.success(
        `Permanently erased · ${(data as any)?.deletedLeads ?? 0} lead(s) deleted and archived`
      );
      setConfirmOpen(false);
      setTyped('');
      queryClient.invalidateQueries({ queryKey: ['erased-customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: any) {
      console.error('Erase failed', err);
      toast.error('Could not erase: ' + (err?.message ?? 'unknown error'));
    } finally {
      setErasing(false);
    }
  };

  if (loading) return null;

  if (!isManagement) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Lock className="h-4 w-4" />
            Permanent deletion (managers only)
          </CardTitle>
          <CardDescription>
            Ask a manager to permanently delete a customer from the leads and the database.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-destructive bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="h-5 w-5" />
            Permanently delete customer
          </CardTitle>
          <CardDescription>
            Removes them from all leads, emails and phone lists and deletes their data. A greyed-out
            copy is kept in the manager-only archive below with an “unsubscribed” status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              This cannot be undone from the dashboard. Policy and payment records are kept but the
              name, email, phone and address are wiped.
            </AlertDescription>
          </Alert>
          <Button
            variant="destructive"
            size="lg"
            className="w-full h-12 font-semibold"
            disabled={!target}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Permanently delete from leads and database
          </Button>
          {!target && (
            <p className="text-xs text-muted-foreground text-center">
              Find a customer first — enter an email or phone number above.
            </p>
          )}
          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Erased and archived · <strong>{result.deletedLeads}</strong> lead
                {result.deletedLeads === 1 ? '' : 's'} deleted ·{' '}
                <strong>{result.anonymisedCustomers}</strong> customer record
                {result.anonymisedCustomers === 1 ? '' : 's'} wiped.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Erased archive (managers only)
          </CardTitle>
          <CardDescription>
            Deleted customers are stored here, greyed out, with an unsubscribed status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {archive.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Nothing has been erased yet.</p>
          ) : (
            <div className="divide-y">
              {archive.map((row) => (
                <div key={row.id} className="p-3 flex items-start justify-between gap-3 opacity-60">
                  <div className="min-w-0">
                    <div className="text-sm font-medium line-through truncate">
                      {row.customer_name || row.email || row.phone || '(no name)'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {row.email || '—'} · {row.phone || '—'} ·{' '}
                      {row.lead_ids?.length ?? 0} lead{(row.lead_ids?.length ?? 0) === 1 ? '' : 's'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(row.created_at), 'd MMM yyyy HH:mm')}
                      {row.erased_by_name ? ` · by ${row.erased_by_name}` : ''}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {row.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{target}</strong> from all leads, notes, calls, saved
              quotes, emails and phone lists. A greyed-out copy is kept in the manager-only archive.
              Type <strong>DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={erasing}>No, cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={erasing || typed.trim().toUpperCase() !== 'DELETE'}
              onClick={(e) => {
                e.preventDefault();
                handleErase();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {erasing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Yes, delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PermanentErasePanel;
