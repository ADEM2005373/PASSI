"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendTransactionalEmail, buildPassiEmailTemplate } from '@/lib/mailer';
import { requireRole } from '@/lib/supabase/api-security';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Server Action: Approve Phase 1 (moves pass to 'awaiting_payment' and sends Payment Points email)
 */
export async function approvePhase1PassAction(passId: string) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  // 1. Fetch pass with event and user info
  const { data: pass, error: fetchError } = await supabaseAdmin
    .from('passes')
    .select('id, entry_status, user_id, event_id, guest_first_name, guest_last_name, events(title, date, location, base_price)')
    .eq('id', passId)
    .single();

  if (fetchError || !pass) {
    throw new Error('Pass introuvable');
  }

  if (['activated', 'scanned'].includes(pass.entry_status)) {
    throw new Error('Les passes déjà validés ou payés ne peuvent pas être modifiés.');
  }

  // 2. Update pass status to awaiting_payment
  const { error: updateError } = await supabaseAdmin
    .from('passes')
    .update({ 
      entry_status: 'awaiting_payment', 
      updated_at: new Date().toISOString() 
    })
    .eq('id', passId);

  if (updateError) {
    throw new Error('Erreur lors de la mise à jour du pass: ' + updateError.message);
  }

  // 3. Fetch user profile for email delivery
  let recipientEmail: string | undefined;
  let recipientName = `${pass.guest_first_name || ''} ${pass.guest_last_name || ''}`.trim();

  if (pass.user_id) {
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', pass.user_id)
      .maybeSingle();

    if (userProfile?.email) {
      recipientEmail = userProfile.email;
    }
    if (userProfile?.full_name) {
      recipientName = userProfile.full_name;
    }

    if (!recipientEmail) {
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(pass.user_id);
        if (authData?.user?.email) {
          recipientEmail = authData.user.email;
          if (!recipientName && authData.user.user_metadata?.full_name) {
            recipientName = authData.user.user_metadata.full_name;
          }
        }
      } catch (authErr) {
        console.warn('[approvePhase1PassAction] Erreur récupération email auth.admin:', authErr);
      }
    }
  }

  // 4. Query active Payment Points: WHERE role = 'PAYMENT_POINT' AND is_suspended = false
  const { data: paymentPoints } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, is_suspended')
    .or('role.eq.payment_point,role.eq.PAYMENT_POINT')
    .eq('is_suspended', false);

  const eventTitle = (pass.events as any)?.title || 'Événement Passi';

  // 5. Build dynamic active Payment Points HTML list
  let paymentPointsHtml = '';
  if (paymentPoints && paymentPoints.length > 0) {
    paymentPointsHtml = `
      <div style="margin: 24px 0; padding: 20px; background-color: #1A2333; border-radius: 16px; border: 1px solid #28354D;">
        <p style="margin: 0 0 12px 0; font-weight: 800; color: #4ECDC4; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
          📍 Points de Paiement actifs pour valider votre Pass :
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          ${paymentPoints.map((pp: any) => `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #222E42; color: #FFFFFF; font-size: 14px;">
                <strong>${pp.full_name || pp.email.split('@')[0]}</strong>
              </td>
              <td align="right" style="padding: 8px 0; border-bottom: 1px solid #222E42; color: #94A3B8; font-size: 13px;">
                ${pp.email}
              </td>
            </tr>
          `).join('')}
        </table>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #94A3B8;">
          Présentez-vous auprès de l'un de ces points de paiement pour régler votre place et obtenir votre QR Code d'entrée.
        </p>
      </div>
    `;
  } else {
    paymentPointsHtml = `
      <div style="margin: 20px 0; padding: 16px; background-color: #1A2333; border-radius: 14px; border: 1px solid #28354D; color: #CBD5E1; font-size: 13px;">
        <p style="margin: 0;">Rendez-vous auprès de l'équipe d'organisation sur place pour régler votre place en espèces.</p>
      </div>
    `;
  }

  // 6. Send "Payment Required" email (await ensures serverless execution doesn't terminate prematurely)
  if (recipientEmail) {
    const htmlBody = buildPassiEmailTemplate({
      headline: 'Phase 1 Validée',
      title: 'Félicitations ! Votre Pass est pré-approuvé 🎉',
      badgeText: 'À Régler',
      badgeColor: '#4ECDC4',
      contentHtml: `
        <p style="margin: 0 0 16px 0;">Bonjour <strong>${recipientName || 'Cher participant'}</strong>,</p>
        <p style="margin: 0 0 16px 0;">
          Votre demande de pass pour l'événement <strong>${eventTitle}</strong> a été validée avec succès par notre équipe !
        </p>
        <p style="margin: 0 0 16px 0;">
          Pour finaliser votre réservation et débloquer votre <strong>QR Code d'accès</strong>, veuillez effectuer votre paiement en espèces auprès d'un de nos Points de Paiement officiels.
        </p>
        ${paymentPointsHtml}
        <p style="margin: 0; font-size: 13px; color: #94A3B8;">
          Dès que le Point de Paiement aura confirmé la réception de votre règlement, votre QR Code d'entrée apparaîtra instantanément sur votre tableau de bord.
        </p>
      `,
    });

    try {
      console.log(`[approvePhase1PassAction] Envoi email de pré-approbation à ${recipientEmail}...`);
      const emailResult = await sendTransactionalEmail({
        to: recipientEmail,
        subject: 'Félicitations ! Votre Pass est pré-approuvé',
        htmlBody,
      });
      console.log('[approvePhase1PassAction] Résultat envoi email:', emailResult);
    } catch (err) {
      console.error('[approvePhase1PassAction] Erreur envoi email:', err);
    }
  } else {
    console.warn(`[approvePhase1PassAction] Aucun email trouvé pour l'utilisateur ${pass.user_id}`);
  }

  return { success: true, status: 'awaiting_payment' };
}

