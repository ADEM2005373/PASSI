'use server';

import { createClient } from '@/lib/supabase/server';

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Server action to verify a 6-digit email OTP for account confirmation.
 * Sets the authentication session cookie via @supabase/ssr.
 */
export async function verifyEmailOtpAction(email: string, code: string): Promise<VerifyOtpResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim().replace(/\D/g, '');

  if (!cleanEmail) {
    return { success: false, error: "Adresse email manquante." };
  }

  if (!cleanCode || cleanCode.length < 6 || cleanCode.length > 8) {
    return { success: false, error: "Veuillez saisir un code de vérification valide (6 à 8 chiffres)." };
  }

  try {
    const supabase = await createClient();

    // 1. Primary verification: type: 'signup' (required for email confirmation)
    let { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'signup',
    });

    // 2. Fallback: if 'signup' token verification returns an error, try 'email' in case the template was sent as magiclink/otp
    if (error && (
      error.message?.toLowerCase().includes('expired') ||
      error.message?.toLowerCase().includes('invalid') ||
      error.message?.toLowerCase().includes('token')
    )) {
      const fallback = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });
      if (!fallback.error && fallback.data?.session) {
        data = fallback.data;
        error = null;
      }
    }

    if (error || !data?.user) {
      return {
        success: false,
        error: error?.message?.toLowerCase().includes('expired') || error?.message?.toLowerCase().includes('invalid')
          ? "Code invalide ou expiré. Veuillez vérifier le code ou en demander un nouveau."
          : (error?.message || "Code invalide ou expiré."),
      };
    }

    return {
      success: true,
      redirectTo: '/onboarding',
    };
  } catch (err: any) {
    console.error("Error in verifyEmailOtpAction:", err);
    return {
      success: false,
      error: err?.message || "Une erreur inattendue est survenue lors de la vérification.",
    };
  }
}

/**
 * Server action to resend the 6-digit signup verification OTP.
 */
export async function resendEmailOtpAction(email: string): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: "Adresse email manquante." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error in resendEmailOtpAction:", err);
    return { success: false, error: err?.message || "Impossible de renvoyer le code pour le moment." };
  }
}
