import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/**
 * Creates and caches the Gmail SMTP transporter
 */
function getTransporter() {
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL port 465
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a transactional email using Gmail SMTP.
 * Fails gracefully if SMTP credentials are missing or invalid, avoiding API crash.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  htmlBody,
  textBody,
}: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const user = process.env.SMTP_EMAIL;
    const pass = process.env.SMTP_APP_PASSWORD;

    if (!user || !pass) {
      console.warn(
        `[Mailer] ⚠️ E-mail non envoyé à ${to} : SMTP_EMAIL ou SMTP_APP_PASSWORD manquant dans .env.local.`
      );
      return { 
        success: false, 
        error: 'SMTP_EMAIL ou SMTP_APP_PASSWORD non configuré dans .env.local' 
      };
    }

    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, error: 'Impossible d\'initialiser le transporteur SMTP' };
    }

    const mailOptions = {
      from: `"Passi Events" <${user}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] ✓ E-mail transactionnel envoyé avec succès à ${to} (MessageId: ${info.messageId})`);
    
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Mailer] ❌ Erreur lors de l'envoi de l'e-mail à ${to}:`, error?.message || error);
    return { 
      success: false, 
      error: error?.message || 'Erreur inconnue lors de l\'envoi de l\'e-mail' 
    };
  }
}

/**
 * Passi Email Template Generator for consistent luxury branding
 */
export function buildPassiEmailTemplate({
  headline,
  title,
  contentHtml,
  badgeText,
  badgeColor = '#FF6B5E',
}: {
  headline: string;
  title: string;
  contentHtml: string;
  badgeText?: string;
  badgeColor?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0E14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0B0E14; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #121824; border-radius: 24px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Top Accent Bar -->
          <tr>
            <td height="5" style="background: linear-gradient(90deg, #FF6B5E, #4ECDC4); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF;">
                      pass<span style="color: #FF6B5E;">i</span>
                    </span>
                  </td>
                  ${badgeText ? `
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background-color: ${badgeColor}20; color: ${badgeColor}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${badgeColor}40;">
                      ${badgeText}
                    </span>
                  </td>
                  ` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 10px 36px 36px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8;">
                ${headline}
              </p>
              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.3;">
                ${title}
              </h1>
              
              <div style="font-size: 15px; line-height: 1.6; color: #CBD5E1;">
                ${contentHtml}
              </div>

              <!-- Action Link -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1E293B; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://passi-xi.vercel.app'}/dashboard" 
                   style="display: inline-block; padding: 14px 28px; background-color: #FF6B5E; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 14px; box-shadow: 0 10px 20px rgba(255,107,94,0.25);">
                  Accéder à mon espace Passi
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0A0D14; padding: 20px 36px; text-align: center; border-top: 1px solid #172033;">
              <p style="margin: 0; font-size: 12px; color: #64748B;">
                Cet e-mail a été envoyé automatiquement par la plateforme Passi.
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569;">
                © ${new Date().getFullYear()} Passi Events. Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
