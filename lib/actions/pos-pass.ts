'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateProfile, normalizeRole } from '@/lib/supabase/profile-guard';
import { dispatchPaidPassEmail } from '@/lib/services/pass-ticket';
import { getPassWebLink } from '@/lib/utils/url';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface POSPassFormData {
  eventId: string;
  userName?: string;
  fullName?: string;
  userEmail?: string;
  email?: string;
  phone?: string;
  drinkName?: string;
  selectedDrink?: string;
  aromas?: string[];
  selectedAromas?: string[];
  totalPrice?: number;
  price?: number;
  posLocation?: string;
  posName?: string;
  cashierId?: string;
  quantity?: number;
}

/**
 * Server Action: POS Direct-Issue Pass Creation (Auto-Paid & Admin Supervision Sync)
 *
 * Automatically generates a pass on-site at the POS / Guichet marked as:
 * - status: 'approved' & 'PAID'
 * - payment_status: 'paid'
 * - entry_status: 'activated'
 * - issued_by_pos & cashier_id / payment_point_id / approved_by
 *
 * Instantly reflects in the Cashier drawer balance, today's revenue,
 * the Admin Supervision dashboard, and sends the dynamic Web Pass QR code to the customer.
 */
export async function createPOSPass(formData: POSPassFormData) {
  // 1. Resolve cashier identity & permissions
  let resolvedCashierId = formData.cashierId || null;
  let resolvedPosLocation = (formData.posLocation || formData.posName || '').trim();

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { profile } = await getOrCreateProfile(user, { defaultRole: 'payment_point' });
      const role = normalizeRole(profile?.role);
      if (!['payment_point', 'admin'].includes(role)) {
        throw new Error('Droits insuffisants : seuls les caissiers et administrateurs peuvent émettre un pass en direct.');
      }
      resolvedCashierId = user.id;
      if (!resolvedPosLocation) {
        resolvedPosLocation = profile?.sell_point_name || profile?.full_name || 'Guichet Point de Vente';
      }
    }
  } catch (authErr: any) {
    if (authErr.message?.includes('Droits insuffisants')) {
      throw authErr;
    }
    // Continue if cashierId was explicitly supplied (e.g. from service context)
  }

  if (!resolvedPosLocation) {
    resolvedPosLocation = 'Guichet Point de Vente';
  }

  // 2. Validate mandatory inputs
  const rawEventId = formData.eventId?.trim();
  if (!rawEventId) {
    throw new Error('Identifiant d\'événement manquant.');
  }

  const rawName = (formData.fullName || formData.userName || '').trim();
  if (!rawName) {
    throw new Error('Le nom complet du client est requis.');
  }

  const rawEmail = (formData.email || formData.userEmail || '').trim().toLowerCase();
  if (!rawEmail || !rawEmail.includes('@')) {
    throw new Error('Une adresse email valide est requise pour délivrer le QR code.');
  }

  const cleanPhone = (formData.phone || '').trim() || null;
  const cleanDrink = (formData.drinkName || formData.selectedDrink || '').trim() || null;

  const rawAromas = formData.selectedAromas || formData.aromas || [];
  const cleanAromas: string[] = Array.isArray(rawAromas)
    ? rawAromas.filter((a) => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim())
    : typeof rawAromas === 'string' && (rawAromas as string).trim().length > 0
      ? [(rawAromas as string).trim()]
      : [];

  const formattedSelectedDrink = cleanDrink
    ? (cleanAromas.length > 0 && !cleanDrink.includes('(') ? `${cleanDrink} (${cleanAromas.join(', ')})` : cleanDrink)
    : null;

  const rawQuantity = parseInt(String(formData.quantity || 1), 10);
  const quantity = Math.max(1, Math.min(10, isNaN(rawQuantity) ? 1 : rawQuantity));

  // Split name into first and last name
  const nameParts = rawName.split(' ');
  const firstName = nameParts[0] || rawName;
  const lastName = nameParts.slice(1).join(' ') || '';

  // 3. Fetch Event Details
  const { data: event, error: eventErr } = await supabaseAdmin
    .from('events')
    .select('id, title, base_price, date, location')
    .eq('id', rawEventId)
    .single();

  if (eventErr || !event) {
    throw new Error('Événement introuvable.');
  }

  // Compute pricing
  const basePrice = Number(event.base_price || 35);
  let totalPrice = Number(formData.totalPrice || formData.price || 0);
  if (isNaN(totalPrice) || totalPrice <= 0) {
    totalPrice = basePrice * quantity;
  }
  const unitPrice = totalPrice / quantity;

  // 4. Account Linking check
  let matchedUserId: string | null = null;
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', rawEmail)
      .maybeSingle();

    if (profile?.id) {
      matchedUserId = profile.id;
    }
  } catch (e) {
    // Non-blocking
  }

  // 5. Generate unique reservation reference code (e.g. POS-A8B9C1)
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const reservationCode = `POS-${randomHex}`;
  const now = new Date().toISOString();

  // 6. Build pass rows to insert
  const rowsToInsert: Record<string, any>[] = [];

  for (let i = 0; i < quantity; i++) {
    const secretToken = crypto.randomBytes(18).toString('base64url');
    const entryUuid = crypto.randomUUID();
    const drinkUuid = cleanDrink ? crypto.randomUUID() : null;

    const pLast = i === 0 ? lastName : (lastName ? `${lastName} (Billet #${i + 1})` : `Invité #${i + 1}`);

    rowsToInsert.push({
      event_id: event.id,
      user_id: matchedUserId,
      full_name: rawName,
      guest_first_name: firstName,
      guest_last_name: pLast,
      email: rawEmail,
      guest_email: rawEmail,
      phone: cleanPhone,
      drink_name: cleanDrink,
      selected_drink: formattedSelectedDrink,
      aromas: cleanAromas,
      selected_aromas: cleanAromas,
      total_price: totalPrice,
      final_price: unitPrice,
      status: 'approved',         // Required: Automatically approved
      payment_status: 'paid',     // Required: Automatically paid on-site
      entry_status: 'activated',  // Required: Instant gate activation
      source: 'POS',
      pass_origin: 'POS',
      pass_type: 'NORMAL',
      issued_by_pos: resolvedPosLocation,
      cashier_id: resolvedCashierId,
      payment_point_id: resolvedCashierId,
      approved_by: resolvedCashierId,
      payment_approved_at: now,
      reservation_code: reservationCode,
      secret_token: secretToken,
      entry_token: entryUuid,
      entry_qr_uuid: entryUuid,
      is_entry_used: false,
      entry_used_at: null,
      drink_token: drinkUuid,
      drink_qr_uuid: drinkUuid,
      drink_qr_code: drinkUuid,
      drink_status: cleanDrink ? 'activated' : null,
      is_drink_used: false,
      drink_used_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  // 7. Insert into passes using defensive dynamic column auto-pruning loop
  let workingRows = rowsToInsert.map((r) => ({ ...r }));
  let insertedPasses: any[] | null = null;

  for (let attempt = 0; attempt < 15; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('passes')
      .insert(workingRows)
      .select();

    if (!error && data) {
      insertedPasses = data;
      break;
    }

    const colMatch = (error?.message || '').match(/Could not find the '([^']+)' column/i);
    if (colMatch && colMatch[1]) {
      const missingCol = colMatch[1];
      console.warn(`[createPOSPass] Retrying insert without unmigrated column '${missingCol}'`);
      workingRows = workingRows.map((r) => {
        const copy = { ...r };
        delete copy[missingCol];
        return copy;
      });
    } else {
      console.error('[createPOSPass] Supabase insert error:', error);
      throw new Error(error?.message || 'Erreur lors de la création du pass en caisse.');
    }
  }

  if (!insertedPasses || insertedPasses.length === 0) {
    throw new Error('Erreur inattendue : aucun pass généré.');
  }

  const primaryPass = insertedPasses[0];
  const primaryToken = primaryPass.secret_token || primaryPass.id;
  const webPassUrl = getPassWebLink(primaryToken);

  // 8. Instant Dispatch of Confirmation & QR Codes via Email
  try {
    await dispatchPaidPassEmail(primaryPass.id);
  } catch (emailDispatchErr) {
    console.error('[createPOSPass] Erreur lors de l’envoi de l\'email du pass:', emailDispatchErr);
  }

  // 9. Revalidate Dashboard & Supervision Caches
  try {
    revalidatePath('/admin');
    revalidatePath('/admin/approbations');
    revalidatePath('/admin/passes');
    revalidatePath('/payment-point/dashboard');
  } catch (e) {
    // Non-blocking in server actions
  }

  return {
    success: true,
    message: 'Pass créé, payé et validé avec succès ! QR code prêt.',
    pass: primaryPass,
    passes: insertedPasses,
    reservationCode,
    webPassUrl,
    count: insertedPasses.length,
    totalPrice,
    cashierId: resolvedCashierId,
    posLocation: resolvedPosLocation,
  };
}
