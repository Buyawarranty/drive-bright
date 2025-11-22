-- Update user_role enum to include new roles (done in separate transaction)
ALTER TYPE user_role ADD VALUE 'member';
ALTER TYPE user_role ADD VALUE 'viewer';
ALTER TYPE user_role ADD VALUE 'guest';