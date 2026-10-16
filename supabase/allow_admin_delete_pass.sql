-- ==============================================================================
-- PASSI: ALLOW ADMIN TO DELETE ANY PASS (EVEN ACTIVATED / PAID PASSES)
-- ==============================================================================
-- Instructions: Exécutez ce script dans Supabase SQL Editor (Dashboard -> SQL Editor).
-- Il met à jour les règles RLS et le trigger prevent_paid_pass_modification()
-- pour autoriser les administrateurs authentifiés ainsi que le service_role API
-- à supprimer définitivement n'importe quel pass avec confirmation.

-- 1. Activer RLS sur la table des passes
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- 2. Créer / Remplacer la politique de suppression RLS pour les administrateurs
DROP POLICY IF EXISTS "Admins can delete all passes" ON passes;
CREATE POLICY "Admins can delete all passes" 
ON passes FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND (LOWER(role::text) = 'admin' OR role = 'ADMIN')
  )
);

-- 3. Mettre à jour le trigger de verrouillage des passes payés / activés
CREATE OR REPLACE FUNCTION prevent_paid_pass_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Si tentative de suppression d'un pass
    IF TG_OP = 'DELETE' THEN
        -- 1. Autoriser la suppression si l'utilisateur est administrateur (insensible à la casse)
        IF LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin' THEN
            RETURN OLD;
        END IF;

        -- 2. Autoriser la suppression si exécuté via le client service_role (API backend admin)
        IF auth.uid() IS NULL THEN
            RETURN OLD;
        END IF;

        -- 3. Sinon, interdire la suppression pour les utilisateurs non-admins sur les passes finalisés
        IF OLD.entry_status IN ('activated', 'scanned') THEN
            RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be deleted by non-admin users.';
        END IF;
        RETURN OLD;
    END IF;

    -- Si tentative de modification d'un pass
    IF TG_OP = 'UPDATE' THEN
        IF OLD.entry_status IN ('activated', 'scanned') THEN
            -- Autoriser l'administrateur ou l'API backend à modifier
            IF LOWER((SELECT role::text FROM profiles WHERE id = auth.uid())) = 'admin' OR auth.uid() IS NULL THEN
                RETURN NEW;
            END IF;

            -- Empêcher les utilisateurs réguliers de modifier les champs critiques
            IF (OLD.user_id <> NEW.user_id) 
               OR (OLD.event_id <> NEW.event_id) 
               OR (OLD.final_price <> NEW.final_price) THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            IF OLD.entry_status = 'activated' AND NEW.entry_status NOT IN ('activated', 'scanned') THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            IF OLD.entry_status = 'scanned' AND NEW.entry_status <> 'scanned' THEN
                RAISE EXCEPTION 'Finalized and paid passes are immutable and cannot be modified or rejected.';
            END IF;

            RETURN NEW;
        END IF;

        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recharger le cache schéma PostgREST
NOTIFY pgrst, 'reload schema';
