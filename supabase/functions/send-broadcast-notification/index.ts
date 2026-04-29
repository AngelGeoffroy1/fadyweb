// Edge Function pour envoyer des notifications push broadcast via APNs
// Supporte l'envoi vers les clients (Fady App) et/ou les coiffeurs (Fady Pro)
// Supporte un filtrage optionnel par userIds pour cibler des utilisateurs spécifiques
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

// Configuration APNs - Fady App (clients)
const CLIENT_APNS_KEY_ID = Deno.env.get('APNS_KEY_ID');
const CLIENT_APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID');
const CLIENT_APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY');

// Configuration APNs - Fady Pro (coiffeurs)
const PRO_APNS_KEY_ID = Deno.env.get('FADYPRO_APNS_KEY_ID');
const PRO_APNS_BUNDLE_ID = Deno.env.get('FADYPRO_APNS_BUNDLE_ID');
const PRO_APNS_PRIVATE_KEY = Deno.env.get('FADYPRO_APNS_PRIVATE_KEY');

// Commun
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_PRODUCTION_URL = 'https://api.push.apple.com';
const APNS_SANDBOX_URL = 'https://api.sandbox.push.apple.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let supabaseClient: any = null;

serve(async (req) => {
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

    const { title, body, target, data, userIds } = await req.json();
    // target: 'all_clients' | 'all_hairdressers' | 'all'
    // userIds: optional string[] - if provided, only send to these specific user IDs

    if (!title || !body || !target) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, body, target' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['all_clients', 'all_hairdressers', 'all'].includes(target)) {
      return new Response(
        JSON.stringify({ error: 'Invalid target. Must be: all_clients, all_hairdressers, all' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasFilter = Array.isArray(userIds) && userIds.length > 0;
    console.log(`\ud83d\udce2 Broadcast notification request: target=${target}, title="${title}", filtered=${hasFilter}${hasFilter ? `, userIds count=${userIds.length}` : ''}`);

    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let totalSent = 0;
    let totalFailed = 0;
    let totalTokens = 0;

    // Envoyer aux clients si nécessaire
    if (target === 'all_clients' || target === 'all') {
      const clientUserIds = hasFilter ? userIds.filter((id: string) => id) : undefined;
      const clientResult = await sendToClients(title, body, data, clientUserIds);
      totalSent += clientResult.sent;
      totalFailed += clientResult.failed;
      totalTokens += clientResult.total;
      console.log(`\ud83d\udcf1 Clients: sent=${clientResult.sent}, failed=${clientResult.failed}, total=${clientResult.total}`);
    }

    // Envoyer aux coiffeurs si nécessaire
    if (target === 'all_hairdressers' || target === 'all') {
      const proUserIds = hasFilter ? userIds.filter((id: string) => id) : undefined;
      const proResult = await sendToHairdressers(title, body, data, proUserIds);
      totalSent += proResult.sent;
      totalFailed += proResult.failed;
      totalTokens += proResult.total;
      console.log(`\ud83d\udc88 Hairdressers: sent=${proResult.sent}, failed=${proResult.failed}, total=${proResult.total}`);
    }

    console.log(`\ud83d\udcca Broadcast results: sent=${totalSent}, failed=${totalFailed}, total=${totalTokens}`);

    return new Response(
      JSON.stringify({
        success: totalSent > 0,
        sent: totalSent,
        failed: totalFailed,
        total: totalTokens,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('\u274c Error in broadcast notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendToClients(title: string, body: string, data?: any, filterUserIds?: string[]) {
  let query = supabaseClient
    .from('user_device_tokens')
    .select('id, device_token, platform, user_id');

  if (filterUserIds && filterUserIds.length > 0) {
    query = query.in('user_id', filterUserIds);
  }

  const { data: tokens, error } = await query;

  if (error || !tokens) {
    console.error('\u274c Error fetching client tokens:', error);
    return { sent: 0, failed: 0, total: 0 };
  }

  console.log(`\ud83d\udcf1 Found ${tokens.length} client device tokens${filterUserIds ? ` (filtered to ${filterUserIds.length} users)` : ''}`);
  if (tokens.length === 0) return { sent: 0, failed: 0, total: 0 };

  const jwt = await createAPNsJWT(CLIENT_APNS_KEY_ID!, CLIENT_APNS_PRIVATE_KEY!);
  let sent = 0;
  let failed = 0;

  // Envoyer par batches de 50 pour éviter de surcharger
  const batchSize = 50;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((token: any) =>
        sendAPNsPush(
          token.device_token,
          title,
          body,
          data,
          jwt,
          CLIENT_APNS_BUNDLE_ID!,
          APNS_PRODUCTION_URL,
          'user_device_tokens',
          token.device_token
        )
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) sent++;
      else failed++;
    }
  }

  return { sent, failed, total: tokens.length };
}

async function sendToHairdressers(title: string, body: string, data?: any, filterUserIds?: string[]) {
  let query = supabaseClient
    .from('fady_pro_device_tokens')
    .select('id, device_token, platform, environment, user_id');

  if (filterUserIds && filterUserIds.length > 0) {
    query = query.in('user_id', filterUserIds);
  }

  const { data: tokens, error } = await query;

  if (error || !tokens) {
    console.error('\u274c Error fetching pro tokens:', error);
    return { sent: 0, failed: 0, total: 0 };
  }

  console.log(`\ud83d\udc88 Found ${tokens.length} pro device tokens${filterUserIds ? ` (filtered to ${filterUserIds.length} users)` : ''}`);
  if (tokens.length === 0) return { sent: 0, failed: 0, total: 0 };

  const jwt = await createAPNsJWT(PRO_APNS_KEY_ID!, PRO_APNS_PRIVATE_KEY!);
  let sent = 0;
  let failed = 0;

  const batchSize = 50;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((token: any) => {
        const env = token.environment || 'production';
        const apnsUrl = env === 'sandbox' ? APNS_SANDBOX_URL : APNS_PRODUCTION_URL;
        return sendAPNsPush(
          token.device_token,
          title,
          body,
          data,
          jwt,
          PRO_APNS_BUNDLE_ID!,
          apnsUrl,
          'fady_pro_device_tokens',
          token.device_token
        );
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) sent++;
      else failed++;
    }
  }

  return { sent, failed, total: tokens.length };
}

async function sendAPNsPush(
  deviceToken: string,
  title: string,
  body: string,
  data: any,
  jwt: string,
  bundleId: string,
  apnsUrl: string,
  tokenTable: string,
  tokenValue: string
): Promise<boolean> {
  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
      'mutable-content': 1,
    },
    ...(data || {}),
  };

  try {
    const response = await fetch(`${apnsUrl}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return true;

    const errorText = await response.text();
    console.error(`\u274c APNs error for ${deviceToken.substring(0, 15)}...: ${response.status} - ${errorText}`);

    // Supprimer les tokens invalides
    if (response.status === 400 || response.status === 410) {
      await supabaseClient
        .from(tokenTable)
        .delete()
        .eq('device_token', tokenValue);
      console.log(`\ud83d\uddd1\ufe0f Removed invalid token: ${deviceToken.substring(0, 15)}...`);
    }

    return false;
  } catch (err) {
    console.error(`\u274c Exception for ${deviceToken.substring(0, 15)}...:`, err);
    return false;
  }
}

async function createAPNsJWT(keyId: string, privateKeyPem: string): Promise<string> {
  if (!keyId || !APNS_TEAM_ID || !privateKeyPem) {
    throw new Error('Missing APNs configuration');
  }

  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: APNS_TEAM_ID, iat: getNumericDate(new Date()) };

  const base64Key = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const keyBuffer = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  return await create(header, payload, privateKey);
}
