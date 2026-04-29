import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

// V2 — Refonte Separate Charges + Transfers (avril 2026)
// Plus de transfer_data.destination + frais user (5% min 0,40€, opt-in via apply_user_fee).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webapp-secret',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const USER_FEE_RATE = 0.05;
const USER_FEE_MIN = 0.40;

function round2(n: number): number { return Math.round(n * 100) / 100; }
function computeUserFee(coupe: number): number {
  return round2(Math.max(USER_FEE_MIN, coupe * USER_FEE_RATE));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface WebappPaymentRequest {
  hairdresser_id: string;
  amount: number;
  location_type: 'salon' | 'home';
  service_name: string;
  client_email: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  apply_user_fee?: boolean;
  booking_slot?: string;
}

const SUBSCRIPTION_PRIORITY: Record<string, number> = {
  'rookie': 0, 'standard': 1, 'boost': 2, 'ambassador': 3,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const expectedSecret = Deno.env.get('WEBAPP_SHARED_SECRET');
    const providedSecret = req.headers.get('x-webapp-secret');
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!providedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body: WebappPaymentRequest = await req.json();
    const {
      hairdresser_id, amount, location_type, service_name,
      client_email, client_first_name, client_last_name, client_phone,
      apply_user_fee, booking_slot
    } = body;

    if (!hairdresser_id || !amount || !location_type || !client_email) {
      return new Response(JSON.stringify({ error: 'hairdresser_id, amount, location_type et client_email requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedHairdresserId = hairdresser_id.toString().trim().toLowerCase();
    const coupeAmount = Number(amount);
    const applyUserFee = apply_user_fee === true;
    const userFee = applyUserFee ? computeUserFee(coupeAmount) : 0;
    const totalCharged = round2(coupeAmount + userFee);

    console.log(`💳 [WebApp] coupe=${coupeAmount}€ userFee=${userFee}€ total=${totalCharged}€`);

    const { data: hairdresser, error: hairdresserError } = await supabaseAdmin
      .from('hairdressers')
      .select('id, name, statut')
      .eq('id', normalizedHairdresserId)
      .single();
    if (hairdresserError || !hairdresser) {
      return new Response(JSON.stringify({ error: 'Coiffeur non trouvé' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (hairdresser.statut !== 'Diplomé' && hairdresser.statut !== 'Pro') {
      return new Response(JSON.stringify({ error: 'Les paiements sont réservés aux coiffeurs pro' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: stripeAccount, error: stripeAccountError } = await supabaseAdmin
      .from('hairdresser_stripe_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, onboarding_status')
      .eq('hairdresser_id', normalizedHairdresserId)
      .single();
    if (stripeAccountError || !stripeAccount) {
      return new Response(JSON.stringify({ error: "Le coiffeur n'a pas configuré son compte Stripe Connect" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (stripeAccount.onboarding_status !== 'completed' || !stripeAccount.payouts_enabled) {
      return new Response(JSON.stringify({ error: "Le compte Stripe Connect du coiffeur n'est pas encore activé" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: subscriptions } = await supabaseAdmin
      .from('hairdresser_subscriptions')
      .select('subscription_type')
      .eq('hairdresser_id', normalizedHairdresserId)
      .eq('status', 'active');

    let bestSubscription: string | null = null;
    if (subscriptions && subscriptions.length > 0) {
      let bestPriority = -1;
      for (const sub of subscriptions) {
        const normalized = sub.subscription_type?.toString().trim().toLowerCase() ?? '';
        const priority = SUBSCRIPTION_PRIORITY[normalized] ?? -1;
        if (priority > bestPriority) {
          bestPriority = priority;
          bestSubscription = normalized;
        }
      }
    }
    let subscriptionTypeKey = 'standard';
    if (bestSubscription === 'boost' || bestSubscription === 'ambassador' || bestSubscription === 'standard') {
      subscriptionTypeKey = bestSubscription;
    }

    const subscriptionTypesToFetch = subscriptionTypeKey === 'standard'
      ? ['standard'] : [subscriptionTypeKey, 'standard'];
    const { data: subscriptionFees } = await supabaseAdmin
      .from('subscription_fees')
      .select('subscription_type, webapp_commission_percentage')
      .in('subscription_type', subscriptionTypesToFetch);
    const feesMap = new Map<string, number>();
    for (const fee of subscriptionFees ?? []) {
      const percentage = Number(fee.webapp_commission_percentage);
      if (Number.isFinite(percentage)) feesMap.set(fee.subscription_type, percentage);
    }
    const commissionPercentage = feesMap.get(subscriptionTypeKey) ?? feesMap.get('standard') ?? 7;
    const barberCommission = round2(coupeAmount * (commissionPercentage / 100));

    let customerId: string;
    const list = await stripe.customers.list({ email: client_email.toLowerCase(), limit: 1 });
    if (list.data.length > 0) {
      customerId = list.data[0].id;
    } else {
      const c = await stripe.customers.create({
        email: client_email.toLowerCase(),
        name: `${client_first_name} ${client_last_name}`.trim(),
        phone: client_phone,
        metadata: { source: 'webapp', app: 'fady' }
      });
      customerId = c.id;
    }

    const captureMethod = location_type === 'home' ? 'manual' : 'automatic';
    const totalInCents = Math.round(totalCharged * 100);

    const idempotencyKey = await sha256Hex(
      `pi:${client_email.toLowerCase()}:${normalizedHairdresserId}:${booking_slot ?? ''}:${coupeAmount}:${applyUserFee ? 1 : 0}:${captureMethod}`
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      customer: customerId,
      capture_method: captureMethod,
      automatic_payment_methods: { enabled: true },
      // PAS de transfer_data.destination : fonds retenus sur le compte plateforme
      metadata: {
        hairdresser_id: normalizedHairdresserId,
        hairdresser_name: hairdresser.name,
        client_email: client_email.toLowerCase(),
        client_name: `${client_first_name} ${client_last_name}`.trim(),
        location_type,
        coupe_amount: coupeAmount.toFixed(2),
        user_fee: userFee.toFixed(2),
        barber_commission: barberCommission.toFixed(2),
        commission_rate: commissionPercentage.toString(),
        subscription_type: subscriptionTypeKey,
        raw_subscription_type: bestSubscription ?? 'none',
        service_name: service_name || 'Coiffure',
        booking_slot: booking_slot ?? '',
        channel: 'webapp',
        connected_account_id: stripeAccount.stripe_account_id,
        source: 'webapp',
        app: 'fady',
        version: 'v2'
      },
      description: `Réservation coiffure (webapp) - ${hairdresser.name} (${location_type === 'home' ? 'À domicile' : 'Au salon'})`
    }, { idempotencyKey: `pi_webapp_${idempotencyKey}` });

    console.log(`✅ [WebApp] PaymentIntent créé: ${paymentIntent.id} (${captureMethod})`);

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: totalCharged,
      coupe_amount: coupeAmount,
      user_fee: userFee,
      total_amount: totalCharged,
      barber_commission: barberCommission,
      commission_rate: commissionPercentage,
      subscription_type: subscriptionTypeKey,
      capture_method: captureMethod
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ [WebApp Payment] Erreur:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
