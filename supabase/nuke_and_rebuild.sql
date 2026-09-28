-- ============================================================
-- THE NUCLEAR OPTION: WIPE EVERYTHING & CREATE ADMIN
-- ============================================================

-- 1. Force wipe all tickets, events, and drinks
TRUNCATE TABLE public.passes CASCADE;
TRUNCATE TABLE public.events CASCADE;
TRUNCATE TABLE public.drink_menus CASCADE;

-- 2. Force delete EVERY SINGLE USER in the database
DELETE FROM auth.users;

-- 3. Instantly create your brand new VIP Admin account
DO $$
DECLARE
  new_user_id uuid;
BEGIN
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
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO new_user_id;

  -- 4. Give the new account Admin powers and the Instagram tag
  UPDATE public.profiles
  SET 
    role = 'admin', 
    instagram_handle = '@adeeeeeeem'
  WHERE id = new_user_id;

END $$;
