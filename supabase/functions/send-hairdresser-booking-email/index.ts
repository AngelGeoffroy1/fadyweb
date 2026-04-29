import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface BookingNotificationRequest {
  hairdresserEmail: string;
  hairdresserName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  locationType: 'salon' | 'home';
  address?: string;
  totalPrice: number;
  bookingId: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data: BookingNotificationRequest = await req.json();

    if (!data.hairdresserEmail || !data.clientName || !data.serviceName) {
      return new Response(
        JSON.stringify({ error: 'Données manquantes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Formater la date en français
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }).format(date);
    };

    const locationText = data.locationType === 'home' 
      ? 'À domicile' 
      : 'En salon';

    const priceText = data.totalPrice === 0 
      ? 'Gratuit (Amateur)' 
      : `${data.totalPrice.toFixed(2)} €`;

    // Template HTML de l'email de notification au coiffeur
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .header {
            background-color: #be3afd;
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header .subtitle {
            margin-top: 8px;
            font-size: 15px;
            opacity: 0.95;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            margin-top: 0;
            font-size: 20px;
            font-weight: 600;
          }
          .content p {
            color: #666;
            margin: 16px 0;
          }
          .booking-card {
            background: #f9f9f9;
            border-left: 3px solid #be3afd;
            padding: 24px;
            border-radius: 6px;
            margin: 24px 0;
          }
          .booking-card h3 {
            margin-top: 0;
            margin-bottom: 20px;
            color: #be3afd;
            font-size: 16px;
            font-weight: 600;
          }
          .booking-detail {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e8e8e8;
          }
          .booking-detail:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 500;
            color: #666;
            font-size: 14px;
          }
          .detail-value {
            color: #333;
            text-align: right;
            font-weight: 500;
            font-size: 14px;
          }
          .client-box {
            background: #fff3f9;
            border-left: 3px solid #be3afd;
            padding: 20px;
            border-radius: 6px;
            margin: 24px 0;
          }
          .client-box h3 {
            margin-top: 0;
            margin-bottom: 16px;
            color: #be3afd;
            font-size: 16px;
            font-weight: 600;
          }
          .client-info {
            margin: 8px 0;
            font-size: 14px;
            color: #333;
          }
          .client-info a {
            color: #be3afd;
            text-decoration: none;
          }
          .price-box {
            background-color: #be3afd;
            color: white;
            padding: 20px;
            border-radius: 6px;
            text-align: center;
            margin: 24px 0;
          }
          .price-box .label {
            font-size: 14px;
            opacity: 0.95;
            margin-bottom: 4px;
          }
          .price-box .amount {
            font-size: 32px;
            font-weight: 700;
          }
          .cta {
            text-align: center;
            margin: 32px 0;
          }
          .button {
            display: inline-block;
            background-color: #be3afd;
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 15px;
          }
          .footer {
            background: #f9f9f9;
            padding: 24px 30px;
            text-align: center;
            color: #999;
            font-size: 13px;
            border-top: 1px solid #eee;
          }
          .footer p {
            margin: 8px 0;
          }
          .reference {
            color: #be3afd;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Nouvelle réservation !</h1>
            <div class="subtitle">Un client vient de réserver chez toi</div>
          </div>
          
          <div class="content">
            <h2>Bonjour ${data.hairdresserName},</h2>
            
            <p>Bonne nouvelle ! Tu as reçu une nouvelle réservation via Fady.</p>
            
            <div class="booking-card">
              <h3>Détails de la réservation</h3>
              
              <div class="booking-detail">
                <span class="detail-label">Prestation</span>
                <span class="detail-value">${data.serviceName}</span>
              </div>
              
              <div class="booking-detail">
                <span class="detail-label">Date</span>
                <span class="detail-value">${formatDate(data.bookingDate)}</span>
              </div>
              
              <div class="booking-detail">
                <span class="detail-label">Heure</span>
                <span class="detail-value">${data.bookingTime}</span>
              </div>
              
              <div class="booking-detail">
                <span class="detail-label">Lieu</span>
                <span class="detail-value">${locationText}</span>
              </div>
              
              ${data.locationType === 'home' && data.address ? `
              <div class="booking-detail">
                <span class="detail-label">Adresse</span>
                <span class="detail-value">${data.address}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="client-box">
              <h3>Informations client</h3>
              <div class="client-info"><strong>Nom :</strong> ${data.clientName}</div>
              <div class="client-info"><strong>Email :</strong> <a href="mailto:${data.clientEmail}">${data.clientEmail}</a></div>
              <div class="client-info"><strong>Téléphone :</strong> <a href="tel:${data.clientPhone}">${data.clientPhone}</a></div>
            </div>
            
            <div class="price-box">
              <div class="label">Montant</div>
              <div class="amount">${priceText}</div>
            </div>
            
            <p>Retrouve tous les détails de cette réservation dans ton application Fady Pro.</p>
            
            <div class="cta">
              <a href="fadypro://booking/${data.bookingId}" class="button">Voir la réservation</a>
            </div>
            
            <p style="margin-top: 24px; color: #333;">À très bientôt,<br>
            <strong>L'équipe Fady</strong></p>
          </div>
          
          <div class="footer">
            <p>Référence : <span class="reference">${data.bookingId.substring(0, 8).toUpperCase()}</span></p>
            <p>© 2025 Fady. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Envoyer l'email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Fady <reservations@fady-app.fr>',
        to: [data.hairdresserEmail],
        subject: `💈 Nouvelle réservation - ${data.clientName} le ${formatDate(data.bookingDate)}`,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Erreur Resend:', resendData);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de l\'envoi de l\'email',
          details: resendData 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Email de notification coiffeur envoyé avec succès:', resendData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email de notification envoyé au coiffeur',
        emailId: resendData.id 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur lors du traitement:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});