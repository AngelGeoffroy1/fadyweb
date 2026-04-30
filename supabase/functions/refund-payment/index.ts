import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

// V2 — Refund admin avec 3 modes : barber_pays | client_pays | fady_covers
// Ainsi que les anciens modes (keep_platform_commission | refund_all) pour rétro-compat.
// Délai admin : annulation possible jusqu'à 48h APRÈS le RDV.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ADMIN_REFUND_MAX_HOURS_AFTER_BOOKING = 48;

function round2(n: number): number { return Math.round(n * 100) / 100; }

type RefundMode =
  | 'barber_pays' | 'client_pays' | 'fady_covers'
  | 'keep_platform_commission' | 'refund_all';

async function reversePaidV2PayoutIfNeeded(
  supabase: any,
  stripe: Stripe,
  booking: any,
  refundId: string,
  amountEuros: number,
  idempotencyKey: string,
) {
  if (booking.payout_status !== 'paid' || !booking.payout_logs_id || amountEuros <= 0) {
    return null;
  }

  const { data: payoutLog, error } = await supabase
    .from('payout_logs')
    .select('stripe_transfer_id')
    .eq('id', booking.payout_logs_id)
    .maybeSingle();
  if (error) throw new Error(`Failed to retrieve payout log: ${error.message}`);
  if (!payoutLog?.stripe_transfer_id) {
    console.warn(`⚠️ [Admin Refund] Booking ${booking.id} is paid but payout log has no transfer id`);
    return null;
  }

  const transfer = await stripe.transfers.retrieve(payoutLog.stripe_transfer_id);
  const remainingCents = Math.max(0, (transfer.amount ?? 0) - ((transfer as any).amount_reversed ?? 0));
  const reversalCents = Math.min(Math.round(amountEuros * 100), remainingCents);
  if (reversalCents <= 0) {
    console.warn(`⚠️ [Admin Refund] Transfer ${payoutLog.stripe_transfer_id} has no reversible amount`);
    return null;
  }

  const reversal = await stripe.transfers.createReversal(payoutLog.stripe_transfer_id, {
    amount: reversalCents,
    metadata: {
      booking_id: booking.id,
      refund_id: refundId,
      source: 'admin_refund_v2',
    },
  }, { idempotencyKey });

  console.log(`✅ [Admin Refund] V2 transfer reversal créé: ${reversal.id} (${(reversalCents / 100).toFixed(2)}€)`);
  return reversal;
}

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

    const { data: adminData, error: adminError } = await supabase
      .from('admins').select('id').eq('user_id', user.id).single();
    if (adminError || !adminData) throw new Error('User is not an admin');

    const { bookingId, amount, commissionHandling, reason } = await req.json() as {
      bookingId: string;
      amount?: number;
      commissionHandling: RefundMode;
      reason?: string;
    };
    if (!bookingId || !commissionHandling) {
      throw new Error('Missing required fields: bookingId, commissionHandling');
    }

    console.log(`📋 [Admin Refund] Booking: ${bookingId}, mode: ${commissionHandling}`);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        hairdressers:hairdresser_id (
          id, hairdresser_stripe_accounts (stripe_account_id)
        )
      `)
      .eq('id', bookingId).single();
    if (bookingError || !booking) throw new Error('Booking not found');

    if (booking.payment_method !== 'card') throw new Error('Only card payments can be refunded via Stripe');
    if (!booking.stripe_payment_intent_id) throw new Error('No Stripe payment intent found for this booking');
    if (booking.status === 'refund') throw new Error('This booking has already been refunded');

    // Délai admin : 48h après le RDV
    if (booking.booking_date && booking.booking_time) {
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursAfterBooking = (Date.now() - bookingDateTime.getTime()) / (1000 * 60 * 60);
      if (hoursAfterBooking > ADMIN_REFUND_MAX_HOURS_AFTER_BOOKING) {
        throw new Error(`Admin refund window expired (>${ADMIN_REFUND_MAX_HOURS_AFTER_BOOKING}h after booking)`);
      }
    }

    const { data: subscription } = await supabase
      .from('hairdresser_subscriptions')
      .select(`subscription_type, subscription_fees:subscription_type (commission_percentage)`)
      .eq('hairdresser_id', booking.hairdresser_id).single();
    const commissionPercentage = (subscription as any)?.subscription_fees?.commission_percentage || 0;

    const totalPaid = Number(booking.total_price);
    const refundAmount = Number(amount ?? totalPaid);
    const amountInCents = Math.round(refundAmount * 100);
    if (!Number.isFinite(totalPaid) || totalPaid <= 0) {
      throw new Error('Invalid booking total amount');
    }
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }
    if (refundAmount > totalPaid) {
      throw new Error('Refund amount cannot exceed booking total');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' });
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    const isV2 = (pi.metadata?.version === 'v2') || !pi.transfer_data?.destination;
    const userFee = isV2 ? Number(pi.metadata?.user_fee ?? booking.fady_commission_user ?? 0) : 0;
    const barberCommission = isV2 ? Number(pi.metadata?.barber_commission ?? booking.fady_commission_barber ?? 0) : 0;
    const clientPaysPlatformFees = isV2
      ? round2(userFee + barberCommission)
      : round2(totalPaid * commissionPercentage / 100);
    const maxClientPaysRefund = round2(Math.max(0, totalPaid - clientPaysPlatformFees));
    if ((commissionHandling === 'client_pays' || commissionHandling === 'keep_platform_commission')
        && refundAmount > maxClientPaysRefund) {
      throw new Error(`Refund amount exceeds client_pays maximum (${maxClientPaysRefund.toFixed(2)}€)`);
    }

    let platformAmountKept = 0;
    let hairdresserAmountReversed = 0;
    let reverseTransfer = false;
    let refundApplicationFee = false;

    switch (commissionHandling) {
      case 'barber_pays':
        // Le barber absorbe les frais : FADY rembourse aussi sa commission
        platformAmountKept = 0;
        hairdresserAmountReversed = refundAmount;
        reverseTransfer = !isV2; // claw back si transfer déjà fait
        refundApplicationFee = !isV2;
        break;
      case 'fady_covers':
        // FADY absorbe : pas de claw back, refund pris sur le solde plateforme
        platformAmountKept = 0;
        hairdresserAmountReversed = 0;
        reverseTransfer = false;
        refundApplicationFee = false;
        break;
      case 'client_pays':
      case 'keep_platform_commission':
      default: {
        // Le client absorbe les frais : le remboursement est plafonné au net hors frais.
        platformAmountKept = round2(Math.max(0, totalPaid - refundAmount));
        hairdresserAmountReversed = refundAmount;
        if (commissionHandling === 'refund_all') {
          platformAmountKept = 0;
          hairdresserAmountReversed = refundAmount;
          reverseTransfer = !isV2;
          refundApplicationFee = !isV2;
        }
        break;
      }
    }

    console.log(`💰 [Admin Refund] mode=${commissionHandling} isV2=${isV2} kept=${platformAmountKept} reversed=${hairdresserAmountReversed} refund=${refundAmount}`);

    const refundIdempotencyKey = `admin_refund_${bookingId}_${amountInCents}_${commissionHandling}`;
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: amountInCents,
      reverse_transfer: reverseTransfer,
      refund_application_fee: refundApplicationFee,
      metadata: {
        booking_id: bookingId,
        commission_handling: commissionHandling,
        admin_id: adminData.id,
        version: isV2 ? 'v2' : 'v1'
      }
    }, { idempotencyKey: refundIdempotencyKey });

    console.log('✅ [Admin Refund] Stripe refund:', refund.id);

    if (isV2 && hairdresserAmountReversed > 0) {
      const reversal = await reversePaidV2PayoutIfNeeded(
        supabase,
        stripe,
        booking,
        refund.id,
        hairdresserAmountReversed,
        `admin_v2_reversal_${bookingId}_${refund.id}`,
      );
      if (reversal?.amount) hairdresserAmountReversed = round2(reversal.amount / 100);
    }

    // V1 legacy : transfer reversal manuel pour la part barber si applicable
    if (!isV2 && (commissionHandling === 'keep_platform_commission' || commissionHandling === 'client_pays')
        && hairdresserAmountReversed > 0 && reverseTransfer === false) {
      const stripeAccountId = booking.hairdressers?.hairdresser_stripe_accounts?.stripe_account_id;
      if (stripeAccountId) {
        try {
          const transfers = await stripe.transfers.list({ destination: stripeAccountId, limit: 100 });
          const charge = (pi as any).latest_charge as string | null;
          const relatedTransfer = transfers.data.find(
            (t: any) => t.source_transaction === charge || t.metadata?.booking_id === bookingId
          );
          if (relatedTransfer) {
            await stripe.transfers.createReversal(relatedTransfer.id, {
              amount: Math.round(hairdresserAmountReversed * 100),
              metadata: { booking_id: bookingId, refund_id: refund.id }
            }, { idempotencyKey: `admin_reversal_${bookingId}_${refund.id}` });
            console.log('✅ [Admin Refund] V1 transfer reversal créé');
          }
        } catch (e) { console.warn('⚠️ V1 reversal:', (e as Error).message); }
      }
    }

    const { data: existingRefundRecord } = await supabase
      .from('refunds')
      .select()
      .eq('stripe_refund_id', refund.id)
      .maybeSingle();

    let refundRecord = existingRefundRecord;
    if (!refundRecord) {
      const { data: insertedRefundRecord, error: refundInsertError } = await supabase
        .from('refunds')
        .insert({
          booking_id: bookingId,
          stripe_refund_id: refund.id,
          payment_intent_id: booking.stripe_payment_intent_id,
          amount: refundAmount,
          refund_type: amount && amount < totalPaid ? 'partial' : 'full',
          commission_handling: commissionHandling,
          platform_amount_kept: platformAmountKept,
          hairdresser_amount_reversed: hairdresserAmountReversed,
          reason: reason || null,
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          admin_id: adminData.id
        })
        .select().single();
      if (refundInsertError) throw new Error('Failed to create refund record');
      refundRecord = insertedRefundRecord;
    }

    const { error: bookingUpdateError } = await supabase.from('bookings').update({
      status: 'refund', payout_status: 'cancelled'
    }).eq('id', bookingId);
    if (bookingUpdateError) {
      throw new Error(`Failed to update booking after refund ${refund.id}: ${bookingUpdateError.message}`);
    }

    const { error: stripePaymentUpdateError } = await supabase.from('stripe_payments').update({ status: 'refunded' })
      .eq('stripe_payment_intent_id', booking.stripe_payment_intent_id);
    if (stripePaymentUpdateError) {
      throw new Error(`Failed to update stripe payment after refund ${refund.id}: ${stripePaymentUpdateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: refund.id, status: refund.status, amount: refundAmount,
        platform_amount_kept: platformAmountKept,
        hairdresser_amount_reversed: hairdresserAmountReversed,
        version: isV2 ? 'v2' : 'v1'
      },
      refundRecord
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });
  } catch (error) {
    console.error('❌ [Admin Refund] Error:', error);
    return new Response(JSON.stringify({
      success: false, error: (error as Error).message || 'An error occurred while processing the refund'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
});
