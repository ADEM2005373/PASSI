-- ============================================================
-- PASSI PRODUCTION CLEANUP SCRIPT
-- Run this in the Supabase SQL Editor to erase all test data
-- ============================================================

-- 1. Delete all passes (tickets)
TRUNCATE TABLE public.passes CASCADE;

-- 2. Delete all events
TRUNCATE TABLE public.events CASCADE;

-- 3. Delete all drink menus
TRUNCATE TABLE public.drink_menus CASCADE;

-- 4. Delete all TEST USERS from auth.users (This automatically deletes their profiles!)
-- NOTE: We explicitly keep 'admin', 'security', and 'barman' accounts so your staff can still log in!
DELETE FROM auth.users 
WHERE id IN (
  SELECT id FROM public.profiles 
  WHERE role = 'user'
);
