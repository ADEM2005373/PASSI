-- ==============================================================================
-- PASSI: ADD SELL_POINT_NAME TO PROFILES & UPDATE NEW USER TRIGGER
-- ==============================================================================

-- 1. Add sell_point_name column to public.profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sell_point_name TEXT;

-- 2. Populate sell_point_name from raw_user_meta_data if available
UPDATE public.profiles p
SET sell_point_name = u.raw_user_meta_data->>'sell_point_name'
FROM auth.users u
WHERE p.id = u.id 
  AND p.sell_point_name IS NULL 
  AND u.raw_user_meta_data->>'sell_point_name' IS NOT NULL;

-- 3. Update handle_new_user() trigger function to persist sell_point_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_instagram TEXT;
  v_sell_point_name TEXT;
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
  v_sell_point_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'sell_point_name', '')), '');
  v_full_name := COALESCE(
    v_sell_point_name,
    NEW.raw_user_meta_data->>'full_name', 
    NULLIF(TRIM(CONCAT(v_first_name, ' ', v_last_name)), ''),
    NEW.email
  );

  -- Extract and normalize instagram handle
  v_instagram := COALESCE(
    NEW.raw_user_meta_data->>'instagram_handle',
    NEW.raw_user_meta_data->>'instagram',
    ''
  );
  IF v_instagram LIKE 'http%' THEN
    v_instagram := '@' || split_part(v_instagram, 'instagram.com/', 2);
    v_instagram := split_part(v_instagram, '/', 1);
    v_instagram := split_part(v_instagram, '?', 1);
  END IF;
  IF v_instagram <> '' AND NOT v_instagram LIKE '@%' THEN
    v_instagram := '@' || v_instagram;
  END IF;

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
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    full_name, 
    sell_point_name, 
    instagram_handle, 
    role, 
    is_suspended
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    v_full_name,
    v_sell_point_name,
    NULLIF(v_instagram, ''),
    v_role::public.user_role,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    sell_point_name = COALESCE(public.profiles.sell_point_name, EXCLUDED.sell_point_name),
    instagram_handle = COALESCE(public.profiles.instagram_handle, EXCLUDED.instagram_handle);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
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
