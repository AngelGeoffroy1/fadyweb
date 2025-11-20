import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RefundRequest {
  bookingId: string
  amount?: number // Montant en euros (optionnel, si non fourni = remboursement complet)
  commissionHandling: 'keep_platform_commission' | 'refund_all'
  reason?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Initialiser Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Vérifier que l'utilisateur est un admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Vérifier que l'utilisateur est bien un admin
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData) {
      throw new Error('User is not an admin')
    }

    // Parser le body de la requête
    const { bookingId, amount, commissionHandling, reason }: RefundRequest = await req.json()

    if (!bookingId || !commissionHandling) {
      throw new Error('Missing required fields: bookingId, commissionHandling')
    }

    // Récupérer les détails de la réservation
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        hairdressers:hairdresser_id (
          id,
          hairdresser_stripe_accounts (
            stripe_account_id
          )
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      throw new Error('Booking not found')
    }

    // Vérifications
    if (booking.payment_method !== 'card') {
      throw new Error('Only card payments can be refunded via Stripe')
    }

    if (!booking.stripe_payment_intent_id) {
      throw new Error('No Stripe payment intent found for this booking')
    }

    if (booking.status === 'refund') {
      throw new Error('This booking has already been refunded')
    }

    // Récupérer la subscription du coiffeur pour calculer la commission
    const { data: subscription } = await supabase
      .from('hairdresser_subscriptions')
      .select(`
        subscription_type,
        subscription_fees:subscription_type (
          commission_percentage
        )
      `)
      .eq('hairdresser_id', booking.hairdresser_id)
      .single()

    const commissionPercentage = subscription?.subscription_fees?.commission_percentage || 0

    // Calculer les montants
    const totalPrice = booking.total_price
    const refundAmount = amount || totalPrice // Si pas de montant spécifié, remboursement complet
    const amountInCents = Math.round(refundAmount * 100)

    // Calculer la répartition selon le choix de commission_handling
    let platformAmountKept = 0
    let hairdresserAmountReversed = 0

    if (commissionHandling === 'keep_platform_commission') {
      // La plateforme garde sa commission, on récupère seulement le payout net du coiffeur
      const commission = (refundAmount * commissionPercentage) / 100
      platformAmountKept = commission
      hairdresserAmountReversed = refundAmount - commission
    } else {
      // On rembourse tout, y compris la commission
      platformAmountKept = 0
      hairdresserAmountReversed = refundAmount
    }

    // Initialiser Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Créer le remboursement Stripe
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: amountInCents,
      reverse_transfer: commissionHandling === 'refund_all', // Reverse tout si on rembourse tout
      metadata: {
        booking_id: bookingId,
        commission_handling: commissionHandling,
        admin_id: adminData.id,
      },
    })

    // Si on garde la commission mais qu'on doit quand même récupérer des fonds du coiffeur
    // On doit faire un transfer reversal manuel
    if (commissionHandling === 'keep_platform_commission' && hairdresserAmountReversed > 0) {
      // Récupérer le transfer associé au paiement
      const transfers = await stripe.transfers.list({
        destination: booking.hairdressers?.hairdresser_stripe_accounts?.stripe_account_id,
        limit: 100,
      })

      // Trouver le transfer qui correspond à ce payment_intent
      const relatedTransfer = transfers.data.find(t =>
        t.source_transaction === booking.stripe_payment_intent_id ||
        t.metadata?.booking_id === bookingId
      )

      if (relatedTransfer) {
        // Reverse seulement la partie du coiffeur (sans la commission)
        await stripe.transferReversals.create(relatedTransfer.id, {
          amount: Math.round(hairdresserAmountReversed * 100),
          metadata: {
            booking_id: bookingId,
            refund_id: refund.id,
          },
        })
      }
    }

    // Créer l'entrée dans la table refunds
    const { data: refundRecord, error: refundInsertError } = await supabase
      .from('refunds')
      .insert({
        booking_id: bookingId,
        stripe_refund_id: refund.id,
        payment_intent_id: booking.stripe_payment_intent_id,
        amount: refundAmount,
        refund_type: amount && amount < totalPrice ? 'partial' : 'full',
        commission_handling: commissionHandling,
        platform_amount_kept: platformAmountKept,
        hairdresser_amount_reversed: hairdresserAmountReversed,
        reason: reason || null,
        status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
        admin_id: adminData.id,
      })
      .select()
      .single()

    if (refundInsertError) {
      console.error('Error inserting refund record:', refundInsertError)
      throw new Error('Failed to create refund record')
    }

    // Mettre à jour le statut de la réservation
    const { error: bookingUpdateError } = await supabase
      .from('bookings')
      .update({
        status: 'refund',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (bookingUpdateError) {
      console.error('Error updating booking status:', bookingUpdateError)
    }

    // Mettre à jour le statut du paiement Stripe si applicable
    const { error: paymentUpdateError } = await supabase
      .from('stripe_payments')
      .update({
        status: 'canceled',
      })
      .eq('stripe_payment_intent_id', booking.stripe_payment_intent_id)

    if (paymentUpdateError) {
      console.error('Error updating stripe_payments status:', paymentUpdateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refundAmount,
          platform_amount_kept: platformAmountKept,
          hairdresser_amount_reversed: hairdresserAmountReversed,
        },
        refundRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing refund:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while processing the refund',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
