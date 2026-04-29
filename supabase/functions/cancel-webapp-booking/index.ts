import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

// V2 — webapp cancellation : 2h delay, V1/V2 detection, idempotency

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webapp-secret',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const CANCEL_MIN_HOURS = 2;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_REGEX = /^[0-9a-f]{64}$/i;
const CANCELLABLE_STATUSES = ['pending', 'confirmed'];

function round2(n: number): number { return Math.round(n * 100) / 100; }

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
    console.warn(`⚠️ [cancel-webapp-booking] Booking ${booking.id} is paid but payout log has no transfer id`);
    return null;
  }

  const transfer = await stripe.transfers.retrieve(payoutLog.stripe_transfer_id);
  const remainingCents = Math.max(0, (transfer.amount ?? 0) - ((transfer as any).amount_reversed ?? 0));
  const reversalCents = Math.min(Math.round(amountEuros * 100), remainingCents);
  if (reversalCents <= 0) {
    console.warn(`⚠️ [cancel-webapp-booking] Transfer ${payoutLog.stripe_transfer_id} has no reversible amount`);
    return null;
  }

  const reversal = await stripe.transfers.createReversal(payoutLog.stripe_transfer_id, {
    amount: reversalCents,
    metadata: {
      booking_id: booking.id,
      refund_id: refundId,
      source: 'webapp_cancel_v2',
    },
  }, { idempotencyKey });

  console.log(`✅ [cancel-webapp-booking] V2 transfer reversal créé: ${reversal.id} (${(reversalCents / 100).toFixed(2)}€)`);
  return reversal;
}

