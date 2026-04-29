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
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Récupérer l'utilisateur actuel
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non trouvé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupérer les données de la requête
    const body = await req.json();
    const { subscription_id, cancel_immediately } = body;

    if (!subscription_id) {
      return new Response(JSON.stringify({ error: 'subscription_id requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Récupérer l'abonnement depuis la base
    const { data: subscription, error: subError } = await supabase
      .from('hairdresser_subscriptions')
      .select('*, hairdressers!inner(user_id)')
      .eq('id', subscription_id)
      .single();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'Abonnement non trouvé' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Vérifier que l'abonnement appartient à l'utilisateur
    if (subscription.hairdressers.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si l'abonnement a un ID Stripe, annuler via Stripe
    if (subscription.stripe_subscription_id) {
      try {
        // CAS SPÉCIAL: Subscription incomplete
        // Les subscriptions incomplètes ne peuvent pas être annulées avec cancellation_details
        // On les supprime directement de la DB et Stripe les expire automatiquement après 23h
        if (subscription.status === 'incomplete' && cancel_immediately) {
          console.log('Subscription incomplete détectée - suppression directe de la DB');
          
          const { error: deleteError } = await supabase
            .from('hairdresser_subscriptions')
            .delete()
            .eq('id', subscription_id);

          if (deleteError) {
            console.error('Erreur suppression DB:', deleteError);
            return new Response(JSON.stringify({ error: 'Erreur lors de la suppression' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({
            success: true,
            status: 'deleted',
            message: 'Subscription incomplete supprimée (expire automatiquement côté Stripe)'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        let finalStatus = subscription.status;

        // CAS 1: Annulation immédiate
        if (cancel_immediately) {
          console.log('Annulation immédiate demandée');
          
          // Annuler directement avec cancellation_details
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id, {
            cancellation_details: {
              comment: "Annulé par l'utilisateur"
            }
          });
          
          finalStatus = 'canceled';
        } 
        // CAS 2: Annulation à la fin de la période
        else {
          console.log('Annulation à la fin de la période demandée');
          
          // Mettre à jour pour annuler à la fin de la période
          const updatedSub = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true
          });
          
          finalStatus = updatedSub.status;
        }

        // Mettre à jour la base de données
        const { error: updateError } = await supabase
          .from('hairdresser_subscriptions')
          .update({
            status: finalStatus,
            cancel_at_period_end: !cancel_immediately,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription_id);

        if (updateError) {
          console.error('Erreur mise à jour DB:', updateError);
        }

        return new Response(JSON.stringify({
          success: true,
          status: finalStatus,
          cancel_at_period_end: !cancel_immediately,
          message: cancel_immediately 
            ? 'Abonnement annulé immédiatement' 
            : 'Abonnement sera annulé à la fin de la période'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (stripeError) {
        console.error('Erreur Stripe:', stripeError);
        return new Response(JSON.stringify({ error: `Erreur Stripe: ${stripeError.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Abonnement gratuit - annuler directement dans la base
      const { error: updateError } = await supabase
        .from('hairdresser_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Erreur lors de l'annulation" }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'canceled',
        message: 'Abonnement gratuit annulé'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
