// Edge Function pour envoyer des notifications push via APNs pour Fady Pro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

// Configuration APNs pour Fady Pro
const APNS_KEY_ID = Deno.env.get('FADYPRO_APNS_KEY_ID');
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_BUNDLE_ID = Deno.env.get('FADYPRO_APNS_BUNDLE_ID');
const APNS_PRIVATE_KEY = Deno.env.get('FADYPRO_APNS_PRIVATE_KEY');

// URLs APNs pour les deux environnements
const APNS_PRODUCTION_URL = 'https://api.push.apple.com';
const APNS_SANDBOX_URL = 'https://api.sandbox.push.apple.com';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Variable globale pour le client Supabase
let supabaseClient: any;

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📨 Received Fady Pro push notification request');
    
    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parser le body de la requête
    const { userId, title, body, data, badge } = await req.json();
    console.log('📋 Fady Pro request data:', { userId, title, body });

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Créer le client Supabase avec service_role pour bypasser RLS
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Récupérer les device tokens de l'utilisateur depuis la table Fady Pro
    const { data: deviceTokens, error: tokensError } = await supabaseClient
      .from('fady_pro_device_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'ios');

    if (tokensError) {
      console.error('❌ Error fetching Fady Pro device tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('❌ No Fady Pro device tokens found for user', userId);
      return new Response(
        JSON.stringify({ error: 'No device tokens found for user' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Found ${deviceTokens.length} Fady Pro device tokens for user ${userId}`);

    // Vérifier la configuration APNs pour Fady Pro
    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_PRIVATE_KEY) {
      console.error('❌ Missing Fady Pro APNs configuration');
      return new Response(
        JSON.stringify({
          error: 'Fady Pro APNs configuration missing',
          config: {
            FADYPRO_APNS_KEY_ID: !!APNS_KEY_ID,
            APNS_TEAM_ID: !!APNS_TEAM_ID,
            FADYPRO_APNS_BUNDLE_ID: !!APNS_BUNDLE_ID,
            FADYPRO_APNS_PRIVATE_KEY: !!APNS_PRIVATE_KEY,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Envoyer la notification à chaque device token
    const results = await Promise.allSettled(
      deviceTokens.map(async (token) => {
        // Utiliser l'environnement stocké avec le token (default: production)
        const environment = token.environment || 'production';
        console.log(`📱 Sending Fady Pro notification to device: ${token.device_token} (${environment})`);
        return await sendAPNsNotification(token.device_token, {
          title,
          body,
          data,
          badge,
        }, token.id, environment);
      })
    );

    // Compter les succès et échecs
    const successful = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected').length;

    console.log(`📊 Fady Pro push notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        total: deviceTokens.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error in Fady Pro send-push-notification function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function removeInvalidToken(tokenId: string, deviceToken: string) {
  try {
    console.log(`🗑️ Attempting to remove invalid token from database: ${deviceToken}`);
    
    // Utiliser une requête RPC ou SQL directe pour bypasser RLS de manière fiable
    const { data, error: deleteError } = await supabaseClient
      .from('fady_pro_device_tokens')
      .delete()
      .eq('id', tokenId)
      .select();
    
    if (deleteError) {
      console.error(`❌ Error deleting invalid token: ${deleteError.message}`);
      return false;
    }
    
    // Vérifier si une ligne a réellement été supprimée
    if (data && data.length > 0) {
      console.log(`✅ Invalid token successfully removed from database: ${deviceToken}`);
      return true;
    } else {
      console.warn(`⚠️ No token was deleted (token may not exist or RLS blocked deletion): ${deviceToken}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Exception while removing invalid token: ${error.message}`);
    return false;
  }
}

async function sendAPNsNotification(deviceToken: string, payload: any, tokenId: string, environment: string) {
  try {
    // Choisir l'URL APNs selon l'environnement du token
    const apnsUrl = environment === 'sandbox' ? APNS_SANDBOX_URL : APNS_PRODUCTION_URL;
    console.log(`🚀 Sending APNs notification to Fady Pro (${environment}): ${deviceToken}`);
    console.log(`🌐 APNs URL: ${apnsUrl}`);

    // Créer le JWT token pour l'authentification APNs
    const jwt = await createAPNsJWT();
    console.log('🔑 JWT created successfully for Fady Pro');

    // Construire le payload de la notification
    const notificationPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
        badge: payload.badge || 1,
        'content-available': 1,
      },
      ...payload.data,
    };

    console.log(`📦 Fady Pro notification payload:`, JSON.stringify(notificationPayload, null, 2));

    // Envoyer la requête à APNs
    const response = await fetch(`${apnsUrl}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'apns-topic': APNS_BUNDLE_ID!,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: JSON.stringify(notificationPayload),
    });

    console.log(`📡 APNs response status for Fady Pro: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ APNs request failed for Fady Pro: ${response.status} ${errorText}`);
      
      // Gérer les tokens invalides - les supprimer de la base de données
      if (response.status === 400 || response.status === 410) {
        try {
          const errorData = JSON.parse(errorText);
          // BadDeviceToken: token invalide, Unregistered: app désinstallée
          if (errorData.reason === 'BadDeviceToken' || errorData.reason === 'Unregistered') {
            await removeInvalidToken(tokenId, deviceToken);
          }
        } catch (parseError) {
          console.error(`❌ Error parsing APNs error response: ${parseError}`);
        }
      }
      
      throw new Error(`APNs request failed: ${response.status} ${errorText}`);
    }

    console.log(`✅ Fady Pro notification sent successfully to device: ${deviceToken}`);
    return { success: true, deviceToken };
  } catch (error) {
    console.error(`❌ Failed to send Fady Pro notification to device ${deviceToken}:`, error);
    throw error;
  }
}

async function createAPNsJWT() {
  try {
    console.log('🔐 Creating APNs JWT for Fady Pro...');

    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
      throw new Error('Missing Fady Pro APNs configuration. Please check your environment variables.');
    }

    const header = {
      alg: 'ES256',
      kid: APNS_KEY_ID,
    };

    const payload = {
      iss: APNS_TEAM_ID,
      iat: getNumericDate(new Date()),
    };

    console.log('📝 Fady Pro JWT Header:', header);

    const privateKeyPem = APNS_PRIVATE_KEY;

    const base64Key = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    console.log('🔑 Base64 key length:', base64Key.length);

    const keyBuffer = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    console.log('🔑 Private key imported successfully for Fady Pro');

    const jwt = await create(header, payload, privateKey);
    console.log('✅ JWT created successfully for Fady Pro');

    return jwt;
  } catch (error) {
    console.error('❌ Error creating Fady Pro APNs JWT:', error);
    throw new Error(`Failed to create JWT: ${error.message}`);
  }
}
