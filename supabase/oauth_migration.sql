-- ============================================================
-- MIGRATION: OAuth-only auth — allow null instagram_handle
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Make instagram_handle nullable to support Google OAuth logins
--    (users are forced to fill it in via the CompleteProfileModal).
ALTER TABLE profiles
  ALTER COLUMN instagram_handle DROP NOT NULL;

-- 2. Add a "self-update own profile" policy so authenticated users can
--    update their own instagram_handle via the CompleteProfileModal.
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Ensure Email Auth is the ONLY legacy provider we still support for
--    existing admin/staff accounts. New users MUST use OAuth.
--    (No SQL change needed — disable Email provider from Supabase Dashboard:
--     Authentication → Providers → Email → toggle off "Enable Email provider")

-- 4. (Optional) Enable Google provider:
--    Authentication → Providers → Google → paste Client ID + Secret

-- 5. (Optional) Enable Facebook provider (used for both Facebook & Instagram):
--    Authentication → Providers → Facebook → paste App ID + App Secret
--    In Meta App, add redirect URI:
--    https://<your-project-ref>.supabase.co/auth/v1/callback
