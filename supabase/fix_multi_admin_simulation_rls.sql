-- ==============================================================================
-- PASSI: MULTI-ADMIN ACCOUNT SIMULATION & RLS BYPASS POLICIES
-- ==============================================================================
-- Description:
-- Fixes account simulation (impersonation) for all administrators.
-- Eliminates recursive RLS evaluation by providing a SECURITY DEFINER function
-- `is_admin()`. This allows all users holding the 'ADMIN' or 'admin' role
-- to securely bypass record ownership restrictions across profiles, passes,
-- events, drink menus, and pass drinks during account simulation.
-- ==============================================================================

-- 1. Create a secure function to check admin status across all admins
-- Uses SECURITY DEFINER to bypass RLS recursion on the profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND (
        role::text = 'ADMIN' 
        OR role::text = 'admin' 
        OR LOWER(role::text) = 'admin'
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execution rights on is_admin()
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;


-- ==============================================================================
-- 2. PROFILES TABLE RLS POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy / conflicting policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Allow users to view their own profile, and allow all admins to view ALL profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  is_admin() OR auth.uid() = id
);

-- Allow admins to update any profile, and allow owners to update their own profile
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (
  is_admin() OR auth.uid() = id
)
WITH CHECK (
  is_admin() OR auth.uid() = id
);


-- ==============================================================================
-- 3. PASSES TABLE RLS POLICIES (Enables simulation of User, Barman, Security)
-- ==============================================================================
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;

-- Drop legacy / conflicting policies
DROP POLICY IF EXISTS "Admins can read all passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can update passes" ON public.passes;
DROP POLICY IF EXISTS "Admins can delete passes" ON public.passes;
DROP POLICY IF EXISTS "Users can read own passes" ON public.passes;
DROP POLICY IF EXISTS "Security can read all passes" ON public.passes;
DROP POLICY IF EXISTS "Security can update passes" ON public.passes;

-- Allow users to view their own passes, and all admins to view ALL passes
CREATE POLICY "Admins can read all passes" 
ON public.passes FOR SELECT 
USING (
  is_admin() 
  OR auth.uid() = user_id 
  OR LOWER((SELECT role::text FROM public.profiles WHERE id = auth.uid())) = 'security'
);

-- Allow admins to update all passes (and security to scan activated passes)
CREATE POLICY "Admins can update passes" 
ON public.passes FOR UPDATE 
USING (
  is_admin() 
  OR auth.uid() = user_id
  OR LOWER((SELECT role::text FROM public.profiles WHERE id = auth.uid())) = 'security'
);

-- Allow admins to delete passes
CREATE POLICY "Admins can delete passes" 
ON public.passes FOR DELETE 
USING (
  is_admin()
);


-- ==============================================================================
-- 4. EVENTS & DRINK MENUS RLS POLICIES
-- ==============================================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Anyone can read drink menus" ON public.drink_menus;
DROP POLICY IF EXISTS "Admins can manage drink menus" ON public.drink_menus;

-- Read policies for events & drink menus
CREATE POLICY "Anyone can read events" 
ON public.events FOR SELECT 
USING (true);

CREATE POLICY "Anyone can read drink menus" 
ON public.drink_menus FOR SELECT 
USING (true);

-- Admin management policies
CREATE POLICY "Admins can manage events" 
ON public.events FOR ALL 
USING (is_admin());

CREATE POLICY "Admins can manage drink menus" 
ON public.drink_menus FOR ALL 
USING (is_admin());


-- ==============================================================================
-- 5. PASS DRINKS RLS POLICIES (Enables Barman simulation)
-- ==============================================================================
ALTER TABLE public.pass_drinks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pass drinks" ON public.pass_drinks;
DROP POLICY IF EXISTS "Admins can read all pass drinks" ON public.pass_drinks;
DROP POLICY IF EXISTS "Barmen can read all pass drinks" ON public.pass_drinks;
DROP POLICY IF EXISTS "Admins can update pass drinks" ON public.pass_drinks;
DROP POLICY IF EXISTS "Barmen can update pass drinks" ON public.pass_drinks;

-- Select policies
CREATE POLICY "Admins can read all pass drinks" 
ON public.pass_drinks FOR SELECT 
USING (
  is_admin() 
  OR LOWER((SELECT role::text FROM public.profiles WHERE id = auth.uid())) = 'barman'
  OR (SELECT user_id FROM public.passes WHERE id = pass_id) = auth.uid()
);

-- Update policies
CREATE POLICY "Admins can update pass drinks" 
ON public.pass_drinks FOR UPDATE 
USING (
  is_admin() 
  OR LOWER((SELECT role::text FROM public.profiles WHERE id = auth.uid())) = 'barman'
);


-- ==============================================================================
-- 6. SECURITY TRIGGERS UPDATE
-- ==============================================================================
-- Prevent non-admins from escalating privileges to admin
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id AND NOT public.is_admin() THEN
      NEW.role = 'user';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin() THEN
      NEW.role = OLD.role;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
