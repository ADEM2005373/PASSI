-- Run this script in your Supabase SQL Editor to directly create an Admin account

-- 1. Insert the user into the Supabase Auth system
INSERT INTO auth.users (
  id, 
  instance_id, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  created_at, 
  updated_at, 
  raw_app_meta_data, 
  raw_user_meta_data, 
  is_super_admin, 
  role
)
VALUES (
  'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 
  '00000000-0000-0000-0000-000000000000', 
  'admin@passi.com', 
  crypt('AdminPassi2026!', gen_salt('bf')), 
  now(), 
  now(), 
  now(), 
  '{"provider":"email","providers":["email"]}', 
  '{}', 
  false, 
  'authenticated'
);

-- 2. Insert the linked profile and assign the 'admin' role
INSERT INTO public.profiles (
  id, 
  email, 
  instagram_handle, 
  role
)
VALUES (
  'a1b2c3d4-e5f6-7890-1234-56789abcdef0', 
  'admin@passi.com', 
  'admin_passi', 
  'admin'
);