/**
 * Server Action: Reject Pass (sets status to 'rejected' and sends 48h notification email)
 */
export async function rejectPassAction(passId: string, rejectionReason?: string) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  // 1. Fetch pass with event and user info
  const { data: pass, error: fetchError } = await supabaseAdmin
    .from('passes')
    .select('id, entry_status, user_id, event_id, guest_first_name, guest_last_name, events(title)')
    .eq('id', passId)
    .single();

  if (fetchError || !pass) {
    throw new Error('Pass introuvable');
  }

  if (['activated', 'scanned'].includes(pass.entry_status)) {
    throw new Error('Les passes déjà validés ou payés ne peuvent pas être rejetés.');
  }

  const cleanReason = rejectionReason ? String(rejectionReason).slice(0, 500) : null;

  // 2. Update pass status to rejected
  const { error: updateError } = await supabaseAdmin
    .from('passes')
    .update({ 
      entry_status: 'rejected',
      rejection_reason: cleanReason,
      updated_at: new Date().toISOString() 
    })
    .eq('id', passId);

  if (updateError) {
    throw new Error('Erreur lors du rejet du pass: ' + updateError.message);
  }

  // 3. Fetch user profile for email delivery with auth.admin fallback
  let recipientEmail: string | undefined;
  let recipientName = `${pass.guest_first_name || ''} ${pass.guest_last_name || ''}`.trim();

  if (pass.user_id) {
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', pass.user_id)
      .maybeSingle();

    if (userProfile?.email) {
      recipientEmail = userProfile.email;
    }
    if (userProfile?.full_name) {
      recipientName = userProfile.full_name;
    }

    if (!recipientEmail) {
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(pass.user_id);
        if (authData?.user?.email) {
          recipientEmail = authData.user.email;
          if (!recipientName && authData.user.user_metadata?.full_name) {
            recipientName = authData.user.user_metadata.full_name;
          }
        }
      } catch (authErr) {
        console.warn('[rejectPassAction] Erreur récupération email auth.admin:', authErr);
      }
    }
  }

  const eventTitle = (pass.events as any)?.title || 'Événement Passi';

  // 4. Send "Pass Rejected" email with 48h notice (awaited to prevent serverless execution freeze)
  if (recipientEmail) {
    const reasonBlock = cleanReason
      ? `
        <div style="margin: 20px 0; padding: 16px; background-color: #2D1418; border-radius: 14px; border: 1px solid #571C24;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #FF6B5E; font-size: 13px;">Motif communiqué par l'organisateur :</p>
          <p style="margin: 0; color: #FECDD3; font-size: 14px; font-style: italic;">« ${cleanReason} »</p>
        </div>
      `
      : '';

    const htmlBody = buildPassiEmailTemplate({
      headline: 'Mise à jour de réservation',
      title: 'Mise à jour concernant votre demande de Pass',
      badgeText: 'Non Retenu',
      badgeColor: '#FF6B5E',
      contentHtml: `
        <p style="margin: 0 0 16px 0;">Bonjour <strong>${recipientName || 'Cher utilisateur'}</strong>,</p>
        <p style="margin: 0 0 16px 0;">
          Nous vous remercions de votre intérêt pour l'événement <strong>${eventTitle}</strong>. Après étude attentive des demandes, nous sommes au regret de vous informer que votre candidature n'a pas pu être retenue pour cette édition.
        </p>
        ${reasonBlock}
        <div style="margin: 24px 0; padding: 18px; background-color: #171E2D; border-radius: 14px; border: 1px solid #25334B;">
          <p style="margin: 0 0 8px 0; font-weight: 800; color: #CBD5E1; font-size: 13px;">
            ⏳ Conservation temporaire de 48 heures :
          </p>
          <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.6;">
            Par souci de transparence, cette notification reste consultable sur votre espace personnel pendant <strong>exactement 48 heures</strong>. Passé ce délai, elle sera <strong>automatiquement et définitivement supprimée</strong> de votre compte.
          </p>
        </div>
        <p style="margin: 0; font-size: 13px; color: #CBD5E1;">
          Nous vous remercions de votre compréhension et espérons vous retrouver lors de nos prochains événements.
        </p>
      `,
    });

    try {
      console.log(`[rejectPassAction] Envoi email de rejet à ${recipientEmail}...`);
      const emailResult = await sendTransactionalEmail({
        to: recipientEmail,
        subject: 'Mise à jour de votre demande de Pass - Passi',
        htmlBody,
      });
      console.log('[rejectPassAction] Résultat envoi email:', emailResult);
    } catch (err) {
      console.error('[rejectPassAction] Erreur envoi email:', err);
    }
  } else {
    console.warn(`[rejectPassAction] Aucun email trouvé pour l'utilisateur ${pass.user_id}`);
  }

  return { success: true, status: 'rejected' };
}

