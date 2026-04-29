import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

// V2 — Annulation client OU barber, avec délai 2h, idempotency, et logique
// V1 (legacy destination charge) vs V2 (Separate Charges + cron payouts).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CANCEL_MIN_HOURS = 2; // ancien : 24h

function round2(n: number): number { return Math.round(n * 100) / 100; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { bookingId } = await req.json();
    if (!bookingId) throw new Error('Missing required field: bookingId');

    console.log(`📋 [Refund] Booking: ${bookingId}, user: ${user.id}`);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        hairdressers:hairdresser_id (
          id, user_id, statut,
          hairdresser_stripe_accounts (stripe_account_id)
        )
      `)
      .eq('id', bookingId)
      .single();
    if (bookingError || !booking) throw new Error('Booking not found');

    const hairdresserUserId = booking.hairdressers?.user_id;
    const isAmateurHairdresser = booking.hairdressers?.statut !== 'Diplomé';

    const isClient = booking.user_id?.toLowerCase() === user.id.toLowerCase();
    const isHairdresser = hairdresserUserId?.toLowerCase() === user.id.toLowerCase();
    if (!isClient && !isHairdresser) {
      throw new Error('Unauthorized: You can only cancel your own bookings or bookings you are providing');
    }
    const cancelledBy = isHairdresser ? 'hairdresser' : 'client';

    if (booking.payment_method !== 'card') {
      throw new Error('Only card payments can be refunded via Stripe');
    }
    if (!booking.stripe_payment_intent_id) {
      throw new Error('No Stripe payment intent found for this booking');
    }
    if (booking.status === 'refund') {
      throw new Error('This booking has already been refunded');
    }

    // Délai d'annulation : 2h (sauf coiffeurs amateurs)
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
    const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (!isAmateurHairdresser && hoursUntilBooking < CANCEL_MIN_HOURS) {
      throw new Error(`Cannot cancel booking less than ${CANCEL_MIN_HOURS} hours before the appointment.`);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-12-18.acacia',
    });

    // Récupérer le PI pour détecter V1 vs V2
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    const isV2 = (pi.metadata?.version === 'v2') || !pi.transfer_data?.destination;
    const couponPrice = Number(pi.metadata?.coupe_amount ?? booking.total_price);
    const userFee = Number(pi.metadata?.user_fee ?? 0);
    const totalPaid = booking.total_price; // ce qui a été chargé (V2 = coupe+userFee, V1 = coupe)

    // Commission barber pour reporting
    const { data: subscription } = await supabase
      .from('hairdresser_subscriptions')
      .select(`subscription_type, subscription_fees:subscription_type (commission_percentage)`)
      .eq('hairdresser_id', booking.hairdresser_id).single();
    const commissionPct = (subscription as any)?.subscription_fees?.commission_percentage || 0;

    // ====== Calcul du remboursement ======
    // Règle : client annule → frais user gardés par FADY ; barber annule → client remboursé intégralement.
    let refundAmount: number;
    let reverseTransfer = false;
    let refundApplicationFee = false;
    let platformAmountKept = 0;
    let hairdresserAmountReversed = 0;

    if (cancelledBy === 'client') {
      // V2 : on rembourse le coupe, FADY garde le user_fee.
      // V1 : on rembourse le coupe moins la commission barber (logique historique "keep_platform_commission").
      if (isV2) {
        refundAmount = round2(couponPrice);
        platformAmountKept = round2(userFee);
        hairdresserAmountReversed = 0; // pas de transfer fait
      } else {
        // legacy V1 : transfer déjà réalisé vers barber
        const commission = round2(totalPaid * commissionPct / 100);
        refundAmount = round2(totalPaid);
        platformAmountKept = commission;
        hairdresserAmountReversed = round2(totalPaid - commission);
        reverseTransfer = true; // on récupère la part barber
        refundApplicationFee = false; // FADY garde la commission
      }
    } else {
      // Barber annule : client remboursé du prix de la coupe ; FADY garde les frais user (cf. plan §6 Test 4).
      if (isV2) {
        refundAmount = round2(couponPrice);
        platformAmountKept = round2(userFee);
        hairdresserAmountReversed = 0;
      } else {
        refundAmount = round2(totalPaid);
        platformAmountKept = 0;
        hairdresserAmountReversed = round2(totalPaid);
        reverseTransfer = true;
        refundApplicationFee = true;
      }
    }

    console.log(`💰 [Refund] cancelledBy=${cancelledBy} isV2=${isV2} refund=${refundAmount}€ kept=${platformAmountKept}€ reversed=${hairdresserAmountReversed}€`);

    const amountInCents = Math.round(refundAmount * 100);
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: amountInCents,
      reverse_transfer: reverseTransfer,
      refund_application_fee: refundApplicationFee,
      metadata: {
        booking_id: bookingId,
        cancelled_by: cancelledBy,
        user_id: user.id,
        version: isV2 ? 'v2' : 'v1'
      }
    }, { idempotencyKey: `refund_booking_${bookingId}` });

    console.log('✅ [Refund] Stripe refund:', refund.id);

    // V1 partial transfer reversal (logique légacy)
    if (!isV2 && cancelledBy === 'client' && hairdresserAmountReversed > 0 && reverseTransfer === false) {
      const stripeAccountId = booking.hairdressers?.hairdresser_stripe_accounts?.stripe_account_id;
      if (stripeAccountId) {
        try {
          const transfers = await stripe.transfers.list({ destination: stripeAccountId, limit: 100 });
          const charge = (pi as any).latest_charge as string | null;
          const relatedTransfer = transfers.data.find(
            (t: any) => t.source_transaction === charge || t.metadata?.booking_id === bookingId
          );
          if (relatedTransfer) {
            await stripe.transferReversals.create(relatedTransfer.id, {
              amount: Math.round(hairdresserAmountReversed * 100),
              metadata: { booking_id: bookingId, refund_id: refund.id }
            }, { idempotencyKey: `reversal_${bookingId}` });
            console.log('✅ [Refund] V1 transfer reversal créé');
          }
        } catch (e) { console.warn('⚠️ V1 reversal:', (e as Error).message); }
      }
    }

    // Insertion refund record (idempotent via stripe_refund_id unique)
    const { data: existingRefund } = await supabase
      .from('refunds').select('id').eq('stripe_refund_id', refund.id).maybeSingle();
    let refundRecord = existingRefund;
    if (!existingRefund) {
      const { data: inserted, error: insertError } = await supabase
        .from('refunds')
        .insert({
          booking_id: bookingId,
          stripe_refund_id: refund.id,
          payment_intent_id: booking.stripe_payment_intent_id,
          amount: refundAmount,
          refund_type: refundAmount < totalPaid ? 'partial' : 'full',
          commission_handling: cancelledBy === 'client' ? 'client_pays' : 'barber_pays',
          platform_amount_kept: platformAmountKept,
          hairdresser_amount_reversed: hairdresserAmountReversed,
          reason: cancelledBy === 'hairdresser' ? 'Hairdresser cancellation' : 'Client cancellation',
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          admin_id: null
        })
        .select().single();
      if (insertError) throw new Error('Failed to create refund record: ' + insertError.message);
      refundRecord = inserted;
    }

    // Mettre à jour la booking
    await supabase.from('bookings').update({
      status: 'refund',
      payout_status: 'cancelled' // s'assure que le cron ignore cette booking
    }).eq('id', bookingId);

    await supabase.from('stripe_payments').update({ status: 'refunded' })
      .eq('stripe_payment_intent_id', booking.stripe_payment_intent_id);

    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refundAmount,
        platform_amount_kept: platformAmountKept,
        hairdresser_amount_reversed: hairdresserAmountReversed,
        cancelled_by: cancelledBy,
        version: isV2 ? 'v2' : 'v1'
      },
      refundRecord
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ [Refund] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message || 'An error occurred while processing the refund'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
