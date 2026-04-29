import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const connectWebhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  console.log('🎯 [Webhook] Requête reçue de Stripe');
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  let event;
  let isConnectEvent = false;
  try {
    const body = await req.text();
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      isConnectEvent = false;
    } catch (err) {
      event = await stripe.webhooks.constructEventAsync(body, signature, connectWebhookSecret);
      isConnectEvent = true;
    }
    console.log(`📨 [Webhook] Type: ${event.type} (Source: ${isConnectEvent ? 'Connect' : 'Account'})`);
  } catch (err) {
    console.error('❌ [Webhook] Vérification signature:', err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object, supabase); break;
      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object, supabase); break;
      case 'account.application.authorized':
        await handleAccountApplicationAuthorized(event.data.object, supabase); break;
      case 'account.application.deauthorized':
        await handleAccountApplicationDeauthorized(event.data.object, supabase); break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, supabase); break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase); break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase); break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, supabase); break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object, supabase); break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object, supabase); break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, supabase); break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase); break;
      default:
        console.log(`⚠️ [Webhook] Type non géré: ${event.type}`);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ [Webhook] Traitement:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});

function safeTimestampToISO(timestamp: any) {
  if (timestamp == null) return null;
  try { return new Date(timestamp * 1000).toISOString(); } catch { return null; }
}

// ==================== STRIPE CONNECT ====================
async function handleAccountUpdated(account, supabase) {
  console.log(`🔄 [Connect] Account updated: ${account.id}`);
  const { data: stripeAccount } = await supabase
    .from('hairdresser_stripe_accounts')
    .select('hairdresser_id, hairdressers!inner(user_id)')
    .eq('stripe_account_id', account.id)
    .maybeSingle();
  if (!stripeAccount) return;
  const updateData: any = {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    updated_at: new Date().toISOString()
  };
  if (account.details_submitted) {
    if (account.charges_enabled && account.payouts_enabled) {
      updateData.onboarding_status = 'completed';
      await sendNotification(supabase, stripeAccount.hairdressers.user_id,
        'Stripe Connect activé ✅', 'Votre compte Stripe Connect est maintenant actif.');
    } else {
      updateData.onboarding_status = 'pending';
    }
  } else {
    updateData.onboarding_status = 'pending';
  }
  await supabase.from('hairdresser_stripe_accounts').update(updateData).eq('stripe_account_id', account.id);
}

async function handleCapabilityUpdated(capability, supabase) {
  const account = await stripe.accounts.retrieve(capability.account);
  await handleAccountUpdated(account, supabase);
}

async function handleAccountApplicationAuthorized(application, supabase) {
  console.log(`✅ [Connect] App authorized: ${application.account}`);
}

async function handleAccountApplicationDeauthorized(application, supabase) {
  const { data: stripeAccount } = await supabase
    .from('hairdresser_stripe_accounts')
    .select('hairdresser_id, hairdressers!inner(user_id)')
    .eq('stripe_account_id', application.account)
    .maybeSingle();
  if (!stripeAccount) return;
  await supabase.from('hairdresser_stripe_accounts').update({
    onboarding_status: 'rejected', charges_enabled: false, payouts_enabled: false,
    updated_at: new Date().toISOString()
  }).eq('stripe_account_id', application.account);
  await sendNotification(supabase, stripeAccount.hairdressers.user_id,
    'Stripe Connect désactivé', "L'accès a été révoqué.");
}

// ==================== ABONNEMENTS ====================
async function handleSubscriptionCreated(subscription, supabase) {
  const { data: existing } = await supabase
    .from('hairdresser_subscriptions')
    .select('hairdresser_id, hairdressers!inner(user_id)')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (existing) {
    await handleSubscriptionUpdated(subscription, supabase);
    return;
  }
  const customer = await stripe.customers.retrieve(subscription.customer);
  const hairdresserId = (customer as any)?.metadata?.hairdresser_id;
  if (!hairdresserId) return;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  let subType = 'standard';
  if (priceId) {
    const s = priceId.toString();
    if (s.includes('AMATEUR') || s.includes('rookie')) subType = 'rookie';
    else if (s.includes('BOOST') || s.includes('boost')) subType = 'boost';
    else if (s.includes('AMBASSADOR') || s.includes('ambassador')) subType = 'ambassador';
  }
  const cps = subscription.current_period_start || subscription.items?.data?.[0]?.current_period_start;
  const cpe = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
  await supabase.from('hairdresser_subscriptions').insert({
    hairdresser_id: hairdresserId,
    subscription_type: subType,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    stripe_customer_id: subscription.customer,
    status: subscription.status,
    current_period_start: safeTimestampToISO(cps),
    current_period_end: safeTimestampToISO(cpe),
    cancel_at_period_end: subscription.cancel_at_period_end || false
  });
}

