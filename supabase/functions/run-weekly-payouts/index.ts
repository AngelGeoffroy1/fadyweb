import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

// V2 — Cron weekly payouts (pg_cron → lundi 8h UTC)
// Boost / Ambassador : toutes les semaines
// Standard : toutes les 2 semaines (parité ISO-week alignée sur la date d'inscription)
//
// Mode dry_run pour tester sans créer de transfer Stripe.
// Auth : header Authorization: Bearer <CRON_SECRET> ou x-cron-secret.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-12-18.acacia'
});
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cronSecret = Deno.env.get('CRON_SECRET') ?? '';

function round2(n: number): number { return Math.round(n * 100) / 100; }

// ISO week number (1–53)
function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function weekIndexSinceEpoch(d: Date): number {
  // Nombre de semaines depuis 1970-01-05 (lundi) — stable sans souci d'année bissextile.
  const monday = new Date(Date.UTC(1970, 0, 5));
  return Math.floor((d.getTime() - monday.getTime()) / (7 * 24 * 3600 * 1000));
}

Deno.serve(async (req) => {
  try {
    // Auth
    const auth = req.headers.get('Authorization') ?? req.headers.get('x-cron-secret') ?? '';
    const provided = auth.replace(/^Bearer\s+/i, '');
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    let body: any = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch { /* no body */ }
    }
    const dry = dryRun || body?.dry_run === true;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const currentWeekIdx = weekIndexSinceEpoch(now);
    const isoNow = getISOWeek(now);

    console.log(`🔄 [Payouts] Début — ${now.toISOString()} (ISO ${isoNow.year}-W${isoNow.week}, idx=${currentWeekIdx}, dryRun=${dry})`);

    // Récupérer tous les barbers avec abonnement actif + Stripe Connect activé
    const { data: subscriptions, error: subError } = await supabase
      .from('hairdresser_subscriptions')
      .select(`
        hairdresser_id,
        subscription_type,
        hairdressers!inner (
          id, name, created_at, statut,
          hairdresser_stripe_accounts!inner (
            stripe_account_id, payouts_enabled, onboarding_status
          )
        )
      `)
      .eq('status', 'active');

    if (subError) throw subError;

    const summary = {
      total_barbers: subscriptions?.length ?? 0,
      eligible_this_week: 0,
      processed: 0,
      skipped_no_bookings: 0,
      skipped_off_week: 0,
      skipped_no_account: 0,
      total_amount_eur: 0,
      errors: [] as string[],
      payouts: [] as any[]
    };

    for (const sub of subscriptions ?? []) {
      const hairdresser = (sub as any).hairdressers;
      const stripeAccount = hairdresser?.hairdresser_stripe_accounts;
      const subType = String(sub.subscription_type ?? '').toLowerCase();

      if (!stripeAccount?.stripe_account_id
          || stripeAccount.onboarding_status !== 'completed'
          || !stripeAccount.payouts_enabled) {
        summary.skipped_no_account++;
        continue;
      }

      // Parité ISO-week pour Standard (bi-hebdo)
      let isThisWeek: boolean;
      if (subType === 'boost' || subType === 'ambassador') {
        isThisWeek = true;
      } else if (subType === 'standard') {
        const createdAt = new Date(hairdresser.created_at);
        const regWeekIdx = weekIndexSinceEpoch(createdAt);
        isThisWeek = ((currentWeekIdx - regWeekIdx) % 2 === 0);
      } else {
        // Type inconnu → traiter comme standard (bi-hebdo)
        const createdAt = new Date(hairdresser.created_at);
        const regWeekIdx = weekIndexSinceEpoch(createdAt);
        isThisWeek = ((currentWeekIdx - regWeekIdx) % 2 === 0);
      }

      if (!isThisWeek) {
        summary.skipped_off_week++;
        continue;
      }
      summary.eligible_this_week++;

      // Bookings éligibles
      const cutoff48h = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
      const { data: eligibleBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, total_price, fady_commission_user, fady_commission_barber, booking_date, booking_time, funds_available_on, payout_status, stripe_payment_intent_id')
        .eq('hairdresser_id', hairdresser.id)
        .eq('status', 'completed')
        .eq('payout_status', 'pending')
        .lte('funds_available_on', now.toISOString().slice(0, 10));

      if (bookingsError) {
        summary.errors.push(`fetch bookings ${hairdresser.id}: ${bookingsError.message}`);
        continue;
      }

      // Filtrer celles dont le RDV est > 48h dans le passé
      const validBookings = (eligibleBookings ?? []).filter((b) => {
        if (!b.booking_date || !b.booking_time) return false;
        const dt = new Date(`${b.booking_date}T${b.booking_time}`);
        return dt.getTime() < (now.getTime() - 48 * 3600 * 1000);
      });

      if (validBookings.length === 0) {
        summary.skipped_no_bookings++;
        continue;
      }

      // Total à virer = total_price - frais user - commission barber
      let totalCents = 0;
      for (const b of validBookings) {
        const total = Number(b.total_price ?? 0);
        const userFee = Number(b.fady_commission_user ?? 0);
        const barberCommission = Number(b.fady_commission_barber ?? 0);
        totalCents += Math.round((total - userFee - barberCommission) * 100);
      }

      if (totalCents <= 0) {
        summary.skipped_no_bookings++;
        continue;
      }

      const totalEuros = round2(totalCents / 100);

      console.log(`💰 [Payouts] ${hairdresser.name} (${subType}): ${validBookings.length} bookings, ${totalEuros}€`);

      if (dry) {
        summary.processed++;
        summary.total_amount_eur += totalEuros;
        summary.payouts.push({
          hairdresser_id: hairdresser.id,
          name: hairdresser.name,
          subscription_type: subType,
          bookings_count: validBookings.length,
          amount: totalEuros,
          dry_run: true
        });
        continue;
      }

      const { data: existingLog } = await supabase
        .from('payout_logs')
        .select('id, stripe_transfer_id, payout_status')
        .eq('hairdresser_id', hairdresser.id)
        .gte('created_at', new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLog && existingLog.payout_status === 'paid') {
        console.log(`⚠️ [Payouts] Déjà un payout aujourd'hui pour ${hairdresser.name}, skip`);
        continue;
      }

      if (existingLog?.payout_status === 'pending' && existingLog.stripe_transfer_id) {
        summary.errors.push(`payout_log ${existingLog.id} pending avec transfer ${existingLog.stripe_transfer_id}: revue manuelle requise`);
        continue;
      }

      // Réutiliser seulement un log pending sans transfer. Un log failed/reversed doit laisser
      // un retry créer une nouvelle idempotency key Stripe.
      let payoutLogId: string | null =
        existingLog?.payout_status === 'pending' && !existingLog.stripe_transfer_id
          ? existingLog.id
          : null;
      if (!payoutLogId) {
        const { data: newLog, error: logError } = await supabase
          .from('payout_logs')
          .insert({
            hairdresser_id: hairdresser.id,
            amount: totalEuros,
            payout_status: 'pending',
            bookings_count: validBookings.length,
            date_virement: now.toISOString()
          })
          .select('id').single();
        if (logError) {
          summary.errors.push(`payout_log insert ${hairdresser.id}: ${logError.message}`);
          continue;
        }
        payoutLogId = newLog.id;
      }

      const idemKey = `payout_${hairdresser.id}_${isoNow.year}W${isoNow.week}_${payoutLogId}`;

      // Créer le transfer Stripe avec idempotency
      let transfer: Stripe.Transfer | null = null;
      try {
        transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: 'eur',
          destination: stripeAccount.stripe_account_id,
          metadata: {
            hairdresser_id: hairdresser.id,
            iso_week: `${isoNow.year}-W${isoNow.week}`,
            bookings_count: String(validBookings.length),
            payout_log_id: payoutLogId!,
            app: 'fady'
          }
        }, { idempotencyKey: idemKey });

        // Mettre à jour payout_log + bookings
        const { error: payoutUpdateError } = await supabase.from('payout_logs').update({
          payout_status: 'paid',
          stripe_transfer_id: transfer.id,
          updated_at: now.toISOString()
        }).eq('id', payoutLogId!);
        if (payoutUpdateError) {
          throw new Error(`payout_log update failed after transfer ${transfer.id}: ${payoutUpdateError.message}`);
        }

        const bookingIds = validBookings.map((b) => b.id);
        const { error: bookingsUpdateError } = await supabase.from('bookings').update({
          payout_status: 'paid',
          payout_logs_id: payoutLogId
        }).in('id', bookingIds);
        if (bookingsUpdateError) {
          throw new Error(`bookings update failed after transfer ${transfer.id}: ${bookingsUpdateError.message}`);
        }

        summary.processed++;
        summary.total_amount_eur += totalEuros;
        summary.payouts.push({
          hairdresser_id: hairdresser.id,
          name: hairdresser.name,
          subscription_type: subType,
          bookings_count: validBookings.length,
          amount: totalEuros,
          stripe_transfer_id: transfer.id,
          payout_log_id: payoutLogId
        });

        console.log(`✅ [Payouts] ${hairdresser.name}: transfer ${transfer.id} créé`);
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`❌ [Payouts] Transfer failed for ${hairdresser.name}:`, msg);

        if (transfer?.id) {
          try {
            await stripe.transfers.createReversal(transfer.id, {
              amount: totalCents,
              metadata: {
                hairdresser_id: hairdresser.id,
                payout_log_id: payoutLogId!,
                source: 'payout_db_update_failed',
                error: msg.slice(0, 450)
              }
            }, { idempotencyKey: `payout_failure_reversal_${payoutLogId}_${transfer.id}` });
            console.warn(`⚠️ [Payouts] Transfer ${transfer.id} reversé après échec DB`);
          } catch (reversalError) {
            const reversalMsg = (reversalError as Error).message;
            console.error(`❌ [Payouts] Reversal failed for transfer ${transfer.id}:`, reversalMsg);
            summary.errors.push(`reversal ${hairdresser.id}: ${reversalMsg}`);
          }
        }

        const failedUpdate: Record<string, string> = {
          payout_status: 'failed',
          updated_at: now.toISOString()
        };
        if (transfer?.id) failedUpdate.stripe_transfer_id = transfer.id;

        const { error: failedLogError } = await supabase.from('payout_logs').update(failedUpdate).eq('id', payoutLogId!);
        if (failedLogError) {
          summary.errors.push(`payout_log failed update ${hairdresser.id}: ${failedLogError.message}`);
        }
        summary.errors.push(`transfer ${hairdresser.id}: ${msg}`);
      }
    }

    console.log('🏦 [Payouts] Résumé:', summary);
    return new Response(JSON.stringify(summary), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ [Payouts] Erreur:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
