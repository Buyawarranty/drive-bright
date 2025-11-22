-- Create customer notifications table
CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  attachment_url TEXT
);

-- Enable RLS
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

-- Customers can view their own notifications
CREATE POLICY "Customers can view own notifications"
  ON public.customer_notifications
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE email = auth.email()
    )
  );

-- Customers can update their own notifications (mark as read)
CREATE POLICY "Customers can mark own notifications as read"
  ON public.customer_notifications
  FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE email = auth.email()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM public.customers WHERE email = auth.email()
    )
  );

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
  ON public.customer_notifications
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Service role has full access
CREATE POLICY "Service role can manage notifications"
  ON public.customer_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_customer_notifications_customer_id ON public.customer_notifications(customer_id);
CREATE INDEX idx_customer_notifications_is_read ON public.customer_notifications(is_read);

-- Enable realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_notifications;