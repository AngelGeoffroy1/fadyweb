import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface SuspensionEmailRequest {
  email: string;
  name: string;
  hairdresserId: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Gérer les requêtes OPTIONS pour CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, name, hairdresserId }: SuspensionEmailRequest = await req.json();

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Données manquantes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 Envoi d\'email de suspension à:', { email, name, hairdresserId });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
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
            background-color: #dc2626;
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            color: #666;
            margin: 16px 0;
            font-size: 15px;
          }
          .warning-box {
            background: #fff3e6;
            border-left: 4px solid #dc2626;
            padding: 20px;
            border-radius: 6px;
            margin: 24px 0;
          }
          .warning-box h3 {
            margin-top: 0;
            color: #dc2626;
            font-size: 18px;
            font-weight: 600;
          }
          .warning-box p {
            margin: 8px 0;
            color: #333;
            font-size: 15px;
          }
          .info-box {
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            border-radius: 6px;
            margin: 24px 0;
          }
          .info-box h3 {
            margin-top: 0;
            color: #3b82f6;
            font-size: 16px;
            font-weight: 600;
          }
          .info-box ul {
            margin: 12px 0;
            padding-left: 20px;
          }
          .info-box li {
            margin: 8px 0;
            color: #333;
            font-size: 14px;
          }
          .contact-box {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin: 24px 0;
          }
          .contact-box h3 {
            margin-top: 0;
            color: #be3afd;
            font-size: 16px;
            font-weight: 600;
          }
          .contact-item {
            margin: 10px 0;
            color: #666;
            font-size: 14px;
          }
          .footer {
            background: #f9f9f9;
            padding: 24px 30px;
            text-align: center;
            color: #999;
            font-size: 13px;
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Votre profil a été suspendu</h1>
          </div>
          
          <div class="content">
            <p><strong>Bonjour ${name},</strong></p>
            
            <div class="warning-box">
              <h3>🚫 Profil mis en suspension</h3>
              <p>Nous vous informons que votre profil a été temporairement rendu invisible sur l'application Fady Client.</p>
              <p><strong>Cela signifie que les clients ne peuvent plus voir votre profil ni prendre rendez-vous avec vous pour le moment.</strong></p>
            </div>
            
            <div class="info-box">
              <h3>📋 Raisons possibles de cette suspension :</h3>
              <ul>
                <li>Non-respect des conditions d'utilisation de Fady</li>
                <li>Signalements répétés de clients</li>
                <li>Comportement inapproprié ou non professionnel</li>
                <li>Informations de profil incomplètes ou incorrectes</li>
                <li>Problèmes de paiement ou d'abonnement</li>
              </ul>
            </div>
            
            <p><strong>Que faire maintenant ?</strong></p>
            
            <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez comprendre les raisons de cette suspension, nous vous invitons à nous contacter au plus vite.</p>
            
            <p>Notre équipe se tient à votre disposition pour vous expliquer la situation et, si possible, trouver une solution pour réactiver votre profil.</p>
            
            <div class="contact-box">
              <h3>📞 Nous contacter</h3>
              <div class="contact-item">📩 Instagram : @fady.app</div>
              <div class="contact-item">📱 WhatsApp : 07 61 38 26 08</div>
              <div class="contact-item">📧 Email : contact@fady-app.fr</div>
            </div>
            
            <p style="margin-top: 32px; color: #333;">Cordialement,<br>
            <strong>L'équipe Fady</strong></p>
          </div>
          
          <div class="footer">
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
        from: 'Fady <notifications@fady-app.fr>',
        to: [email],
        subject: '⚠️ Votre profil Fady a été suspendu',
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Email de suspension envoyé avec succès:', resendData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email de suspension envoyé',
        emailId: resendData.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});