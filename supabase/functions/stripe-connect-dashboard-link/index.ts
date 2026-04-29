import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

    console.log(`🔑 [Login Link] Génération pour hairdresser_id: ${hairdresser_id}`);

    // Vérifier que le coiffeur appartient à l'utilisateur
    const { data: hairdresser, error: hairdresserError } = await supabase
      .from('hairdressers')
      .select('id, user_id')
      .eq('id', hairdresser_id)
      .eq('user_id', user.id)
      .single();

    if (hairdresserError || !hairdresser) {
      console.error(`❌ [Login Link] Coiffeur non trouvé:`, hairdresserError);
      return new Response(
        JSON.stringify({ error: 'Coiffeur non trouvé ou non autorisé' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le compte Stripe Connect
    const { data: stripeAccount, error: accountError } = await supabase
      .from('hairdresser_stripe_accounts')
      .select('stripe_account_id, onboarding_status, charges_enabled, payouts_enabled')
      .eq('hairdresser_id', hairdresser_id)
      .single();

    if (accountError || !stripeAccount) {
      console.error(`❌ [Login Link] Compte Stripe non trouvé:`, accountError);
      return new Response(
        JSON.stringify({ error: 'Compte Stripe Connect non trouvé' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [Login Link] Compte trouvé: ${stripeAccount.stripe_account_id}`);

    // Générer un lien de connexion temporaire au Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(
      stripeAccount.stripe_account_id
    );

    console.log(`✅ [Login Link] Lien généré: ${loginLink.url}`);

    return new Response(
      JSON.stringify({
        url: loginLink.url,
        created: loginLink.created,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [Login Link] Erreur:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.type || 'unknown'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
