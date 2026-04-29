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
    // Vérifier l'authentification
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
    // Pas besoin de JOIN, on vérifie juste user_id
    const { data: hairdresser, error: hairdresserError } = await supabase
      .from('hairdressers')
      .select('id, user_id, name')
      .eq('id', hairdresser_id)
      .eq('user_id', user.id)
      .single();

    if (hairdresserError || !hairdresser) {
      console.error('Erreur hairdresser:', hairdresserError);
      return new Response(
        JSON.stringify({ error: 'Coiffeur non trouvé ou non autorisé' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier si un compte Stripe existe déjà
    const { data: existingAccount } = await supabase
      .from('hairdresser_stripe_accounts')
      .select('*')
      .eq('hairdresser_id', hairdresser_id)
      .maybeSingle();

    if (existingAccount) {
      // Si le compte existe mais n'est pas complété, régénérer le lien
      if (existingAccount.onboarding_status === 'pending' || existingAccount.onboarding_status === 'rejected') {
        const accountLink = await stripe.accountLinks.create({
          account: existingAccount.stripe_account_id,
          refresh_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link`,
          return_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link?success=true`,
          type: 'account_onboarding',
        });

        // Mettre à jour le lien dans la DB
        await supabase
          .from('hairdresser_stripe_accounts')
          .update({
            onboarding_link: accountLink.url,
            updated_at: new Date().toISOString(),
          })
          .eq('hairdresser_id', hairdresser_id);

        return new Response(
          JSON.stringify({
            stripe_account_id: existingAccount.stripe_account_id,
            onboarding_link: accountLink.url,
            onboarding_status: existingAccount.onboarding_status,
            charges_enabled: existingAccount.charges_enabled,
            payouts_enabled: existingAccount.payouts_enabled,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          stripe_account_id: existingAccount.stripe_account_id,
          onboarding_status: existingAccount.onboarding_status,
          charges_enabled: existingAccount.charges_enabled,
          payouts_enabled: existingAccount.payouts_enabled,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Utiliser les informations de l'utilisateur depuis auth.users
    const userEmail = user.email;
    const userName = user.user_metadata?.full_name || hairdresser.name || 'Coiffeur Fady Pro';

    console.log(`Création compte Stripe Connect pour: ${userName} (${userEmail})`);

    // Créer un nouveau compte Stripe Connect Express
    const account = await stripe.accounts.create({
      type: 'express',
      email: userEmail,
      country: 'FR',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        hairdresser_id: hairdresser_id,
        user_id: user.id,
        name: userName,
      },
    });

    console.log(`Compte Stripe Connect créé: ${account.id} pour hairdresser ${hairdresser_id}`);

    // Créer le lien d'onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link`,
      return_url: `${getBaseUrl()}/functions/v1/stripe-connect-onboarding-link?success=true`,
      type: 'account_onboarding',
    });

    // Enregistrer dans la base de données
    const { error: insertError } = await supabase
      .from('hairdresser_stripe_accounts')
      .insert({
        hairdresser_id: hairdresser_id,
        stripe_account_id: account.id,
        onboarding_status: 'pending',
        onboarding_link: accountLink.url,
        charges_enabled: false,
        payouts_enabled: false,
      });

    if (insertError) {
      console.error('Erreur lors de l\'insertion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du compte dans la base de données' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        stripe_account_id: account.id,
        onboarding_link: accountLink.url,
        onboarding_status: 'pending',
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
