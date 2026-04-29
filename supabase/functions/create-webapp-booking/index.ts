import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webapp-secret',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});

interface WebappBookingRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hairdresserId: string;
  serviceId: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  locationType: 'salon' | 'home' | 'domicile';
  address?: string;
  hairdresserName: string;
  hairdresserUserId: string;
  stripePaymentIntentId?: string;
  totalPrice?: number;
  paymentMethod?: 'card' | 'cash' | null;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function endTimeToMin(t: string): number {
  const v = timeToMin(t);
  return v === 0 ? 1440 : v;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function validateSlotAvailability(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  hairdresserId: string,
  serviceId: string,
  bookingDate: string,
  bookingTime: string,
): Promise<{ valid: boolean; error?: string }> {
  const { data: service } = await supabase
    .from('hairdresser_services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .eq('hairdresser_id', hairdresserId)
    .maybeSingle();

  if (!service) {
    return { valid: false, error: 'Service introuvable' };
  }

  const durationMinutes: number = service.duration_minutes || 30;
  const slotStart = timeToMin(bookingTime);
  const slotEnd = slotStart + durationMinutes;

  const parisNowStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' });
  const parisNow = new Date(parisNowStr);
  const [y, mo, d] = bookingDate.split('-').map(Number);
  const [hh, mm] = bookingTime.split(':').map(Number);
  const slotDateTime = new Date(y, mo - 1, d, hh, mm);
  if (slotDateTime.getTime() < parisNow.getTime() + 15 * 60 * 1000) {
    return { valid: false, error: 'Ce créneau est dans le passé ou trop proche' };
  }

  const dayOfWeek = slotDateTime.getDay();

  const { data: exceptions } = await supabase
    .from('hairdresser_schedule_exceptions')
    .select('exception_type, start_time, end_time')
    .eq('hairdresser_id', hairdresserId)
    .eq('exception_date', bookingDate);

  // deno-lint-ignore no-explicit-any
  const exceptionsList: any[] = exceptions || [];

  if (exceptionsList.some((e) => e.exception_type === 'closed')) {
    return { valid: false, error: 'Le coiffeur est fermé ce jour-là' };
  }

  const modified = exceptionsList.filter(
    (e) => e.exception_type === 'modified_hours' && e.start_time && e.end_time,
  );

  let periods: { start: number; end: number }[];
  if (modified.length > 0) {
    periods = modified.map((e) => ({
      start: timeToMin(e.start_time),
      end: endTimeToMin(e.end_time),
    }));
  } else {
    const { data: availability } = await supabase
      .from('hairdresser_availability')
      .select('start_time, end_time')
      .eq('hairdresser_id', hairdresserId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);

    if (!availability || availability.length === 0) {
      return { valid: false, error: 'Le coiffeur ne travaille pas ce jour-là' };
    }
    // deno-lint-ignore no-explicit-any
    periods = availability.map((a: any) => ({
      start: timeToMin(a.start_time),
      end: endTimeToMin(a.end_time),
    }));
  }

  const fitsInPeriod = periods.some((p) => {
    let pe = p.end;
    if (pe <= p.start) pe += 1440;
    return slotStart >= p.start && slotEnd <= pe;
  });
  if (!fitsInPeriod) {
    return { valid: false, error: "Créneau en dehors des horaires de travail" };
  }

  const blockedRanges = exceptionsList
    .filter((e) => e.exception_type === 'blocked_slot' && e.start_time && e.end_time)
    .map((e) => ({ start: timeToMin(e.start_time), end: endTimeToMin(e.end_time) }));

  if (blockedRanges.some((b) => slotStart < b.end && slotEnd > b.start)) {
    return { valid: false, error: 'Ce créneau a été bloqué par le coiffeur' };
  }

  const { data: busy } = await supabase.rpc('get_hairdresser_busy_slots', {
    p_hairdresser_id: hairdresserId,
    p_date: bookingDate,
  });

  // deno-lint-ignore no-explicit-any
  const bookedRanges = ((busy as any[]) || []).map((b) => {
    const bs = timeToMin(b.booking_time);
    return { start: bs, end: bs + (b.duration_minutes || 30) };
  });

  if (bookedRanges.some((r) => slotStart < r.end && slotEnd > r.start)) {
    return { valid: false, error: 'Ce créneau est déjà réservé' };
  }

  return { valid: true };
}

async function refundOrCancelPaymentIntent(paymentIntentId: string): Promise<void> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (
      pi.status === 'requires_capture' ||
      pi.status === 'requires_payment_method' ||
      pi.status === 'requires_confirmation' ||
      pi.status === 'requires_action'
    ) {
      await stripe.paymentIntents.cancel(pi.id);
      console.log(`💰 [create-webapp-booking] Cancelled PI ${pi.id} (status was ${pi.status})`);
    } else if (pi.status === 'succeeded') {
      await stripe.refunds.create({ payment_intent: pi.id });
      console.log(`💰 [create-webapp-booking] Refunded PI ${pi.id}`);
    }
  } catch (err) {
    console.error('⚠️ [create-webapp-booking] Failed to cancel/refund PI:', (err as Error).message);
  }
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
    console.warn('⚠️ [create-webapp-booking] balance_transaction unavailable:', (err as Error).message);
  }

  return { stripeFee, stripeNet, fundsAvailableOn };
}

