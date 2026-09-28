-- ============================================================
-- CREATE ADMIN ACCOUNT
-- ============================================================

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- 1. Create the user in auth.users (Supabase Auth)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', 
    gen_random_uuid(), 
    'authenticated', 
    'authenticated', 
    'ourhaniadem@passi.com', 
    crypt('adempassievent', gen_salt('bf')),
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}',
    now(), 
    now(),
    '', '', '', ''
  )
  RETURNING id INTO new_user_id;

  -- 2. Wait a split second for your Database Trigger to automatically create the profile row
  -- (Your system automatically inserts a profile when an auth.user is created)
  
  -- 3. Update the automatically created profile to be an Admin and set the Instagram tag!
  UPDATE public.profiles
  SET 
    role = 'admin', 
    instagram_handle = '@adeeeeeeem'
  WHERE id = new_user_id;

END $$;
