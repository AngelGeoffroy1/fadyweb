import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req: Request) => {
  try {
    const { payment_method_id } = await req.json();

    if (!payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'payment_method_id est requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Détacher le moyen de paiement du client
    const paymentMethod = await stripe.paymentMethods.detach(payment_method_id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_method: paymentMethod,
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