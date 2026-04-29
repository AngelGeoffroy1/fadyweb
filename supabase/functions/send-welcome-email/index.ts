import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Utiliser les secrets Supabase
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface EmailRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  userId: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Vérifier que la clé API est configurée
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée');
      return new Response(
        JSON.stringify({ error: 'Configuration manquante' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les données de l'utilisateur
    const { email, firstName, lastName, userId }: EmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construire le nom complet
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Nouveau membre';

    // Template HTML de l'email de bienvenue
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
          .features {
            background: #f9f9f9;
            padding: 24px;
            border-radius: 6px;
            margin: 24px 0;
            border-left: 3px solid #be3afd;
          }
          .features h3 {
            margin-top: 0;
            color: #be3afd;
            font-size: 16px;
            font-weight: 600;
          }
          .feature {
            margin: 12px 0;
            padding-left: 24px;
            position: relative;
            color: #666;
            font-size: 15px;
          }
          .feature::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #be3afd;
            font-weight: bold;
            font-size: 16px;
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue sur Fady</h1>
          </div>
          
          <div class="content">
            <h2>Bonjour ${fullName},</h2>
            
            <p>Merci de nous avoir rejoint ! Nous sommes ravis de vous accueillir dans la communauté Fady, l'application qui révolutionne la coiffure à domicile et en salon.</p>
            
            <div class="features">
              <h3>Avec Fady, vous pouvez :</h3>
              <div class="feature">Découvrir des coiffeurs disponibles immédiatement</div>
              <div class="feature">Réserver un rendez-vous en salon ou à domicile</div>
              <div class="feature">Chatter en temps réel avec votre coiffeur</div>
              <div class="feature">Payer facilement avec Apple Pay et Stripe</div>
              <div class="feature">Consulter les avis et portfolios des coiffeurs</div>
            </div>
            
            <p>Votre compte est maintenant activé et vous pouvez commencer à explorer nos coiffeurs talentueux.</p>
            
            <div class="cta">
              <a href="fadyapp://profile" class="button">Découvrir Fady</a>
            </div>
            
            <p>Si vous avez des questions, n'hésitez pas à nous contacter. Notre équipe est là pour vous aider.</p>
            
            <p style="margin-top: 24px; color: #333;">À très bientôt,<br>
            <strong>L'équipe Fady</strong></p>
          </div>
          
          <div class="footer">
            <p>Vous recevez cet email car vous vous êtes inscrit sur Fady.</p>
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
        from: 'Fady <bienvenue@fady-app.fr>',
        to: [email],
        subject: `Bienvenue sur Fady, ${fullName}`,
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

    console.log('Email envoyé avec succès:', resendData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email de bienvenue envoyé',
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