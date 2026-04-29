import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function readPaymentFinancials(paymentIntent: Stripe.PaymentIntent): Promise<{
  stripeFee: number;
  stripeNet: number;
  fundsAvailableOn: string | null;
}> {
  let stripeFee = 0;
  let stripeNet = 0;
  let fundsAvailableOn: string | null = null;

  try {
    const chargeId = (paymentIntent as any).latest_charge as string | null;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
      const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (bt && typeof bt === 'object') {
        stripeFee = round2((bt.fee ?? 0) / 100);
        stripeNet = round2((bt.net ?? 0) / 100);
        if (bt.available_on) {
          fundsAvailableOn = new Date(bt.available_on * 1000).toISOString().slice(0, 10);
        }
      }
    }
  } catch (err) {
    console.warn('[sync-booking-payment-financials] balance_transaction unavailable:', (err as Error).message);
  }

  return { stripeFee, stripeNet, fundsAvailableOn };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorise' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non trouve' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { booking_id } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, user_id, hairdresser_id, location_type, status, payout_status,
        stripe_payment_intent_id, payment_method,
        hairdressers!inner(user_id)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Reservation non trouvee' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hairdresserUserId = (booking as any).hairdressers?.user_id;
    if (booking.user_id !== user.id && hairdresserUserId !== user.id) {
      return new Response(JSON.stringify({ error: 'Non autorise' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!booking.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'Aucun paiement associe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    const meta = (paymentIntent.metadata ?? {}) as Record<string, string>;

    const metadataHairdresserId = meta.hairdresser_id?.toLowerCase();
    const bookingHairdresserId = String(booking.hairdresser_id).toLowerCase();
    if (metadataHairdresserId && metadataHairdresserId !== bookingHairdresserId) {
      console.warn('[sync-booking-payment-financials] hairdresser mismatch:', {
        metadata_hairdresser_id: meta.hairdresser_id,
        booking_hairdresser_id: booking.hairdresser_id,
        booking_id: booking.id,
        payment_intent_id: paymentIntent.id,
      });
      return new Response(JSON.stringify({
        error: 'Coiffeur du paiement invalide',
        metadata_hairdresser_id: meta.hairdresser_id,
        booking_hairdresser_id: booking.hairdresser_id,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isV2 = meta.version === 'v2';
    const { stripeFee, stripeNet, fundsAvailableOn } = await readPaymentFinancials(paymentIntent);

    const updatePayload: Record<string, unknown> = {};
    if (paymentIntent.status === 'succeeded' && (booking.location_type === 'salon' || paymentIntent.capture_method === 'automatic')) {
      if (booking.status === 'pending') updatePayload.status = 'confirmed';
    }

    if (isV2) {
      updatePayload.fady_commission_user = Number(meta.user_fee ?? '0');
      updatePayload.fady_commission_barber = Number(meta.barber_commission ?? '0');
      updatePayload.commission_percentage = Number(meta.commission_rate ?? '0');
      updatePayload.payout_status = booking.payout_status ?? 'pending';
      if (meta.channel) updatePayload.channel = meta.channel;
    }
    if (stripeFee > 0) updatePayload.stripe_fee = stripeFee;
    if (stripeNet > 0) updatePayload.stripe_net = stripeNet;
    if (fundsAvailableOn) updatePayload.funds_available_on = fundsAvailableOn;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update(updatePayload)
        .eq('id', booking.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Erreur mise a jour booking', details: updateError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const paymentStatus = paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending';
    const { data: existingPayment } = await supabaseAdmin
      .from('stripe_payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (existingPayment) {
      await supabaseAdmin
        .from('stripe_payments')
        .update({
          booking_id: booking.id,
          hairdresser_id: booking.hairdresser_id,
          amount: round2(paymentIntent.amount / 100),
          currency: paymentIntent.currency,
          status: paymentStatus,
          payment_type: 'booking',
        })
        .eq('id', existingPayment.id);
    } else {
      await supabaseAdmin.from('stripe_payments').insert({
        booking_id: booking.id,
        hairdresser_id: booking.hairdresser_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: round2(paymentIntent.amount / 100),
        currency: paymentIntent.currency,
        status: paymentStatus,
        payment_type: 'booking',
      });
    }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
      stripe_fee: stripeFee,
      stripe_net: stripeNet,
      funds_available_on: fundsAvailableOn,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync-booking-payment-financials] error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