/**
 * Server Action: Fetch passes for Payment Point (strictly pre-approved / awaiting_payment only)
 */
export async function getPassesForPaymentPoint(eventId?: string) {
  const { error: authError } = await requireRole(['payment_point', 'admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits point de paiement ou administrateur requis');
  }

  let query = supabaseAdmin
    .from('passes')
    .select('*, events(title, base_price)')
    .eq('entry_status', 'awaiting_payment')
    .order('created_at', { ascending: true });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data: passesData, error } = await query;
  if (error) {
    console.error('Error in getPassesForPaymentPoint action:', error);
    throw new Error('Erreur lors de la récupération des passes: ' + error.message);
  }

  const filtered = (passesData || []).filter((p: any) => {
    const s = p.entry_status || p.status;
    return s === 'awaiting_payment' || s === 'PENDING_PAYMENT';
  });

  return filtered.map((pass: any) => ({
    ...pass,
    status: 'PENDING_PAYMENT',
    drink_menus: pass.drink_name ? { name: pass.drink_name } : (pass.drink_menus || null),
  }));
}

/**
 * Server Action: Approve Pass Payment (Real POS or Simulation Mode)
 * Explicitly records the currently authenticated Admin or Cashier ID in `approved_by`
 * and `payment_point_id`, updates status to 'activated' (and 'PAID'), generates the entry QR,
 * and records the exact approval timestamp in `payment_approved_at`.
 */
