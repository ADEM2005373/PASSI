import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SafeProfile {
  id: string;
  email: string;
  full_name?: string | null;
  sell_point_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  is_suspended: boolean;
  instagram_handle?: string | null;
  created_at?: string;
  isFallback?: boolean;
}

export interface ProfileGuardOptions {
  defaultRole?: string;
  client?: SupabaseClient;
  allowFallback?: boolean;
}

/**
 * Normalizes user role strings across the application.
 * E.g., 'cashier' -> 'payment_point', uppercase -> lowercase
 */
export function normalizeRole(role?: string | null): string {
  if (!role) return 'user';
  const clean = role.trim().toLowerCase();
  if (clean === 'cashier') return 'payment_point';
  return clean;
}

/**
 * Singleton Supabase admin client with service role privileges
 * to reliably inspect and provision missing profiles without RLS blockage.
 */
let adminClientInstance: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient | null {
  if (adminClientInstance) return adminClientInstance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  adminClientInstance = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClientInstance;
}

/**
 * Defensive Helper Utility: getOrCreateProfile
 * 
 * Permanently guards against "Profil utilisateur introuvable" errors across
 * Server Actions and API Routes.
 * 
 * 1. Safely looks up the profile in the `profiles` table.
 * 2. If absent, dynamically provisions a baseline profile row with valid schema columns.
 * 3. Gracefully falls back in-memory if a database glitch or constraint issue occurs,
 *    ensuring operations never crash with unhandled 500 or false 404 errors.
 */
export async function getOrCreateProfile(
  userOrId: any,
  options: ProfileGuardOptions = {}
): Promise<{ profile: SafeProfile; created: boolean }> {
  const adminClient = options.client || getAdminClient();
  const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;

  if (!userId) {
    throw new Error('[profile-guard] Identifiant utilisateur requis pour la vérification de profil');
  }

  // 1. If only ID was passed and we have an admin client, attempt to load auth metadata if needed later
  let authUser: any = typeof userOrId === 'object' ? userOrId : null;

  // 2. Query existing profile
  if (adminClient) {
    try {
      const { data: existingProfile, error: queryError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, is_suspended, instagram_handle, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (!queryError && existingProfile) {
        return {
          profile: {
            ...existingProfile,
            role: normalizeRole(existingProfile.role),
            is_suspended: Boolean(existingProfile.is_suspended),
          },
          created: false,
        };
      }
    } catch (err) {
      console.warn('[profile-guard] Failed querying existing profile:', err);
    }
  }

  // 3. Profile does not exist: dynamically resolve profile attributes
  if (!authUser && adminClient) {
    try {
      const { data: authData } = await adminClient.auth.admin.getUserById(userId);
      authUser = authData?.user;
    } catch (e) {
      // safe ignore
    }
  }

  const meta = authUser?.user_metadata || {};
  const email = (authUser?.email || '').trim().toLowerCase();

  // Inferred role determination
  let inferredRole = 'user';
  if (options.defaultRole) {
    inferredRole = normalizeRole(options.defaultRole);
  } else if (meta.role) {
    inferredRole = normalizeRole(meta.role);
  } else if (email.includes('passi.com')) {
    inferredRole = 'admin';
  }

  // Full name determination
  const sellPointName = meta.sell_point_name || null;
  const fullName =
    sellPointName ||
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    (email ? email.split('@')[0] : 'Utilisateur');

  // Instagram handle determination
  const instagramHandle = meta.instagram_handle || meta.instagram || '';

  const baselinePayload: Record<string, any> = {
    id: userId,
    email: email || `${userId.slice(0, 8)}@passi.local`,
    full_name: fullName,
    role: inferredRole,
    is_suspended: false,
    instagram_handle: instagramHandle,
  };

  if (sellPointName) baselinePayload.sell_point_name = sellPointName;
  if (meta.first_name) baselinePayload.first_name = meta.first_name;
  if (meta.last_name) baselinePayload.last_name = meta.last_name;

  // 4. Provision profile in database
  if (adminClient) {
    try {
      let { data: newProfile, error: insertError } = await adminClient
        .from('profiles')
        .upsert(baselinePayload, { onConflict: 'id' })
        .select('id, email, full_name, role, is_suspended, instagram_handle, created_at')
        .single();

      if (insertError && (insertError.message?.includes('first_name') || insertError.message?.includes('last_name') || insertError.message?.includes('sell_point_name'))) {
        delete baselinePayload.sell_point_name;
        delete baselinePayload.first_name;
        delete baselinePayload.last_name;
        const retryResult = await adminClient
          .from('profiles')
          .upsert(baselinePayload, { onConflict: 'id' })
          .select('id, email, full_name, role, is_suspended, instagram_handle, created_at')
          .single();
        newProfile = retryResult.data;
        insertError = retryResult.error;
      }

      if (!insertError && newProfile) {
        return {
          profile: {
            ...newProfile,
            sell_point_name: (newProfile as any).sell_point_name || sellPointName,
            role: normalizeRole(newProfile.role),
            is_suspended: Boolean(newProfile.is_suspended),
          },
          created: true,
        };
      } else if (insertError) {
        console.warn('[profile-guard] Profile upsert warning:', insertError.message);
      }
    } catch (err: any) {
      console.warn('[profile-guard] Profile auto-provisioning exception:', err.message);
    }
  }

  // 5. In-Memory Safe Fallback
  // Prevents transaction failure even if database write fails temporarily
  const fallbackProfile: SafeProfile = {
    id: userId,
    email: email || `${userId.slice(0, 8)}@passi.local`,
    full_name: fullName,
    sell_point_name: sellPointName,
    role: inferredRole,
    is_suspended: false,
    instagram_handle: instagramHandle,
    isFallback: true,
  };

  return { profile: fallbackProfile, created: false };
}

/**
 * Direct shorthand returning the SafeProfile object directly.
 */
export async function ensureProfile(
  userOrId: any,
  options?: ProfileGuardOptions
): Promise<SafeProfile> {
  const { profile } = await getOrCreateProfile(userOrId, options);
  return profile;
}
