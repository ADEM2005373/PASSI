import jsPDF from 'jspdf';
import { createClient } from '@supabase/supabase-js';
import { sendTransactionalEmail, buildPassiEmailTemplate } from '@/lib/mailer';
import { getPassWebLink } from '@/lib/utils/url';

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
  ticketIndex?: number;
  ticketTotal?: number;
}

/**
 * Renders an individual luxury Passi ticket page onto a jsPDF document.
 */
export function renderTicketPage(
  doc: jsPDF,
  data: PassTicketData,
  pageIndex: number = 1,
  totalPages: number = 1
): void {
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

  // Status Badge / Multi-ticket indicator
  if (totalPages > 1) {
    doc.setFillColor(78, 205, 196); // Teal 400
    doc.roundedRect(48, 11, 40, 8, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(11, 14, 20);
    doc.text(`BILLET ${pageIndex}/${totalPages} • CONFIRMÉ`, 50, 16.5);
  } else {
    doc.setFillColor(34, 197, 94); // Emerald 500
    doc.roundedRect(62, 11, 26, 8, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('PASS CONFIRMÉ', 64, 16.5);
  }

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
  doc.text(totalPages > 1 ? `TITULAIRE BILLET ${pageIndex}` : 'TITULAIRE DU PASS', 12, 60);
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
  doc.text(`SCAN ENTRÉE ${totalPages > 1 ? `(#${pageIndex})` : 'PASSI'}`, 33, qrTop + 9);

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
}

/**
 * Generates a clean, luxury branded Passi multi-page PDF ticket for an array of passes.
 */
export async function generatePassTicketsPDF(tickets: PassTicketData[]): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 180],
  });

  const total = tickets.length || 1;
  tickets.forEach((ticket, idx) => {
    if (idx > 0) {
      doc.addPage([100, 180], 'portrait');
    }
    renderTicketPage(doc, ticket, idx + 1, total);
  });

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Generates a clean, luxury branded Passi PDF ticket using jsPDF (backward compatible).
 */
export async function generatePassTicketPDF(data: PassTicketData): Promise<Buffer> {
  return generatePassTicketsPDF([data]);
}

/**
 * Dispatches the activated & paid pass immediately to the guest/user via email
 * with the generated PDF ticket attached. If the reservation has multiple passes,
 * sends a SINGLE consolidated email with all tickets in a multi-page PDF!
 */
export async function dispatchPaidPassEmail(passOrId: any): Promise<{ success: boolean; error?: string }> {
  try {
    let pass = passOrId;

    // Fetch full pass record if passOrId is just a string ID
    if (typeof passOrId === 'string' || !pass?.events) {
      const passId = typeof passOrId === 'string' ? passOrId : pass.id;
      let fetchedPass: any = null;

      try {
        const { data, error } = await supabaseAdmin
          .from('passes')
          .select('*, events(*)')
          .eq('id', passId)
          .maybeSingle();
        if (!error && data) fetchedPass = data;
      } catch (e) {}

      if (!fetchedPass) {
        const { data: rawPass } = await supabaseAdmin
          .from('passes')
          .select('*')
          .eq('id', passId)
          .maybeSingle();
        fetchedPass = rawPass;
      }

      if (fetchedPass) {
        pass = fetchedPass;
      }
    }

    if (!pass) {
      console.warn('[dispatchPaidPassEmail] Pass introuvable pour envoi email.');
      return { success: false, error: 'Pass introuvable' };
    }

    // Check if this pass belongs to a multi-pass reservation
    let passesToDeliver = [pass];
    if (pass.reservation_code) {
      let siblingPasses: any[] | null = null;

      try {
        const { data, error } = await supabaseAdmin
          .from('passes')
          .select('*, events(*)')
          .eq('reservation_code', pass.reservation_code)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          siblingPasses = data;
        }
      } catch (e) {}

      // Fallback: Query without relations if schema relations fail
      if (!siblingPasses || siblingPasses.length === 0) {
        const { data: rawSiblings } = await supabaseAdmin
          .from('passes')
          .select('*')
          .eq('reservation_code', pass.reservation_code)
          .order('created_at', { ascending: true });

        if (rawSiblings && rawSiblings.length > 0) {
          siblingPasses = rawSiblings;
        }
      }

      if (siblingPasses && siblingPasses.length > 0) {
        passesToDeliver = siblingPasses;
      }
    } else if (pass.created_at && (pass.email || pass.phone)) {
      // Fallback: match passes created at identical timestamp for this guest
      try {
        const { data: sameTimePasses } = await supabaseAdmin
          .from('passes')
          .select('*')
          .eq('created_at', pass.created_at)
          .eq('email', pass.email)
          .order('created_at', { ascending: true });

        if (sameTimePasses && sameTimePasses.length > 0) {
          passesToDeliver = sameTimePasses;
        }
      } catch (e) {}
    }

    const firstPass = passesToDeliver[0];

    // Resolve recipient email address
    let recipientEmail = (
      firstPass.email ||
      firstPass.guest_email ||
      firstPass.user?.email ||
      ''
    ).trim().toLowerCase();

    // If still missing, check user_id in profiles or auth.users
    if (!recipientEmail && firstPass.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', firstPass.user_id)
        .maybeSingle();
      if (profile?.email) {
        recipientEmail = profile.email.trim().toLowerCase();
      }
    }

    if (!recipientEmail) {
      console.warn(`[dispatchPaidPassEmail] Aucun email disponible pour la réservation #${pass.reservation_code || pass.id}`);
      return { success: false, error: 'Adresse email manquante' };
    }

    let event = firstPass.events || firstPass.event || {};
    if (!event.title && firstPass.event_id) {
      const { data: evData } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', firstPass.event_id)
        .maybeSingle();
      if (evData) {
        event = evData;
      }
    }
    const reservationCode = firstPass.reservation_code || `PASS-${firstPass.id.slice(0, 8).toUpperCase()}`;
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

    const totalPasses = passesToDeliver.length;
    const buyerName = [firstPass.guest_first_name, firstPass.guest_last_name].filter(Boolean).join(' ') || 'Cher participant';

    // 1. Prepare ticket data for each pass and compute total price
    let totalSettled = 0;
    const ticketsData: PassTicketData[] = passesToDeliver.map((p, idx) => {
      const pEvent = p.events || event;
      const price = Number(p.final_price ?? pEvent.base_price ?? 0);
      totalSettled += price;

      const pGuestName = [p.guest_first_name, p.guest_last_name].filter(Boolean).join(' ')
        || (totalPasses > 1 ? `${buyerName} (Billet #${idx + 1})` : buyerName);

      return {
        passId: p.id,
        reservationCode,
        guestName: pGuestName,
        eventTitle,
        eventDate: pEvent.date,
        eventLocation,
        drinkName: p.selected_drink || p.drink_name || null,
        selectedAromas: p.selected_aromas || null,
        finalPrice: price,
        entryQrUuid: p.entry_qr_uuid || p.id,
        approvedAt: p.payment_approved_at || new Date().toISOString(),
        ticketIndex: idx + 1,
        ticketTotal: totalPasses,
      };
    });

    // 2. Check if this is a Quick Reservation flow (Dynamic Web Pass /p/:secretToken)
    const isQuickReservation = passesToDeliver.some(
      (p) => p.source === 'QUICK_RESERVATION' || Boolean(p.secret_token) || (p.reservation_code && p.reservation_code.startsWith('QCK-'))
    );

    const isMultiPass = totalPasses > 1;

    // ─── CASE A: QUICK RESERVATION FLOW (SHAREABLE WEB PASS LINKS, NO PDF) ───
    if (isQuickReservation) {
      console.log(`[dispatchPaidPassEmail] Quick Reservation détectée [${reservationCode}] : Génération des liens Web Pass dynamiques...`);

      const passLinks = passesToDeliver.map((p, idx) => {
        const token = p.secret_token || p.id;
        const webLink = getPassWebLink(token);
        const gName = [p.guest_first_name, p.guest_last_name].filter(Boolean).join(' ') || (isMultiPass ? `Billet #${idx + 1}` : buyerName);
        const drink = p.selected_drink || p.drink_name || 'Consommation incluse';
        const aromas = p.selected_aromas && p.selected_aromas.length > 0 ? ` (${p.selected_aromas.join(', ')})` : '';
        const whatsappMsg = `Salut ! Voici ton pass officiel Passi pour ${eventTitle} (${gName}) : ${webLink}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

        return {
          index: idx + 1,
          name: gName,
          drink: `${drink}${aromas}`,
          token,
          url: webLink,
          whatsappUrl,
        };
      });

      const emailTitle = isMultiPass
        ? `Vos ${totalPasses} Pass Web officiels sont prêts ! 🎉`
        : 'Votre Pass Web officiel est prêt ! 🎉';

      const emailHeadline = isMultiPass
        ? `${totalPasses} Pass Web Confirmés & Payés`
        : 'Pass Web Confirmé & Payé';

      const emailSubject = isMultiPass
        ? `Vos ${totalPasses} liens de Pass pour ${eventTitle} 🎟️ (${reservationCode})`
        : `Votre lien de Pass pour ${eventTitle} 🎟️ (${reservationCode})`;

      const linksHtmlList = `
        <div style="margin: 24px 0;">
          <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #4ECDC4; text-transform: uppercase; letter-spacing: 0.5px;">
            📱 ${isMultiPass ? `Vos ${totalPasses} Liens de Pass individuels à partager :` : 'Votre Lien de Pass officiel :'}
          </p>
          ${passLinks.map((item) => `
            <div style="margin: 12px 0; padding: 18px; background-color: #172033; border-radius: 14px; border: 1px solid #28354D;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="color: #FFFFFF; font-size: 15px; font-weight: 800;">
                    🎟️ Pass ${item.index} : <strong>${item.name}</strong>
                  </td>
                  <td align="right" style="color: #4ECDC4; font-size: 12px; font-weight: 700;">
                    ${reservationCode}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 6px 0 12px 0; color: #FF6B5E; font-size: 13px; font-weight: 600;">
                    🍹 Boisson : ${item.drink}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-bottom: 14px;">
                    <span style="font-size: 12px; color: #94A3B8;">Lien direct :</span><br />
                    <a href="${item.url}" style="color: #38BDF8; font-size: 13px; font-weight: 700; word-break: break-all; text-decoration: underline;">
                      ${item.url}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right: 10px;">
                          <a href="${item.url}" style="display: inline-block; padding: 10px 20px; background-color: #22C55E; color: #FFFFFF; font-size: 13px; font-weight: 800; text-decoration: none; border-radius: 10px;">
                            📲 Ouvrir ce Pass
                          </a>
                        </td>
                        <td>
                          <a href="${item.whatsappUrl}" style="display: inline-block; padding: 10px 18px; background-color: #25D366; color: #FFFFFF; font-size: 13px; font-weight: 800; text-decoration: none; border-radius: 10px;">
                            💬 Transférer sur WhatsApp
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>
          `).join('')}
        </div>
      `;

      const htmlBody = buildPassiEmailTemplate({
        headline: emailHeadline,
        title: emailTitle,
        badgeText: 'Payé & Activé',
        badgeColor: '#4ECDC4',
        contentHtml: `
          <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerName}</strong>,</p>
          <p style="margin: 0 0 16px 0;">
            Votre règlement en espèces a bien été validé auprès de notre point de vente. ${isMultiPass ? `Vos <strong>${totalPasses} pass d'accès</strong>` : 'Votre pass d’accès'} pour <strong>${eventTitle}</strong> ${isMultiPass ? 'sont immédiatement <strong>actifs et prêts</strong>' : 'est immédiatement <strong>actif et prêt</strong>'} !
          </p>
          
          <div style="margin: 20px 0; padding: 20px; background-color: #121824; border-radius: 16px; border: 1px solid #28354D;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Référence commande :</td>
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
              <tr>
                <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Nombre de pass :</td>
                <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px; font-weight: 700;">${totalPasses} place(s)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Total réglé :</td>
                <td align="right" style="padding: 6px 0; color: #22C55E; font-size: 15px; font-weight: 800;">${totalSettled.toFixed(2)} TND</td>
              </tr>
            </table>

            ${linksHtmlList}
          </div>

          <div style="margin: 20px 0; padding: 16px; background-color: #0F172A; border-radius: 12px; border: 1px solid #1E293B;">
            <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #38BDF8;">
              💡 Comment utiliser vos pass :
            </p>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #94A3B8; line-height: 1.6;">
              <li>Cliquez sur <strong>« Ouvrir ce Pass »</strong> pour afficher votre QR code d'accès en direct.</li>
              ${isMultiPass ? '<li>Utilisez le bouton <strong>« Transférer sur WhatsApp »</strong> pour envoyer chaque pass directement à la personne correspondante.</li>' : ''}
              <li>Chaque page contient le QR Code d'entrée et le bon de boisson en temps réel qui se valide automatiquement dès son scan !</li>
            </ul>
          </div>
        `,
      });

      console.log(`[dispatchPaidPassEmail] Envoi des liens Web Pass à ${recipientEmail}...`);
      const emailResult = await sendTransactionalEmail({
        to: recipientEmail,
        subject: emailSubject,
        htmlBody,
      });

      console.log('[dispatchPaidPassEmail] Résultat envoi Quick Reservation:', emailResult);
      return emailResult;
    }

    // ─── CASE B: STANDARD ACCOUNT RESERVATION FLOW (PRESERVED PDF GENERATION) ───
    console.log(`[dispatchPaidPassEmail] Standard Pass détecté : Génération du PDF pour ${totalPasses} pass(es) [${reservationCode}]...`);
    const pdfBuffer = await generatePassTicketsPDF(ticketsData);

    let ticketsHtmlList = '';
    if (isMultiPass) {
      ticketsHtmlList = `
        <div style="margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px;">
            Détail de vos ${totalPasses} billets :
          </p>
          ${passesToDeliver.map((p, idx) => {
            const gName = [p.guest_first_name, p.guest_last_name].filter(Boolean).join(' ') || `Billet ${idx + 1}`;
            const drink = p.selected_drink || p.drink_name;
            const aromas = p.selected_aromas && p.selected_aromas.length > 0 ? ` (${p.selected_aromas.join(', ')})` : '';
            const price = Number(p.final_price ?? event.base_price ?? 0);
            return `
              <div style="margin: 8px 0; padding: 12px 14px; background-color: #172033; border-radius: 12px; border: 1px solid #28354D;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="color: #FFFFFF; font-size: 14px; font-weight: 700;">
                      🎟️ Billet #${idx + 1} — <strong>${gName}</strong>
                    </td>
                    <td align="right" style="color: #4ECDC4; font-size: 13px; font-weight: 800;">
                      ${price.toFixed(2)} TND
                    </td>
                  </tr>
                  ${drink ? `
                    <tr>
                      <td colspan="2" style="padding-top: 6px; color: #FF6B5E; font-size: 12px; font-weight: 600;">
                        🍹 Boisson : ${drink}${aromas}
                      </td>
                    </tr>
                  ` : ''}
                </table>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      const singleDrink = firstPass.selected_drink || firstPass.drink_name;
      if (singleDrink) {
        ticketsHtmlList = `
          <div style="margin: 16px 0; padding: 14px; background-color: #172033; border-radius: 12px; border: 1px solid #28354D;">
            <p style="margin: 0; font-size: 13px; color: #4ECDC4;">
              🍹 <strong>Boisson incluse :</strong> ${singleDrink}
              ${firstPass.selected_aromas && firstPass.selected_aromas.length > 0 ? ` (${firstPass.selected_aromas.join(', ')})` : ''}
            </p>
          </div>
        `;
      }
    }

    const emailTitle = isMultiPass
      ? `Vos ${totalPasses} Pass officiels sont prêts ! 🎉`
      : 'Votre Pass officiel est prêt ! 🎉';

    const emailHeadline = isMultiPass
      ? `${totalPasses} Pass Confirmés & Payés`
      : 'Pass Confirmé & Payé';

    const emailSubject = isMultiPass
      ? `Vos ${totalPasses} Pass officiels pour ${eventTitle} 🎟️ (${reservationCode})`
      : `Votre Pass officiel pour ${eventTitle} 🎟️ (${reservationCode})`;

    const pdfFileName = isMultiPass
      ? `Passi_Billets_${reservationCode}.pdf`
      : `Passi_Ticket_${reservationCode}.pdf`;

    const htmlBody = buildPassiEmailTemplate({
      headline: emailHeadline,
      title: emailTitle,
      badgeText: 'Payé & Activé',
      badgeColor: '#4ECDC4',
      contentHtml: `
        <p style="margin: 0 0 16px 0;">Bonjour <strong>${buyerName}</strong>,</p>
        <p style="margin: 0 0 16px 0;">
          Votre règlement a bien été enregistré avec succès auprès de notre point de vente. ${isMultiPass ? `Vos <strong>${totalPasses} accès</strong>` : 'Votre accès'} pour l'événement <strong>${eventTitle}</strong> ${isMultiPass ? 'sont désormais <strong>validés et actifs</strong>' : 'est désormais <strong>validé et actif</strong>'} !
        </p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #121824; border-radius: 16px; border: 1px solid #28354D;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Référence commande :</td>
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
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Nombre de pass :</td>
              <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px; font-weight: 700;">${totalPasses} billet(s)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94A3B8; font-size: 13px;">Total réglé :</td>
              <td align="right" style="padding: 6px 0; color: #22C55E; font-size: 15px; font-weight: 800;">${totalSettled.toFixed(2)} TND</td>
            </tr>
          </table>
          ${ticketsHtmlList}
        </div>

        <p style="margin: 0 0 16px 0;">
          📎 <strong>${isMultiPass ? `Vos ${totalPasses} billets officiels avec QR Codes distincts sont réunis dans le fichier PDF joint (${pdfFileName}).` : 'Votre billet officiel en format PDF est joint à cet e-mail.'}</strong> Vous pouvez également retrouver vos pass directement sur votre espace Passi à tout moment en vous connectant avec cet e-mail.
        </p>

        <p style="margin: 0; font-size: 13px; color: #94A3B8;">
          Chaque participant doit présenter le QR Code de son billet lors de son arrivée à l'entrée de l'événement pour un scan instantané.
        </p>
      `,
    });

    console.log(`[dispatchPaidPassEmail] Envoi de l'e-mail avec ${totalPasses} billet(s) PDF à ${recipientEmail}...`);
    const emailResult = await sendTransactionalEmail({
      to: recipientEmail,
      subject: emailSubject,
      htmlBody,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log('[dispatchPaidPassEmail] Résultat envoi Standard Pass:', emailResult);
    return emailResult;
  } catch (error: any) {
    console.error('[dispatchPaidPassEmail] Erreur lors de l’envoi du pass:', error);
    return { success: false, error: error?.message || 'Erreur inconnue' };
  }
}
