import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface HairdresserEmailRequest {
    email: string;
    name: string;
    statut: 'Amateur' | 'Diplomé';
    hairdresserId: string;
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

        const { email, name, statut, hairdresserId }: HairdresserEmailRequest = await req.json();

        if (!email || !name || !statut) {
            return new Response(
                JSON.stringify({ error: 'Données manquantes' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Template HTML pour coiffeurs amateurs
        const amateurTemplate = `
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
            background-color: #f8f8f8;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #BC31FC;
            margin-bottom: 10px;
          }
          h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .highlight {
            color: #BC31FC;
            font-weight: bold;
          }
          .plan-box {
            background: linear-gradient(135deg, #BC31FC 0%, #8B24C7 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            color: white;
          }
          .plan-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .plan-price {
            font-size: 16px;
            opacity: 0.9;
          }
          .feature-list {
            list-style: none;
            padding: 0;
            margin: 20px 0;
          }
          .feature-list li {
            padding: 8px 0;
            padding-left: 28px;
            position: relative;
          }
          .feature-list li::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #BC31FC;
            font-weight: bold;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #BC31FC 0%, #8B24C7 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FADY</div>
            <p style="color: #666;">L'app qui connecte les coiffeurs aux clients</p>
          </div>
          
          <h1>Bienvenue ${name} ! 🎉</h1>
          
          <p>Félicitations, ton compte <span class="highlight">Coiffeur Amateur</span> est maintenant créé sur Fady !</p>
          
          <p>Tu as choisi de te lancer dans l'aventure de la coiffure, et on est là pour t'accompagner. Avec Fady, tu vas pouvoir :</p>
          
          <ul class="feature-list">
            <li>Trouver des modèles près de chez toi</li>
            <li>Proposer des coupes gratuites pour te faire la main</li>
            <li>Recevoir des tips de tes clients satisfaits</li>
            <li>Construire ton portfolio et ta réputation</li>
          </ul>
          
          <div class="plan-box">
            <div class="plan-name">FADY Amateur</div>
            <div class="plan-price">9,99€/mois - L'offre parfaite pour débuter</div>
          </div>
          
          <p>Pour activer ton profil et commencer à recevoir des demandes, il te suffit de :</p>
          
          <ol>
            <li>Compléter ton profil avec une belle photo</li>
            <li>Ajouter tes premières réalisations dans ta galerie</li>
            <li>Définir tes disponibilités</li>
            <li>Souscrire à l'abonnement Amateur</li>
          </ol>
          
          <center>
            <a href="https://fady-app.fr" class="cta-button">Compléter mon profil</a>
          </center>
          
          <p>Si tu as des questions, n'hésite pas à nous contacter. On est là pour t'aider !</p>
          
          <p>À très vite sur Fady,<br><strong>L'équipe Fady</strong> ✂️</p>
          
          <div class="footer">
            <p>Cet email a été envoyé par Fady</p>
            <p>© 2025 Fady - Tous droits réservés</p>
          </div>
        </div>
      </body>
      </html>
    `;

        // Template HTML pour coiffeurs diplômés
        const diplomeTemplate = `
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
            background-color: #f8f8f8;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #BC31FC;
            margin-bottom: 10px;
          }
          h1 {
            color: #1a1a1a;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .highlight {
            color: #BC31FC;
            font-weight: bold;
          }
          .green-text {
            color: #06C270;
            font-weight: bold;
          }
          .plans-container {
            display: flex;
            gap: 16px;
            margin: 24px 0;
          }
          .plan-box {
            flex: 1;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
          }
          .plan-standard {
            background: #f0f0f0;
            border: 2px solid #ddd;
          }
          .plan-boost {
            background: linear-gradient(135deg, #BC31FC 0%, #8B24C7 100%);
            color: white;
          }
          .plan-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .plan-name-purple {
            color: #BC31FC;
            font-weight: bold;
          }
          .plan-price {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .plan-period {
            font-size: 14px;
            opacity: 0.8;
          }
          .feature-list {
            list-style: none;
            padding: 0;
            margin: 20px 0;
          }
          .feature-list li {
            padding: 8px 0;
            padding-left: 28px;
            position: relative;
          }
          .feature-list li::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #BC31FC;
            font-weight: bold;
          }
          .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
          }
          .comparison-table th,
          .comparison-table td {
            padding: 12px;
            text-align: center;
            border-bottom: 1px solid #eee;
          }
          .comparison-table th {
            background: #f8f8f8;
            font-weight: bold;
          }
          .comparison-table td:first-child {
            text-align: left;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #BC31FC 0%, #8B24C7 100%);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
          }
          .badge {
            display: inline-block;
            background: #BC31FC;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FADY</div>
            <p style="color: #666;">L'app qui connecte les coiffeurs aux clients</p>
          </div>
          
          <h1>Bienvenue ${name} ! 🎉</h1>
          
          <p>Félicitations, ton compte <span class="highlight">Coiffeur Diplômé</span> est maintenant créé sur Fady !</p>
          
          <p>En tant que professionnel certifié, tu as accès à des fonctionnalités exclusives pour développer ton activité.</p>
          
          <h2 style="margin-top: 30px; color: #1a1a1a;">Choisis ton abonnement</h2>
          
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Fonctionnalités</th>
                <th><span class="plan-name-purple">FADY STANDARD</span></th>
                <th><span class="plan-name-purple">FADY BOOST</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prix</td>
                <td><span class="green-text">GRATUIT</span></td>
                <td><strong>14,99€/mois</strong></td>
              </tr>
              <tr>
                <td>Commission App</td>
                <td>10%</td>
                <td><strong>6%</strong></td>
              </tr>
              <tr>
                <td>Commission Web</td>
                <td>6%</td>
                <td><strong>4%</strong></td>
              </tr>
              <tr>
                <td>Paiement espèces</td>
                <td>Non</td>
                <td><strong>Oui ✓</strong></td>
              </tr>
              <tr>
                <td>Virements</td>
                <td>2/mois</td>
                <td><strong>1/semaine</strong></td>
              </tr>
              <tr>
                <td>Lien Web App</td>
                <td>Oui ✓</td>
                <td>Oui ✓</td>
              </tr>
              <tr>
                <td>Coupe domicile</td>
                <td>Oui ✓</td>
                <td>Oui ✓</td>
              </tr>
            </tbody>
          </table>
          
          <p>Les deux offres te permettent de :</p>
          
          <ul class="feature-list">
            <li>Recevoir des réservations de clients près de chez toi</li>
            <li>Gérer ton calendrier et tes disponibilités</li>
            <li>Te déplacer chez tes clients (coupe à domicile)</li>
            <li>Encaisser les paiements de manière sécurisée</li>
            <li>Suivre tes statistiques et revenus</li>
          </ul>
          
          <p>Pour activer ton profil et commencer à recevoir des demandes, il te suffit de :</p>
          
          <ol>
            <li>Compléter ton profil avec une belle photo</li>
            <li>Télécharger ton diplôme pour vérification</li>
            <li>Configurer ton compte Stripe Connect</li>
            <li>Définir tes services et tarifs</li>
            <li>Choisir ton abonnement (<span class="plan-name-purple">FADY STANDARD</span> <span class="green-text">Gratuit</span> ou <span class="plan-name-purple">FADY BOOST</span>)</li>
          </ol>
          
          <center>
            <a href="https://fady-app.fr" class="cta-button">Compléter mon profil</a>
          </center>
          
          <p>Si tu as des questions, n'hésite pas à nous contacter. On est là pour t'aider !</p>
          
          <p>À très vite sur Fady,<br><strong>L'équipe Fady</strong> ✂️</p>
          
          <div class="footer">
            <p>Cet email a été envoyé par Fady</p>
            <p>© 2025 Fady - Tous droits réservés</p>
          </div>
        </div>
      </body>
      </html>
    `;

        // Choisir le template et le sujet en fonction du statut
        const isAmateur = statut === 'Amateur';
        const htmlContent = isAmateur ? amateurTemplate : diplomeTemplate;
        const subject = isAmateur
            ? `Bienvenue sur Fady – ton profil Coiffeur Amateur est presque prêt ✂️🔥`
            : `Bienvenue sur Fady – ton profil Coiffeur Diplômé est presque prêt ✂️🔥`;

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
                subject: subject,
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

        console.log('Email coiffeur envoyé avec succès:', resendData);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Email de bienvenue coiffeur envoyé',
                emailId: resendData.id,
                statut: statut
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