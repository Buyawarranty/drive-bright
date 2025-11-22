-- Add soft delete columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Add soft delete columns to customer_policies table
ALTER TABLE public.customer_policies
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Create index for better performance on deleted items queries
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON public.customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_customer_policies_is_deleted ON public.customer_policies(is_deleted);

-- Create a function to soft delete a customer and their policies
CREATE OR REPLACE FUNCTION soft_delete_customer(customer_uuid UUID, admin_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Soft delete the customer
  UPDATE customers 
  SET is_deleted = true, 
      deleted_at = now(), 
      deleted_by = admin_uuid
  WHERE id = customer_uuid;
  
  -- Soft delete associated policies
  UPDATE customer_policies 
  SET is_deleted = true, 
      deleted_at = now(), 
      deleted_by = admin_uuid
  WHERE customer_id = customer_uuid;
END;
$$;

-- Create a function to restore a customer and their policies
CREATE OR REPLACE FUNCTION restore_customer(customer_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Restore the customer
  UPDATE customers 
  SET is_deleted = false, 
      deleted_at = NULL, 
      deleted_by = NULL
  WHERE id = customer_uuid;
  
  -- Restore associated policies
  UPDATE customer_policies 
  SET is_deleted = false, 
      deleted_at = NULL, 
      deleted_by = NULL
  WHERE customer_id = customer_uuid;
END;
$$;