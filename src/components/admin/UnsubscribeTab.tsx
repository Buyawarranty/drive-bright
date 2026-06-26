import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailX, CheckCircle2, Ban, ShieldCheck } from 'lucide-react';
import { useEmailUnsubscribes } from '@/hooks/useEmailUnsubscribes';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { format } from 'date-fns';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);

export const UnsubscribeTab: React.FC = () => {
  const { user } = useAuth();
  const { blockEmail, unsubscribes, isBlocked } = useEmailUnsubscribes();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastUnsubscribed, setLastUnsubscribed] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    const cleanEmail = parsed.data.toLowerCase();

    blockEmail.mutate(
      {
        email: cleanEmail,
        reason: reason.trim() || 'Staff unsubscribed customer via admin dashboard',
        source: 'staff_unsubscribe',
        unsubscribedBy: user?.id,
        unsubscribedByName: user?.email ?? undefined,
      },
      {
        onSuccess: () => {
          setLastUnsubscribed(cleanEmail);
          setEmail('');
          setReason('');
        },
      }
    );
  };

  const recent = unsubscribes.slice(0, 10);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MailX className="h-6 w-6 text-destructive" />
          Unsubscribe Customer
        </h2>
        <p className="text-muted-foreground mt-1">
          Enter an email address below to opt that person out of <strong>all</strong> marketing
          emails — forever. Use this when a customer calls or messages and isn't able to find
          the unsubscribe link themselves.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5 text-destructive" />
            Block marketing emails
          </CardTitle>
          <CardDescription>
            This removes the email from every future marketing send across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="unsubscribe-email">Email address</Label>
              <Input
                id="unsubscribe-email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  setLastUnsubscribed(null);
                }}
                autoComplete="off"
                className="mt-1"
                required
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
              {email && isBlocked(email) && (
                <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  This email is already unsubscribed.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="unsubscribe-reason">Reason (optional)</Label>
              <Textarea
                id="unsubscribe-reason"
                placeholder="e.g. Customer called and asked to be removed from all emails"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
                rows={3}
                maxLength={500}
              />
            </div>

            <Button
              type="submit"
              variant="destructive"
              disabled={blockEmail.isPending || !email.trim()}
              className="w-full sm:w-auto"
            >
              <MailX className="h-4 w-4 mr-2" />
              {blockEmail.isPending ? 'Unsubscribing…' : 'Unsubscribe from all marketing'}
            </Button>
          </form>

          {lastUnsubscribed && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{lastUnsubscribed}</strong> has been unsubscribed from all marketing
                emails. They will no longer receive promotional messages from Buy A Warranty.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently unsubscribed</CardTitle>
          <CardDescription>
            {unsubscribes.length} total email{unsubscribes.length === 1 ? '' : 's'} on the
            blocklist
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unsubscribes yet.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{u.email}</p>
                    {u.reason && (
                      <p className="text-xs text-muted-foreground">{u.reason}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(u.created_at), 'dd MMM yyyy HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnsubscribeTab;
