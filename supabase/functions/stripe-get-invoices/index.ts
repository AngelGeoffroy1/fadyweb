import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req: Request) => {
  try {
    const { customer_id, limit = 20 } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id est requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer les factures du client
    const invoices = await stripe.invoices.list({
      customer: customer_id,
      limit: limit,
    });

    return new Response(
      JSON.stringify({
        invoices: invoices.data,
        has_more: invoices.has_more,
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