export async function approvePassPaymentAction(passId: string) {
  if (!passId || typeof passId !== 'string') {
    throw new Error('Identifiant de pass manquant ou invalide');
  }

  // 1. Authenticate user directly using Supabase Auth (Step B of Directive)
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Utilisateur non authentifié.");
  }

  // Verify role: allow 'admin' (even in simulation) or 'payment_point'
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_suspended, full_name, first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Profil utilisateur introuvable.");
  }

  if (profile.is_suspended) {
    throw new Error("Compte suspendu. Veuillez contacter un administrateur.");
  }

  const role = (profile.role || '').toLowerCase();
  if (!['payment_point', 'admin'].includes(role)) {
    throw new Error("Droits insuffisants pour approuver le paiement.");
  }

  // 2. Fetch pass to ensure it exists
  const { data: pass, error: fetchError } = await supabaseAdmin
    .from('passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (fetchError || !pass) {
    throw new Error('Pass introuvable');
  }

  const isPreApproved = pass.entry_status === 'awaiting_payment' || (pass as any).status === 'PENDING_PAYMENT';
  if (!isPreApproved && pass.entry_status !== 'pending') {
    if (['activated', 'scanned'].includes(pass.entry_status)) {
      return { success: true, pass, message: 'Pass déjà activé et payé.' };
    }
  }

  // 3. Generate QR codes and timestamp
  const now = new Date().toISOString();
  const entryQr = pass.entry_qr_uuid || crypto.randomUUID();

  // Explicitly update status, approved_by and payment_approved_at
  const updatePayload: Record<string, any> = {
    entry_status: 'activated',
    status: 'PAID',
    payment_point_id: user.id,
    approved_by: user.id, // Explicitly tracking the Admin/Cashier ID
    payment_approved_at: now,
    entry_qr_uuid: entryQr,
    updated_at: now,
  };

  if ((pass as any).drink_name || (pass as any).drink_id) {
    const drinkQr = pass.drink_qr_uuid || crypto.randomUUID();
    updatePayload.drink_status = 'activated';
    updatePayload.drink_qr_uuid = drinkQr;
    updatePayload.drink_qr_code = drinkQr;
  }

  // 4. Update the pass record
  let updatedPass: any = null;
  const updateResult = await supabaseAdmin
    .from('passes')
    .update(updatePayload)
    .eq('id', passId)
    .select('id, entry_status, status, final_price, payment_point_id, approved_by, payment_approved_at, drink_id, drink_name, drink_status, drink_qr_uuid, drink_qr_code')
    .single();

  updatedPass = updateResult.data;
  let updateError = updateResult.error;

  // Fallback if approved_by schema column issue arises
  if (updateError && (updateError.message?.includes('approved_by') || updateError.details?.includes('approved_by'))) {
    delete updatePayload.approved_by;
    const fallbackResult = await supabaseAdmin
      .from('passes')
      .update(updatePayload)
      .eq('id', passId)
      .select('id, entry_status, status, final_price, payment_point_id, payment_approved_at, drink_id, drink_name, drink_status, drink_qr_uuid, drink_qr_code')
      .single();
    updatedPass = fallbackResult.data;
    updateError = fallbackResult.error;
  }

  if (updateError) {
    console.error('Error approving pass payment:', updateError);
    throw new Error("Échec de l'approbation du paiement: " + updateError.message);
  }

  try {
    revalidatePath('/admin');
    revalidatePath('/admin/approbations');
    revalidatePath('/payment-point/dashboard');
  } catch (e) {
    // Safe ignore when executed outside Next request cycle
  }

  const approverDisplayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') 
    || profile.full_name 
    || profile.email?.split('@')[0] 
    || 'Administrateur';

  return {
    success: true,
    pass: updatedPass,
    message: 'Paiement approuvé avec succès. Le pass est désormais activé.',
    approverId: user.id,
    approverName: approverDisplayName,
    isSimulation: role === 'admin'
  };
}

// Aliases for standard naming conventions
export const markPassAsPaidAction = approvePassPaymentAction;
export const approvePassPayment = approvePassPaymentAction;
export const markPassAsPaid = approvePassPaymentAction;

export interface SavePassPayload {
  eventId: string;
  userId: string;
  guestFirstName: string;
  guestLastName: string;
  drinkName?: string | null;
  drinkId?: string | null;
  selectedAromas?: string[];
  promoCode?: string | null;
}

/**
 * Server Action: savePassAction
 * Saves a pass with guest information, optional drink selection, and selected_aromas.
 */
