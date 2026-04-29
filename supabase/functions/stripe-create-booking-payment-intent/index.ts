import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

// V2 — Refonte Separate Charges + Transfers (avril 2026)
// Plus de transfer_data.destination : les fonds restent sur le compte plateforme FADY
// jusqu'au virement hebdomadaire effectué par run-weekly-payouts.
// Frais user (5% min 0,40€) appliqués uniquement si apply_user_fee=true (rétrocompat apps v1).

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const USER_FEE_RATE = 0.05;
const USER_FEE_MIN = 0.40;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeUserFee(coupe: number): number {
  return round2(Math.max(USER_FEE_MIN, coupe * USER_FEE_RATE));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non trouvé' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      hairdresser_id, amount, location_type, service_name,
      apply_user_fee, booking_slot,
    } = body;

    if (!hairdresser_id || !amount || !location_type) {
      return new Response(JSON.stringify({ error: 'hairdresser_id, amount et location_type requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedHairdresserId = hairdresser_id.toString().trim().toLowerCase();
    const coupeAmount = Number(amount);
    const applyUserFee = apply_user_fee === true;
    const userFee = applyUserFee ? computeUserFee(coupeAmount) : 0;
    const totalCharged = round2(coupeAmount + userFee);

    console.log(`💳 [Payment] coupe=${coupeAmount}€ userFee=${userFee}€ total=${totalCharged}€ (${location_type}, applyUserFee=${applyUserFee})`);

    const { data: hairdresser, error: hairdresserError } = await supabaseAdmin
      .from('hairdressers')
      .select('id, name, statut')
      .eq('id', normalizedHairdresserId)
      .single();
    if (hairdresserError || !hairdresser) {
      return new Response(JSON.stringify({ error: 'Coiffeur non trouvé' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Accepte Diplomé ET Pro (aligné sur webapp)
    if (hairdresser.statut !== 'Diplomé' && hairdresser.statut !== 'Pro') {
      return new Response(JSON.stringify({ error: 'Les paiements sont réservés aux coiffeurs Pro' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: stripeAccount, error: stripeAccountError } = await supabaseAdmin
      .from('hairdresser_stripe_accounts')
      .select('stripe_account_id, charges_enabled, payouts_enabled, onboarding_status')
      .eq('hairdresser_id', normalizedHairdresserId)
      .single();
    if (stripeAccountError || !stripeAccount) {
      return new Response(JSON.stringify({ error: "Le coiffeur n'a pas configuré son compte Stripe Connect" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (stripeAccount.onboarding_status !== 'completed' || !stripeAccount.payouts_enabled) {
      return new Response(JSON.stringify({ error: "Le compte Stripe Connect du coiffeur n'est pas encore activé" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: subscription } = await supabaseAdmin
      .from('hairdresser_subscriptions')
      .select('subscription_type')
      .eq('hairdresser_id', normalizedHairdresserId)
      .eq('status', 'active')
      .maybeSingle();

    const rawSubscriptionType = subscription?.subscription_type ?? null;
    const normalized = rawSubscriptionType?.toString().trim().toLowerCase() ?? null;
    let subscriptionTypeKey = 'standard';
    if (normalized === 'boost' || normalized === 'ambassador' || normalized === 'standard') {
      subscriptionTypeKey = normalized;
    }

    const { data: feesRows } = await supabaseAdmin
      .from('subscription_fees')
      .select('subscription_type, commission_percentage')
      .in('subscription_type', subscriptionTypeKey === 'standard' ? ['standard'] : [subscriptionTypeKey, 'standard']);

    const feesMap = new Map<string, number>();
    for (const f of feesRows ?? []) {
      const p = Number(f.commission_percentage);
      if (Number.isFinite(p)) feesMap.set(f.subscription_type, p);
    }
    const commissionPercentage = feesMap.get(subscriptionTypeKey) ?? feesMap.get('standard') ?? 7;
    const barberCommission = round2(coupeAmount * (commissionPercentage / 100));

    console.log(`💰 [Payment] subscription=${subscriptionTypeKey} barberCommission=${commissionPercentage}% (${barberCommission}€)`);

    let customerId: string | undefined;
    if (user.email) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 });
      if (list.data.length > 0) {
        customerId = list.data[0].id;
      } else {
        const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id, app: 'fady' } });
        customerId = c.id;
      }
    } else {
      const c = await stripe.customers.create({ metadata: { user_id: user.id, app: 'fady' } });
      customerId = c.id;
    }

    const captureMethod = location_type === 'home' ? 'manual' : 'automatic';
    const totalInCents = Math.round(totalCharged * 100);

    const idempotencyKey = await sha256Hex(
      `pi:${user.id}:${normalizedHairdresserId}:${booking_slot ?? ''}:${coupeAmount}:${applyUserFee ? 1 : 0}:${captureMethod}`
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      customer: customerId,
      capture_method: captureMethod,
      metadata: {
        hairdresser_id: normalizedHairdresserId,
        hairdresser_name: hairdresser.name,
        user_id: user.id,
        location_type,
        coupe_amount: coupeAmount.toFixed(2),
        user_fee: userFee.toFixed(2),
        barber_commission: barberCommission.toFixed(2),
        commission_rate: commissionPercentage.toString(),
        subscription_type: subscriptionTypeKey,
        raw_subscription_type: rawSubscriptionType ?? 'none',
        service_name: service_name || 'Coiffure',
        booking_slot: booking_slot ?? '',
        channel: 'ios',
        connected_account_id: stripeAccount.stripe_account_id,
        app: 'fady',
        version: 'v2'
      },
      description: `Réservation coiffure - ${hairdresser.name} (${location_type === 'home' ? 'À domicile' : 'Au salon'})`
    }, { idempotencyKey: `pi_${idempotencyKey}` });

    console.log(`✅ [Payment] PaymentIntent créé: ${paymentIntent.id} (${captureMethod})`);

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
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ [Payment] Erreur:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