async function handleSubscriptionUpdated(subscription, supabase) {
  const full = await stripe.subscriptions.retrieve(subscription.id);
  const { data: oldSub } = await supabase
    .from('hairdresser_subscriptions')
    .select('status, cancel_at_period_end, hairdresser_id, hairdressers!inner(user_id)')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (!oldSub) {
    await handleSubscriptionCreated(full, supabase);
    return;
  }
  const cps = full.current_period_start || full.items?.data?.[0]?.current_period_start;
  const cpe = full.current_period_end || full.items?.data?.[0]?.current_period_end;
  const updateData: any = { status: full.status, cancel_at_period_end: full.cancel_at_period_end || false };
  if (cps != null) updateData.current_period_start = safeTimestampToISO(cps);
  if (cpe != null) updateData.current_period_end = safeTimestampToISO(cpe);
  await supabase.from('hairdresser_subscriptions').update(updateData)
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription, supabase) {
  await supabase.from('hairdresser_subscriptions').update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);
}

// ==================== PAIEMENTS ====================
async function handlePaymentIntentSucceeded(paymentIntent, supabase) {
  console.log(`💳 [Payment] PI succeeded: ${paymentIntent.id}`);

  // V2 : détection via metadata.app=fady (pas via transfer_data, qui est null avec Separate Charges)
  // V1 (legacy) : détection via transfer_data.destination
  const meta = (paymentIntent.metadata ?? {}) as Record<string, string>;
  const isFadyBooking = meta.app === 'fady' || !!paymentIntent.transfer_data?.destination;
  if (!isFadyBooking) {
    // Probablement un paiement d'abonnement — traité plus bas via invoice
    if (paymentIntent.invoice) await handleSubscriptionInvoice(paymentIntent, supabase);
    return;
  }

  // Trouver la booking via le PI
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, hairdresser_id, location_type, status, payout_status, hairdressers!inner(name, user_id)')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();

  if (!booking) {
    console.log(`⚠️ [Payment] Aucune booking pour PI ${paymentIntent.id}`);
    return;
  }

  // Récupérer balance_transaction pour stripe_fee + funds_available_on
  let stripeFee = 0, stripeNet = 0;
  let fundsAvailableOn: string | null = null;
  try {
    const chargeId = (paymentIntent as any).latest_charge as string | null;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
      const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (bt && typeof bt === 'object') {
        stripeFee = (bt.fee ?? 0) / 100;
        stripeNet = (bt.net ?? 0) / 100;
        if (bt.available_on) {
          fundsAvailableOn = new Date(bt.available_on * 1000).toISOString().slice(0, 10);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ [Payment] balance_transaction:', (e as Error).message);
  }

  // Mise à jour de la booking
  const isV2 = meta.version === 'v2';
  const updatePayload: Record<string, any> = {};

  // Confirmer la booking si capture auto (salon) ou si manuel déjà capturé
  if (booking.location_type === 'salon' || paymentIntent.capture_method === 'automatic') {
    if (booking.status === 'pending') updatePayload.status = 'confirmed';
  }

  if (isV2) {
    if (booking.payout_status == null) updatePayload.payout_status = 'pending';
    updatePayload.fady_commission_user = Number(meta.user_fee ?? '0');
    updatePayload.fady_commission_barber = Number(meta.barber_commission ?? '0');
    updatePayload.commission_percentage = Number(meta.commission_rate ?? '0');
    if (meta.channel) updatePayload.channel = meta.channel;
  }
  if (stripeFee > 0) updatePayload.stripe_fee = stripeFee;
  if (stripeNet > 0) updatePayload.stripe_net = stripeNet;
  if (fundsAvailableOn) updatePayload.funds_available_on = fundsAvailableOn;

  if (Object.keys(updatePayload).length > 0) {
    await supabase.from('bookings').update(updatePayload).eq('id', booking.id);
  }

  // Enregistrer dans stripe_payments si pas déjà fait
  const { data: existingPayment } = await supabase
    .from('stripe_payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();
  if (!existingPayment) {
    await supabase.from('stripe_payments').insert({
      booking_id: booking.id,
      hairdresser_id: booking.hairdresser_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: 'succeeded',
      payment_type: 'booking'
    });
  }

  // Notifications
  const hairdresserUserId = (booking as any).hairdressers?.user_id;
  const hairdresserName = (booking as any).hairdressers?.name;
  if (hairdresserUserId) {
    await sendNotification(supabase, hairdresserUserId,
      'Paiement reçu 💰',
      `Vous avez reçu un paiement de ${(paymentIntent.amount / 100).toFixed(2)}€`);
  }
  if (booking.location_type === 'salon' && booking.user_id) {
    await sendNotification(supabase, booking.user_id,
      'Réservation confirmée ✅',
      `Votre réservation avec ${hairdresserName} est confirmée et payée.`);
  }
}

async function handleSubscriptionInvoice(paymentIntent, supabase) {
  try {
    const invoice = await stripe.invoices.retrieve(paymentIntent.invoice, { expand: ['subscription'] });
    if (!invoice.subscription) return;
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    const { data: dbSub } = await supabase
      .from('hairdresser_subscriptions')
      .select('hairdresser_id')
      .eq('stripe_subscription_id', subId)
      .maybeSingle();
    if (!dbSub) return;
    const cps = sub.current_period_start || sub.items?.data?.[0]?.current_period_start;
    const cpe = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
    const updateData: any = { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end || false };
    if (cps != null) updateData.current_period_start = safeTimestampToISO(cps);
    if (cpe != null) updateData.current_period_end = safeTimestampToISO(cpe);
    await supabase.from('hairdresser_subscriptions').update(updateData).eq('stripe_subscription_id', subId);
    await supabase.from('stripe_payments').insert({
      hairdresser_id: dbSub.hairdresser_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: 'succeeded',
      payment_type: 'subscription'
    });
  } catch (e) { console.error('❌ [Subscription invoice]:', e); }
}

async function handlePaymentIntentFailed(paymentIntent, supabase) {
  const { data: booking } = await supabase
    .from('bookings').select('id, user_id, hairdresser_id')
    .eq('stripe_payment_intent_id', paymentIntent.id).maybeSingle();
  if (!booking) return;
  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
  await supabase.from('stripe_payments').insert({
    booking_id: booking.id, hairdresser_id: booking.hairdresser_id,
    stripe_payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount / 100, currency: paymentIntent.currency,
    status: 'failed', payment_type: 'booking'
  });
  await sendNotification(supabase, booking.user_id,
    'Échec du paiement ❌', 'Le paiement de votre réservation a échoué. Veuillez réessayer.');
}

async function handlePaymentIntentCanceled(paymentIntent, supabase) {
  const { data: booking } = await supabase
    .from('bookings').select('id, user_id, hairdresser_id')
    .eq('stripe_payment_intent_id', paymentIntent.id).maybeSingle();
  if (!booking) return;
  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
  await supabase.from('stripe_payments').insert({
    booking_id: booking.id, hairdresser_id: booking.hairdresser_id,
    stripe_payment_intent_id: paymentIntent.id,
    amount: paymentIntent.amount / 100, currency: paymentIntent.currency,
    status: 'canceled', payment_type: 'booking'
  });
}

async function handleInvoicePaymentSucceeded(invoice, supabase) {
  if (!invoice.subscription) return;
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId);
  const { data: dbSub } = await supabase
    .from('hairdresser_subscriptions').select('hairdresser_id')
    .eq('stripe_subscription_id', subId).maybeSingle();
  if (!dbSub) return;
  const cps = sub.current_period_start || sub.items?.data?.[0]?.current_period_start;
  const cpe = sub.current_period_end || sub.items?.data?.[0]?.current_period_end;
  const updateData: any = { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end || false };
  if (cps != null) updateData.current_period_start = safeTimestampToISO(cps);
  if (cpe != null) updateData.current_period_end = safeTimestampToISO(cpe);
  await supabase.from('hairdresser_subscriptions').update(updateData).eq('stripe_subscription_id', subId);
  await supabase.from('stripe_payments').insert({
    hairdresser_id: dbSub.hairdresser_id,
    stripe_payment_intent_id: invoice.payment_intent,
    amount: invoice.amount_paid / 100, currency: invoice.currency,
    status: 'succeeded', payment_type: 'subscription'
  });
}

async function handleInvoicePaymentFailed(invoice, supabase) {
  if (!invoice.subscription) return;
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
  const { data: dbSub } = await supabase
    .from('hairdresser_subscriptions')
    .select('hairdresser_id, hairdressers!inner(user_id)')
    .eq('stripe_subscription_id', subId).maybeSingle();
  if (!dbSub) return;
  await supabase.from('hairdresser_subscriptions').update({ status: 'past_due' })
    .eq('stripe_subscription_id', subId);
  await sendNotification(supabase, (dbSub as any).hairdressers.user_id,
    'Échec de paiement ❌',
    'Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement.');
}

// ==================== HELPERS ====================
async function sendNotification(supabase, userId, title, body) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification-fady-pro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ userId, title, body })
    });
  } catch (e) { console.error('❌ [Notification]:', e); }
}
