/**
 * Configuration centralisée pour les variables d'environnement
 * Ce fichier permet d'accéder aux variables d'environnement de manière sûre
 * dans les composants client Next.js
 */

// Configuration Supabase
// IMPORTANT: Next.js remplace ces variables à la compilation
// Elles doivent être accédées directement, pas via une variable dynamique
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Vérification au chargement du module
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Configuration Supabase manquante:', {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
  })
}

export const supabaseConfig = {
  url: SUPABASE_URL || '',
  anonKey: SUPABASE_ANON_KEY || '',
}

// URLs des Edge Functions
export const edgeFunctionUrls = {
  sendPushNotification: `${supabaseConfig.url}/functions/v1/send-push-notification`,
  sendPushNotificationFadyPro: `${supabaseConfig.url}/functions/v1/send-push-notification-fady-pro`,
  refundPayment: `${supabaseConfig.url}/functions/v1/refund-payment`,
}

// Log de vérification en développement
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('📋 Configuration chargée:', {
    supabaseUrl: supabaseConfig.url,
    edgeFunctions: {
      sendPushNotification: edgeFunctionUrls.sendPushNotification,
      sendPushNotificationFadyPro: edgeFunctionUrls.sendPushNotificationFadyPro,
      refundPayment: edgeFunctionUrls.refundPayment,
    }
  })
}
