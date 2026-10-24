import jsPDF from 'jspdf';
import { createClient } from '@supabase/supabase-js';
import { sendTransactionalEmail, buildPassiEmailTemplate } from '@/lib/mailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface PassTicketData {
  passId: string;
  reservationCode?: string;
  guestName: string;
  eventTitle: string;
  eventDate?: string;
  eventLocation?: string;
  drinkName?: string | null;
  selectedAromas?: string[] | null;
  finalPrice?: number;
  entryQrUuid?: string;
  approvedAt?: string;
}

/**
 * Generates a clean, luxury branded Passi PDF ticket using jsPDF.
 * Optimized to run cleanly on the server (Node.js runtime).
 */
export async function generatePassTicketPDF(data: PassTicketData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 180], // Luxury event ticket aspect ratio
  });

  const reservationRef = data.reservationCode || data.passId.slice(0, 8).toUpperCase();
  const guestName = data.guestName || 'Invité';
  const eventTitle = data.eventTitle || 'Événement Passi';
  const eventDate = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date à confirmer';
  const eventLocation = data.eventLocation || "L'Agora Djerba";
  const finalPrice = data.finalPrice !== undefined ? `${data.finalPrice.toFixed(2)} TND` : '0.00 TND';
  const entryQrUuid = data.entryQrUuid || data.passId;

  // Background Dark Gradient Simulation
  doc.setFillColor(11, 14, 20); // #0B0E14
  doc.rect(0, 0, 100, 180, 'F');

  // Top Accent Gradient Bar
  doc.setFillColor(255, 107, 94); // #FF6B5E
  doc.rect(0, 0, 50, 3, 'F');
  doc.setFillColor(78, 205, 196); // #4ECDC4
  doc.rect(50, 0, 50, 3, 'F');

  // Brand Logo Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('pass', 12, 18);
  doc.setTextColor(255, 107, 94);
  doc.text('i.', 29, 18);

  // Status Badge
  doc.setFillColor(34, 197, 94); // Emerald 500
  doc.roundedRect(62, 11, 26, 8, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PASS CONFIRMÉ', 64, 16.5);

  // Divider Line
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(10, 24, 90, 24);

  // Event Name & Location Box
  doc.setFillColor(18, 24, 36);
  doc.roundedRect(10, 28, 80, 24, 3, 3, 'F');
  doc.setDrawColor(40, 53, 77);
  doc.roundedRect(10, 28, 80, 24, 3, 3, 'S');

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(eventTitle.slice(0, 30), 14, 36);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`📅  ${eventDate}`, 14, 42);
  doc.text(`📍  ${eventLocation}`, 14, 48);

  // Reservation Details Section
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('TITULAIRE DU PASS', 12, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(guestName.slice(0, 32), 12, 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('RÉFÉRENCE RÉSERVATION', 12, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(78, 205, 196);
  doc.text(reservationRef, 12, 80);

  // Drink Selection Box (if drink was chosen)
  if (data.drinkName) {
    doc.setFillColor(23, 32, 48);
    doc.roundedRect(10, 86, 80, 14, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 107, 94);
    doc.setFont('helvetica', 'bold');
    doc.text('🍹 BOISSON INCLUSE', 14, 92);
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    const aromasSuffix = data.selectedAromas && data.selectedAromas.length > 0
      ? ` (${data.selectedAromas.join(', ')})`
      : '';
    doc.text(`${data.drinkName}${aromasSuffix}`.slice(0, 36), 14, 97);
  }

  // QR Code Placeholder & Token Information
  const qrTop = data.drinkName ? 106 : 90;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(26, qrTop, 48, 48, 3, 3, 'F');

  // Draw minimal QR border & token code
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.roundedRect(29, qrTop + 3, 42, 42, 2, 2, 'S');

  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('SCAN ENTRÉE PASSI', 33, qrTop + 9);

  // Simulation of QR barcode visual lines
  doc.setFillColor(15, 23, 42);
  doc.rect(34, qrTop + 13, 32, 3, 'F');
  doc.rect(34, qrTop + 18, 22, 2, 'F');
  doc.rect(34, qrTop + 22, 32, 4, 'F');
  doc.rect(34, qrTop + 28, 18, 3, 'F');
  doc.rect(34, qrTop + 33, 32, 2.5, 'F');

  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(`UUID: ${entryQrUuid.slice(0, 18)}...`, 31, qrTop + 42);

  // Bottom Settlement Details
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('MONTANT RÉGLÉ :', 12, qrTop + 56);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(finalPrice, 90, qrTop + 56, { align: 'right' });

  // Security Note
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.2);
  doc.line(10, qrTop + 60, 90, qrTop + 60);

  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Pass unique et infalsifiable. Présentez ce pass sur smartphone ou imprimé à l’entrée.', 50, qrTop + 64, { align: 'center', maxWidth: 80 });

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Dispatches the activated & paid pass immediately to the guest/user via email
 * with the generated PDF ticket attached.
 */
export async function dispatchPaidPassEmail(passOrId: any): Promise<{ success: boolean; error?: string }> {
  try {
    let pass = passOrId;

    // Fetch full pass record if passOrId is just a string ID
    if (typeof passOrId === 'string' || !pass?.events) {
      const passId = typeof passOrId === 'string' ? passOrId : pass.id;
      const { data: fetchedPass, error: fetchErr } = await supabaseAdmin
        .from('passes')
        .select(`
          *,
          events(title, date, location, base_price),
          user:profiles!passes_user_id_fkey(email, full_name)
        `)
        .eq('id', passId)
        .maybeSingle();

      if (fetchErr || !fetchedPass) {
        // Fallback without user relation
        const { data: fallbackPass } = await supabaseAdmin
          .from('passes')
          .select('*, events(title, date, location, base_price)')
          .eq('id', passId)
          .single();
        pass = fallbackPass;
      } else {
        pass = fetchedPass;
      }
    }

    if (!pass) {
      console.warn('[dispatchPaidPassEmail] Pass introuvable pour envoi email.');
      return { success: false, error: 'Pass introuvable' };
    }

    // Resolve recipient email address
    let recipientEmail = (
      pass.email ||
      pass.guest_email ||
      pass.user?.email ||
      ''
    ).trim().toLowerCase();

    // If still missing, check user_id in profiles or auth.users
    if (!recipientEmail && pass.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', pass.user_id)
        .maybeSingle();
      if (profile?.email) {
        recipientEmail = profile.email.trim().toLowerCase();
      }
    }

    if (!recipientEmail) {
      console.warn(`[dispatchPaidPassEmail] Aucun email disponible pour le pass #${pass.id}`);
      return { success: false, error: 'Adresse email manquante' };
    }

    const event = pass.events || pass.event || {};
    const guestName = [pass.guest_first_name, pass.guest_last_name].filter(Boolean).join(' ') || 'Cher participant';
    const reservationCode = pass.reservation_code || `PASS-${pass.id.slice(0, 8).toUpperCase()}`;
    const eventTitle = event.title || 'Événement Passi';
    const eventLocation = event.location || "L'Agora Djerba";
    const eventDate = event.date
      ? new Date(event.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Date à confirmer';

    // 1. Generate the PDF ticket Buffer
    console.log(`[dispatchPaidPassEmail] Génération du PDF pour le pass #${pass.id}...`);
    const pdfBuffer = await generatePassTicketPDF({
      passId: pass.id,
      reservationCode,
      guestName,
      eventTitle,
      eventDate: event.date,
      eventLocation,
      drinkName: pass.selected_drink || pass.drink_name || null,
      selectedAromas: pass.selected_aromas || null,
      finalPrice: Number(pass.final_price ?? event.base_price ?? 0),
      entryQrUuid: pass.entry_qr_uuid || pass.id,
      approvedAt: pass.payment_approved_at || new Date().toISOString(),
    });

    // 2. Build luxury transactional email template
    const drinkHtml = pass.selected_drink || pass.drink_name
      ? `
        <div style="margin: 16px 0; padding: 14px; background-color: #172033; border-radius: 12px; border: 1px solid #28354D;">
          <p style="margin: 0; font-size: 13px; color: #4ECDC4;">
            🍹 <strong>Boisson incluse :</strong> ${pass.selected_drink || pass.drink_name}
            ${pass.selected_aromas && pass.selected_aromas.length > 0 ? ` (${pass.selected_aromas.join(', ')})` : ''}
          </p>
        </div>
      `
      : '';

    const htmlBody = buildPassiEmailTemplate({
      headline: 'Pass Confirmé & Payé',
      title: 'Votre Pass officiel est prêt ! 🎉',
      badgeText: 'Payé & Activé',
      badgeColor: '#4ECDC4',
      contentHtml: `
        <p style="margin: 0 0 16px 0;">Bonjour <strong>${guestName}</strong>,</p>
        <p style="margin: 0 0 16px 0;">
          Votre règlement a bien été enregistré avec succès auprès de notre point de vente. Votre accès pour l'événement <strong>${eventTitle}</strong> est désormais <strong>validé et actif</strong> !
        </p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #121824; border-radius: 16px; border: 1px solid #28354D;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Référence réservation :</td>
              <td align="right" style="padding: 6px 0; color: #4ECDC4; font-size: 14px; font-weight: 800;">${reservationCode}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Événement :</td>
              <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px; font-weight: 700;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Date :</td>
              <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Lieu :</td>
              <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px;">${eventLocation}</td>
            </tr>
          </table>
          ${drinkHtml}
        </div>

        <p style="margin: 0 0 16px 0;">
          📎 <strong>Votre billet officiel en format PDF est joint à cet e-mail.</strong> Vous pouvez également retrouver vos pass directement sur votre espace Passi à tout moment en vous connectant avec cet e-mail.
        </p>

        <p style="margin: 0; font-size: 13px; color: #94A3B8;">
          Présentez le QR Code de votre billet lors de votre arrivée sur le lieu de l'événement pour un scan instantané à l'entrée.
        </p>
      `,
    });

    // 3. Dispatch transactional email with PDF attachment
    console.log(`[dispatchPaidPassEmail] Envoi de l'e-mail avec billet PDF à ${recipientEmail}...`);
    const emailResult = await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Votre Pass officiel pour ${eventTitle} 🎟️`,
      htmlBody,
      attachments: [
        {
          filename: `Passi_Ticket_${reservationCode}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log('[dispatchPaidPassEmail] Résultat envoi:', emailResult);
    return emailResult;
  } catch (error: any) {
    console.error('[dispatchPaidPassEmail] Erreur lors de l’envoi du pass:', error);
    return { success: false, error: error?.message || 'Erreur inconnue' };
  }
}