export async function savePassAction(payload: SavePassPayload) {
  const { eventId, userId, guestFirstName, guestLastName, drinkName, drinkId, selectedAromas, promoCode } = payload || {};

  if (!eventId || !guestFirstName || !guestLastName) {
    throw new Error('Champs requis manquants pour la réservation du pass');
  }

  const formattedAromas = Array.isArray(selectedAromas)
    ? selectedAromas.filter(a => typeof a === 'string' && a.trim().length > 0).map(a => a.trim())
    : [];

  const selectedDrink = (drinkName || drinkId || '').trim();
  const drinkParam = selectedDrink || null;

  // Try RPC create_pass_with_pricing with p_drink_name (TEXT) first
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_pass_with_pricing', {
    p_user_id: userId,
    p_event_id: eventId,
    p_guest_first_name: guestFirstName.trim(),
    p_guest_last_name: guestLastName.trim(),
    p_drink_name: drinkParam,
    p_promo_code: promoCode ? promoCode.trim() : null,
    p_selected_aromas: formattedAromas
  });

  if (!rpcError && rpcData?.success) {
    return { success: true, passId: rpcData.pass_id, finalPrice: rpcData.final_price, promoUsed: rpcData.promo_used };
  }

  // Fallback: direct insert with pricing and promo validation
  const { data: eventData } = await supabaseAdmin
    .from('events')
    .select('base_price, promo_codes')
    .eq('id', eventId)
    .single();

  const basePrice = Number(eventData?.base_price) || 0;
  let discount = 0;
  let promoUsed: string | null = null;

  if (promoCode && eventData?.promo_codes && Array.isArray(eventData.promo_codes)) {
    const matched = eventData.promo_codes.find(
      (p: any) => p && typeof p.code === 'string' && p.code.trim().toUpperCase() === promoCode.trim().toUpperCase()
    );
    if (matched) {
      discount = Number(matched.discount_amount) || 0;
      promoUsed = matched.code.trim().toUpperCase();
    }
  }

  const finalPrice = Math.max(0, basePrice - discount);

  const insertData: Record<string, any> = {
    user_id: userId,
    event_id: eventId,
    guest_first_name: guestFirstName.trim(),
    guest_last_name: guestLastName.trim(),
    entry_status: 'pending',
    final_price: finalPrice,
    promo_used: promoUsed,
    drink_name: drinkParam,
    drink_status: drinkParam ? 'pending' : null,
    selected_aromas: formattedAromas,
  };

  const { data: newPass, error: insertError } = await supabaseAdmin
    .from('passes')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    console.warn("Direct pass insert failed, retrying without selected_aromas/drink_name:", insertError);
    delete insertData.selected_aromas;
    delete insertData.drink_name;
    const { data: retryPass, error: retryError } = await supabaseAdmin
      .from('passes')
      .insert(insertData)
      .select()
      .single();

    if (retryError || !retryPass) {
      throw new Error("Impossible d'enregistrer le pass: " + (retryError?.message || insertError.message));
    }
    return { success: true, passId: retryPass.id, finalPrice, promoUsed };
  }

  return { success: true, pass: newPass, passId: newPass.id, finalPrice, promoUsed };
}

/**
 * Server Action: selectPassDrinkAction
 * Asynchronously selects drink and saves selected_aromas for a pass.
 */
export async function selectPassDrinkAction(
  passId: string, 
  drinkId: string, 
  selectedAromas: string[] = []
) {
  if (!passId || !drinkId) {
    throw new Error('ID du pass et ID de la boisson requis.');
  }

  const formattedAromas = Array.isArray(selectedAromas)
    ? selectedAromas.filter(a => typeof a === 'string' && a.trim().length > 0).map(a => a.trim())
    : [];

  const updateData: Record<string, any> = {
    drink_id: drinkId,
    drink_name: drinkId,
    selected_aromas: formattedAromas,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedPass, error: updateError } = await supabaseAdmin
    .from('passes')
    .update(updateData)
    .eq('id', passId)
    .select('*, events(title, date, location)')
    .single();

  if (updateError) {
    console.warn("Server action selectPassDrinkAction failed with selected_aromas, retrying without column:", updateError);
    delete updateData.selected_aromas;
    const { data: retryPass, error: retryError } = await supabaseAdmin
      .from('passes')
      .update(updateData)
      .eq('id', passId)
      .select('*, events(title, date, location)')
      .single();
    if (retryError) throw new Error(retryError.message);
    return { success: true, pass: { ...retryPass, selected_aromas: formattedAromas } };
  }

  return { success: true, pass: updatedPass };
}

export interface CreateAdminPassPayload {
  userId: string;
  eventId: string;
  passType?: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP' | 'CADEAU';
  status?: 'NORMAL' | 'GIFT' | 'INVITATION' | 'VIP' | 'CADEAU';
  guestFirstName?: string;
  guestLastName?: string;
  drink_name?: string | null;
  drinkName?: string | null;
  selected_aromas?: string[];
  selectedAromas?: string[];
  promo_code?: string;
  promoCode?: string;
  promo_used?: string;
  final_price?: number;
  finalPrice?: number;
}

/**
 * Server Action: createAdminPassAction
 * Creates a manual admin pass (VIP, GIFT/CADEAU, INVITATION, NORMAL)
 * with selected drink and aromas.
 */
