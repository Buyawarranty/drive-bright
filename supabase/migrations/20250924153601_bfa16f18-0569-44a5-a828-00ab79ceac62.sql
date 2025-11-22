-- Create table to store Bumper transaction data instead of passing via URL parameters
-- This fixes the signature validation issue by keeping URLs short and clean
CREATE TABLE public.bumper_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  customer_data JSONB NOT NULL,
  vehicle_data JSONB NOT NULL,
  protection_addons JSONB,
  payment_type TEXT NOT NULL,
  final_amount INTEGER NOT NULL,
  discount_code TEXT DEFAULT '',
  add_another_warranty BOOLEAN DEFAULT false,
  redirect_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bumper_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies - these transactions don't need user-specific access as they're system managed
CREATE POLICY "Service can manage all bumper transactions" 
ON public.bumper_transactions 
FOR ALL 
USING (true);

-- Create index for faster lookups by transaction_id
CREATE INDEX idx_bumper_transactions_transaction_id ON public.bumper_transactions(transaction_id);

-- Create index for status filtering
CREATE INDEX idx_bumper_transactions_status ON public.bumper_transactions(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bumper_transactions_updated_at
BEFORE UPDATE ON public.bumper_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();