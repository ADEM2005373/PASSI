import { createClient } from './server';
import { NextResponse } from 'next/server';
import { getOrCreateProfile, SafeProfile, normalizeRole, ensureProfile } from './profile-guard';

export { getOrCreateProfile, ensureProfile, normalizeRole };
export type { SafeProfile };

export async function requireRole(allowedRoles: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { 
        error: NextResponse.json({ error: 'Non autorisé : Veuillez vous connecter.' }, { status: 401 }), 
        user: null, 
        role: null,
        profile: null 
      };
    }

    // Defensive Profile Guard: automatically look up or provision baseline profile
    const targetRole = allowedRoles[0] || 'user';
    const { profile } = await getOrCreateProfile(user, { defaultRole: targetRole });

    if (!profile) {
      return { 
        error: NextResponse.json({ error: 'Non autorisé : Profil introuvable.' }, { status: 401 }), 
        user: null, 
        role: null,
        profile: null 
      };
    }

    if (profile.is_suspended) {
      return { 
        error: NextResponse.json({ error: 'Compte suspendu. Veuillez contacter un administrateur.' }, { status: 403 }), 
        user: null, 
        role: null,
        profile: null 
      };
    }

    const currentRole = normalizeRole(profile.role);
    const normalizedAllowedRoles = allowedRoles.map(r => normalizeRole(r));

    if (!normalizedAllowedRoles.includes(currentRole)) {
      return { 
        error: NextResponse.json({ error: 'Accès refusé : Droits insuffisants.' }, { status: 403 }), 
        user, 
        role: currentRole,
        profile 
      };
    }

    return { error: null, user, role: currentRole, profile };
  } catch (err: any) {
    console.error("Security verification error in requireRole:", err);
    return { 
      error: NextResponse.json({ error: 'Erreur interne du serveur lors de la vérification des accès.' }, { status: 500 }), 
      user: null, 
      role: null,
      profile: null 
    };
  }
}

