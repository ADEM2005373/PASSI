"use server";

import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/supabase/api-security";

// Initialize Supabase Admin client with the service role key
// NEVER expose this client or SUPABASE_SERVICE_ROLE_KEY to the frontend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface CreateStaffAccountPayload {
  email: string;
  password: string;
  role: 'admin' | 'barman' | 'security' | 'payment_point' | string;
  fullName?: string;
  instagramHandle?: string;
}

export interface CreateStaffAccountResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Server Action: createStaffAccount
 * Exclusively used by administrators to pre-create internal staff and secondary admin accounts.
 *
 * CRITICAL FEATURE:
 * Bypasses email confirmation for staff/admin by passing `email_confirm: true` to Supabase Admin API.
 * This guarantees the internal user can log in immediately with their credentials without clicking
 * any confirmation email, while keeping the global email confirmation requirement intact for regular users.
 */
export async function createStaffAccount(
  payload: CreateStaffAccountPayload
): Promise<CreateStaffAccountResponse> {
  // 1. Authorization: verify caller has active ADMIN privileges
  const { error: authError, user: caller } = await requireRole(['admin']);
  if (authError || !caller) {
    return {
      success: false,
      error: "Non autorisé : Seuls les administrateurs peuvent créer des comptes staff ou admin.",
    };
  }

  try {
    const { email, password, role, fullName, instagramHandle } = payload || {};

    // 2. Validate inputs
    if (!email || typeof email !== 'string' || !email.trim()) {
      return { success: false, error: "L'adresse email est requise." };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return { success: false, error: "Le mot de passe doit comporter au moins 6 caractères." };
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawRole = (role || 'barman').trim();
    const normalizedRole = rawRole.toLowerCase();

    const allowedRoles = ['admin', 'barman', 'security', 'payment_point'];
    if (!allowedRoles.includes(normalizedRole)) {
      return {
        success: false,
        error: `Rôle invalide: ${role}. Les rôles autorisés sont: ${allowedRoles.join(', ')}`,
      };
    }

    // 3. Create Auth user via Supabase Admin API with email_confirm: true
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true, // MAGIC FLAG: auto-confirms email and bypasses confirmation requirement
      user_metadata: {
        role: normalizedRole.toUpperCase(),
        full_name: fullName ? fullName.trim() : undefined,
        created_by_admin: caller.id,
      },
    });

    if (createError || !authData?.user) {
      console.error("[createStaffAccount] Supabase Auth creation failed:", createError);
      return {
        success: false,
        error: createError?.message || "Impossible de créer le compte utilisateur.",
      };
    }

    const newUserId = authData.user.id;

    // 4. Insert or update corresponding row in public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        email: cleanEmail,
        role: normalizedRole,
        full_name: fullName ? fullName.trim() : undefined,
        instagram_handle: instagramHandle ? instagramHandle.trim() : '',
        is_suspended: false,
      });

    if (profileError) {
      console.error("[createStaffAccount] Profiles insertion failed:", profileError);
      // Rollback auth user creation if profile insertion fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return {
        success: false,
        error: "Erreur lors de l'enregistrement du profil utilisateur.",
      };
    }

    return {
      success: true,
      userId: newUserId,
    };
  } catch (err: any) {
    console.error("[createStaffAccount] Unexpected exception:", err);
    return {
      success: false,
      error: err.message || "Une erreur inattendue est survenue.",
    };
  }
}

export { createAdminPassAction } from '@/lib/actions/pass-lifecycle';
export type { CreateAdminPassPayload } from '@/lib/actions/pass-lifecycle';

