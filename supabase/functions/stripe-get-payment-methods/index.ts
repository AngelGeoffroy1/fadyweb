import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req: Request) => {
  try {
    const { customer_id } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id est requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les moyens de paiement du client
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer_id,
      type: 'card',
    });

    // Récupérer le client pour obtenir le moyen de paiement par défaut
    const customer = await stripe.customers.retrieve(customer_id);
    const defaultPaymentMethodId = typeof customer !== 'string' && !customer.deleted
      ? customer.invoice_settings?.default_payment_method
      : null;

    return new Response(
      JSON.stringify({
        payment_methods: paymentMethods.data,
        default_payment_method_id: defaultPaymentMethodId,
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