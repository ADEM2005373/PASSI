-- ==============================================================================
-- PASSI: BYPASS EMAIL CONFIRMATION FOR ADMIN & STAFF ACCOUNTS ONLY
-- ==============================================================================
-- In Supabase Auth, 'confirmed_at' is a generated column that computes automatically
-- from 'email_confirmed_at'. We only update 'email_confirmed_at' and 'updated_at'.
-- ==============================================================================

-- 1. Confirmer les comptes existants liés à un profil Admin ou Staff
UPDATE auth.users
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE id IN (
    SELECT p.id 
    FROM public.profiles p
    WHERE LOWER(p.role::text) IN ('admin', 'staff', 'barman', 'security', 'payment_point')
);

-- 2. Sécurité : Confirmer les comptes dont le rôle est défini dans les métadonnées auth
UPDATE auth.users
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email_confirmed_at IS NULL
  AND (
    LOWER(COALESCE(raw_user_meta_data->>'role', '')) IN ('admin', 'staff', 'barman', 'security', 'payment_point')
    OR LOWER(COALESCE(raw_app_meta_data->>'role', '')) IN ('admin', 'staff', 'barman', 'security', 'payment_point')
  );

-- 3. Requête de vérification : affiche les comptes confirmés
SELECT 
    u.id,
    u.email,
    p.role AS profile_role,
    u.email_confirmed_at,
    u.confirmed_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE LOWER(p.role::text) IN ('admin', 'staff', 'barman', 'security', 'payment_point');
