import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

// V2 — Capture + remplissage des colonnes financières sur la booking
// (pas de transfer Stripe ici : effectué par run-weekly-payouts)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non trouvé' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`💳 [Capture] Tentative pour booking: ${booking_id}`);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, status, stripe_payment_intent_id, hairdresser_id,
        hairdressers!inner(user_id)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Réservation non trouvée' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (booking.hairdressers.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Non autorisé à capturer ce paiement' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!booking.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'Aucun paiement associé à cette réservation' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (booking.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Impossible de capturer: réservation en statut ${booking.status}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    if (paymentIntent.status !== 'requires_capture') {
      return new Response(JSON.stringify({ error: `Le paiement ne peut pas être capturé (statut: ${paymentIntent.status})` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const captured = await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, undefined, {
      idempotencyKey: `capture_${booking_id}`
    });
    console.log(`✅ [Capture] Paiement capturé: ${captured.id}`);

    // Récupérer le balance_transaction pour stripe_fee + funds_available_on
    let stripeFee = 0;
    let stripeNet = 0;
    let fundsAvailableOn: string | null = null;
    try {
      const chargeId = (captured as any).latest_charge as string | null;
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
      console.warn('⚠️ [Capture] Impossible de lire balance_transaction:', (e as Error).message);
    }

    // Métadonnées PI pour reconstruire les commissions (PI v2 only)
    const meta = (captured.metadata ?? {}) as Record<string, string>;
    const isV2 = meta.version === 'v2';
    const couponAmount = Number(meta.coupe_amount ?? '0');
    const userFeeAmt = Number(meta.user_fee ?? '0');
    const barberCommissionAmt = Number(meta.barber_commission ?? '0');
    const commissionPct = Number(meta.commission_rate ?? '0');
    const channel = meta.channel ?? null;

    const updatePayload: Record<string, any> = { status: 'confirmed' };
    if (isV2) {
      updatePayload.fady_commission_user = userFeeAmt;
      updatePayload.fady_commission_barber = barberCommissionAmt;
      updatePayload.commission_percentage = commissionPct;
      updatePayload.payout_status = 'pending';
      if (channel) updatePayload.channel = channel;
    }
    if (stripeFee > 0) updatePayload.stripe_fee = stripeFee;
    if (stripeNet > 0) updatePayload.stripe_net = stripeNet;
    if (fundsAvailableOn) updatePayload.funds_available_on = fundsAvailableOn;

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', booking_id);
    if (updateError) {
      console.error('❌ [Capture] Erreur mise à jour booking:', updateError);
    }

    // Enregistrer dans stripe_payments
    await supabase.from('stripe_payments').insert({
      booking_id,
      hairdresser_id: booking.hairdresser_id,
      stripe_payment_intent_id: captured.id,
      amount: captured.amount / 100,
      currency: captured.currency,
      status: 'succeeded',
      payment_type: 'booking'
    });

    // Notification client
    try {
      const { data: bookingDetails } = await supabase
        .from('bookings')
        .select('user_id, hairdressers!inner(name)')
        .eq('id', booking_id)
        .single();
      if (bookingDetails) {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({
            userId: bookingDetails.user_id,
            title: 'Réservation confirmée ✅',
            body: `Votre réservation avec ${bookingDetails.hairdressers.name} est confirmée et le paiement a été effectué.`
          })
        });
      }
    } catch (e) { console.error('⚠️ [Capture] Notif:', e); }

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: captured.id,
      amount: captured.amount / 100,
      status: captured.status,
      stripe_fee: stripeFee,
      stripe_net: stripeNet,
      funds_available_on: fundsAvailableOn
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ [Capture] Erreur:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
