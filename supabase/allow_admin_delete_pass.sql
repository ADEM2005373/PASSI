-- ==============================================================================
-- PASSI: ALLOW ADMIN TO DELETE ANY PASS (EVEN ACTIVATED / PAID PASSES)
-- ==============================================================================
-- Instructions: Exécutez ce script dans Supabase SQL Editor (Dashboard -> SQL Editor).
-- Il met à jour le trigger prevent_paid_pass_modification() pour autoriser
-- les administrateurs authentifiés ainsi que le service_role API à supprimer
-- définitivement n'importe quel pass avec confirmation.

CREATE OR REPLACE FUNCTION prevent_paid_pass_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Si tentative de suppression d'un pass
    IF TG_OP = 'DELETE' THEN
        -- 1. Autoriser la suppression si l'utilisateur est administrateur
        IF (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
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
            IF (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() IS NULL THEN
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

-- Recharger le cache schéma PostgREST
NOTIFY pgrst, 'reload schema';