async function syncBookingPaymentFinancials(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  booking: { id: string; hairdresser_id: string; location_type: string; status: string; payout_status?: string | null },
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const meta = (paymentIntent.metadata ?? {}) as Record<string, string>;
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
    const { error } = await supabase.from('bookings').update(updatePayload).eq('id', booking.id);
    if (error) {
      console.error('❌ [create-webapp-booking] Financial sync update failed:', error);
    }
  }

  const { data: existingPayment } = await supabase
    .from('stripe_payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();

  if (existingPayment) {
    await supabase
      .from('stripe_payments')
      .update({
        booking_id: booking.id,
        hairdresser_id: booking.hairdresser_id,
        amount: round2(paymentIntent.amount / 100),
        currency: paymentIntent.currency,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        payment_type: 'booking',
      })
      .eq('id', existingPayment.id);
  } else {
    await supabase.from('stripe_payments').insert({
      booking_id: booking.id,
      hairdresser_id: booking.hairdresser_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount: round2(paymentIntent.amount / 100),
      currency: paymentIntent.currency,
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
      payment_type: 'booking',
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedSecret = Deno.env.get('WEBAPP_SHARED_SECRET');
    const providedSecret = req.headers.get('x-webapp-secret');

    if (!expectedSecret) {
      console.error('\u{1F6A8} [SECURITY][create-webapp-booking] WEBAPP_SHARED_SECRET env var NOT SET on Supabase — function is UNPROTECTED');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!providedSecret || providedSecret !== expectedSecret) {
      console.warn('\u{1F6A8} [SECURITY][create-webapp-booking] ❌ Unauthorized request (missing or invalid x-webapp-secret). Origin: ' + (req.headers.get('origin') ?? 'unknown') + ', User-Agent: ' + (req.headers.get('user-agent') ?? 'unknown'));
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('\u{1F512} [SECURITY][create-webapp-booking] ✅ Request authenticated via x-webapp-secret');

    const data: WebappBookingRequest = await req.json();
    console.log('\u{1F4CB} Webapp booking request:', data);

    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
      return new Response(
        JSON.stringify({ error: 'Informations personnelles manquantes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.hairdresserId || !data.serviceId || !data.bookingDate || !data.bookingTime) {
      return new Response(
        JSON.stringify({ error: 'Informations de réservation manquantes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    data.hairdresserId = data.hairdresserId.trim().toLowerCase();
    data.serviceId = data.serviceId.trim().toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const slotCheck = await validateSlotAvailability(
      supabase,
      data.hairdresserId,
      data.serviceId,
      data.bookingDate,
      data.bookingTime,
    );
    if (!slotCheck.valid) {
      console.warn(`\u{1F6A8} [create-webapp-booking] ❌ Slot validation failed: ${slotCheck.error} (${data.bookingDate} ${data.bookingTime}, hairdresser ${data.hairdresserId})`);
      if (data.stripePaymentIntentId && Deno.env.get('STRIPE_SECRET_KEY')) {
        await refundOrCancelPaymentIntent(data.stripePaymentIntentId);
      }
      return new Response(
        JSON.stringify({ error: slotCheck.error }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isPaidBooking = !!data.stripePaymentIntentId;
    const isCashBooking = data.paymentMethod === 'cash';
    let verifiedPaymentIntent: Stripe.PaymentIntent | null = null;
    let bookingTotalPrice = Number(data.totalPrice ?? 0);

    if (isPaidBooking) {
      if (!Deno.env.get('STRIPE_SECRET_KEY')) {
        console.error('\u{1F6A8} [SECURITY][create-webapp-booking] STRIPE_SECRET_KEY not set — cannot verify payment');
        return new Response(
          JSON.stringify({ error: 'Server misconfiguration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        verifiedPaymentIntent = await stripe.paymentIntents.retrieve(data.stripePaymentIntentId!);
      } catch (err) {
        console.warn('\u{1F6A8} [SECURITY][create-webapp-booking] ❌ Invalid PaymentIntent id:', data.stripePaymentIntentId, (err as Error).message);
        return new Response(
          JSON.stringify({ error: 'Paiement introuvable ou invalide' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validStatuses = new Set(['succeeded', 'requires_capture']);
      if (!validStatuses.has(verifiedPaymentIntent.status)) {
        console.warn(`\u{1F6A8} [SECURITY][create-webapp-booking] ❌ PaymentIntent ${verifiedPaymentIntent.id} has non-final status: ${verifiedPaymentIntent.status}`);
        return new Response(
          JSON.stringify({ error: `Paiement non finalisé (status: ${verifiedPaymentIntent.status})` }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const providedAmountInCents = Math.round((data.totalPrice ?? 0) * 100);
      const coupeAmountFromMetadata = Number(verifiedPaymentIntent.metadata?.coupe_amount ?? NaN);
      const legacyFeeExcludedAmountInCents = Number.isFinite(coupeAmountFromMetadata)
        ? Math.round(coupeAmountFromMetadata * 100)
        : null;
      const isExactAmount = verifiedPaymentIntent.amount === providedAmountInCents;
      const isV2FeeExcludedLegacyClient =
        verifiedPaymentIntent.metadata?.version === 'v2' &&
        legacyFeeExcludedAmountInCents !== null &&
        providedAmountInCents === legacyFeeExcludedAmountInCents;

      if (!isExactAmount && !isV2FeeExcludedLegacyClient) {
        console.warn(`\u{1F6A8} [SECURITY][create-webapp-booking] ❌ Amount mismatch — PI: ${verifiedPaymentIntent.amount} cents, provided: ${providedAmountInCents} cents`);
        await refundOrCancelPaymentIntent(verifiedPaymentIntent.id);
        return new Response(
          JSON.stringify({ error: 'Montant du paiement invalide' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      bookingTotalPrice = round2(verifiedPaymentIntent.amount / 100);

      const metadataHairdresserId = verifiedPaymentIntent.metadata?.hairdresser_id?.toLowerCase();
      if (metadataHairdresserId !== data.hairdresserId) {
        console.warn(`\u{1F6A8} [SECURITY][create-webapp-booking] ❌ Hairdresser mismatch — PI: ${verifiedPaymentIntent.metadata?.hairdresser_id}, booking: ${data.hairdresserId}`);
        await refundOrCancelPaymentIntent(verifiedPaymentIntent.id);
        return new Response(
          JSON.stringify({ error: 'Coiffeur du paiement invalide' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (verifiedPaymentIntent.metadata?.source !== 'webapp') {
        console.warn(`\u{1F6A8} [SECURITY][create-webapp-booking] ❌ PaymentIntent source is not webapp: ${verifiedPaymentIntent.metadata?.source}`);
        await refundOrCancelPaymentIntent(verifiedPaymentIntent.id);
        return new Response(
          JSON.stringify({ error: 'Source du paiement invalide' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('stripe_payment_intent_id', verifiedPaymentIntent.id)
        .maybeSingle();

      if (existingBooking) {
        console.warn(`\u{1F6A8} [SECURITY][create-webapp-booking] ❌ PaymentIntent ${verifiedPaymentIntent.id} already used for booking ${existingBooking.id}`);
        return new Response(
          JSON.stringify({ error: 'Ce paiement a déjà été utilisé pour une réservation' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`\u{1F512} [SECURITY][create-webapp-booking] ✅ PaymentIntent ${verifiedPaymentIntent.id} verified (${verifiedPaymentIntent.status}, ${verifiedPaymentIntent.amount} cents)`);
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = data.phone.trim();
    let userId: string;

    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUserByEmail) {
      userId = existingUserByEmail.id;
      console.log('\u{1F464} Found existing user by email:', userId);
    } else {
      let existingUserByPhone = null;
      if (normalizedPhone) {
        const { data: phoneMatch } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (phoneMatch) {
          existingUserByPhone = phoneMatch;
        }
      }

      if (existingUserByPhone) {
        userId = existingUserByPhone.id;
        console.log(`\u{1F4F1} Found existing user by phone (email: ${existingUserByPhone.email}):`, userId);
      } else {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            full_name: `${data.firstName} ${data.lastName}`,
            phone: normalizedPhone,
          },
        });

        if (authError) {
          console.error('❌ Error creating auth user:', authError);

          if (authError.message?.includes('already been registered') || (authError as any).code === 'email_exists') {
            console.log('\u{1F50D} Auth user exists but not in public.users, looking up...');

            const { data: authUserId, error: rpcError } = await supabase
              .rpc('get_auth_user_id_by_email', { lookup_email: normalizedEmail });

            if (rpcError || !authUserId) {
              console.error('❌ Error looking up auth user:', rpcError);
              return new Response(
                JSON.stringify({ error: 'Erreur lors de la recherche du compte', details: rpcError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const { data: newPublicUser, error: createPublicError } = await supabase
              .from('users')
              .insert({
                id: authUserId,
                email: normalizedEmail,
                full_name: `${data.firstName} ${data.lastName}`,
                phone: normalizedPhone,
                email_confirmed: true,
              })
              .select()
              .single();

            if (createPublicError) {
              if (createPublicError.code === '23505') {
                const { data: existingPublic } = await supabase
                  .from('users')
                  .select('id')
                  .eq('id', authUserId)
                  .single();
                if (existingPublic) {
                  userId = existingPublic.id;
                  console.log('\u{1F464} Found public user after race condition:', userId);
                } else {
                  return new Response(
                    JSON.stringify({ error: 'Erreur lors de la création du profil' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                }
              } else {
                console.error('❌ Error creating public user:', createPublicError);
                return new Response(
                  JSON.stringify({ error: 'Erreur lors de la création du profil', details: createPublicError.message }),
                  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else {
              userId = newPublicUser.id;
              console.log('\u{1F464} Created public user from existing auth user:', userId);
            }
          } else {
            return new Response(
              JSON.stringify({ error: 'Erreur lors de la création du compte', details: authError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Le trigger `on_auth_user_created` sur auth.users a déjà inséré
          // la ligne public.users (id, email, full_name, phone, email_confirmed)
          // à partir du user_metadata passé ci-dessus. Pas de re-insert ici,
          // sinon conflit 23505 sur users_pkey.
          userId = authUser.user.id;
          console.log('\u{1F464} Created new auth user (public row via trigger):', userId);
        }
      }
    }

    let paymentMethod: string | null = null;
    if (isCashBooking) {
      paymentMethod = 'cash';
    } else if (isPaidBooking) {
      paymentMethod = 'card';
    }

    const bookingData = {
      user_id: userId,
      hairdresser_id: data.hairdresserId,
      service_id: data.serviceId,
      booking_date: data.bookingDate,
      booking_time: data.bookingTime,
      location_type: data.locationType === 'home' ? 'domicile' : 'salon',
      address: data.address || null,
      status: 'confirmed',
      total_price: bookingTotalPrice,
      stripe_payment_intent_id: data.stripePaymentIntentId || null,
      payment_method: paymentMethod,
      channel: 'webapp',
      payout_status: isPaidBooking ? 'pending' : null,
    };

    console.log('\u{1F4DD} Creating booking with data:', bookingData);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('❌ Error creating booking:', bookingError);
      if (verifiedPaymentIntent) {
        await refundOrCancelPaymentIntent(verifiedPaymentIntent.id);
      }
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de la réservation', details: bookingError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Booking created successfully:', booking.id);

    if (verifiedPaymentIntent) {
      await syncBookingPaymentFinancials(supabase, booking, verifiedPaymentIntent);
    }

    const { data: hairdresserData } = await supabase
      .from('users')
      .select('email')
      .eq('id', data.hairdresserUserId)
      .single();

    const paymentTypeLabel = isCashBooking ? ' (Paiement en espèces)' : (isPaidBooking ? ' (Payé)' : '');

    const notificationPromises: Promise<void>[] = [
      fetch(
        `${supabaseUrl}/functions/v1/send-push-notification-fady-pro`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.hairdresserUserId,
            title: '\u{1F4C5} Nouvelle réservation !',
            body: `${data.firstName} ${data.lastName} a réservé ${data.serviceName} le ${formatDateFr(data.bookingDate)} à ${data.bookingTime}${paymentTypeLabel}`,
            data: {
              type: 'new_booking',
              bookingId: booking.id,
              hairdresserId: data.hairdresserId,
            }
          })
        }
      ).then(async (res) => {
        const result = await res.json();
        console.log('\u{1F4F2} Push notification result:', result);
      }).catch((err) => {
        console.error('⚠️ Error sending push notification:', err);
      }),

      fetch(
        `${supabaseUrl}/functions/v1/send-booking-confirmation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: data.email,
            userName: `${data.firstName} ${data.lastName}`,
            hairdresserName: data.hairdresserName,
            serviceName: data.serviceName,
            bookingDate: data.bookingDate,
            bookingTime: data.bookingTime,
            locationType: data.locationType,
            address: data.address,
            totalPrice: (isPaidBooking || isCashBooking) ? bookingTotalPrice : 0,
            numberOfCuts: 1,
            bookingId: booking.id,
          })
        }
      ).then(async (res) => {
        const result = await res.json();
        console.log('\u{1F4E7} Email notification result:', result);
      }).catch((err) => {
        console.error('⚠️ Error sending confirmation email:', err);
      }),
    ];

    if (hairdresserData?.email) {
      notificationPromises.push(
        fetch(
          `${supabaseUrl}/functions/v1/send-hairdresser-booking-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hairdresserEmail: hairdresserData.email,
              hairdresserName: data.hairdresserName,
              clientName: `${data.firstName} ${data.lastName}`,
              clientEmail: data.email,
              clientPhone: data.phone,
              serviceName: data.serviceName,
              bookingDate: data.bookingDate,
              bookingTime: data.bookingTime,
              locationType: data.locationType,
              address: data.address,
              totalPrice: (isPaidBooking || isCashBooking) ? bookingTotalPrice : 0,
              bookingId: booking.id,
              isCashPayment: isCashBooking
            })
          }
        ).then(async (res) => {
          const result = await res.json();
          console.log('\u{1F4E7} Email notification to hairdresser result:', result);
        }).catch((err) => {
          console.error('⚠️ Error sending notification email to hairdresser:', err);
        })
      );
    } else {
      console.warn('⚠️ Could not find hairdresser email');
    }

    await Promise.race([
      Promise.allSettled(notificationPromises),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Réservation créée avec succès',
        bookingId: booking.id,
        booking: booking,
        isPaid: isPaidBooking,
        isCash: isCashBooking
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in create-webapp-booking:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date);
}
