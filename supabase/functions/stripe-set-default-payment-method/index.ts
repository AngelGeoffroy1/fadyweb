import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req: Request) => {
  try {
    const { customer_id, payment_method_id } = await req.json();

    if (!customer_id || !payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id et payment_method_id sont requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Définir le moyen de paiement par défaut pour le client
    const customer = await stripe.customers.update(customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        customer: customer,
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