export async function createAdminPassAction(payload: CreateAdminPassPayload) {
  const { error: authError, user: caller } = await requireRole(['admin']);
  if (authError || !caller) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  const {
    userId,
    eventId,
    passType,
    status,
    guestFirstName,
    guestLastName,
    drink_name,
    drinkName,
    selected_aromas,
    selectedAromas,
    promo_code,
    promoCode,
    promo_used,
    final_price,
    finalPrice: clientFinalPrice,
  } = payload || {};

  if (!userId || !eventId) {
    throw new Error("L'identifiant de l'utilisateur et de l'événement sont obligatoires");
  }

  const rawType = String(passType || status || 'NORMAL').toUpperCase().trim();
  const normalizedPassType = rawType === 'CADEAU'
    ? 'GIFT'
    : ['NORMAL', 'GIFT', 'INVITATION', 'VIP'].includes(rawType)
      ? rawType
      : 'NORMAL';

  // 1. Fetch user profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, instagram_handle, full_name')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error('Utilisateur destinataire introuvable');
  }

  // 2. Fetch event with promo_codes
  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, title, base_price, date, promo_codes')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error('Événement introuvable');
  }

  // 3. Entry status, promo discount & QR logic
  let entryStatus: 'pending' | 'awaiting_payment' | 'activated' = 'pending';
  let entryQrUuid: string | null = null;
  let invitationStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null = null;
  let finalPrice = event.base_price ?? 0;
  let promoUsed: string | null = null;

  if (normalizedPassType === 'GIFT' || normalizedPassType === 'VIP') {
    entryStatus = 'activated';
    entryQrUuid = crypto.randomUUID();
    finalPrice = 0;
    invitationStatus = null;
  } else if (normalizedPassType === 'INVITATION') {
    entryStatus = 'pending';
    entryQrUuid = null;
    finalPrice = 0;
    invitationStatus = 'PENDING';
  } else {
    // NORMAL pass
    entryStatus = 'pending';
    entryQrUuid = null;
    invitationStatus = null;

    const rawPromo = (promo_code || promoCode || promo_used || '').trim().toUpperCase();
    const basePrice = Number(event.base_price) || 0;
    let discount = 0;

    if (rawPromo && event.promo_codes && Array.isArray(event.promo_codes)) {
      const matched = event.promo_codes.find(
        (p: any) => p && typeof p.code === 'string' && p.code.trim().toUpperCase() === rawPromo
      );
      if (matched) {
        promoUsed = matched.code.trim().toUpperCase();
        if (matched.discount_type === 'percentage') {
          discount = (basePrice * Number(matched.discount_amount || 0)) / 100;
        } else {
          discount = Number(matched.discount_amount) || 0;
        }
      }
    }

    finalPrice = Math.max(0, basePrice - discount);
  }

  // 4. Resolve Drink & Aromas
  const resolvedDrinkName = (drink_name || drinkName || '').trim() || null;
  const rawAromas = selected_aromas || selectedAromas || [];
  const formattedAromas: string[] = Array.isArray(rawAromas)
    ? rawAromas.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim())
    : [];

  let drinkStatus: 'activated' | 'pending' | null = null;
  let drinkQrUuid: string | null = null;

  if (resolvedDrinkName) {
    if (normalizedPassType === 'GIFT' || normalizedPassType === 'VIP') {
      drinkStatus = 'activated';
      drinkQrUuid = crypto.randomUUID();
    } else {
      drinkStatus = 'pending';
      drinkQrUuid = null;
    }
  }

  const resolvedFirstName = guestFirstName?.trim() 
    || (profile.full_name ? profile.full_name.split(' ')[0] : (profile.instagram_handle || 'Invité'));
  const resolvedLastName = guestLastName?.trim() 
    || (profile.full_name && profile.full_name.split(' ').length > 1 ? profile.full_name.split(' ').slice(1).join(' ') : '');

  // 5. Try RPC create_admin_pass first if it exists
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_admin_pass', {
    p_user_id: userId,
    p_event_id: eventId,
    p_pass_type: normalizedPassType,
    p_guest_first_name: resolvedFirstName,
    p_guest_last_name: resolvedLastName,
    p_drink_name: resolvedDrinkName,
    p_selected_aromas: formattedAromas,
    p_promo_code: promoUsed,
  });

  if (!rpcError && rpcData?.success) {
    return { success: true, pass: rpcData.pass, passId: rpcData.pass_id };
  }

  // 6. Direct DB insertion
  const now = new Date().toISOString();
  const insertPayload: Record<string, any> = {
    user_id: userId,
    event_id: eventId,
    guest_first_name: resolvedFirstName,
    guest_last_name: resolvedLastName,
    pass_type: normalizedPassType,
    pass_origin: 'ADMIN',
    created_by: caller.id,
    invitation_status: invitationStatus,
    entry_status: entryStatus,
    entry_qr_uuid: entryQrUuid,
    final_price: finalPrice,
    promo_used: promoUsed,
    drink_name: resolvedDrinkName,
    drink_id: resolvedDrinkName,
    selected_aromas: formattedAromas,
    drink_status: drinkStatus,
    drink_qr_uuid: drinkQrUuid,
    drink_qr_code: drinkQrUuid,
  };

  if (normalizedPassType === 'GIFT' || normalizedPassType === 'VIP') {
    insertPayload.status = 'PAID';
    insertPayload.approved_by = caller.id;
    insertPayload.payment_approved_at = now;
  }

  let { data: newPass, error: insertError } = await supabaseAdmin
    .from('passes')
    .insert(insertPayload)
    .select('*, events(title, date, location)')
    .single();

  if (insertError) {
    // Retry without newly added schema columns if not yet migrated
    delete insertPayload.drink_qr_code;
    delete insertPayload.created_by;
    delete insertPayload.pass_origin;
    if (insertError.message?.includes('approved_by')) {
      delete insertPayload.approved_by;
    }
    const { data: retryPass, error: retryError } = await supabaseAdmin
      .from('passes')
      .insert(insertPayload)
      .select('*, events(title, date, location)')
      .single();

    if (retryError || !retryPass) {
      throw new Error("Impossible d'enregistrer le pass administrateur: " + (retryError?.message || insertError.message));
    }
    newPass = retryPass;
  }

  return { success: true, pass: newPass, passId: newPass.id };
}

