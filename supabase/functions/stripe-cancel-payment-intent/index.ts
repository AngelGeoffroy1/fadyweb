import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  try {
    // Récupérer les données de la requête
    const body = await req.json();
    const { payment_intent_id, booking_id, reason } = body;

    if (!payment_intent_id) {
      return new Response(
        JSON.stringify({ error: 'payment_intent_id requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🚫 [Cancel] Tentative d'annulation du PaymentIntent: ${payment_intent_id}`);

    // Récupérer le PaymentIntent depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    console.log(`📊 [Cancel] Statut actuel du PaymentIntent: ${paymentIntent.status}`);

    // Vérifier si le PaymentIntent peut être annulé
    if (paymentIntent.status === 'canceled') {
      console.log(`ℹ️ [Cancel] PaymentIntent déjà annulé`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'PaymentIntent déjà annulé',
          payment_intent_id: paymentIntent.id,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Seuls les PaymentIntent avec statut requires_payment_method, requires_capture,
    // requires_confirmation, ou requires_action peuvent être annulés
    if (
      ![
        'requires_payment_method',
        'requires_capture',
        'requires_confirmation',
        'requires_action',
      ].includes(paymentIntent.status)
    ) {
      console.warn(
        `⚠️ [Cancel] Impossible d'annuler le PaymentIntent (statut: ${paymentIntent.status})`
      );
      return new Response(
        JSON.stringify({
          error: `Impossible d'annuler le paiement (statut: ${paymentIntent.status})`,
          status: paymentIntent.status,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Annuler le PaymentIntent
    const canceledPaymentIntent = await stripe.paymentIntents.cancel(
      payment_intent_id,
      {
        cancellation_reason: reason || 'requested_by_customer',
      }
    );

    console.log(`✅ [Cancel] PaymentIntent annulé avec succès: ${canceledPaymentIntent.id}`);

    // Mettre à jour le statut dans stripe_payments si le booking_id est fourni
    if (booking_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabase
        .from('stripe_payments')
        .update({ status: 'canceled' })
        .eq('booking_id', booking_id)
        .eq('stripe_payment_intent_id', payment_intent_id);

      if (updateError) {
        console.error(`⚠️ [Cancel] Erreur mise à jour stripe_payments:`, updateError);
      } else {
        console.log(`✅ [Cancel] Statut mis à jour dans stripe_payments`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: canceledPaymentIntent.id,
        status: canceledPaymentIntent.status,
        amount: canceledPaymentIntent.amount / 100,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [Cancel] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
