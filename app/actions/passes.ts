"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getOrCreateProfile, normalizeRole } from "@/lib/supabase/profile-guard";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface ClaimPassDrinkPayload {
  passId: string;
  drinkName: string;
  selectedAromas?: string[];
}

export interface ClaimPassDrinkResponse {
  success: boolean;
  pass?: any;
  error?: string;
}

/**
 * Server Action: claimPassDrink
 * Allows a pass owner (or admin) to select their complimentary drink and aromas
 * for special or active passes (VIP, GIFT/CADEAU, INVITATION, PAID).
 *
 * Saves drink_name & selected_aromas, activates the drink QR code, and triggers revalidatePath('/dashboard').
 */
export async function claimPassDrink(
  passIdOrPayload: string | ClaimPassDrinkPayload,
  drinkNameArg?: string,
  selectedAromasArg?: string[]
): Promise<ClaimPassDrinkResponse> {
  try {
    // 1. Normalize parameters (support positional or object payload)
    let passId: string;
    let drinkName: string;
    let selectedAromas: string[] = [];

    if (typeof passIdOrPayload === "object" && passIdOrPayload !== null) {
      passId = passIdOrPayload.passId;
      drinkName = passIdOrPayload.drinkName;
      selectedAromas = passIdOrPayload.selectedAromas || [];
    } else {
      passId = passIdOrPayload;
      drinkName = drinkNameArg || "";
      selectedAromas = selectedAromasArg || [];
    }

    if (!passId || typeof passId !== "string" || !passId.trim()) {
      return { success: false, error: "Identifiant du pass manquant." };
    }

    if (!drinkName || typeof drinkName !== "string" || !drinkName.trim()) {
      return { success: false, error: "Veuillez sélectionner une boisson." };
    }

    const cleanDrinkName = drinkName.trim();
    const formattedAromas: string[] = Array.isArray(selectedAromas)
      ? selectedAromas
          .filter((a: any) => typeof a === "string" && a.trim().length > 0)
          .map((a: string) => a.trim())
      : [];

    // 2. Authentication: Get current user from session
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Non autorisé : vous devez être connecté pour réclamer votre boisson.",
      };
    }

    // 3. Fetch target pass to verify existence and ownership
    const { data: pass, error: passError } = await supabaseAdmin
      .from("passes")
      .select("*, events(title, id, date, location)")
      .eq("id", passId)
      .single();

    if (passError || !pass) {
      return { success: false, error: "Pass introuvable." };
    }

    // Check ownership (or admin permission) with defensive profile auto-recovery
    const { profile } = await getOrCreateProfile(user);
    const isAdmin = normalizeRole(profile?.role) === 'admin';
    if (!isAdmin && pass.user_id !== user.id) {
      return {
        success: false,
        error: "Accès refusé : vous n'êtes pas le propriétaire de ce pass.",
      };
    }

    // 4. Determine Drink Status & Drink QR Code
    // For activated or special passes, instant activation and QR generation
    const passType = (pass.pass_type || "NORMAL").toUpperCase();
    const isSpecialPass =
      passType === "VIP" ||
      passType === "GIFT" ||
      (passType === "INVITATION" && pass.invitation_status === "ACCEPTED");

    const isPaid = (pass as any).status === "PAID" || (pass as any).status === "ACTIVATED";
    const shouldActivate = isSpecialPass || pass.entry_status === "activated" || isPaid;
    const drinkQrUuid = shouldActivate
      ? pass.drink_qr_uuid || crypto.randomUUID()
      : null;
    const drinkStatus = shouldActivate ? "activated" : "pending";

    // 5. Update passes table
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanDrinkName);
    const updatePayload: Record<string, any> = {
      drink_name: cleanDrinkName,
      selected_aromas: formattedAromas,
      drink_status: drinkStatus,
      updated_at: new Date().toISOString(),
    };

    if (isUuid) {
      updatePayload.drink_id = cleanDrinkName;
    }

    if (drinkQrUuid) {
      updatePayload.drink_qr_uuid = drinkQrUuid;
      updatePayload.drink_qr_code = drinkQrUuid;
    }

    let { data: updatedPass, error: updateError } = await supabaseAdmin
      .from("passes")
      .update(updatePayload)
      .eq("id", passId)
      .select("*, events(title, date, location)")
      .single();

    if (updateError) {
      console.warn(
        "[claimPassDrink] Update failed, retrying without drink_qr_code and drink_id:",
        updateError
      );
      delete updatePayload.drink_qr_code;
      delete updatePayload.drink_id;
      const { data: retryPass, error: retryError } = await supabaseAdmin
        .from("passes")
        .update(updatePayload)
        .eq("id", passId)
        .select("*, events(title, date, location)")
        .single();

      if (retryError) {
        console.error("[claimPassDrink] Error updating pass drink:", retryError);
        return {
          success: false,
          error: "Impossible d'enregistrer la boisson : " + retryError.message,
        };
      }
      updatedPass = retryPass;
    }

    // 6. Revalidate dashboard path to refresh server components/cached views
    revalidatePath("/dashboard");

    return {
      success: true,
      pass: updatedPass,
    };
  } catch (err: any) {
    console.error("[claimPassDrink] Unexpected error:", err);
    return {
      success: false,
      error: err.message || "Une erreur inattendue est survenue.",
    };
  }
}
