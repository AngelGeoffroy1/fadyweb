import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// URL de base pour les redirections (sans /rest/v1)
const getBaseUrl = () => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  return url.replace('/rest/v1', '');
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const method = req.method;

    // Si c'est un GET (retour depuis Stripe), traiter différemment
    if (method === 'GET') {
      const accountId = url.searchParams.get('account');
      const success = url.searchParams.get('success');

      if (!accountId) {
        // Page de retour sans account ID
        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fady Pro - Onboarding</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #06C270 0%, #05A85F 100%);
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    h1 { color: #06C270; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
    .icon { font-size: 60px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Configuration terminée</h1>
    <p>Vous pouvez fermer cette page et retourner à l'application Fady Pro.</p>
    <p style="font-size: 14px; color: #999; margin-top: 20px;">
      Votre compte sera mis à jour automatiquement.
    </p>
  </div>
</body>
</html>`;
        
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          }
        });
      }

      // Utiliser le service role pour mettre à jour le statut sans authentification
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Trouver le compte dans la base de données
      const { data: stripeAccount } = await supabase
        .from('hairdresser_stripe_accounts')
        .select('*')
        .eq('stripe_account_id', accountId)
        .maybeSingle();

      if (stripeAccount) {
        // Récupérer les informations du compte depuis Stripe
        const account = await stripe.accounts.retrieve(accountId);
        
        console.log(`Mise à jour compte ${accountId}:`, {
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled
        });

        // Déterminer le statut
        let onboardingStatus = 'pending';
        if (account.details_submitted) {
          if (account.charges_enabled && account.payouts_enabled) {
            onboardingStatus = 'completed';
          } else if (!account.charges_enabled || !account.payouts_enabled) {
            // En mode test, les comptes peuvent nécessiter une activation manuelle
            // Si details_submitted est true mais charges/payouts false, c'est en attente de vérification
            onboardingStatus = 'pending';
          }
        }

        // Mettre à jour dans la base de données
        await supabase
          .from('hairdresser_stripe_accounts')
          .update({
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            onboarding_status: onboardingStatus,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_account_id', accountId);
      }

      // Retourner une page HTML de succès
      const successHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fady Pro - Onboarding terminé</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #06C270 0%, #05A85F 100%);
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    h1 { color: #06C270; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; }
    .icon { font-size: 60px; margin-bottom: 20px; }
    .success-animation {
      animation: pop 0.5s ease-out;
    }
    @keyframes pop {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon success-animation">✅</div>
    <h1>Configuration terminée !</h1>
    <p>Votre compte Stripe Connect a été configuré avec succès.</p>
    <p style="margin-top: 20px;">
      Vous pouvez maintenant fermer cette page et retourner à l'application Fady Pro.
    </p>
    <p style="font-size: 14px; color: #999; margin-top: 30px;">
      Votre compte sera mis à jour automatiquement dans quelques instants.
    </p>
  </div>
</body>
</html>`;

      return new Response(successHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        }
      });
    }

    // Pour les requêtes POST (depuis l'app), nécessiter l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Récupérer l'utilisateur actuel
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non trouvé' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le hairdresser_id
    const body = await req.json();
    const { hairdresser_id } = body;

    if (!hairdresser_id) {
      return new Response(
        JSON.stringify({ error: 'hairdresser_id requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que le coiffeur appartient à l'utilisateur
    const { data: hairdresser, error: hairdresserError } = await supabase
      .from('hairdressers')
      .select('id, user_id')
      .eq('id', hairdresser_id)
      .eq('user_id', user.id)
      .single();

    if (hairdresserError || !hairdresser) {
      return new Response(
        JSON.stringify({ error: 'Coiffeur non trouvé ou non autorisé' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le compte Stripe existant
    const { data: stripeAccount, error: accountError } = await supabase
      .from('hairdresser_stripe_accounts')
      .select('*')
      .eq('hairdresser_id', hairdresser_id)
      .maybeSingle();

    if (accountError || !stripeAccount) {
      return new Response(
        JSON.stringify({ error: 'Compte Stripe non trouvé' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les informations du compte depuis Stripe
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);

    // Déterminer le statut
    let onboardingStatus = 'pending';
    if (account.details_submitted) {
      if (account.charges_enabled && account.payouts_enabled) {
        onboardingStatus = 'completed';
      }
    }

    // Générer un nouveau lien d'onboarding si nécessaire
    let onboardingLink = stripeAccount.onboarding_link;
    if (onboardingStatus !== 'completed') {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccount.stripe_account_id,
        refresh_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link`,
        return_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link?success=true`,
        type: 'account_onboarding'
      });
      onboardingLink = accountLink.url;
    }

    // Mettre à jour dans la base de données
    const { error: updateError } = await supabase
      .from('hairdresser_stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        onboarding_status: onboardingStatus,
        onboarding_link: onboardingLink,
        updated_at: new Date().toISOString()
      })
      .eq('hairdresser_id', hairdresser_id);

    if (updateError) {
      console.error('Erreur lors de la mise à jour:', updateError);
    }

    return new Response(
      JSON.stringify({
        stripe_account_id: stripeAccount.stripe_account_id,
        onboarding_link: onboardingLink,
        onboarding_status: onboardingStatus,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
