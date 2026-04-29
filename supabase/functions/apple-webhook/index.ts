import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface AppleNotification {
  signedPayload: string;
}

interface DecodedPayload {
  notificationType: string;
  subtype?: string;
  data: {
    signedRenewalInfo?: string;
    signedTransactionInfo?: string;
  };
}

interface TransactionInfo {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
}

interface RenewalInfo {
  autoRenewStatus: number;
}

Deno.serve(async (req) => {
  console.log('🍎 [Apple Webhook] Notification reçue');

  try {
    const body = await req.json() as AppleNotification;
    const { signedPayload } = body;

    if (!signedPayload) {
      console.error('❌ [Apple Webhook] Pas de signedPayload');
      return new Response(
        JSON.stringify({ error: 'Missing signedPayload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 [Apple Webhook] Décodage du payload JWT...');

    const payload = decodeJWT(signedPayload) as DecodedPayload;
    console.log('📨 [Apple Webhook] Type:', payload.notificationType);
    if (payload.subtype) {
      console.log('📨 [Apple Webhook] Subtype:', payload.subtype);
    }

    let transactionInfo: TransactionInfo | null = null;
    let renewalInfo: RenewalInfo | null = null;

    if (payload.data.signedTransactionInfo) {
      transactionInfo = decodeJWT(payload.data.signedTransactionInfo) as TransactionInfo;
      console.log('📋 [Apple Webhook] Product ID:', transactionInfo.productId);
      console.log('📋 [Apple Webhook] Transaction ID:', transactionInfo.transactionId);
      console.log('📋 [Apple Webhook] Original Transaction ID:', transactionInfo.originalTransactionId);
    }

    if (payload.data.signedRenewalInfo) {
      renewalInfo = decodeJWT(payload.data.signedRenewalInfo) as RenewalInfo;
      console.log('🔄 [Apple Webhook] Auto-renew status:', renewalInfo.autoRenewStatus);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await handleNotification(
      payload.notificationType,
      payload.subtype,
      transactionInfo,
      renewalInfo,
      supabase
    );

    console.log('✅ [Apple Webhook] Notification traitée avec succès');
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Apple Webhook] Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function decodeJWT(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

async function handleNotification(
  notificationType: string,
  subtype: string | undefined,
  transactionInfo: TransactionInfo | null,
  renewalInfo: RenewalInfo | null,
  supabase: any
) {
  console.log(`🔄 [Handler] Traitement: ${notificationType}${subtype ? ` (${subtype})` : ''}`);

  if (!transactionInfo) {
    console.log('⚠️ [Handler] Pas d\'info de transaction, skip');
    return;
  }

  switch (notificationType) {
    case 'SUBSCRIBED':
      await handleSubscribed(transactionInfo, renewalInfo, supabase);
      break;
    case 'DID_RENEW':
      await handleDidRenew(transactionInfo, renewalInfo, supabase);
      break;
    case 'DID_CHANGE_RENEWAL_STATUS':
      await handleDidChangeRenewalStatus(transactionInfo, renewalInfo, supabase);
      break;
    case 'EXPIRED':
      await handleExpired(transactionInfo, supabase);
      break;
    case 'DID_FAIL_TO_RENEW':
      await handleDidFailToRenew(transactionInfo, supabase);
      break;
    case 'REFUND':
      await handleRefund(transactionInfo, supabase);
      break;
    case 'GRACE_PERIOD_EXPIRED':
      await handleGracePeriodExpired(transactionInfo, supabase);
      break;
    case 'PRICE_INCREASE':
      await handlePriceIncrease(transactionInfo, renewalInfo, supabase);
      break;
    default:
      console.log(`⚠️ [Handler] Type non géré: ${notificationType}`);
  }
}

function getSubscriptionType(productId: string): string {
  if (productId.includes('rookie') || productId.includes('amateur')) return 'rookie';
  if (productId.includes('boost')) return 'boost';
  return 'standard';
}

function getSubscriptionDisplayName(productId: string): string {
  const type = getSubscriptionType(productId);
  return type === 'rookie' ? 'Amateur' : type === 'boost' ? 'Boost' : 'Standard';
}

function timestampToISO(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Helper pour récupérer l'abonnement (prend le plus récent)
async function getSubscription(supabase: any, originalTransactionId: string) {
  const { data, error } = await supabase
    .from('hairdresser_subscriptions')
    .select('id, hairdresser_id, subscription_type, status, current_period_end, hairdressers(user_id, name)')
    .eq('apple_original_transaction_id', originalTransactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('❌ [getSubscription] Erreur:', error);
    return null;
  }

  console.log('✅ [getSubscription] Abonnement trouvé:', data.id);
  return data;
}

async function handleSubscribed(transaction: TransactionInfo, renewal: RenewalInfo | null, supabase: any) {
  console.log('🆕 [SUBSCRIBED] Nouvel abonnement');
  console.log('   Original Transaction ID:', transaction.originalTransactionId);

  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub) {
    console.log('ℹ️ [SUBSCRIBED] Abonnement trouvé pour hairdresser:', sub.hairdresser_id);
    
    await updateSubscription(transaction, renewal, supabase);
    
    if (sub.hairdressers?.user_id) {
      const planName = getSubscriptionDisplayName(transaction.productId);
      console.log(`🔔 [SUBSCRIBED] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
      await sendNotification(
        supabase,
        sub.hairdressers.user_id,
        `Abonnement ${planName} activé ! 🎉`,
        `Bienvenue dans le plan ${planName}. Profitez de tous vos avantages dès maintenant !`
      );
    } else {
      console.error('❌ [SUBSCRIBED] Pas de user_id dans hairdressers');
    }
  } else {
    console.log('⚠️ [SUBSCRIBED] Aucun abonnement trouvé');
  }
}

async function handleDidRenew(transaction: TransactionInfo, renewal: RenewalInfo | null, supabase: any) {
  console.log('🔄 [DID_RENEW] Renouvellement');
  await updateSubscription(transaction, renewal, supabase);

  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub?.hairdressers?.user_id) {
    const planName = getSubscriptionDisplayName(transaction.productId);
    const nextRenewal = sub.current_period_end ? formatDate(new Date(sub.current_period_end).getTime()) : '';
    console.log(`🔔 [DID_RENEW] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
    await sendNotification(
      supabase,
      sub.hairdressers.user_id,
      `Abonnement ${planName} renouvelé ✅`,
      `Votre abonnement a été renouvelé avec succès. Prochaine échéance : ${nextRenewal}`
    );
  }
}

async function handleDidChangeRenewalStatus(transaction: TransactionInfo, renewal: RenewalInfo | null, supabase: any) {
  console.log('🔄 [DID_CHANGE_RENEWAL_STATUS] Changement statut renouvellement');
  const willRenew = renewal?.autoRenewStatus === 1;
  console.log(`   → Auto-renew: ${willRenew ? 'OUI' : 'NON'}`);

  // Mettre à jour TOUS les abonnements actifs avec cet original_transaction_id
  const { error: updateError } = await supabase
    .from('hairdresser_subscriptions')
    .update({ cancel_at_period_end: !willRenew, updated_at: new Date().toISOString() })
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .eq('status', 'active');

  if (updateError) {
    console.error('❌ [DID_CHANGE_RENEWAL_STATUS] Erreur UPDATE:', updateError);
    return;
  }

  console.log('✅ [DID_CHANGE_RENEWAL_STATUS] Statut mis à jour');

  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub?.hairdressers?.user_id) {
    const planName = getSubscriptionDisplayName(transaction.productId);
    const endDate = sub.current_period_end ? formatDate(new Date(sub.current_period_end).getTime()) : '';
    console.log(`🔔 [DID_CHANGE_RENEWAL_STATUS] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
    
    if (willRenew) {
      await sendNotification(
        supabase, sub.hairdressers.user_id,
        'Abonnement réactivé 🔄',
        `Votre abonnement ${planName} a été réactivé et sera renouvelé automatiquement le ${endDate}.`
      );
    } else {
      await sendNotification(
        supabase, sub.hairdressers.user_id,
        'Annulation programmée ⏰',
        `Votre abonnement ${planName} sera annulé le ${endDate}. Vous conservez l'accès jusqu'à cette date.`
      );
    }
  }
}

async function handleExpired(transaction: TransactionInfo, supabase: any) {
  console.log('⏰ [EXPIRED] Abonnement expiré');
  console.log('   Original Transaction ID:', transaction.originalTransactionId);

  // Mettre à jour TOUS les abonnements actifs avec cet original_transaction_id
  const { error: updateError } = await supabase
    .from('hairdresser_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .eq('status', 'active');

  if (updateError) {
    console.error('❌ [EXPIRED] Erreur UPDATE:', updateError);
    return;
  }

  console.log('✅ [EXPIRED] Abonnement marqué comme canceled');

  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub?.hairdressers?.user_id) {
    const planName = getSubscriptionDisplayName(transaction.productId);
    console.log(`🔔 [EXPIRED] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
    await sendNotification(
      supabase,
      sub.hairdressers.user_id,
      'Abonnement expiré 📅',
      `Votre abonnement ${planName} a expiré. Renouvelez-le pour retrouver tous vos avantages !`
    );
  } else {
    console.error('❌ [EXPIRED] Pas de user_id trouvé');
  }
}

async function handleDidFailToRenew(transaction: TransactionInfo, supabase: any) {
  console.log('❌ [DID_FAIL_TO_RENEW] Échec du renouvellement');

  const { error } = await supabase
    .from('hairdresser_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .eq('status', 'active');

  if (error) {
    console.error('❌ [DID_FAIL_TO_RENEW] Erreur:', error);
  } else {
    console.log('✅ [DID_FAIL_TO_RENEW] Statut mis à jour');

    const sub = await getSubscription(supabase, transaction.originalTransactionId);

    if (sub?.hairdressers?.user_id) {
      const planName = getSubscriptionDisplayName(transaction.productId);
      console.log(`🔔 [DID_FAIL_TO_RENEW] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
      await sendNotification(
        supabase, sub.hairdressers.user_id,
        'Problème de paiement ⚠️',
        `Le renouvellement de votre abonnement ${planName} a échoué. Vérifiez votre moyen de paiement dans Réglages > [votre nom] > Paiement.`
      );
    }
  }
}

async function handleRefund(transaction: TransactionInfo, supabase: any) {
  console.log('💸 [REFUND] Remboursement');

  const { error } = await supabase
    .from('hairdresser_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .eq('status', 'active');

  if (error) {
    console.error('❌ [REFUND] Erreur:', error);
  } else {
    console.log('✅ [REFUND] Abonnement annulé suite au remboursement');

    const sub = await getSubscription(supabase, transaction.originalTransactionId);

    if (sub?.hairdressers?.user_id) {
      const planName = getSubscriptionDisplayName(transaction.productId);
      console.log(`🔔 [REFUND] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
      await sendNotification(
        supabase, sub.hairdressers.user_id,
        'Abonnement remboursé 💸',
        `Votre abonnement ${planName} a été annulé et remboursé. Le montant sera retourné sur votre compte sous quelques jours.`
      );
    }
  }
}

async function handleGracePeriodExpired(transaction: TransactionInfo, supabase: any) {
  console.log('⏰ [GRACE_PERIOD_EXPIRED] Période de grâce expirée');
  
  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub?.hairdressers?.user_id) {
    const planName = getSubscriptionDisplayName(transaction.productId);
    console.log(`🔔 [GRACE_PERIOD_EXPIRED] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
    await sendNotification(
      supabase, sub.hairdressers.user_id,
      'Période de grâce terminée ⏰',
      `Votre abonnement ${planName} va expirer. Mettez à jour votre moyen de paiement pour conserver vos avantages.`
    );
  }
  
  await handleExpired(transaction, supabase);
}

async function handlePriceIncrease(transaction: TransactionInfo, renewal: RenewalInfo | null, supabase: any) {
  console.log('💰 [PRICE_INCREASE] Augmentation de prix');

  const sub = await getSubscription(supabase, transaction.originalTransactionId);

  if (sub?.hairdressers?.user_id) {
    const planName = getSubscriptionDisplayName(transaction.productId);
    console.log(`🔔 [PRICE_INCREASE] Envoi notification à user_id: ${sub.hairdressers.user_id}`);
    await sendNotification(
      supabase, sub.hairdressers.user_id,
      'Nouveau prix d\'abonnement 💰',
      `Le prix de votre abonnement ${planName} a évolué. Le nouveau tarif sera appliqué au prochain renouvellement.`
    );
  }
}

async function updateSubscription(transaction: TransactionInfo, renewal: RenewalInfo | null, supabase: any) {
  const willRenew = renewal?.autoRenewStatus === 1;
  const expiresDate = transaction.expiresDate ? timestampToISO(transaction.expiresDate) : null;

  const updates: any = {
    apple_transaction_id: transaction.transactionId,
    status: 'active',
    current_period_start: timestampToISO(transaction.purchaseDate),
    current_period_end: expiresDate,
    expires_date: expiresDate,
    cancel_at_period_end: !willRenew,
    subscription_type: getSubscriptionType(transaction.productId),
    updated_at: new Date().toISOString()
  };

  // Mettre à jour l'abonnement le plus récent
  const { error } = await supabase
    .from('hairdresser_subscriptions')
    .update(updates)
    .eq('apple_original_transaction_id', transaction.originalTransactionId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ [Update] Erreur:', error);
  } else {
    console.log('✅ [Update] Abonnement mis à jour');
  }
}

async function sendNotification(supabase: any, userId: string, title: string, body: string) {
  try {
    console.log(`📨 [sendNotification] Préparation notification`);
    console.log(`   user_id: ${userId}`);
    console.log(`   title: ${title}`);
    console.log(`   body: ${body}`);
    
    const notificationUrl = `${supabaseUrl}/functions/v1/send-push-notification-fady-pro`;
    console.log(`   URL: ${notificationUrl}`);
    
    const response = await fetch(notificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ userId, title, body })
    });

    const responseText = await response.text();
    console.log(`   HTTP Status: ${response.status}`);
    console.log(`   Réponse:`, responseText);
    
    if (!response.ok) {
      console.error('❌ [Notification] Échec:', responseText);
    } else {
      console.log(`✅ [Notification] Envoyée avec succès`);
    }
  } catch (error) {
    console.error('❌ [Notification] Erreur exception:', error);
  }
}
