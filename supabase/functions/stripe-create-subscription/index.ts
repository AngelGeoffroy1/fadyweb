import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Prix des abonnements - IDs réels de Stripe
const PRICE_IDS = {
  rookie: Deno.env.get('STRIPE_PRICE_ID_AMATEUR') || 'price_1SQ7UOF3Vklrzbhsz0xabt1Z',
  boost: Deno.env.get('STRIPE_PRICE_ID_BOOST') || 'price_1SQ7VaF3VklrzbhsVf0qO1bE' // Fady Boost - 19,99€/mois
};

// Helper function pour convertir un timestamp Unix en ISO string de manière sécurisée
function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (timestamp == null || timestamp === undefined) {
    return null;
  }
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch (error) {
    console.error('❌ Erreur conversion timestamp:', timestamp, error);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Non autorisé'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    
    // Récupérer l'utilisateur actuel
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Utilisateur non trouvé'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Récupérer les données de la requête
    const body = await req.json();
    const { hairdresser_id, subscription_type } = body;
    
    if (!hairdresser_id || !subscription_type) {
      return new Response(JSON.stringify({
        error: 'hairdresser_id et subscription_type requis'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Vérifier que le type d'abonnement est valide
    if (!['rookie', 'boost'].includes(subscription_type)) {
      return new Response(JSON.stringify({
        error: 'Type d\'abonnement invalide. Utilisez "rookie" ou "boost"'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Vérifier que le coiffeur appartient à l'utilisateur
    const { data: hairdresser, error: hairdresserError } = await supabase
      .from('hairdressers')
      .select('id, user_id, statut')
      .eq('id', hairdresser_id)
      .eq('user_id', user.id)
      .single();
    
    if (hairdresserError || !hairdresser) {
      return new Response(JSON.stringify({
        error: 'Coiffeur non trouvé ou non autorisé'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Vérifier l'éligibilité selon le statut
    if (subscription_type === 'boost' && hairdresser.statut !== 'Diplomé') {
      return new Response(JSON.stringify({
        error: 'Le plan FADY Boost est réservé aux coiffeurs diplomés'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (subscription_type === 'rookie' && hairdresser.statut !== 'Amateur') {
      return new Response(JSON.stringify({
        error: 'Le plan Fady Amateur est réservé aux coiffeurs amateurs'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Vérifier s'il existe un abonnement actif
    const { data: existingSubscription } = await supabase
      .from('hairdresser_subscriptions')
      .select('*')
      .eq('hairdresser_id', hairdresser_id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (existingSubscription) {
      return new Response(JSON.stringify({
        error: 'Un abonnement actif existe déjà'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Obtenir ou créer un client Stripe
    let customerId;
    const { data: existingSub } = await supabase
      .from('hairdresser_subscriptions')
      .select('stripe_customer_id')
      .eq('hairdresser_id', hairdresser_id)
      .not('stripe_customer_id', 'is', null)
      .maybeSingle();
    
    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          hairdresser_id: hairdresser_id,
          user_id: user.id
        }
      });
      customerId = customer.id;
    }
    
    // Créer l'abonnement dans Stripe
    const priceId = PRICE_IDS[subscription_type];
    console.log(`Création abonnement avec price_id: ${priceId} pour type: ${subscription_type}`);
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    });
    
    const invoice = subscription.latest_invoice;
    const paymentIntent = invoice?.payment_intent;
    
    // Utiliser les timestamps de l'abonnement ou des items, avec vérification null-safe
    const currentPeriodStart = subscription.current_period_start || subscription.items?.data?.[0]?.current_period_start;
    const currentPeriodEnd = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
    
    // Enregistrer l'abonnement dans la base de données
    const insertData: any = {
      hairdresser_id: hairdresser_id,
      subscription_type: subscription_type,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_customer_id: customerId,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end || false
    };
    
    // Ajouter les timestamps seulement s'ils existent
    if (currentPeriodStart != null) {
      insertData.current_period_start = safeTimestampToISO(currentPeriodStart);
    }
    if (currentPeriodEnd != null) {
      insertData.current_period_end = safeTimestampToISO(currentPeriodEnd);
    }
    
    const { error: insertError } = await supabase
      .from('hairdresser_subscriptions')
      .insert(insertData);
    
    if (insertError) {
      console.error('Erreur lors de l\'insertion:', insertError);
      // Annuler l'abonnement Stripe en cas d'erreur
      await stripe.subscriptions.cancel(subscription.id);
      return new Response(JSON.stringify({
        error: 'Erreur lors de la création de l\'abonnement'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify({
      subscription_id: subscription.id,
      status: subscription.status,
      client_secret: paymentIntent?.client_secret,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
