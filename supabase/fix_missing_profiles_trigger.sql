-- ==============================================================================
-- PASSI: AUTOMATIC PROFILE CREATION TRIGGER & EXISTING PROFILES BACKFILL
-- ==============================================================================

-- 1. Ensure columns exist on profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- 2. Trigger function to handle new auth user creation automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract metadata safely
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name', 
    split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1), 
    'Utilisateur'
  );
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name', 
    NULLIF(substr(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), length(v_first_name) + 2), ''), 
    ''
  );
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NULLIF(TRIM(CONCAT(v_first_name, ' ', v_last_name)), ''),
    NEW.email
  );

  -- Infer role: check user metadata first, or check email domain / specific admins
  v_role := LOWER(COALESCE(
    NEW.raw_user_meta_data->>'role',
    CASE 
      WHEN NEW.email LIKE '%admin%@passi.com' OR NEW.email = 'ouernhaniadem@passi.com' THEN 'admin'
      WHEN NEW.email LIKE '%@passi.com' THEN 'payment_point'
      ELSE 'user'
    END
  ));

  -- Insert profile row
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, role, is_suspended)
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_full_name,
    v_role::public.user_role,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback insertion if user_role enum doesn't include the value or extra column mismatch
    BEGIN
      INSERT INTO public.profiles (id, email, role)
      VALUES (NEW.id, NEW.email, 'user'::public.user_role)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill existing auth.users who do not have a row in public.profiles
INSERT INTO public.profiles (id, email, first_name, last_name, full_name, role, is_suspended)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', split_part(COALESCE(u.raw_user_meta_data->>'full_name', ''), ' ', 1), 'Utilisateur'),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  LOWER(COALESCE(
    u.raw_user_meta_data->>'role',
    CASE 
      WHEN u.email LIKE '%admin%@passi.com' OR u.email = 'ouernhaniadem@passi.com' THEN 'admin'
      WHEN u.email LIKE '%@passi.com' THEN 'payment_point'
      ELSE 'user'
    END
  ))::public.user_role,
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
