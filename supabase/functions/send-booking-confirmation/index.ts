import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const WEBAPP_URL = Deno.env.get('WEBAPP_URL') ?? 'https://fady-app.fr';

interface BookingConfirmationRequest {
  userEmail: string;
  userName: string;
  hairdresserName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  locationType: string;
  address?: string;
  totalPrice: number;
  numberOfCuts: number;
  bookingId: string;
}

// HMAC-SHA256 of the bookingId used to authenticate cancellation links from the
// confirmation email. Shares the WEBAPP_SHARED_SECRET already used for edge-fn
// authentication \u2014 the secret never leaves the server.
async function signBookingId(bookingId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(bookingId)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configur\u00e9e');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cancelSecret = Deno.env.get('WEBAPP_SHARED_SECRET');
    if (!cancelSecret) {
      console.error('\u{1F6A8} [SECURITY][send-booking-confirmation] WEBAPP_SHARED_SECRET not set \u2014 cannot sign cancellation link');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'M\u00e9thode non autoris\u00e9e' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data: BookingConfirmationRequest = await req.json();

    if (!data.userEmail || !data.hairdresserName) {
      return new Response(
        JSON.stringify({ error: 'Donn\u00e9es manquantes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    const locationText = data.locationType === 'home' ? 'À domicile' : 'En salon';
    const cutsText = data.numberOfCuts > 1 ? `${data.numberOfCuts} coupes` : '1 coupe';

    const cancelToken = await signBookingId(data.bookingId, cancelSecret);
    const reservationUrl = `${WEBAPP_URL}/reservation/${data.bookingId}?token=${cancelToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
          .header { background-color: #be3afd; color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .header .subtitle { margin-top: 8px; font-size: 15px; opacity: 0.95; }
          .content { padding: 40px 30px; }
          .content h2 { color: #333; margin-top: 0; font-size: 20px; font-weight: 600; }
          .content p { color: #666; margin: 16px 0; }
          .booking-card { background: #f9f9f9; border-left: 3px solid #be3afd; padding: 24px; border-radius: 6px; margin: 24px 0; }
          .booking-card h3 { margin-top: 0; margin-bottom: 20px; color: #be3afd; font-size: 16px; font-weight: 600; }
          .booking-detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e8e8e8; }
          .booking-detail:last-child { border-bottom: none; }
          .detail-label { font-weight: 500; color: #666; font-size: 14px; }
          .detail-value { color: #333; text-align: right; font-weight: 500; font-size: 14px; }
          .price-box { background-color: #be3afd; color: white; padding: 20px; border-radius: 6px; text-align: center; margin: 24px 0; }
          .price-box .label { font-size: 14px; opacity: 0.95; margin-bottom: 4px; }
          .price-box .amount { font-size: 32px; font-weight: 700; }
          .info-box { background: #fff9e6; border-left: 3px solid #ffc107; padding: 16px; border-radius: 4px; margin: 24px 0; font-size: 14px; color: #666; }
          .info-box strong { color: #333; }
          .cta { text-align: center; margin: 32px 0; }
          .button { display: inline-block; background-color: #be3afd; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
          .footer { background: #f9f9f9; padding: 24px 30px; text-align: center; color: #999; font-size: 13px; border-top: 1px solid #eee; }
          .footer p { margin: 8px 0; }
          .reference { color: #be3afd; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>R\u00e9servation confirm\u00e9e</h1>
            <div class="subtitle">Votre rendez-vous est bien enregistr\u00e9</div>
          </div>
          <div class="content">
            <h2>Bonjour ${data.userName},</h2>
            <p>Votre r\u00e9servation a \u00e9t\u00e9 confirm\u00e9e avec succ\u00e8s. Nous avons h\u00e2te de vous accueillir !</p>
            <div class="booking-card">
              <h3>D\u00e9tails de votre r\u00e9servation</h3>
              <div class="booking-detail"><span class="detail-label">Coiffeur</span><span class="detail-value">${data.hairdresserName}</span></div>
              <div class="booking-detail"><span class="detail-label">Prestation</span><span class="detail-value">${data.serviceName}</span></div>
              <div class="booking-detail"><span class="detail-label">Date</span><span class="detail-value">${formatDate(data.bookingDate)}</span></div>
              <div class="booking-detail"><span class="detail-label">Heure</span><span class="detail-value">${data.bookingTime}</span></div>
              <div class="booking-detail"><span class="detail-label">Lieu</span><span class="detail-value">${locationText}</span></div>
              ${data.address ? `<div class="booking-detail"><span class="detail-label">Adresse</span><span class="detail-value">${data.address}</span></div>` : ''}
              <div class="booking-detail"><span class="detail-label">Nombre</span><span class="detail-value">${cutsText}</span></div>
            </div>
            <div class="price-box"><div class="label">Total</div><div class="amount">${data.totalPrice.toFixed(2)} \u20ac</div></div>
            <div class="info-box"><strong>Rappel important</strong><br>Merci d'arriver \u00e0 l'heure pour votre rendez-vous. En cas d'emp\u00eachement, veuillez pr\u00e9venir votre coiffeur via le chat de l'application.</div>
            <div class="cta"><a href="${reservationUrl}" class="button">Voir ma r\u00e9servation</a></div>
            <p>Vous pouvez retrouver tous les d\u00e9tails de votre r\u00e9servation et l'annuler si n\u00e9cessaire en cliquant sur le bouton ci-dessus.</p>
            <p style="margin-top: 24px; color: #333;">\u00c0 tr\u00e8s bient\u00f4t,<br><strong>L'\u00e9quipe Fady</strong></p>
          </div>
          <div class="footer">
            <p>R\u00e9f\u00e9rence : <span class="reference">${data.bookingId.substring(0, 8).toUpperCase()}</span></p>
            <p>\u00a9 2025 Fady. Tous droits r\u00e9serv\u00e9s.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Fady <reservations@fady-app.fr>',
        to: [data.userEmail],
        subject: `R\u00e9servation confirm\u00e9e - ${data.hairdresserName}`,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Erreur Resend:', resendData);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\u0027envoi de l\u0027email', details: resendData }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email de confirmation envoy\u00e9 avec succ\u00e8s:', resendData);

    return new Response(
      JSON.stringify({ success: true, message: 'Email de confirmation envoy\u00e9', emailId: resendData.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur lors du traitement:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
