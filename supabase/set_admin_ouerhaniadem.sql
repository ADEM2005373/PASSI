-- ==============================================================================
-- PASSI : FORCER LE RÔLE ADMIN POUR ouerhaniadem@passi.com
-- À exécuter dans le Supabase SQL Editor (Dashboard Supabase -> SQL Editor)
-- ==============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Recherche de l'ID utilisateur dans auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE LOWER(email) = LOWER('ouerhaniadem@passi.com');

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Aucun compte auth trouvé pour ouerhaniadem@passi.com.';
    RAISE NOTICE 'Si le compte n''existe pas encore, vous pouvez le créer via la section optionnelle ci-dessous.';
  ELSE
    RAISE NOTICE '✓ Utilisateur trouvé (ID: %). Application des droits admin...', v_user_id;

    -- 2. Désactiver temporairement le trigger anti-escalade de privilèges si présent
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_role_security') THEN
      ALTER TABLE public.profiles DISABLE TRIGGER enforce_role_security;
    END IF;

    -- 3. Mettre à jour ou insérer dans public.profiles avec le rôle 'admin'
    INSERT INTO public.profiles (id, email, role, is_suspended)
    VALUES (v_user_id, 'ouerhaniadem@passi.com', 'admin', false)
    ON CONFLICT (id) DO UPDATE 
    SET 
      role = 'admin',
      is_suspended = false,
      email = 'ouerhaniadem@passi.com';

    -- 4. Réactiver le trigger de sécurité
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_role_security') THEN
      ALTER TABLE public.profiles ENABLE TRIGGER enforce_role_security;
    END IF;

    -- 5. Synchroniser le rôle et valider l'email dans auth.users
    UPDATE auth.users
    SET 
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_user_id;

    RAISE NOTICE '🎉 Le compte ouerhaniadem@passi.com a été promu ADMIN avec succès !';
  END IF;
END $$;

-- 6. Requête de contrôle / vérification
SELECT 
  p.id,
  p.email,
  p.role,
  p.is_suspended,
  u.email_confirmed_at,
  u.raw_app_meta_data->>'role' AS app_metadata_role
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE LOWER(p.email) = LOWER('ouerhaniadem@passi.com');
