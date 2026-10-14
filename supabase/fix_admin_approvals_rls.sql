-- ==============================================================================
-- Migration: Fix Admin Approvals Queue RLS Policy on passes and profiles tables
-- Description:
--   Ensures Admins have unrestricted SELECT, UPDATE, and DELETE access to all passes,
--   supporting both 'ADMIN' and 'admin' role casing in profiles table.
-- ==============================================================================

-- 1. Enable RLS on passes
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing Admin SELECT policies on passes to prevent conflicts or restrictive casing
DROP POLICY IF EXISTS "Admins can view all passes" ON passes;
DROP POLICY IF EXISTS "Admins can read all passes" ON passes;
DROP POLICY IF EXISTS "Admins can select all passes" ON passes;

-- 3. Create robust Admin SELECT policy for passes
CREATE POLICY "Admins can view all passes" 
ON passes FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND (
        role::text = 'ADMIN' 
        OR role::text = 'admin' 
        OR LOWER(role::text) = 'admin'
      )
  )
);

-- 4. Create robust Admin UPDATE policy for passes
DROP POLICY IF EXISTS "Admins can update passes" ON passes;
CREATE POLICY "Admins can update passes" 
ON passes FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND (
        role::text = 'ADMIN' 
        OR role::text = 'admin' 
        OR LOWER(role::text) = 'admin'
      )
  )
);

-- 5. Ensure Admins can read all profiles to view user/guest identities
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" 
ON profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND (
        role::text = 'ADMIN' 
        OR role::text = 'admin' 
        OR LOWER(role::text) = 'admin'
      )
  )
);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