/**
 * Server Action: Permanently delete a pass strictly by id (Admin only)
 */
export async function deletePassAction(passId: string, holderNameConfirmation?: string) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) {
    throw new Error('Action non autorisée : droits administrateur requis');
  }

  if (!passId || typeof passId !== 'string') {
    throw new Error('Identifiant du pass requis');
  }

  // 1. Fetch pass without ambiguous relationship embedding
  const { data: pass, error: fetchError } = await supabaseAdmin
    .from('passes')
    .select('id, guest_first_name, guest_last_name, user_id, entry_status')
    .eq('id', passId)
    .maybeSingle();

  if (fetchError || !pass) {
    throw new Error('Pass introuvable');
  }

  // Validate holder name if confirmation was passed
  if (holderNameConfirmation && holderNameConfirmation.trim()) {
    let profileFullName = '';
    if (pass.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', pass.user_id)
        .maybeSingle();
      profileFullName = (profile?.full_name || '').trim();
    }

    const normalize = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const guestFullName = [pass.guest_first_name, pass.guest_last_name]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ');
    
    const expectedCandidates = [guestFullName, profileFullName]
      .filter(n => n.length > 0)
      .map(normalize);

    const inputClean = normalize(holderNameConfirmation);
    const isMatched = expectedCandidates.includes(inputClean);

    if (!isMatched) {
      throw new Error(`Le nom saisi ne correspond pas. Nom attendu : "${guestFullName || profileFullName || 'Inconnu'}"`);
    }
  }

  // 2. Delete associated pass_drinks first
  await supabaseAdmin
    .from('pass_drinks')
    .delete()
    .eq('pass_id', passId);

  // 3. Delete pass strictly by id without status restriction
  const { data: deletedData, error: deleteError } = await supabaseAdmin
    .from('passes')
    .delete()
    .eq('id', passId)
    .select('id');

  if (deleteError) {
    throw new Error(`Erreur SQL: ${deleteError.message}`);
  }

  if (!deletedData || deletedData.length === 0) {
    throw new Error('Pass introuvable ou suppression bloquée par les permissions (RLS).');
  }

  try {
    revalidatePath('/admin');
    revalidatePath('/admin/approbations');
  } catch (e) {
    // Safe ignore outside Next request cycle
  }

  return { success: true, message: 'Pass supprimé avec succès' };
}