async function signBookingId(bookingId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bookingId));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const expectedSecret = Deno.env.get('WEBAPP_SHARED_SECRET');
    const providedSecret = req.headers.get('x-webapp-secret');
    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!providedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { bookingId, token } = await req.json();
    if (!bookingId || !UUID_REGEX.test(bookingId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (typeof token !== 'string' || !HEX64_REGEX.test(token)) {
      return new Response(JSON.stringify({ error: "Lien d'annulation invalide ou expiré" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const expectedToken = await signBookingId(bookingId, expectedSecret);
    if (!timingSafeEqual(token.toLowerCase(), expectedToken)) {
      return new Response(JSON.stringify({ error: "Lien d'annulation invalide ou expiré" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`*,
        users:user_id (id, email, full_name),
        hairdressers:hairdresser_id (id, user_id, name, statut, hairdresser_stripe_accounts (stripe_account_id)),
        hairdresser_services:service_id (service_name, duration_minutes)`)
      .eq('id', bookingId).single();
    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Réservation introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!CANCELLABLE_STATUSES.includes(booking.status ?? '')) {
      return new Response(JSON.stringify({ error: 'Cette réservation ne peut plus être annulée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
    const hoursUntil = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isAmateur = booking.hairdressers?.statut !== 'Diplomé';
    if (bookingDateTime <= new Date()) {
      return new Response(JSON.stringify({ error: "Impossible d'annuler une réservation passée" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!isAmateur && hoursUntil < CANCEL_MIN_HOURS) {
      return new Response(JSON.stringify({ error: `Annulation impossible à moins de ${CANCEL_MIN_HOURS}h du rendez-vous` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isCardPayment = booking.payment_method === 'card'
      && (booking.total_price ?? 0) > 0
      && !!booking.stripe_payment_intent_id;

    let refundResult = null;

    if (isCardPayment) {
      if (booking.status === 'refund') {
        return new Response(JSON.stringify({ error: 'Cette réservation a déjà été remboursée' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ error: 'Configuration Stripe manquante' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
      const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      const isV2 = (pi.metadata?.version === 'v2') || !pi.transfer_data?.destination;
      const couponPrice = Number(pi.metadata?.coupe_amount ?? booking.total_price);
      const userFee = Number(pi.metadata?.user_fee ?? 0);
      const barberCommission = Number(pi.metadata?.barber_commission ?? booking.fady_commission_barber ?? 0);
      const totalPaid = Number(booking.total_price);

      const { data: subscription } = await supabase
        .from('hairdresser_subscriptions')
        .select(`subscription_type, subscription_fees:subscription_type (commission_percentage)`)
        .eq('hairdresser_id', booking.hairdresser_id).single();
      const commissionPct = (subscription as any)?.subscription_fees?.commission_percentage || 0;

      // Annulation client : FADY garde frais (V2: user_fee | V1: commission)
      let refundAmount: number;
      let platformAmountKept = 0;
      let hairdresserAmountReversed = 0;
      let reverseTransfer = false;

      if (isV2) {
        refundAmount = round2(couponPrice);
        platformAmountKept = round2(userFee);
        hairdresserAmountReversed = booking.payout_status === 'paid'
          ? round2(Math.max(0, couponPrice - barberCommission))
          : 0;
      } else {
        const commission = round2(totalPaid * commissionPct / 100);
        refundAmount = round2(totalPaid);
        platformAmountKept = commission;
        hairdresserAmountReversed = round2(totalPaid - commission);
      }

      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
        reverse_transfer: reverseTransfer,
        metadata: {
          booking_id: bookingId,
          commission_handling: 'client_pays',
          cancelled_by: 'webapp_client',
          version: isV2 ? 'v2' : 'v1'
        }
      }, { idempotencyKey: `refund_webapp_${bookingId}` });

      if (isV2 && hairdresserAmountReversed > 0) {
        const reversal = await reversePaidV2PayoutIfNeeded(
          supabase,
          stripe,
          booking,
          refund.id,
          hairdresserAmountReversed,
          `webapp_v2_reversal_${bookingId}_${refund.id}`,
        );
        if (reversal?.amount) hairdresserAmountReversed = round2(reversal.amount / 100);
      }

      // V1 partial transfer reversal
      if (!isV2 && hairdresserAmountReversed > 0) {
        const stripeAccountId = booking.hairdressers?.hairdresser_stripe_accounts?.stripe_account_id;
        if (stripeAccountId) {
          try {
            const transfers = await stripe.transfers.list({ destination: stripeAccountId, limit: 100 });
            const charge = (pi as any).latest_charge as string | null;
            const relatedTransfer = transfers.data.find((t: any) =>
              t.source_transaction === charge || t.metadata?.booking_id === bookingId);
            if (relatedTransfer) {
              await stripe.transfers.createReversal(relatedTransfer.id, {
                amount: Math.round(hairdresserAmountReversed * 100),
                metadata: { booking_id: bookingId, refund_id: refund.id }
              }, { idempotencyKey: `webapp_reversal_${bookingId}` });
            }
          } catch (e) { console.warn('⚠️ V1 reversal:', (e as Error).message); }
        }
      }

      const { data: existingRefund } = await supabase
        .from('refunds').select('id').eq('stripe_refund_id', refund.id).maybeSingle();
      if (!existingRefund) {
        await supabase.from('refunds').insert({
          booking_id: bookingId,
          stripe_refund_id: refund.id,
          payment_intent_id: booking.stripe_payment_intent_id,
          amount: refundAmount,
          refund_type: refundAmount < totalPaid ? 'partial' : 'full',
          commission_handling: 'client_pays',
          platform_amount_kept: platformAmountKept,
          hairdresser_amount_reversed: hairdresserAmountReversed,
          reason: 'Webapp client cancellation',
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          admin_id: null
        });
      }

      await supabase.from('bookings').update({
        status: 'refund', payout_status: 'cancelled'
      }).eq('id', bookingId);

      await supabase.from('stripe_payments').update({ status: 'refunded' })
        .eq('stripe_payment_intent_id', booking.stripe_payment_intent_id);

      refundResult = {
        refundId: refund.id, refundStatus: refund.status,
        amount: refundAmount, platformAmountKept, hairdresserAmountReversed,
        version: isV2 ? 'v2' : 'v1'
      };
    } else {
      const { error: updateError } = await supabase
        .from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      if (updateError) {
        return new Response(JSON.stringify({ error: "Erreur lors de l'annulation" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // === Notifications (push + emails) — logique conservée ===
    const hairdresserData = booking.hairdressers;
    const serviceData = booking.hairdresser_services;
    const userData = booking.users;

    let hairdresserEmail: string | null = null;
    if (hairdresserData?.user_id) {
      const { data: hdUser } = await supabase
        .from('users').select('email').eq('id', hairdresserData.user_id).single();
      hairdresserEmail = hdUser?.email ?? null;
    }

    const notificationPromises: Promise<void>[] = [];
    if (hairdresserData?.user_id) {
      notificationPromises.push(
        fetch(`${supabaseUrl}/functions/v1/send-push-notification-fady-pro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: hairdresserData.user_id,
            title: '❌ Réservation annulée',
            body: `${userData?.full_name ?? 'Un client'} a annulé sa réservation${serviceData?.service_name ? ` pour ${serviceData.service_name}` : ''} du ${formatDateFr(booking.booking_date)} à ${booking.booking_time.slice(0, 5)}`,
            data: { type: 'booking_cancelled', bookingId: booking.id, hairdresserId: booking.hairdresser_id }
          })
        }).then(() => {}).catch((e) => { console.error('⚠️ push:', e); })
      );
    }

    if (RESEND_API_KEY && userData?.email) {
      const refundMsg = isCardPayment
        ? `<div style="background:#f3e8ff;border-left:3px solid #be3afd;padding:16px;border-radius:4px;margin:24px 0;font-size:14px;color:#7c3aed;"><strong>💳 Remboursement en cours</strong><br>Le montant remboursé sera de <strong>${(refundResult?.amount ?? Number(booking.total_price)).toFixed(2)} €</strong>.</div>`
        : '';
      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1>Réservation annulée</h1><p>Bonjour ${userData.full_name ?? ''},</p><p>Votre réservation auprès de <strong>${hairdresserData?.name ?? ''}</strong> du ${formatDateFr(booking.booking_date)} à ${booking.booking_time.slice(0,5)} a été annulée.</p>${refundMsg}<p>L'équipe Fady</p></body></html>`;
      notificationPromises.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Fady <reservations@fady-app.fr>',
            to: [userData.email],
            subject: `Réservation annulée - ${hairdresserData?.name ?? 'Fady'}`,
            html
          })
        }).then(() => {}).catch((e) => { console.error('⚠️ email:', e); })
      );
    }

    if (RESEND_API_KEY && hairdresserEmail) {
      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1>Réservation annulée</h1><p>Bonjour ${hairdresserData?.name ?? ''},</p><p>Le client <strong>${userData?.full_name ?? 'Un client'}</strong> a annulé sa réservation du ${formatDateFr(booking.booking_date)} à ${booking.booking_time.slice(0,5)}.</p>${isCardPayment ? `<p>Remboursement client : ${(refundResult?.amount ?? 0).toFixed(2)} €.</p>` : ''}<p>L'équipe Fady</p></body></html>`;
      notificationPromises.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Fady <reservations@fady-app.fr>',
            to: [hairdresserEmail],
            subject: `Réservation annulée - ${userData?.full_name ?? 'Client'}`,
            html
          })
        }).then(() => {}).catch((e) => { console.error('⚠️ email:', e); })
      );
    }

    await Promise.race([
      Promise.allSettled(notificationPromises),
      new Promise((resolve) => setTimeout(resolve, 10000))
    ]);

    return new Response(JSON.stringify({
      success: true,
      message: 'Réservation annulée avec succès',
      isCardPayment,
      refundPending: isCardPayment,
      refund: refundResult
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ [Cancel webapp]:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
