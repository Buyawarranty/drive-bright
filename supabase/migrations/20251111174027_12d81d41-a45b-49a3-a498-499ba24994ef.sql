-- Update RLS policy for customer_policies to use case-insensitive email matching
DROP POLICY IF EXISTS "Users can view their own policies by user_id or email" ON customer_policies;

CREATE POLICY "Users can view their own policies by user_id or email"
ON customer_policies
FOR SELECT
USING ((user_id = auth.uid()) OR (LOWER(email) = LOWER(auth.email())));
