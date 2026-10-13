-- ==============================================================================
-- PASSI: LOGIN RATE LIMITING MIGRATION (10 TENTATIVES / 24 HEURES)
-- ==============================================================================
-- Ce script crée la table login_attempts et les politiques associées
-- pour protéger les endpoints d'authentification contre les attaques par force brute.
-- Exécutez ce script dans Supabase SQL Editor (Dashboard -> SQL Editor).

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,          -- Identifiant unique (email normalisé ou adresse IP)
    email TEXT,                        -- Adresse email (si renseignée)
    ip_address TEXT NOT NULL,          -- Adresse IP du client
    attempt_count INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour des recherches instantanées
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts (identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts (email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts (ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_first_attempt ON public.login_attempts (first_attempt_at);

-- Activer Row Level Security
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Seul le service_role (API backend) peut lire et écrire dans cette table
DROP POLICY IF EXISTS "Service role access only for login_attempts" ON public.login_attempts;
CREATE POLICY "Service role access only for login_attempts"
    ON public.login_attempts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- Fonction de purge automatique des tentatives expirées (> 24 heures)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_login_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_rows INTEGER;
BEGIN
    DELETE FROM public.login_attempts
    WHERE first_attempt_at < (now() - INTERVAL '24 hours');
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.login_attempts IS 'Stocke le décompte des tentatives de connexion par IP et Email pour le Rate Limiting (10 max / 24h).';
