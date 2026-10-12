"use server";

import { createClient } from '@supabase/supabase-js';
import { sendTransactionalEmail, buildPassiEmailTemplate } from '@/lib/mailer';
import { requireRole } from '@/lib/supabase/api-security';

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
